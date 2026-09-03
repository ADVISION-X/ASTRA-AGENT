import type { BrowserDomReadScope } from "../exact-target/browser-dom-intent.js";
import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import { BROWSER_MECHANICAL_FACTS_READER_SOURCE } from "./dom-mechanical-facts.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";

type BrowserRecord = Record<string, unknown>;
type CandidateRequest = Readonly<{
  selector: string;
  scope?: BrowserDomReadScope;
  text?: Readonly<{ value: string; exact: boolean }>;
}>;
export type BrowserPointerAction = Readonly<{ x: number; y: number }>;

const COHERENT_CANDIDATE_FUNCTION = `function (spec) {
  ${BROWSER_MECHANICAL_FACTS_READER_SOURCE}
  const mechanicallyEligible = (node) => {
    const facts = browserMechanicalFacts(node, false);
    return facts.connected && facts.layout && facts.visible && !facts.ariaHidden && !facts.inert;
  };
  const targetEligible = (node) => {
    if (!mechanicallyEligible(node)) return false;
    const text = node.textContent || "";
    return !spec.text || (spec.text.exact
      ? text.trim() === spec.text.value.trim() : text.includes(spec.text.value));
  };
  const scopeRaw = spec.scope
    ? Array.from(document.querySelectorAll(spec.scope.selector)) : [document.documentElement];
  if (scopeRaw.length > 256) return "BROWSER_DOM_READ_INVALID";
  const scopes = scopeRaw.filter(mechanicallyEligible);
  if (scopes.length !== 1) return scopes.length === 0
    ? "BROWSER_DOM_CANDIDATE_MISSING" : "BROWSER_DOM_CANDIDATE_AMBIGUOUS";
  const raw = Array.from(scopes[0].querySelectorAll(spec.selector));
  if (scopeRaw.length + raw.length > 256) return "BROWSER_DOM_READ_INVALID";
  const candidates = raw.filter(targetEligible);
  if (candidates.length !== 1) return candidates.length === 0
    ? "BROWSER_DOM_CANDIDATE_MISSING" : "BROWSER_DOM_CANDIDATE_AMBIGUOUS";
  const candidate = candidates[0];
  if (spec.output !== "pointer") return candidate;
  const facts = browserMechanicalFacts(candidate, true);
  if (!facts.connected) return "BROWSER_DOM_ACTION_NODE_DISCONNECTED";
  if (!facts.layout || facts.bounds === null) return "BROWSER_DOM_ACTION_NO_LAYOUT_BOX";
  if (!facts.visible) return "BROWSER_DOM_ACTION_NOT_VISIBLE";
  if (facts.ariaHidden) return "BROWSER_DOM_ACTION_ARIA_HIDDEN";
  if (facts.inert) return "BROWSER_DOM_ACTION_INERT";
  if (facts.disabled) return "BROWSER_DOM_ACTION_DISABLED";
  if (facts.ariaDisabled) return "BROWSER_DOM_ACTION_ARIA_DISABLED";
  if (!facts.viewport) return "BROWSER_DOM_ACTION_OUTSIDE_VIEWPORT";
  if (globalThis.getComputedStyle(candidate).pointerEvents === "none") {
    return "BROWSER_DOM_ACTION_POINTER_EVENTS_NONE";
  }
  if (!facts.hitTest) return "BROWSER_DOM_ACTION_HIT_TEST_FAILED";
  return {
    x: facts.bounds.x + facts.bounds.width / 2,
    y: facts.bounds.y + facts.bounds.height / 2
  };
}`;

const pointerActionCode = (value: unknown): value is string => typeof value === "string"
  && /^BROWSER_DOM_ACTION_(?:NODE_DISCONNECTED|NO_LAYOUT_BOX|NOT_VISIBLE|ARIA_HIDDEN|INERT|DISABLED|ARIA_DISABLED|OUTSIDE_VIEWPORT|POINTER_EVENTS_NONE|HIT_TEST_FAILED)$/u.test(value);

const record = (value: unknown): BrowserRecord => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  return value as BrowserRecord;
};

const machineError = (error: unknown): Error => {
  if (error instanceof Error && /^BROWSER_[A-Z_]+$/u.test(error.message)) return error;
  const stale = error instanceof Error
    && /(?:could not find node|no node with given id|node.*(?:detached|does not exist|not found))/iu.test(error.message);
  return new Error(stale ? "BROWSER_DOM_NODE_STALE" : "BROWSER_DOM_READ_INVALID", { cause: error });
};

const read = async <T>(operation: () => Promise<T>): Promise<T> => {
  try { return await operation(); }
  catch (error) { throw machineError(error); }
};

const mainFrameLoaderId = async (
  runtime: ExtensionDebuggerRuntime,
  tabId: number,
): Promise<string> => {
  const tree = record(await read(() => runtime.send(tabId, "Page.getFrameTree")));
  const frame = record(record(tree.frameTree).frame);
  if (typeof frame.loaderId !== "string" || frame.loaderId.length === 0) {
    throw new Error("BROWSER_DOCUMENT_INVALID");
  }
  return frame.loaderId;
};

