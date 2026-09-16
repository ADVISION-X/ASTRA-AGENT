import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import { BROWSER_CANONICAL_SEMANTIC_TEXT_READER_SOURCE } from "./dom-semantic-text.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";
import { canonicalBrowserExactAssistantTurnRevision } from
  "../exact-target/exact-assistant-turn-revision.js";

type BrowserRecord = Record<string, unknown>;
type ExactAssistantObservation = Readonly<{
  rawCount: number;
  rawDomHtml: string;
  semanticText: string;
  currentUrl: string;
  assistantTurnId: string;
  precedingUserTurnId: string;
  generatingRaw: number;
  observedAt: string;
  nativeStage: "runtime-call-function-on";
}>;

const EXACT_ASSISTANT_TURN_FUNCTION = `async function (spec) {
  ${BROWSER_CANONICAL_SEMANTIC_TEXT_READER_SOURCE}
  const userTurnId = spec.userTurnId;
  if (!/^conversation-turn-[1-9][0-9]*$/.test(userTurnId)) throw new Error("BROWSER_DOM_READ_INVALID");
  const observedUrl = new URL(location.href);
  const currentUrl = observedUrl.origin + observedUrl.pathname;
  const expectedUrlValue = new URL(spec.canonicalConversationUrl);
  const expectedUrl = expectedUrlValue.origin + expectedUrlValue.pathname;
  const segments = observedUrl.pathname.split("/");
  const root = observedUrl.pathname === "/";
  const conversation = segments.length === 3 && segments[0] === "" && segments[1] === "c"
    && segments[2].length > 0 && segments[2].length <= 256;
  if (observedUrl.protocol !== "https:" || observedUrl.origin !== "https://chatgpt.com"
    || observedUrl.username !== "" || observedUrl.password !== ""
    || (!root && !conversation)) throw new Error("BROWSER_DOM_READ_INVALID");
  const precedingUserTurnId = userTurnId;
  const userRaw = Array.from(document.querySelectorAll(
    "[data-testid='" + precedingUserTurnId + "']:has([data-message-author-role='user'])"
  ));
  const turns = Array.from(document.querySelectorAll("[data-testid^='conversation-turn-']"));
  const userIndex = userRaw.length === 1 ? turns.indexOf(userRaw[0]) : -1;
  const [, assistantOuter = null] = userIndex >= 0 ? turns.slice(userIndex) : [];
  const assistantTurnId = assistantOuter?.getAttribute("data-testid") || "";
  const raw = assistantOuter
    ? Array.from(assistantOuter.querySelectorAll("[data-message-author-role='assistant']")) : [];
  const observedAt = new Date().toISOString();
  const generatingRaw = document.querySelectorAll(
    "#composer-submit-button[data-testid='stop-button']"
  ).length;
  const rawCount = raw.length;
  if (currentUrl !== expectedUrl || rawCount !== 1) return { rawCount,
    rawDomHtml: "", semanticText: "", currentUrl, assistantTurnId, precedingUserTurnId,
    generatingRaw, observedAt, nativeStage: "runtime-call-function-on" };
  const node = raw[0];
  return { rawCount: 1,
    rawDomHtml: node.outerHTML, semanticText: browserCanonicalSemanticText(node),
    currentUrl, assistantTurnId, precedingUserTurnId, generatingRaw,
    observedAt, nativeStage: "runtime-call-function-on" };
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
): boolean => [
  Object.keys(observed).length === keys.length,
  keys.every((key) => Object.hasOwn(observed, key)),
  typeof observed.rawDomHtml === "string",
  typeof observed.semanticText === "string",
  typeof observed.currentUrl === "string",
  typeof observed.assistantTurnId === "string",
  typeof observed.precedingUserTurnId === "string",
  Number.isSafeInteger(observed.generatingRaw) && (observed.generatingRaw as number) >= 0,
  exactIsoTimestamp(observed.observedAt),
  observed.nativeStage === "runtime-call-function-on",
].every(Boolean);

const decodeObservation = (
  value: unknown,
  expectedCurrentUrl: string,
): ExactAssistantObservation => {
  const observed = record(value);
  const keys = ["rawCount", "rawDomHtml", "semanticText", "currentUrl", "assistantTurnId",
    "precedingUserTurnId", "generatingRaw", "observedAt", "nativeStage"];
  const rawCount = count(observed.rawCount);
  if (!observationValueShapeValid(observed, keys)) {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  if (observed.currentUrl !== expectedCurrentUrl) throw new Error("BROWSER_DOCUMENT_INVALID");
  if (rawCount > 1) throw new Error("BROWSER_DOM_CANDIDATE_AMBIGUOUS");
  if (rawCount === 0) throw new Error("BROWSER_DOM_CANDIDATE_MISSING");
  const rawDomHtml = observed.rawDomHtml as string;
  if (rawDomHtml.length === 0) throw new Error("BROWSER_DOM_READ_INVALID");
  return Object.freeze({
    rawCount, rawDomHtml,
    semanticText: observed.semanticText as string, observedAt: observed.observedAt as string,
    currentUrl: observed.currentUrl as string,
    assistantTurnId: observed.assistantTurnId as string,
    precedingUserTurnId: observed.precedingUserTurnId as string,
    generatingRaw: observed.generatingRaw as number,
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
    return decodeObservation(record(call.result).value, intent.canonicalConversationUrl);
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
    targetRefHash, documentRefHash, assistantTurnId: observed.assistantTurnId,
    currentUrl: observed.currentUrl,
    precedingUserTurnId: observed.precedingUserTurnId,
    generatingRaw: observed.generatingRaw, rawDomHash, semanticTextHash,
    observedAt: observed.observedAt,
  });
  const observationRevisionHash = await sha256Text(
    canonicalBrowserExactAssistantTurnRevision(revisionInput),
  );
  return Object.freeze({
    schemaVersion: "grasseye.browser.exact-assistant-turn.v3" as const,
    targetRefHash,
    documentRefHash,
    observationRevisionHash,
    assistantTurnId: observed.assistantTurnId,
    currentUrl: observed.currentUrl,
    precedingUserTurnId: observed.precedingUserTurnId,
    generatingRaw: observed.generatingRaw,
    rawDomHtml: observed.rawDomHtml,
    rawDomHash,
    semanticText: observed.semanticText,
    semanticTextHash,
    observedAt: observed.observedAt,
  });
};
