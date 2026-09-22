import type {
  BrowserDomPostconditionQuery,
  BrowserDomReadScope,
} from "../exact-target/browser-dom-intent.js";
import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import type { BrowserCoherentObservationResult } from "./dom-coherent-observation.js";
import {
  coherentCandidateMachineError as machineError,
  coherentCandidateMainFrameLoaderId as mainFrameLoaderId,
  coherentCandidateRecord as record,
  coherentPointerFromValue as pointerFromValue,
  coherentCandidateSetFailure,
  decodeObservationPointerPreparation,
  readCoherentCandidate as read,
} from "./dom-coherent-candidate-readback.js";
import { BROWSER_MECHANICAL_FACTS_READER_SOURCE } from "./dom-mechanical-facts.js";
import { BROWSER_EXACT_EDITABLE_TEXT_READER_SOURCE } from "./dom-exact-editable-text.js";
import { CANDIDATE_MISSING_STAGE_SOURCE } from "./dom-candidate-missing-stage.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";

type CandidateRequest = Readonly<{
  selector: string;
  clickPointSelector?: string;
  scope?: BrowserDomReadScope;
  text?: Readonly<{ value: string; exact: boolean }>;
  exactOutgoingTurn?: Readonly<{
    composerSelector: string;
    composerFormSelector: string;
    attachmentSelector: string;
    userTurnSelector: string;
    expectedPromptHash: `sha256:${string}`;
    expectedAttachmentLabels: readonly string[];
  }>;
}>;
export type BrowserPointerAction = Readonly<{ x: number; y: number }>;
export type BrowserRetainedPointerAction = BrowserPointerAction & Readonly<{ nodeId: number }>;
export type CoherentObservationPointerPreparation = Readonly<{
  kind: "postcondition";
  observation: BrowserCoherentObservationResult;
}> | Readonly<{
  kind: "pointer";
  point: BrowserPointerAction;
}>;

