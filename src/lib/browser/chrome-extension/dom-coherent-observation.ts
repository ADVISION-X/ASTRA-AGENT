import {
  type BrowserDomIneligibleCandidate,
  type BrowserDomIneligibleReason,
  type BrowserDomObservationField,
  type BrowserDomObservationQuery,
} from "../exact-target/browser-dom-intent.js";
import { canonicalizeBrowserAuthorityValue } from "../transport/browser-authority-frame-codec.js";
import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import { BROWSER_MECHANICAL_FACTS_READER_SOURCE } from "./dom-mechanical-facts.js";
import { BROWSER_EXACT_EDITABLE_TEXT_READER_SOURCE } from "./dom-exact-editable-text.js";
import { BROWSER_CANONICAL_SEMANTIC_TEXT_READER_SOURCE } from "./dom-semantic-text.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";

type BrowserRecord = Record<string, unknown>;
const GPT_ORIGIN = "https://chatgpt.com";
const GPT_CONVERSATION_SEGMENT_MAX_CHARS = 256;
const GPT_TURN_KEY = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const GPT_USER_PROMPT_CONTENT_SELECTOR = "[data-testid='collapsible-user-message-content']";
const GPT_SHORT_USER_PROMPT_CONTENT_SELECTOR = ".whitespace-pre-wrap";
const GPT_ASSISTANT_RESPONSE_SELECTOR = "[data-chatgpt-search-unit-key$=':assistant'] [data-markdown-text-style='assistant-message']";
type CoherentObservationResult = Readonly<{
  schemaVersion: "grasseye.browser.dom-observation.v2";
  targetRefHash: `sha256:${string}`;
  documentRefHash: `sha256:${string}`;
  currentUrl: string;
  observationRevisionHash: `sha256:${string}`;
  observedAt: string;
  queries: readonly Readonly<Record<string, unknown>>[];
}>;

export type BrowserCoherentObservationResult = CoherentObservationResult;