export const resolveCoherentMutationCandidate = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  request: CandidateRequest,
): Promise<number> => {
  const objectIds = new Set<string>();
  let primaryFailure: unknown = null;
  try {
    const loaderBefore = await mainFrameLoaderId(runtime, target.tabId);
    const document = record(await read(() => runtime.send(
      target.tabId, "DOM.getDocument", { depth: 0, pierce: true },
    )));
    const nodeId = record(document.root).nodeId;
    if (!Number.isSafeInteger(nodeId)) throw new Error("BROWSER_DOM_READ_INVALID");
    const resolved = record(await read(() => runtime.send(target.tabId, "DOM.resolveNode", { nodeId })));
    const rootObjectId = record(resolved.object).objectId;
    if (typeof rootObjectId !== "string" || rootObjectId.length === 0) {
      throw new Error("BROWSER_DOM_READ_INVALID");
    }
    objectIds.add(rootObjectId);
    const call = record(await read(() => runtime.send(target.tabId, "Runtime.callFunctionOn", {
      objectId: rootObjectId, functionDeclaration: COHERENT_CANDIDATE_FUNCTION,
      arguments: [{ value: { ...request, output: "node" } }], returnByValue: false,
      awaitPromise: false, silent: true,
    })));
    if (call.exceptionDetails !== undefined) throw new Error("BROWSER_DOM_READ_INVALID");
    const result = record(call.result);
    if (result.type === "string" && typeof result.value === "string"
      && /^BROWSER_DOM_(?:CANDIDATE_MISSING|CANDIDATE_AMBIGUOUS|READ_INVALID)$/u.test(result.value)) {
      throw new Error(result.value);
    }
    if (result.subtype !== "node" || typeof result.objectId !== "string") {
      throw new Error("BROWSER_DOM_READ_INVALID");
    }
    objectIds.add(result.objectId);
    const requested = record(await read(() => runtime.send(
      target.tabId, "DOM.requestNode", { objectId: result.objectId },
    )));
    if (await mainFrameLoaderId(runtime, target.tabId) !== loaderBefore) {
      throw new Error("BROWSER_DOCUMENT_INVALID");
    }
    if (!Number.isSafeInteger(requested.nodeId)) throw new Error("BROWSER_DOM_READ_INVALID");
    return requested.nodeId as number;
  } catch (error) {
    primaryFailure = error;
    throw machineError(error);
  } finally {
    for (const objectId of objectIds) try {
      await read(() => runtime.send(target.tabId, "Runtime.releaseObject", { objectId }));
    } catch (error) {
      if (primaryFailure === null) throw machineError(error);
    }
  }
};

export const resolveCoherentPointerAction = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  request: CandidateRequest,
): Promise<BrowserPointerAction> => {
  let rootObjectId: string | null = null;
  let primaryFailure: unknown = null;
  try {
    const loaderBefore = await mainFrameLoaderId(runtime, target.tabId);
    const document = record(await read(() => runtime.send(
      target.tabId, "DOM.getDocument", { depth: 0, pierce: true },
    )));
    const nodeId = record(document.root).nodeId;
    if (!Number.isSafeInteger(nodeId)) throw new Error("BROWSER_DOM_READ_INVALID");
    const resolved = record(await read(() => runtime.send(target.tabId, "DOM.resolveNode", { nodeId })));
    rootObjectId = record(resolved.object).objectId as string;
    if (typeof rootObjectId !== "string" || rootObjectId.length === 0) {
      throw new Error("BROWSER_DOM_READ_INVALID");
    }
    const call = record(await read(() => runtime.send(target.tabId, "Runtime.callFunctionOn", {
      objectId: rootObjectId, functionDeclaration: COHERENT_CANDIDATE_FUNCTION,
      arguments: [{ value: { ...request, output: "pointer" } }], returnByValue: true,
      awaitPromise: false, silent: true,
    })));
    if (call.exceptionDetails !== undefined) throw new Error("BROWSER_DOM_READ_INVALID");
    const value = record(call.result).value;
    if (typeof value === "string" && (/^BROWSER_DOM_(?:CANDIDATE_MISSING|CANDIDATE_AMBIGUOUS|READ_INVALID)$/u.test(value)
      || pointerActionCode(value))) throw new Error(value);
    const point = record(value);
    if (await mainFrameLoaderId(runtime, target.tabId) !== loaderBefore) {
      throw new Error("BROWSER_DOCUMENT_INVALID");
    }
    if (typeof point.x !== "number" || !Number.isFinite(point.x)
      || typeof point.y !== "number" || !Number.isFinite(point.y)) {
      throw new Error("BROWSER_DOM_READ_INVALID");
    }
    return Object.freeze({ x: point.x, y: point.y });
  } catch (error) {
    primaryFailure = error;
    throw machineError(error);
  } finally {
    if (rootObjectId !== null) try {
      await read(() => runtime.send(target.tabId, "Runtime.releaseObject", { objectId: rootObjectId }));
    } catch (error) {
      if (primaryFailure === null) throw machineError(error);
    }
  }
};
