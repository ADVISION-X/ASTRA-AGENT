import {
  type BrowserDomIneligibleCandidate,
  type BrowserDomIneligibleReason,
  type BrowserDomObservationField,
  type BrowserDomObservationQuery,
} from "../exact-target/browser-dom-intent.js";
import { canonicalizeBrowserAuthorityValue } from "../transport/browser-authority-frame-codec.js";
import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import { BROWSER_MECHANICAL_FACTS_READER_SOURCE } from "./dom-mechanical-facts.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";

type BrowserRecord = Record<string, unknown>;
type CoherentObservationResult = Readonly<{
  schemaVersion: "grasseye.browser.dom-observation.v1";
  targetRefHash: `sha256:${string}`;
  documentRefHash: `sha256:${string}`;
  observationRevisionHash: `sha256:${string}`;
  observedAt: string;
  queries: readonly Readonly<Record<string, unknown>>[];
}>;

const COHERENT_OBSERVATION_FUNCTION = `function (specs) {
  ${BROWSER_MECHANICAL_FACTS_READER_SOURCE}
  const fieldValue = (node, facts, field) => {
    if (field === "id") return node.getAttribute("id") || "";
    if (field === "dataTurn") return node.getAttribute("data-turn") || "";
    if (field === "tagName") return node.tagName;
    if (field === "ariaLabel") return node.getAttribute("aria-label") || "";
    if (field === "ariaExpanded") return node.getAttribute("aria-expanded") || "";
    if (field === "ariaChecked") return node.getAttribute("aria-checked") || "";
    if (field === "accept") return node.getAttribute("accept") || "";
    if (field === "multiple") return node.hasAttribute("multiple");
    return facts[field];
  };
  const eligibilityReasons = (node, facts, spec, checkText) => {
    const reasons = [];
    if (!facts.connected) reasons.push("DISCONNECTED");
    if (!facts.layout) reasons.push("NO_LAYOUT_BOX");
    if (facts.displayHidden) reasons.push("DISPLAY_HIDDEN");
    if (facts.visibilityHidden) reasons.push("VISIBILITY_HIDDEN");
    if (facts.opacityHidden) reasons.push("OPACITY_HIDDEN");
    if (facts.hidden) reasons.push("HTML_HIDDEN");
    if (facts.ariaHidden) reasons.push("ARIA_HIDDEN");
    if (facts.inert) reasons.push("INERT");
    if (checkText && ((spec.textContains !== undefined && !(node.textContent || "").includes(spec.textContains))
      || (spec.textEquals !== undefined && (node.textContent || "").trim() !== spec.textEquals.trim()))) {
      reasons.push("TEXT_MISMATCH");
    }
    return reasons;
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
  const observeQuery = (spec) => {
    const scopeRaw = spec.scope ? Array.from(document.querySelectorAll(spec.scope.selector)) : [document.documentElement];
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
    const eligible = observed.filter(({ node, facts }) => eligibilityReasons(node, facts, spec, true).length === 0);
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
  };
  return { observedAt: new Date().toISOString(), queries: specs.map(observeQuery) };
}`;

const sha256Text = async (value: string): Promise<`sha256:${string}`> => {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
};

const observationRecord = (value: unknown): BrowserRecord => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("BROWSER_DOM_READ_INVALID");
  return value as BrowserRecord;
};

const observationCount = (value: unknown): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error("BROWSER_DOM_READ_INVALID");
  return value as number;
};

const stringObservationFields = new Set<BrowserDomObservationField>([
  "id", "testId", "dataTurn", "tagName", "type", "role", "name", "label", "ariaLabel",
  "ariaExpanded", "ariaChecked", "value", "accept", "computedDisplay", "computedVisibility",
  "computedOpacity", "effectiveOpacity",
]);
const booleanObservationFields = new Set<BrowserDomObservationField>([
  "multiple", "connected", "layout", "visible", "hidden", "ariaHidden", "inert", "disabled",
  "ariaDisabled",
]);

const observationFieldValid = (field: BrowserDomObservationField, value: unknown): boolean => {
  if (stringObservationFields.has(field)) return typeof value === "string";
  if (booleanObservationFields.has(field)) return typeof value === "boolean";
  if (field === "checked") return value === null || typeof value === "boolean";
  return false;
};

const OBSERVATION_ROW_KEYS = new Set(["queryId", "scopeRawCount", "scopeEligibleCount", "rawCount",
  "eligibleCount", "matches", "scopeRejections", "rejections", "nativeCauseCode",
  "nativeCauseCount", "nativeStage"]);