const COHERENT_OBSERVATION_FUNCTION = `async function (specs) {
  ${BROWSER_MECHANICAL_FACTS_READER_SOURCE}
  ${BROWSER_EXACT_EDITABLE_TEXT_READER_SOURCE}
  ${BROWSER_CANONICAL_SEMANTIC_TEXT_READER_SOURCE}
  const sha256 = async (value) => {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return "sha256:" + Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0")).join("");
  };
  const exactEmptyComposerMarker = (node) => {
    if (!(node instanceof Element) || !node.hasAttribute("data-composer-markdown")
      || node.getAttribute("role") !== "textbox"
      || node.getAttribute("contenteditable") !== "true") return false;
    const rootChildren = Array.from(node.childNodes || []);
    if (rootChildren.length !== 1 || !(rootChildren[0] instanceof Element)
      || rootChildren[0].tagName !== "P"
      || rootChildren[0].getAttribute("data-empty-paragraph") !== "true") return false;
    const paragraphChildren = Array.from(rootChildren[0].childNodes || []);
    return paragraphChildren.length === 1 && paragraphChildren[0] instanceof Element
      && paragraphChildren[0].tagName === "BR"
      && paragraphChildren[0].getAttribute("class") === "ProseMirror-trailingBreak";
  };
  const canonicalSemanticText = (node) => {
    if (exactEmptyComposerMarker(node)) return "";
    return browserCanonicalSemanticText(node);
  };
  const exactGptUserPromptText = (node) => {
    const turnKey = node instanceof Element ? node.getAttribute("data-turn-key") || "" : "";
    const markers = node instanceof Element
      ? node.querySelectorAll("[data-content-search-turn-key^='fallback-turn-']") : [];
    const ordinalKey = markers.length === 1
      ? markers[0].getAttribute("data-content-search-turn-key") || "" : "";
    if (!/${GPT_TURN_KEY.source}/.test(turnKey)
      || document.querySelectorAll('[data-turn-key="' + turnKey + '"]').length !== 1
      || !/^fallback-turn-(0|[1-9][0-9]*)$/.test(ordinalKey)) {
      throw new Error("BROWSER_DOM_READ_INVALID");
    }
    const userRoots = Array.from(node.querySelectorAll("[data-chatgpt-search-unit-key$=':user']"));
    if (userRoots.length === 0) throw new Error("BROWSER_DOM_CANDIDATE_MISSING");
    if (userRoots.length !== 1) throw new Error("BROWSER_DOM_CANDIDATE_AMBIGUOUS");
    if (!(userRoots[0].getAttribute("data-chatgpt-search-unit-key") || "").startsWith(ordinalKey + ":")
      || userRoots[0].getAttribute("data-chatgpt-search-message-ids") !== turnKey
      || userRoots[0].querySelectorAll("[data-user-message-bubble='true']").length !== 1)
      throw new Error("BROWSER_DOM_READ_INVALID");
    const bubble = userRoots[0].querySelector("[data-user-message-bubble='true']");
    const promptNodes = Array.from(bubble.querySelectorAll("${GPT_USER_PROMPT_CONTENT_SELECTOR}"));
    if (promptNodes.length > 1) throw new Error("BROWSER_DOM_CANDIDATE_AMBIGUOUS");
    if (promptNodes.length === 1) return browserCanonicalGptUserPromptText(promptNodes[0]);
    const shortPromptNodes = Array.from(bubble.querySelectorAll("${GPT_SHORT_USER_PROMPT_CONTENT_SELECTOR}"));
    if (shortPromptNodes.length === 0) throw new Error("BROWSER_DOM_CANDIDATE_MISSING");
    if (shortPromptNodes.length !== 1) throw new Error("BROWSER_DOM_CANDIDATE_AMBIGUOUS");
    return browserCanonicalGptUserPromptText(shortPromptNodes[0]);
  };
  const gptAssistantResponseText = (node) => {
    if (!(node instanceof Element)
      || !/${GPT_TURN_KEY.source}/.test(node.getAttribute("data-turn-key") || "")) return null;
    const responseNodes = Array.from(node.querySelectorAll("${GPT_ASSISTANT_RESPONSE_SELECTOR}"));
    if (responseNodes.length === 0) return null;
    if (node.querySelectorAll("[data-chatgpt-search-unit-key$=':user']").length !== 1) {
      throw new Error("BROWSER_DOM_READ_INVALID");
    }
    if (responseNodes.length !== 1) throw new Error("BROWSER_DOM_READ_INVALID");
    return canonicalSemanticText(responseNodes[0]);
  };
  const currentUrlValue = (() => {
    const observedUrl = new URL(location.href);
    if (observedUrl.protocol !== "https:" || observedUrl.origin !== "${GPT_ORIGIN}"
      || observedUrl.username !== "" || observedUrl.password !== "") {
      throw new Error("BROWSER_DOM_READ_INVALID");
    }
    const segments = observedUrl.pathname.split("/");
    const root = observedUrl.pathname === "/";
    const conversation = segments.length === 3 && segments[0] === "" && segments[1] === "c"
      && segments[2].length > 0 && segments[2].length <= ${GPT_CONVERSATION_SEGMENT_MAX_CHARS};
    if (!root && !conversation) throw new Error("BROWSER_DOM_READ_INVALID");
    return observedUrl.origin + observedUrl.pathname;
  })();
  const fieldValue = async (node, facts, field) => {
    if (field === "id") return node.getAttribute("id") || "";
    if (field === "turnKey") return node.getAttribute("data-turn-key") || "";
    if (field === "tagName") return node.tagName;
    if (field === "ariaLabel") return node.getAttribute("aria-label") || "";
    if (field === "ariaLabelledBy") return node.getAttribute("aria-labelledby") || "";
    if (field === "ariaControls") return node.getAttribute("aria-controls") || "";
    if (field === "ariaExpanded") return node.getAttribute("aria-expanded") || "";
    if (field === "ariaChecked") return node.getAttribute("aria-checked") || "";
    if (field === "ariaPressed") return node.getAttribute("aria-pressed") || "";
    if (field === "ariaValueMin") return node.getAttribute("aria-valuemin") || "";
    if (field === "ariaValueMax") return node.getAttribute("aria-valuemax") || "";
    if (field === "ariaValueNow") return node.getAttribute("aria-valuenow") || "";
    if (field === "semanticTextHash") {
      return sha256(gptAssistantResponseText(node) ?? canonicalSemanticText(node));
    }
    if (field === "exactGptUserPromptHash") return sha256(exactGptUserPromptText(node));
    if (field === "exactEditableTextHash") {
      const exactEditableText = browserExactEditableText(node);
      if (exactEditableText === null) throw new Error("BROWSER_DOM_READ_INVALID");
      return sha256(exactEditableText);
    }
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
    if (facts.ariaHidden && !(checkText && spec.readEligibility === "non-actionable-aria-state")) {
      reasons.push("ARIA_HIDDEN");
    }
    if (facts.inert) {
      reasons.push("INERT");
    }
    if (checkText && ((spec.textContains !== undefined && !(node.textContent || "").includes(spec.textContains))
      || (spec.textEquals !== undefined && (node.textContent || "").trim() !== spec.textEquals.trim())
      || (spec.exactGptUserPromptContains !== undefined
        && !exactGptUserPromptText(node).includes(spec.exactGptUserPromptContains)))) {
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
  const latestGptUserTurn = (nodes) => {
    const ordinals = nodes.map((node) => {
      const marker = node.querySelectorAll("[data-content-search-turn-key^='fallback-turn-']");
      const match = marker.length === 1
        ? /^fallback-turn-(0|[1-9][0-9]*)$/.exec(marker[0].getAttribute("data-content-search-turn-key") || "") : null;
      const ordinal = match ? Number(match[1]) : -1;
      return Number.isSafeInteger(ordinal) ? { node, ordinal } : { node, ordinal: -1 };
    }).filter((entry) => entry.ordinal >= 0).sort((a, b) => b.ordinal - a.ordinal);
    if (ordinals.length > 1 && ordinals[0].ordinal === ordinals[1].ordinal)
      throw new Error("BROWSER_DOM_CANDIDATE_AMBIGUOUS");
    return ordinals[0]?.node || null;
  };
  const observeQuery = async (spec) => {
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
    const queried = Array.from(scopeEligible[0].node.querySelectorAll(spec.selector));
    const latest = spec.latestGptUserTurn === true ? latestGptUserTurn(queried) : null;
    const raw = spec.latestGptUserTurn === true ? latest ? [latest] : [] : queried;
    observedCandidateCount += queried.length - raw.length;
    if (observedCandidateCount > 256) throw new Error("BROWSER_DOM_READ_INVALID");
    const observed = observeNodes(raw);
    const eligible = observed.filter(({ node, facts }) => eligibilityReasons(node, facts, spec, true).length === 0);
    const noLayoutCount = observed.filter(({ facts }) => facts.nativeCauseCode === "NO_LAYOUT_BOX").length;
    return {
      queryId: spec.queryId, scopeRawCount: scopeRaw.length, scopeEligibleCount: scopeEligible.length,
      rawCount: raw.length, eligibleCount: eligible.length,
      matches: await Promise.all(eligible.slice(0, spec.maxMatches + 1).map(async ({ node, facts, candidateIndex }) => ({
        candidateIndex,
        ...Object.fromEntries(await Promise.all(spec.fields.map(async (field) => [field, await fieldValue(node, facts, field)])))
      }))),
      scopeRejections, rejections: rejected(observed, spec, true),
      nativeCauseCode: noLayoutCount > 0 ? "NO_LAYOUT_BOX" : null,
      nativeCauseCount: noLayoutCount, nativeStage: "runtime-call-function-on"
    };
  };
  return { currentUrl: currentUrlValue, observedAt: new Date().toISOString(), queries: await Promise.all(specs.map(observeQuery)) };
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
  "id", "testId", "turnKey", "tagName", "type", "role", "name", "label", "ariaLabel",
  "ariaLabelledBy", "ariaControls", "ariaExpanded", "ariaChecked", "ariaPressed", "ariaValueMin", "ariaValueMax", "ariaValueNow", "semanticTextHash",
  "exactEditableTextHash", "exactGptUserPromptHash",
  "value", "accept", "computedDisplay", "computedVisibility",
  "computedOpacity", "effectiveOpacity",
]);
const booleanObservationFields = new Set<BrowserDomObservationField>([
  "multiple", "connected", "layout", "visible", "hidden", "ariaHidden", "inert", "disabled",
  "ariaDisabled",
]);

const observationFieldValid = (field: BrowserDomObservationField, value: unknown): boolean => {
  if (field === "semanticTextHash" || field === "exactEditableTextHash"
    || field === "exactGptUserPromptHash") {
    return typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value);
  }
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

const decodeObservationMatch = (
  value: unknown,
  spec: BrowserDomObservationQuery,
  rawCount: number,
  indices: Set<number>,
): Readonly<Record<string, unknown>> => {
  const match = observationRecord(value);
  const keys = Object.keys(match);
  if (keys.length !== spec.fields.length + 1 || !Number.isSafeInteger(match.candidateIndex)
    || (match.candidateIndex as number) < 0 || (match.candidateIndex as number) >= rawCount
    || indices.has(match.candidateIndex as number)
    || keys.some((field) => field !== "candidateIndex"
      && !spec.fields.includes(field as BrowserDomObservationField))
    || spec.fields.some((field) => !observationFieldValid(field, match[field]))) {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  indices.add(match.candidateIndex as number);
  return Object.freeze({ ...match });
};

const observationRowIdentityValid = (
  row: Readonly<Record<string, unknown>>,
  spec: BrowserDomObservationQuery,
  nativeCauseCount: number,
): boolean => Object.keys(row).length === OBSERVATION_ROW_KEYS.size
  && !Object.keys(row).some((key) => !OBSERVATION_ROW_KEYS.has(key))
  && row.queryId === spec.queryId
  && row.nativeStage === "runtime-call-function-on"
  && ((row.nativeCauseCode === null && nativeCauseCount === 0)
    || (row.nativeCauseCode === "NO_LAYOUT_BOX" && nativeCauseCount > 0));

const observationRowCountsValid = (
  scopeRaw: number,
  scopeEligible: number,
  raw: number,
  eligible: number,
  nativeCause: number,
): boolean => scopeEligible <= scopeRaw && eligible <= raw && nativeCause <= raw
  && (scopeEligible === 1 || (raw === 0 && eligible === 0));

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
  if (!observationRowIdentityValid(row, spec, nativeCause)
    || !observationRowCountsValid(scopeRaw, scopeEligible, raw, eligible, nativeCause)
    || !Array.isArray(row.matches)
    || row.matches.length !== Math.min(eligible, spec.maxMatches + 1)) {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  const matchIndices = new Set<number>();
  const matches = row.matches.map((matchValue) => decodeObservationMatch(matchValue, spec, raw, matchIndices));
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
): Readonly<{ currentUrl: string; observedAt: string;
  queries: readonly Readonly<Record<string, unknown>>[] }> => {
  const packet = observationRecord(value);
  if (Object.keys(packet).length !== 3 || !Array.isArray(packet.queries)
    || packet.queries.length !== specs.length || typeof packet.observedAt !== "string"
    || typeof packet.currentUrl !== "string" || sanitizeCurrentUrl(packet.currentUrl) !== packet.currentUrl
    || new Date(packet.observedAt).toISOString() !== packet.observedAt) {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  const queries = packet.queries.map((query, index) => decodeObservationRow(query, specs[index]!));
  const observedCandidateCount = queries.reduce((count, query) =>
    count + (query.scopeRawCount as number) + (query.rawCount as number), 0);
  if (observedCandidateCount > 256) throw new Error("BROWSER_DOM_READ_INVALID");
  return Object.freeze({
    currentUrl: packet.currentUrl,
    observedAt: packet.observedAt,
    queries,
  });
};

const sanitizeCurrentUrl = (value: string): string => {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("BROWSER_DOM_READ_INVALID"); }
  const segments = url.pathname.split("/");
  const root = url.pathname === "/";
  const conversation = segments.length === 3 && segments[0] === "" && segments[1] === "c"
    && segments[2]!.length > 0 && segments[2]!.length <= GPT_CONVERSATION_SEGMENT_MAX_CHARS;
  if (url.protocol !== "https:" || url.origin !== GPT_ORIGIN || url.username !== "" || url.password !== ""
    || (!root && !conversation) || url.search !== "" || url.hash !== "") {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  return `${url.origin}${url.pathname}`;
};

const mainFrameLoaderId = async (
  runtime: ExtensionDebuggerRuntime,
  tabId: number,
): Promise<string> => {
  const tree = observationRecord(await runtime.send(tabId, "Page.getFrameTree"));
  const frame = observationRecord(observationRecord(tree.frameTree).frame);
  if (typeof frame.loaderId !== "string" || frame.loaderId.length === 0) {
    throw new Error("BROWSER_DOCUMENT_INVALID");
  }
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

export const bindCoherentObservationResult = async (
  value: unknown,
  target: ExtensionExactTarget,
  specs: readonly BrowserDomObservationQuery[],
): Promise<CoherentObservationResult> => {
  const observed = decodeObservationCall(value, specs);
  const targetRefHash = await sha256Text(target.targetRef);
  const documentRefHash = await sha256Text(target.documentRef);
  const queries = await bindObservationIdentities(
    observed.queries, targetRefHash, documentRefHash, observed.observedAt,
  );
  const observationRevisionHash = await sha256Text(canonicalizeBrowserAuthorityValue({
    targetRefHash, documentRefHash, currentUrl: observed.currentUrl,
    observedAt: observed.observedAt, queries,
  }));
  return Object.freeze({ schemaVersion: "grasseye.browser.dom-observation.v2", targetRefHash,
    documentRefHash, currentUrl: observed.currentUrl, observationRevisionHash,
    observedAt: observed.observedAt, queries });
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
      returnByValue: true, awaitPromise: true, silent: true,
    }));
    if (call.exceptionDetails !== undefined) {
      const details = observationRecord(call.exceptionDetails);
      const exception = details.exception && typeof details.exception === "object"
        && !Array.isArray(details.exception) ? details.exception as BrowserRecord : null;
      const diagnostic = [details.text, exception?.description, exception?.value]
        .filter((value): value is string => typeof value === "string").join("\n");
      const typed = /\b(BROWSER_DOM_(?:CANDIDATE_MISSING|CANDIDATE_AMBIGUOUS|NODE_STALE))\b/u.exec(diagnostic)?.[1];
      throw new Error(typed ?? "BROWSER_DOM_READ_INVALID");
    }
    const loaderAfter = await mainFrameLoaderId(runtime, target.tabId);
    if (loaderAfter !== loaderBefore) {
      throw new Error("BROWSER_DOCUMENT_INVALID");
    }
    return bindCoherentObservationResult(observationRecord(call.result).value, target, specs);
  } catch (error) {
    primaryFailure = error;
    if (error instanceof Error && /^BROWSER_[A-Z_]+$/u.test(error.message)) throw error;
    throw new Error("BROWSER_DOM_READ_INVALID", { cause: error });
  } finally {
    if (objectId !== null) try { await runtime.send(target.tabId, "Runtime.releaseObject", { objectId }); }
    catch (error) { if (primaryFailure === null) throw new Error("BROWSER_DOM_READ_INVALID", { cause: error }); }
  }
};
