import { type BrowserDomObservationField, type BrowserDomObservationQuery } from "../exact-target/browser-dom-intent.js";
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
  const bounded = (value) => typeof value === "string" ? value.slice(0, 1024) : value;
  const fieldValue = (node, facts, field) => {
    if (field === "id") return bounded(node.getAttribute("id") || "");
    if (field === "dataTurn") return bounded(node.getAttribute("data-turn") || "");
    if (field === "tagName") return node.tagName;
    if (field === "ariaLabel") return bounded(node.getAttribute("aria-label") || "");
    if (field === "ariaExpanded") return node.getAttribute("aria-expanded") || "";
    if (field === "ariaChecked") return node.getAttribute("aria-checked") || "";
    if (field === "accept") return bounded(node.getAttribute("accept") || "");
    if (field === "multiple") return node.hasAttribute("multiple");
    return bounded(facts[field]);
  };
  const observeQuery = (spec) => {
    const scopeRaw = spec.scope ? Array.from(document.querySelectorAll(spec.scope.selector)) : [document.documentElement];
    const scopeEligible = spec.scope ? scopeRaw.filter((node) => {
      const facts = browserMechanicalFacts(node);
      return facts.visible && !facts.ariaHidden && !facts.inert;
    }) : scopeRaw;
    if (scopeEligible.length !== 1) return {
      queryId: spec.queryId, scopeRawCount: scopeRaw.length, scopeEligibleCount: scopeEligible.length,
      rawCount: 0, eligibleCount: 0, matches: [], nativeCauseCode: null,
      nativeCauseCount: 0, nativeStage: "runtime-call-function-on"
    };
    const raw = Array.from(scopeEligible[0].querySelectorAll(spec.selector));
    const observed = raw.map((node) => ({ node, facts: browserMechanicalFacts(node) }));
    const eligible = observed.filter(({ node, facts }) => facts.visible && !facts.ariaHidden && !facts.inert
      && (spec.textContains === undefined || (node.textContent || "").includes(spec.textContains))
      && (spec.textEquals === undefined || (node.textContent || "").trim() === spec.textEquals.trim()));
    const noLayoutCount = observed.filter(({ facts }) => facts.nativeCauseCode === "NO_LAYOUT_BOX").length;
    return {
      queryId: spec.queryId, scopeRawCount: scopeRaw.length, scopeEligibleCount: scopeEligible.length,
      rawCount: raw.length, eligibleCount: eligible.length,
      matches: eligible.slice(0, spec.maxMatches + 1).map(({ node, facts }) =>
        Object.fromEntries(spec.fields.map((field) => [field, fieldValue(node, facts, field)]))),
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
  "ariaDisabled", "viewport", "hitTest",
]);

const observationFieldValid = (field: BrowserDomObservationField, value: unknown): boolean => {
  if (stringObservationFields.has(field)) return typeof value === "string";
  if (booleanObservationFields.has(field)) return typeof value === "boolean";
  if (field === "checked") return value === null || typeof value === "boolean";
  if (field !== "bounds") return false;
  if (value === null) return true;
  const bounds = observationRecord(value);
  return [bounds.x, bounds.y, bounds.width, bounds.height]
    .every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate));
};

const OBSERVATION_ROW_KEYS = new Set(["queryId", "scopeRawCount", "scopeEligibleCount", "rawCount",
  "eligibleCount", "matches", "nativeCauseCode", "nativeCauseCount", "nativeStage"]);

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
  const matches = row.matches.map((matchValue) => {
    const match = observationRecord(matchValue);
    const keys = Object.keys(match);
    if (keys.length !== spec.fields.length
      || keys.some((field) => !spec.fields.includes(field as BrowserDomObservationField))
      || spec.fields.some((field) => !observationFieldValid(field, match[field]))) {
      throw new Error("BROWSER_DOM_READ_INVALID");
    }
    return Object.freeze({ ...match });
  });
  return Object.freeze({ ...row, matches });
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
  return Object.freeze({
    observedAt: packet.observedAt,
    queries: packet.queries.map((query, index) => decodeObservationRow(query, specs[index]!)),
  });
};

const mainFrameLoaderId = async (runtime: ExtensionDebuggerRuntime, tabId: number): Promise<string> => {
  const tree = observationRecord(await runtime.send(tabId, "Page.getFrameTree"));
  const frame = observationRecord(observationRecord(tree.frameTree).frame);
  if (typeof frame.loaderId !== "string" || frame.loaderId.length === 0) throw new Error("BROWSER_DOCUMENT_INVALID");
  return frame.loaderId;
};

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
    const observationRevisionHash = await sha256Text(canonicalizeBrowserAuthorityValue({
      targetRefHash, documentRefHash, observedAt: observed.observedAt, queries: observed.queries,
    }));
    return Object.freeze({ schemaVersion: "grasseye.browser.dom-observation.v1", targetRefHash,
      documentRefHash, observationRevisionHash, observedAt: observed.observedAt, queries: observed.queries });
  } catch (error) {
    primaryFailure = error;
    if (error instanceof Error && /^BROWSER_[A-Z_]+$/u.test(error.message)) throw error;
    throw new Error("BROWSER_DOM_READ_INVALID", { cause: error });
  } finally {
    if (objectId !== null) try { await runtime.send(target.tabId, "Runtime.releaseObject", { objectId }); }
    catch (error) { if (primaryFailure === null) throw new Error("BROWSER_DOM_READ_INVALID", { cause: error }); }
  }
};
