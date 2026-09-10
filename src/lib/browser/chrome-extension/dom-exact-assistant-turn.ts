import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import { BROWSER_MECHANICAL_FACTS_READER_SOURCE } from "./dom-mechanical-facts.js";
import { BROWSER_CANONICAL_SEMANTIC_TEXT_READER_SOURCE } from "./dom-semantic-text.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";
import { canonicalBrowserExactAssistantTurnRevision } from
  "../exact-target/exact-assistant-turn-revision.js";

type BrowserRecord = Record<string, unknown>;
type ExactAssistantObservation = Readonly<{
  rawCount: number;
  eligibleCount: number;
  rawDomHtml: string;
  semanticText: string;
  currentUrl: string;
  precedingUserTurnId: string;
  precedingPromptHash: string;
  turnMarkerMatched: boolean;
  generatingRaw: number;
  observedAt: string;
  nativeCauseCode: "NO_LAYOUT_BOX" | null;
  nativeStage: "runtime-call-function-on";
}>;

const EXACT_ASSISTANT_TURN_FUNCTION = `async function (spec) {
  ${BROWSER_MECHANICAL_FACTS_READER_SOURCE}
  ${BROWSER_CANONICAL_SEMANTIC_TEXT_READER_SOURCE}
  const assistantTurnId = spec.assistantTurnId;
  if (!/^conversation-turn-[1-9][0-9]*$/.test(assistantTurnId)) throw new Error("BROWSER_DOM_READ_INVALID");
  const source = spec.sourceCheckpoint;
  const observedUrl = new URL(location.href);
  const currentUrl = observedUrl.origin + observedUrl.pathname;
  const segments = observedUrl.pathname.split("/");
  const root = observedUrl.pathname === "/";
  const conversation = segments.length === 3 && segments[0] === "" && segments[1] === "c"
    && segments[2].length > 0 && segments[2].length <= 256;
  if (observedUrl.protocol !== "https:" || observedUrl.origin !== "https://chatgpt.com"
    || observedUrl.username !== "" || observedUrl.password !== ""
    || (!root && !conversation)) throw new Error("BROWSER_DOM_READ_INVALID");
  const sha256 = async (value) => {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return "sha256:" + Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0")).join("");
  };
  const ordinal = Number(assistantTurnId.slice("conversation-turn-".length));
  const precedingUserTurnId = "conversation-turn-" + (ordinal - 1);
  const userRaw = Array.from(document.querySelectorAll(
    "[data-testid='" + precedingUserTurnId + "']:has([data-message-author-role='user'])"
  ));
  const promptRaw = userRaw.length === 1 ? Array.from(userRaw[0].querySelectorAll(
    "[data-testid='collapsible-user-message-content']"
  )) : [];
  const prompt = promptRaw.length === 1 ? browserCanonicalGptUserPromptText(promptRaw[0]) : "";
  const selector = '[data-testid="' + assistantTurnId
    + '"]:has([data-message-author-role="assistant"]) [data-message-author-role="assistant"]';
  const raw = Array.from(document.querySelectorAll(selector));
  const observedAt = new Date().toISOString();
  const precedingPromptHash = promptRaw.length === 1 ? await sha256(prompt) : "";
  const turnMarkerMatched = promptRaw.length === 1 && prompt.includes(source.turnMarker);
  const generatingRaw = document.querySelectorAll(
    "#composer-submit-button[data-testid='stop-button']"
  ).length;
  if (raw.length !== 1) return { rawCount: raw.length, eligibleCount: 0,
    rawDomHtml: "", semanticText: "", currentUrl, precedingUserTurnId, precedingPromptHash,
    turnMarkerMatched, generatingRaw, observedAt, nativeCauseCode: null,
    nativeStage: "runtime-call-function-on" };
  const node = raw[0];
  const facts = browserMechanicalFacts(node, false);
  const eligible = facts !== null && facts.visible && !facts.ariaHidden && !facts.inert;
  return { rawCount: 1, eligibleCount: eligible ? 1 : 0,
    rawDomHtml: eligible ? node.outerHTML : "", semanticText: eligible ? browserCanonicalSemanticText(node) : "",
    currentUrl, precedingUserTurnId, precedingPromptHash, turnMarkerMatched, generatingRaw,
    observedAt, nativeCauseCode: facts === null ? null : facts.nativeCauseCode,
    nativeStage: "runtime-call-function-on" };
}`;