const COHERENT_CANDIDATE_FUNCTION = `async function (spec) {
  ${BROWSER_MECHANICAL_FACTS_READER_SOURCE}
  ${BROWSER_EXACT_EDITABLE_TEXT_READER_SOURCE}
  ${CANDIDATE_MISSING_STAGE_SOURCE}
  const sha256 = async (value) => {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return "sha256:" + Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0")).join("");
  };
  const mechanicallyEligible = (node) => {
    const facts = browserMechanicalFacts(node, false);
    return facts.connected && facts.layout && facts.visible && !facts.ariaHidden && !facts.inert;
  };
  const textEligible = (node) => {
    const text = node.textContent || "";
    return !spec.text || (spec.text.exact
      ? text.trim() === spec.text.value.trim() : text.includes(spec.text.value));
  };
  const scopeRaw = spec.scope
    ? Array.from(document.querySelectorAll(spec.scope.selector)) : [document.documentElement];
  if (scopeRaw.length > 256) return "BROWSER_DOM_READ_INVALID";
  const scopes = scopeRaw.filter(mechanicallyEligible);
  if (scopes.length !== 1) return scopes.length === 0
    ? candidateMissing(scopeRaw.length, 0, 0) : "BROWSER_DOM_CANDIDATE_AMBIGUOUS";
  const raw = Array.from(scopes[0].querySelectorAll(spec.selector));
  if (scopeRaw.length + raw.length > 256) return "BROWSER_DOM_READ_INVALID";
  const textCandidates = raw.filter(textEligible);
  const candidates = textCandidates.filter(mechanicallyEligible);
  if (candidates.length !== 1) return candidates.length === 0
    ? raw.length > 0 && textCandidates.length === 0
      ? "BROWSER_DOM_ACTION_NOT_QUALIFIED" : candidateMissing(scopeRaw.length, 1, raw.length)
    : "BROWSER_DOM_CANDIDATE_AMBIGUOUS";
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
  if (!spec.clickPointSelector && !facts.hitTest) return "BROWSER_DOM_ACTION_HIT_TEST_FAILED";
  const clickPoint = (() => {
    if (!spec.clickPointSelector) return {
      x: facts.bounds.x + facts.bounds.width / 2,
      y: facts.bounds.y + facts.bounds.height / 2
    };
    const markers = Array.from(candidate.querySelectorAll(spec.clickPointSelector));
    if (markers.length !== 1) return null;
    const markerFacts = browserMechanicalFacts(markers[0], false);
    if (!markerFacts || !markerFacts.visible) return null;
    const marker = markers[0].getBoundingClientRect();
    const x = marker.left + marker.width / 2;
    const y = marker.top + marker.height / 2;
    if (x < facts.bounds.x || x > facts.bounds.x + facts.bounds.width
      || y < facts.bounds.y || y > facts.bounds.y + facts.bounds.height
      || x < 0 || x >= globalThis.innerWidth || y < 0 || y >= globalThis.innerHeight) return null;
    const top = document.elementFromPoint(x, y);
    return top !== null && candidate.contains(top) ? { x, y } : null;
  })();
  if (clickPoint === null) return "BROWSER_DOM_ACTION_HIT_TEST_FAILED";
  if (spec.exactOutgoingTurn) {
    const outgoing = spec.exactOutgoingTurn;
    const composers = Array.from(document.querySelectorAll(outgoing.composerSelector));
    const forms = Array.from(document.querySelectorAll(outgoing.composerFormSelector));
    if (composers.length !== 1 || forms.length !== 1
      || !forms[0].contains(composers[0]) || !forms[0].contains(candidate)) {
      return "BROWSER_DOM_ACTION_OUTGOING_STRUCTURE_MISMATCH";
    }
    const editableText = browserExactEditableText(composers[0]);
    if (editableText === null || await sha256(editableText) !== outgoing.expectedPromptHash) {
      return "BROWSER_DOM_ACTION_OUTGOING_PROMPT_HASH_MISMATCH";
    }
    const expectedLabels = outgoing.expectedAttachmentLabels.map((label) => label.normalize("NFC")).sort();
    const providerDuplicateSuffix = /\\((?:\\d+|\\d{8}-\\d{6})\\)(?=(?:\\.[^./]+)?$)/u;
    const providerLabel = (label) => {
      const withoutProviderDuplicateSuffix = label.replace(providerDuplicateSuffix, "");
      return providerDuplicateSuffix.test(withoutProviderDuplicateSuffix) ? label : withoutProviderDuplicateSuffix;
    };
    const observedLabels = Array.from(forms[0].querySelectorAll(outgoing.attachmentSelector))
      .map((node) => (node.getAttribute("aria-label") || "").normalize("NFC")).map((label) => expectedLabels.includes(label) ? label : expectedLabels.includes(providerLabel(label)) ? providerLabel(label) : label).sort();
    if (JSON.stringify(observedLabels) !== JSON.stringify(expectedLabels)) {
      return "BROWSER_DOM_ACTION_OUTGOING_ATTACHMENT_SET_MISMATCH";
    }
  }
  return clickPoint;
}`;

