import type {
  BrowserDomPostconditionQuery,
  BrowserDomReadScope,
} from "../exact-target/browser-dom-intent.js";
import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import {
  bindCoherentObservationResult,
  type BrowserCoherentObservationResult,
} from "./dom-coherent-observation.js";
import { BROWSER_MECHANICAL_FACTS_READER_SOURCE } from "./dom-mechanical-facts.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";

type BrowserRecord = Record<string, unknown>;
type CandidateRequest = Readonly<{
  selector: string;
  scope?: BrowserDomReadScope;
  text?: Readonly<{ value: string; exact: boolean }>;
}>;
export type BrowserPointerAction = Readonly<{ x: number; y: number }>;
export type CoherentObservationPointerPreparation = Readonly<{
  kind: "postcondition";
  observation: BrowserCoherentObservationResult;
}> | Readonly<{
  kind: "pointer";
  point: BrowserPointerAction;
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

const COHERENT_OBSERVATION_POINTER_FUNCTION = `function (request) {
  ${BROWSER_MECHANICAL_FACTS_READER_SOURCE}
  const currentUrlValue = (() => {
    const observedUrl = new URL(location.href);
    const segments = observedUrl.pathname.split("/");
    const root = observedUrl.pathname === "/";
    const conversation = segments.length === 3 && segments[0] === "" && segments[1] === "c"
      && segments[2].length > 0 && segments[2].length <= 256;
    if (observedUrl.protocol !== "https:" || observedUrl.origin !== "https://chatgpt.com"
      || observedUrl.username !== "" || observedUrl.password !== "" || (!root && !conversation)
      || observedUrl.search !== "" || observedUrl.hash !== "") {
      throw new Error("BROWSER_DOM_READ_INVALID");
    }
    return observedUrl.origin + observedUrl.pathname;
  })();
  const eligibilityReasons = (node, facts, spec, checkText) => {
    const reasons = [];
    if (!facts.connected) reasons.push("DISCONNECTED");
    if (!facts.layout) reasons.push("NO_LAYOUT_BOX");
    if (facts.displayHidden) reasons.push("DISPLAY_HIDDEN");
    if (facts.visibilityHidden) reasons.push("VISIBILITY_HIDDEN");
    if (facts.opacityHidden) reasons.push("OPACITY_HIDDEN");
    if (facts.hidden) reasons.push("HTML_HIDDEN");
    if (facts.ariaHidden && !(checkText && spec.readEligibility === "non-actionable-aria-state")) {
      reasons.push("ARIA_HIDDEN");
    }
    if (facts.inert) reasons.push("INERT");
    if (checkText && ((spec.textContains !== undefined && !(node.textContent || "").includes(spec.textContains))
      || (spec.textEquals !== undefined && (node.textContent || "").trim() !== spec.textEquals.trim()))) {
      reasons.push("TEXT_MISMATCH");
    }
    return reasons;
  };
  const fieldValue = (node, facts, field) => {
    if (field === "id") return node.getAttribute("id") || "";
    if (field === "dataTurn") return node.getAttribute("data-turn") || "";
    if (field === "tagName") return node.tagName;
    if (field === "ariaLabel") return node.getAttribute("aria-label") || "";
    if (field === "ariaExpanded") return node.getAttribute("aria-expanded") || "";
    if (field === "ariaChecked") return node.getAttribute("aria-checked") || "";
    if (field === "ariaValueMin") return node.getAttribute("aria-valuemin") || "";
    if (field === "ariaValueMax") return node.getAttribute("aria-valuemax") || "";
    if (field === "ariaValueNow") return node.getAttribute("aria-valuenow") || "";
    if (field === "accept") return node.getAttribute("accept") || "";
    if (field === "multiple") return node.hasAttribute("multiple");
    return facts[field];
  };
  const rejected = (observed, spec, checkText) => observed
    .map(({ node, facts, candidateIndex }) => ({
      index: candidateIndex, reasons: eligibilityReasons(node, facts, spec, checkText)
    }))
    .filter(({ reasons }) => reasons.length > 0);
  let observedCandidateCount = 0;
  const observeNodes = (nodes) => {
    observedCandidateCount += nodes.length;
    if (observedCandidateCount > 256) throw new Error("BROWSER_DOM_READ_INVALID");
    return nodes.map((node, candidateIndex) => ({
      node, candidateIndex, facts: browserMechanicalFacts(node, false)
    }));
  };
  const queries = request.postcondition.queries.map((spec) => {
    if (spec.fields.includes("semanticTextHash")) throw new Error("BROWSER_DOM_READ_INVALID");
    const scopeRaw = spec.scope ? Array.from(document.querySelectorAll(spec.scope.selector))
      : [document.documentElement];
    const scopeObserved = observeNodes(scopeRaw);
    const scopeRejections = spec.scope ? rejected(scopeObserved, spec, false) : [];
    const scopeEligible = spec.scope
      ? scopeObserved.filter(({ node, facts }) => eligibilityReasons(node, facts, spec, false).length === 0)
      : scopeObserved;
    if (scopeEligible.length !== 1) return {
      queryId: spec.queryId, scopeRawCount: scopeRaw.length, scopeEligibleCount: scopeEligible.length,
      rawCount: 0, eligibleCount: 0, matches: [], scopeRejections, rejections: [], nativeCauseCode: null,
      nativeCauseCount: 0, nativeStage: "runtime-call-function-on"
    };
    const raw = Array.from(scopeEligible[0].node.querySelectorAll(spec.selector));
    const observed = observeNodes(raw);
    const eligible = observed.filter(({ node, facts }) =>
      eligibilityReasons(node, facts, spec, true).length === 0);
    const noLayoutCount = observed.filter(({ facts }) => facts.nativeCauseCode === "NO_LAYOUT_BOX").length;
    return {
      queryId: spec.queryId, scopeRawCount: scopeRaw.length, scopeEligibleCount: scopeEligible.length,
      rawCount: raw.length, eligibleCount: eligible.length,
      matches: eligible.slice(0, spec.maxMatches + 1).map(({ node, facts, candidateIndex }) => ({
        candidateIndex,
        ...Object.fromEntries(spec.fields.map((field) => [field, fieldValue(node, facts, field)]))
      })),
      scopeRejections, rejections: rejected(observed, spec, true),
      nativeCauseCode: noLayoutCount > 0 ? "NO_LAYOUT_BOX" : null,
      nativeCauseCount: noLayoutCount, nativeStage: "runtime-call-function-on"
    };
  });
  const observation = {
    currentUrl: currentUrlValue, observedAt: new Date().toISOString(), queries
  };
  const postconditionSatisfied = queries.every((query, index) =>
    query.eligibleCount === request.postcondition.queries[index].expectedEligibleCount);
  if (postconditionSatisfied) return { kind: "postcondition", observation };
  const mechanicallyEligible = (node) => {
    const facts = browserMechanicalFacts(node, false);
    return facts.connected && facts.layout && facts.visible && !facts.ariaHidden && !facts.inert;
  };
  const targetEligible = (node) => {
    if (!mechanicallyEligible(node)) return false;
    const text = node.textContent || "";
    return !request.candidate.text || (request.candidate.text.exact
      ? text.trim() === request.candidate.text.value.trim()
      : text.includes(request.candidate.text.value));
  };
  const scopeRaw = request.candidate.scope
    ? Array.from(document.querySelectorAll(request.candidate.scope.selector)) : [document.documentElement];
  const scopes = scopeRaw.filter(mechanicallyEligible);
  observedCandidateCount += scopeRaw.length;
  if (observedCandidateCount > 256) return "BROWSER_DOM_READ_INVALID";
  if (scopes.length !== 1) return scopes.length === 0
    ? "BROWSER_DOM_CANDIDATE_MISSING" : "BROWSER_DOM_CANDIDATE_AMBIGUOUS";
  const raw = Array.from(scopes[0].querySelectorAll(request.candidate.selector));
  observedCandidateCount += raw.length;
  if (observedCandidateCount > 256) return "BROWSER_DOM_READ_INVALID";
  const candidates = raw.filter(targetEligible);
  if (candidates.length !== 1) return candidates.length === 0
    ? "BROWSER_DOM_CANDIDATE_MISSING" : "BROWSER_DOM_CANDIDATE_AMBIGUOUS";
  const candidate = candidates[0];
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
  return { kind: "pointer", point: {
    x: facts.bounds.x + facts.bounds.width / 2,
    y: facts.bounds.y + facts.bounds.height / 2
  } };
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

const pointerFromValue = (value: unknown): BrowserPointerAction => {
  if (typeof value === "string" && (/^BROWSER_DOM_(?:CANDIDATE_MISSING|CANDIDATE_AMBIGUOUS|READ_INVALID)$/u.test(value)
    || pointerActionCode(value))) throw new Error(value);
  const point = record(value);
  if (typeof point.x !== "number" || !Number.isFinite(point.x)
    || typeof point.y !== "number" || !Number.isFinite(point.y)) {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  return Object.freeze({ x: point.x, y: point.y });
};

const bindSatisfiedObservation = async (
  value: unknown,
  target: ExtensionExactTarget,
  postcondition: Readonly<{ queries: readonly BrowserDomPostconditionQuery[] }>,
): Promise<BrowserCoherentObservationResult> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  const specs = postcondition.queries.map(({ expectedEligibleCount: _expected, ...query }) => query);
  const observation = await bindCoherentObservationResult(value, target, specs);
  const satisfied = observation.queries.every((query, index) =>
    query.eligibleCount === postcondition.queries[index]!.expectedEligibleCount);
  if (!satisfied) throw new Error("BROWSER_DOM_READ_INVALID");
  return observation;
};

const decodeObservationPointerPreparation = async (
  value: unknown,
  target: ExtensionExactTarget,
  postcondition: Readonly<{ queries: readonly BrowserDomPostconditionQuery[] }>,
): Promise<CoherentObservationPointerPreparation> => {
  if (typeof value === "string" && (/^BROWSER_DOM_(?:CANDIDATE_MISSING|CANDIDATE_AMBIGUOUS|READ_INVALID)$/u.test(value)
    || pointerActionCode(value))) throw new Error(value);
  const reply = record(value);
  if ((reply.kind !== "postcondition" && reply.kind !== "pointer") || Object.keys(reply).length !== 2) {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  if (reply.kind === "postcondition") return Object.freeze({
    kind: "postcondition",
    observation: await bindSatisfiedObservation(reply.observation, target, postcondition),
  });
  return Object.freeze({ kind: "pointer", point: pointerFromValue(reply.point) });
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
    const point = pointerFromValue(record(call.result).value);
    if (await mainFrameLoaderId(runtime, target.tabId) !== loaderBefore) {
      throw new Error("BROWSER_DOCUMENT_INVALID");
    }
    return point;
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

export const resolveCoherentObservationPointerAction = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  candidate: CandidateRequest,
  postcondition: Readonly<{ queries: readonly BrowserDomPostconditionQuery[] }>,
): Promise<CoherentObservationPointerPreparation> => {
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
      objectId: rootObjectId, functionDeclaration: COHERENT_OBSERVATION_POINTER_FUNCTION,
      arguments: [{ value: { candidate, postcondition } }], returnByValue: true,
      awaitPromise: false, silent: true,
    })));
    if (call.exceptionDetails !== undefined) throw new Error("BROWSER_DOM_READ_INVALID");
    if (await mainFrameLoaderId(runtime, target.tabId) !== loaderBefore) {
      throw new Error("BROWSER_DOCUMENT_INVALID");
    }
    return await decodeObservationPointerPreparation(record(call.result).value, target, postcondition);
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