const sha256Text = async (value: string): Promise<`sha256:${string}`> => {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
};

const record = (value: unknown): BrowserRecord => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("BROWSER_DOM_READ_INVALID");
  return value as BrowserRecord;
};

const count = (value: unknown): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error("BROWSER_DOM_READ_INVALID");
  return value as number;
};

const exactIsoTimestamp = (value: unknown): value is string => typeof value === "string"
  && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;

const observationValueShapeValid = (
  observed: BrowserRecord,
  keys: readonly string[],
  rawCount: number,
  eligibleCount: number,
): boolean => [
  Object.keys(observed).length === keys.length,
  keys.every((key) => Object.hasOwn(observed, key)),
  eligibleCount <= rawCount,
  eligibleCount <= 1,
  typeof observed.rawDomHtml === "string",
  typeof observed.semanticText === "string",
  typeof observed.currentUrl === "string",
  typeof observed.precedingUserTurnId === "string",
  typeof observed.precedingPromptHash === "string",
  typeof observed.turnMarkerMatched === "boolean",
  Number.isSafeInteger(observed.generatingRaw) && (observed.generatingRaw as number) >= 0,
  exactIsoTimestamp(observed.observedAt),
  new Set([null, "NO_LAYOUT_BOX"]).has(observed.nativeCauseCode as string | null),
  observed.nativeStage === "runtime-call-function-on",
].every(Boolean);

const decodeObservation = (value: unknown): ExactAssistantObservation => {
  const observed = record(value);
  const keys = ["rawCount", "eligibleCount", "rawDomHtml", "semanticText", "currentUrl",
    "precedingUserTurnId", "precedingPromptHash", "turnMarkerMatched", "generatingRaw", "observedAt",
    "nativeCauseCode", "nativeStage"];
  const rawCount = count(observed.rawCount);
  const eligibleCount = count(observed.eligibleCount);
  if (!observationValueShapeValid(observed, keys, rawCount, eligibleCount)) {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  if (rawCount > 1) throw new Error("BROWSER_DOM_CANDIDATE_AMBIGUOUS");
  if (rawCount === 0 || eligibleCount === 0) throw new Error("BROWSER_DOM_CANDIDATE_MISSING");
  if (eligibleCount !== 1) throw new Error("BROWSER_DOM_CANDIDATE_AMBIGUOUS");
  const rawDomHtml = observed.rawDomHtml as string;
  if (rawDomHtml.length === 0) throw new Error("BROWSER_DOM_READ_INVALID");
  return Object.freeze({
    rawCount, eligibleCount, rawDomHtml,
    semanticText: observed.semanticText as string, observedAt: observed.observedAt as string,
    currentUrl: observed.currentUrl as string,
    precedingUserTurnId: observed.precedingUserTurnId as string,
    precedingPromptHash: observed.precedingPromptHash as string,
    turnMarkerMatched: observed.turnMarkerMatched as boolean,
    generatingRaw: observed.generatingRaw as number,
    nativeCauseCode: observed.nativeCauseCode as "NO_LAYOUT_BOX" | null,
    nativeStage: "runtime-call-function-on",
  }) as ExactAssistantObservation;
};

const mainFrameLoaderId = async (runtime: ExtensionDebuggerRuntime, tabId: number): Promise<string> => {
  const tree = record(await runtime.send(tabId, "Page.getFrameTree"));
  const frame = record(record(tree.frameTree).frame);
  if (typeof frame.loaderId !== "string" || frame.loaderId.length === 0) {
    throw new Error("BROWSER_DOCUMENT_INVALID");
  }
  return frame.loaderId;
};

const observeExactAssistantTurn = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: Extract<import("../exact-target/browser-dom-intent.js").BrowserDomIntent, { kind: "readExactAssistantTurn" }>,
  expectedMainFrameLoaderId: string,
): Promise<ExactAssistantObservation> => {
  let objectId: string | null = null;
  let primaryFailure: unknown = null;
  try {
    const loaderBefore = await mainFrameLoaderId(runtime, target.tabId);
    if (loaderBefore !== expectedMainFrameLoaderId) throw new Error("BROWSER_DOCUMENT_INVALID");
    const document = record(await runtime.send(target.tabId, "DOM.getDocument", { depth: 0, pierce: true }));
    const root = record(document.root);
    if (!Number.isSafeInteger(root.nodeId)) throw new Error("BROWSER_DOM_READ_INVALID");
    const resolved = record(await runtime.send(target.tabId, "DOM.resolveNode", { nodeId: root.nodeId }));
    objectId = record(resolved.object).objectId as string;
    if (typeof objectId !== "string" || objectId.length === 0) throw new Error("BROWSER_DOM_READ_INVALID");
    const call = record(await runtime.send(target.tabId, "Runtime.callFunctionOn", {
      objectId, functionDeclaration: EXACT_ASSISTANT_TURN_FUNCTION,
      arguments: [{ value: intent }], returnByValue: true, awaitPromise: true, silent: true,
    }));
    if (call.exceptionDetails !== undefined) throw new Error("BROWSER_DOM_READ_INVALID");
    const loaderAfter = await mainFrameLoaderId(runtime, target.tabId);
    if (loaderAfter !== expectedMainFrameLoaderId) throw new Error("BROWSER_DOCUMENT_INVALID");
    return decodeObservation(record(call.result).value);
  } catch (error) {
    primaryFailure = error;
    if (error instanceof Error && /^BROWSER_[A-Z_]+$/u.test(error.message)) throw error;
    throw new Error("BROWSER_DOM_READ_INVALID", { cause: error });
  } finally {
    if (objectId !== null) try { await runtime.send(target.tabId, "Runtime.releaseObject", { objectId }); }
    catch (error) { if (primaryFailure === null) throw new Error("BROWSER_DOM_READ_INVALID", { cause: error }); }
  }
};