const INELIGIBLE_REASONS = new Set<BrowserDomIneligibleReason>([
  "DISCONNECTED", "NO_LAYOUT_BOX", "DISPLAY_HIDDEN", "VISIBILITY_HIDDEN", "OPACITY_HIDDEN",
  "HTML_HIDDEN", "ARIA_HIDDEN", "INERT", "TEXT_MISMATCH",
]);

const decodeRejections = (
  value: unknown,
  rawCount: number,
  eligibleCount: number,
): readonly BrowserDomIneligibleCandidate[] => {
  if (!Array.isArray(value) || value.length !== rawCount - eligibleCount) {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  const indices = new Set<number>();
  return Object.freeze(value.map((entryValue) => {
    const entry = observationRecord(entryValue);
    if (Object.keys(entry).length !== 2 || !Number.isSafeInteger(entry.index)
      || (entry.index as number) < 0 || (entry.index as number) >= rawCount
      || indices.has(entry.index as number) || !Array.isArray(entry.reasons)
      || entry.reasons.length < 1 || new Set(entry.reasons).size !== entry.reasons.length
      || entry.reasons.some((reason) => typeof reason !== "string"
        || !INELIGIBLE_REASONS.has(reason as BrowserDomIneligibleReason))) {
      throw new Error("BROWSER_DOM_READ_INVALID");
    }
    indices.add(entry.index as number);
    return Object.freeze({
      index: entry.index as number,
      reasons: Object.freeze([...(entry.reasons as BrowserDomIneligibleReason[])]),
    });
  }));
};

const decodeObservationRow = (
  value: unknown,
  spec: BrowserDomObservationQuery,
): Readonly<Record<string, unknown>> => {
  const row = observationRecord(value);
  const scopeRaw = observationCount(row.scopeRawCount);
  const scopeEligible = observationCount(row.scopeEligibleCount);
  const raw = observationCount(row.rawCount);
  const eligible = observationCount(row.eligibleCount);
  const nativeCause = observationCount(row.nativeCauseCount);
  const identityValid = Object.keys(row).length === OBSERVATION_ROW_KEYS.size
    && !Object.keys(row).some((key) => !OBSERVATION_ROW_KEYS.has(key))
    && row.queryId === spec.queryId && row.nativeStage === "runtime-call-function-on"
    && ((row.nativeCauseCode === null && nativeCause === 0)
      || (row.nativeCauseCode === "NO_LAYOUT_BOX" && nativeCause > 0));
  const countsValid = scopeEligible <= scopeRaw && eligible <= raw && nativeCause <= raw
    && (scopeEligible === 1 || (raw === 0 && eligible === 0));
  if (!identityValid || !countsValid || !Array.isArray(row.matches)
    || row.matches.length !== Math.min(eligible, spec.maxMatches + 1)) {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  const matchIndices = new Set<number>();
  const matches = row.matches.map((matchValue) => {
    const match = observationRecord(matchValue);
    const keys = Object.keys(match);
    if (keys.length !== spec.fields.length + 1 || !Number.isSafeInteger(match.candidateIndex)
      || (match.candidateIndex as number) < 0 || (match.candidateIndex as number) >= raw
      || matchIndices.has(match.candidateIndex as number)
      || keys.some((field) => field !== "candidateIndex"
        && !spec.fields.includes(field as BrowserDomObservationField))
      || spec.fields.some((field) => !observationFieldValid(field, match[field]))) {
      throw new Error("BROWSER_DOM_READ_INVALID");
    }
    matchIndices.add(match.candidateIndex as number);
    return Object.freeze({ ...match });
  });
  const scopeRejections = decodeRejections(row.scopeRejections, scopeRaw, scopeEligible);
  const rejections = decodeRejections(row.rejections, raw, eligible);
  if (rejections.some((rejection) => matchIndices.has(rejection.index))) {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  return Object.freeze({ ...row, matches, scopeRejections, rejections });
};

const decodeObservationCall = (
  value: unknown,
  specs: readonly BrowserDomObservationQuery[],
): Readonly<{ observedAt: string; queries: readonly Readonly<Record<string, unknown>>[] }> => {
  const packet = observationRecord(value);
  if (Object.keys(packet).length !== 2 || !Array.isArray(packet.queries)
    || packet.queries.length !== specs.length || typeof packet.observedAt !== "string"
    || new Date(packet.observedAt).toISOString() !== packet.observedAt) {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  const queries = packet.queries.map((query, index) => decodeObservationRow(query, specs[index]!));
  const observedCandidateCount = queries.reduce((count, query) =>
    count + (query.scopeRawCount as number) + (query.rawCount as number), 0);
  if (observedCandidateCount > 256) throw new Error("BROWSER_DOM_READ_INVALID");
  return Object.freeze({
    observedAt: packet.observedAt,
    queries,
  });
};

const mainFrameLoaderId = async (runtime: ExtensionDebuggerRuntime, tabId: number): Promise<string> => {
  const tree = observationRecord(await runtime.send(tabId, "Page.getFrameTree"));
  const frame = observationRecord(observationRecord(tree.frameTree).frame);
  if (typeof frame.loaderId !== "string" || frame.loaderId.length === 0) throw new Error("BROWSER_DOCUMENT_INVALID");
  return frame.loaderId;
};

const bindObservationIdentities = async (
  queries: readonly Readonly<Record<string, unknown>>[],
  targetRefHash: `sha256:${string}`,
  documentRefHash: `sha256:${string}`,
  observedAt: string,
): Promise<readonly Readonly<Record<string, unknown>>[]> => Promise.all(queries.map(async (query) => {
  const matches = query.matches as readonly Readonly<Record<string, unknown>>[];
  return Object.freeze({ ...query, matches: await Promise.all(matches.map(async (match) => Object.freeze({
    ...match,
    observationIdentityHash: await sha256Text(canonicalizeBrowserAuthorityValue({
      targetRefHash, documentRefHash, observedAt, queryId: query.queryId,
      candidateIndex: match.candidateIndex,
    })),
  }))) });
}));

export const executeCoherentObservation = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  specs: readonly BrowserDomObservationQuery[],
): Promise<CoherentObservationResult> => {
  let objectId: string | null = null;
  let primaryFailure: unknown = null;
  try {
    const loaderBefore = await mainFrameLoaderId(runtime, target.tabId);
    const document = observationRecord(await runtime.send(target.tabId, "DOM.getDocument", { depth: 0, pierce: true }));
    const root = observationRecord(document.root);
    if (!Number.isSafeInteger(root.nodeId)) throw new Error("BROWSER_DOM_READ_INVALID");
    const resolved = observationRecord(await runtime.send(target.tabId, "DOM.resolveNode", { nodeId: root.nodeId }));
    objectId = observationRecord(resolved.object).objectId as string;
    if (typeof objectId !== "string" || objectId.length === 0) throw new Error("BROWSER_DOM_READ_INVALID");
    const call = observationRecord(await runtime.send(target.tabId, "Runtime.callFunctionOn", {
      objectId, functionDeclaration: COHERENT_OBSERVATION_FUNCTION, arguments: [{ value: specs }],
      returnByValue: true, awaitPromise: false, silent: true,
    }));
    if (call.exceptionDetails !== undefined) throw new Error("BROWSER_DOM_READ_INVALID");
    if (await mainFrameLoaderId(runtime, target.tabId) !== loaderBefore) throw new Error("BROWSER_DOCUMENT_INVALID");
    const observed = decodeObservationCall(observationRecord(call.result).value, specs);
    const targetRefHash = await sha256Text(target.targetRef);
    const documentRefHash = await sha256Text(target.documentRef);
    const queries = await bindObservationIdentities(
      observed.queries, targetRefHash, documentRefHash, observed.observedAt,
    );
    const observationRevisionHash = await sha256Text(canonicalizeBrowserAuthorityValue({
      targetRefHash, documentRefHash, observedAt: observed.observedAt, queries,
    }));
    return Object.freeze({ schemaVersion: "grasseye.browser.dom-observation.v1", targetRefHash,
      documentRefHash, observationRevisionHash, observedAt: observed.observedAt, queries });
  } catch (error) {
    primaryFailure = error;
    if (error instanceof Error && /^BROWSER_[A-Z_]+$/u.test(error.message)) throw error;
    throw new Error("BROWSER_DOM_READ_INVALID", { cause: error });
  } finally {
    if (objectId !== null) try { await runtime.send(target.tabId, "Runtime.releaseObject", { objectId }); }
    catch (error) { if (primaryFailure === null) throw new Error("BROWSER_DOM_READ_INVALID", { cause: error }); }
  }
};