const RETAINED_POINTER_FUNCTION = `function () {
  ${BROWSER_MECHANICAL_FACTS_READER_SOURCE}
  const candidate = this;
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
  ${CANDIDATE_MISSING_STAGE_SOURCE}
  const currentUrlValue = (() => {
    const observedUrl = new URL(location.href);
    const segments = observedUrl.pathname.split("/");
    const root = observedUrl.pathname === "/";
    const conversation = segments.length === 3 && segments[0] === "" && segments[1] === "c"
      && segments[2].length > 0 && segments[2].length <= 256;
    if (observedUrl.protocol !== "https:" || observedUrl.origin !== "https://chatgpt.com"
      || observedUrl.username !== "" || observedUrl.password !== "" || (!root && !conversation)
    ) {
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
    if (facts.inert) {
      reasons.push("INERT");
    }
    if (checkText && ((spec.textContains !== undefined && !(node.textContent || "").includes(spec.textContains))
      || (spec.textEquals !== undefined && (node.textContent || "").trim() !== spec.textEquals.trim()))) {
      reasons.push("TEXT_MISMATCH");
    }
    return reasons;
  };
  const fieldValue = (node, facts, field) => {
    if (field === "id") return node.getAttribute("id") || "";
    if (field === "dataTurn") {
      const user = node.querySelectorAll("[data-message-author-role='user']").length;
      const assistant = node.querySelectorAll("[data-message-author-role='assistant']").length;
      return user === 1 && assistant === 0 ? "user" : assistant === 1 && user === 0 ? "assistant" : "";
    }
    if (field === "tagName") return node.tagName;
    if (field === "ariaLabel") return node.getAttribute("aria-label") || "";
    if (field === "ariaLabelledBy") return node.getAttribute("aria-labelledby") || "";
    if (field === "ariaControls") return node.getAttribute("aria-controls") || "";
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
    if (spec.fields.includes("semanticTextHash") || spec.fields.includes("exactEditableTextHash")
      || spec.fields.includes("exactGptUserPromptHash")) throw new Error("BROWSER_DOM_READ_INVALID");
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
    ? candidateMissing(scopeRaw.length, 0, 0) : "BROWSER_DOM_CANDIDATE_AMBIGUOUS";
  const raw = Array.from(scopes[0].querySelectorAll(request.candidate.selector));
  observedCandidateCount += raw.length;
  if (observedCandidateCount > 256) return "BROWSER_DOM_READ_INVALID";
  const candidates = raw.filter(targetEligible);
  if (candidates.length !== 1) return candidates.length === 0
    ? candidateMissing(scopeRaw.length, 1, raw.length) : "BROWSER_DOM_CANDIDATE_AMBIGUOUS";
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
      awaitPromise: true, silent: true,
    })));
    if (call.exceptionDetails !== undefined) throw new Error("BROWSER_DOM_READ_INVALID");
    const result = record(call.result);
    const failure = coherentCandidateSetFailure(result.value);
    if (failure) throw failure;
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

export const resolveCoherentRetainedPointerAction = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  request: CandidateRequest,
): Promise<BrowserRetainedPointerAction> => {
  let candidateObjectId: string | null = null;
  let primaryFailure: unknown = null;
  try {
    const loaderBefore = await mainFrameLoaderId(runtime, target.tabId);
    const nodeId = await resolveCoherentMutationCandidate(runtime, target, request);
    const resolved = record(await read(() => runtime.send(
      target.tabId, "DOM.resolveNode", { nodeId },
    )));
    candidateObjectId = record(resolved.object).objectId as string;
    if (typeof candidateObjectId !== "string" || candidateObjectId.length === 0) {
      throw new Error("BROWSER_DOM_READ_INVALID");
    }
    const call = record(await read(() => runtime.send(target.tabId, "Runtime.callFunctionOn", {
      objectId: candidateObjectId,
      functionDeclaration: RETAINED_POINTER_FUNCTION,
      returnByValue: true,
      awaitPromise: false,
      silent: true,
    })));
    if (call.exceptionDetails !== undefined) throw new Error("BROWSER_DOM_READ_INVALID");
    const point = pointerFromValue(record(call.result).value);
    if (await mainFrameLoaderId(runtime, target.tabId) !== loaderBefore) {
      throw new Error("BROWSER_DOCUMENT_INVALID");
    }
    return Object.freeze({ ...point, nodeId });
  } catch (error) {
    primaryFailure = error;
    throw machineError(error);
  } finally {
    if (candidateObjectId !== null) try {
      await read(() => runtime.send(target.tabId, "Runtime.releaseObject", { objectId: candidateObjectId }));
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
      objectId: rootObjectId,
      functionDeclaration: COHERENT_CANDIDATE_FUNCTION,
      arguments: [{ value: { ...request, output: "pointer" } }], returnByValue: true,
      awaitPromise: true, silent: true,
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