export const executeExactAssistantTurnRead = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: Extract<import("../exact-target/browser-dom-intent.js").BrowserDomIntent, { kind: "readExactAssistantTurn" }>,
  assertCurrent: () => void,
  expectedMainFrameLoaderId: string,
): Promise<unknown> => {
  assertCurrent();
  const observed = await observeExactAssistantTurn(
    debuggerRuntime, target, intent, expectedMainFrameLoaderId,
  );
  assertCurrent();
  const rawDomHash = await sha256Text(observed.rawDomHtml);
  const semanticTextHash = await sha256Text(observed.semanticText);
  const targetRefHash = await sha256Text(target.targetRef);
  const documentRefHash = await sha256Text(target.documentRef);
  const revisionInput = Object.freeze({
    targetRefHash, documentRefHash, assistantTurnId: intent.assistantTurnId,
    currentUrl: observed.currentUrl,
    precedingUserTurnId: observed.precedingUserTurnId,
    precedingPromptHash: observed.precedingPromptHash as `sha256:${string}`,
    turnMarkerMatched: observed.turnMarkerMatched as true,
    generatingRaw: observed.generatingRaw, rawDomHash, semanticTextHash,
    observedAt: observed.observedAt,
  });
  const observationRevisionHash = await sha256Text(
    canonicalBrowserExactAssistantTurnRevision(revisionInput),
  );
  return Object.freeze({
    schemaVersion: "grasseye.browser.exact-assistant-turn.v2" as const,
    targetRefHash,
    documentRefHash,
    observationRevisionHash,
    assistantTurnId: intent.assistantTurnId,
    currentUrl: observed.currentUrl,
    precedingUserTurnId: observed.precedingUserTurnId,
    precedingPromptHash: observed.precedingPromptHash,
    turnMarkerMatched: observed.turnMarkerMatched,
    generatingRaw: observed.generatingRaw,
    rawDomHtml: observed.rawDomHtml,
    rawDomHash,
    semanticText: observed.semanticText,
    semanticTextHash,
    observedAt: observed.observedAt,
  });
};
