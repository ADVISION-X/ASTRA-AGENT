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
  return candidates[0];
}`;

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
      arguments: [{ value: request }], returnByValue: false, awaitPromise: false, silent: true,
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
