import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import { BROWSER_CANONICAL_SEMANTIC_TEXT_READER_SOURCE } from "./dom-semantic-text.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";
import { canonicalBrowserExactAssistantTurnRevision } from
  "../exact-target/exact-assistant-turn-revision.js";

type BrowserRecord = Record<string, unknown>;
type ExactAssistantObservation = Readonly<{
  rawCount: number;
  pendingCause: ExactAssistantPendingCause;
  rawDomHtml: string;
  semanticText: string;
  currentUrl: string;
  assistantTurnId: string;
  precedingUserTurnId: string;
  generatingRaw: number;
  observedAt: string;
  nativeStage: "runtime-call-function-on";
}>;

type ExactAssistantPendingCause =
  | "exact-user-turn-unavailable"
  | "adjacent-assistant-missing"
  | null;

const MARKER_USER_SOURCE = `function browserMarkerUserId(turn, marker) {
  const units = Array.from(turn.querySelectorAll("[data-chatgpt-search-unit-key]"));
  const users = units.filter((unit) =>
    (unit.getAttribute("data-chatgpt-search-unit-key") || "").endsWith(":user"));
  const matching = users.filter((unit) => Array.from(
    unit.querySelectorAll("[data-user-message-bubble='true']")
  ).some((bubble) => (bubble.textContent || "").includes(marker)));
  if (matching.length === 0) return "";
  const id = turn.getAttribute("data-turn-key") || "";
  if (matching.length !== 1 || users.length !== 1
    || matching[0].querySelectorAll("[data-user-message-bubble='true']").length !== 1
    || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)
    || matching[0].getAttribute("data-chatgpt-search-message-ids") !== id) {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  return id;
}`;

const EXACT_ASSISTANT_TURN_FUNCTION = `async function (spec) {
  ${BROWSER_CANONICAL_SEMANTIC_TEXT_READER_SOURCE}
  ${MARKER_USER_SOURCE}
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
  const turns = Array.from(document.querySelectorAll("[data-turn-key]"));
  const currentMatches = turns.map((turn) => Object.freeze({ turn,
    id: browserMarkerUserId(turn, spec.turnMarker) })).filter((item) => item.id);
  if (currentMatches.length > 1) throw new Error("BROWSER_DOM_CANDIDATE_AMBIGUOUS");
  const userRaw = spec.observedUserTurnId ? currentMatches.filter((item) =>
    item.id === spec.observedUserTurnId).map((item) => item.turn) : [];
  if (userRaw.length > 1) throw new Error("BROWSER_DOM_CANDIDATE_AMBIGUOUS");
  const precedingUserTurnId = userRaw[0]?.getAttribute("data-turn-key") || "";
  const units = userRaw.length === 1
    ? Array.from(userRaw[0].querySelectorAll("[data-chatgpt-search-unit-key]")) : [];
  const users = units.filter((unit) => (unit.getAttribute("data-chatgpt-search-unit-key") || "").endsWith(":user")
    && unit.getAttribute("data-chatgpt-search-message-ids") === precedingUserTurnId);
  if (userRaw.length === 1 && users.length !== 1) throw new Error("BROWSER_DOM_READ_INVALID");
  const assistant = users.length === 1 ? units[units.indexOf(users[0]) + 1] : null;
  const assistantKey = assistant?.getAttribute("data-chatgpt-search-unit-key") || "";
  const assistantIds = (assistant?.getAttribute("data-chatgpt-search-message-ids") || "").split(/\\s+/).filter(Boolean);
  const assistantTurnId = assistantIds[0] || "";
  const role = assistant?.querySelectorAll("h4[data-conversation-role='assistant']") || [];
  const raw = assistantKey.endsWith(":assistant")
    ? Array.from(assistant.querySelectorAll("[data-markdown-text-style='assistant-message']")) : [];
  if (raw.length > 1 || (raw.length === 1 && (
    role.length !== 1
    || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(assistantTurnId)
    || assistantIds.some((id) => id !== assistantTurnId)))) throw new Error("BROWSER_DOM_READ_INVALID");
  const pendingCause = userRaw.length !== 1 ? "exact-user-turn-unavailable"
    : raw.length === 0 ? "adjacent-assistant-missing" : null;
  const observedAt = new Date().toISOString();
  const generatingRaw = document.querySelectorAll(
    "form[data-chatgpt-composer] button[aria-label='停止']"
  ).length;
  const rawCount = raw.length;
  if (currentUrl !== expectedUrl || rawCount !== 1) return { rawCount,
    rawDomHtml: "", semanticText: "", currentUrl, assistantTurnId, precedingUserTurnId,
    generatingRaw, observedAt, pendingCause, nativeStage: "runtime-call-function-on" };
  const node = raw[0];
  return { rawCount: 1,
    rawDomHtml: node.outerHTML, semanticText: browserCanonicalSemanticText(node),
    currentUrl, assistantTurnId, precedingUserTurnId, generatingRaw,
    observedAt, pendingCause, nativeStage: "runtime-call-function-on" };
}`;

/**
 * One synchronous materialization step. The extension owns the bounded waits between samples.
 * Step 0 moves to the bottom; subsequent steps scan the mounted user turns before moving up.
 */
const MATERIALIZE_STEP_FUNCTION = `function (spec) {
  ${MARKER_USER_SOURCE}
  if (document.visibilityState !== "visible") {
    return { pageVisible: false, containerFound: false, atTop: false, ids: [], scrollTop: 0 };
  }
  const turns = Array.from(document.querySelectorAll("[data-turn-key]"));
  let container = null;
  let unknownScroll = false;
  if (turns.length > 0) {
    let candidate = turns[0].parentElement;
    while (candidate && candidate !== document.body) {
      const style = getComputedStyle(candidate);
      if (candidate.scrollHeight > candidate.clientHeight) {
        if (!turns.every((turn) => candidate.contains(turn))) unknownScroll = true;
        else if (style.overflowY === "auto" || style.overflowY === "scroll") {
          container = candidate;
          break;
        } else if (style.overflowY !== "visible") unknownScroll = true;
      }
      candidate = candidate.parentElement;
    }
  }
  if (unknownScroll) return { pageVisible: true, containerFound: false, atTop: false,
    ids: [], scrollTop: 0 };
  if (!container && document.scrollingElement?.scrollHeight > document.scrollingElement?.clientHeight) {
    container = document.scrollingElement;
  }
  if (!container) return { pageVisible: true, containerFound: false, atTop: true,
    ids: turns.map((turn) => browserMarkerUserId(turn, spec.turnMarker)).filter(Boolean), scrollTop: 0 };
  const reverse = getComputedStyle(container).flexDirection === "column-reverse";
  const top = reverse ? container.clientHeight - container.scrollHeight : 0;
  if (typeof spec.restoreTop === "number") {
    container.scrollTop = spec.restoreTop;
    return { pageVisible: true, containerFound: true, atTop: false, ids: [], scrollTop: container.scrollTop };
  }
  if (spec.step === 0) {
    container.scrollTop = reverse ? 0 : container.scrollHeight;
    return { pageVisible: true, containerFound: true, atTop: false, ids: [], scrollTop: container.scrollTop };
  }
  const scrollTop = container.scrollTop;
  const ids = turns.map((turn) => browserMarkerUserId(turn, spec.turnMarker)).filter(Boolean);
  const atTop = scrollTop <= top + 1;
  if (!atTop) container.scrollTop = Math.max(top, scrollTop - 0.8 * container.clientHeight);
  return { pageVisible: true, containerFound: true, ids, atTop, scrollTop };
}`;

type MaterializeStepResult = Readonly<{
  pageVisible: boolean;
  containerFound: boolean;
  atTop: boolean;
  ids: readonly string[];
  scrollTop: number;
}>;

const decodeMaterializeStep = (value: unknown): MaterializeStepResult => {
  const observed = record(value);
  if (typeof observed.pageVisible !== "boolean" || typeof observed.containerFound !== "boolean"
    || typeof observed.atTop !== "boolean" || !Array.isArray(observed.ids)
    || !observed.ids.every((id) => typeof id === "string"
      && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(id))
    || typeof observed.scrollTop !== "number" || !Number.isFinite(observed.scrollTop)) {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  return Object.freeze({
    pageVisible: observed.pageVisible, containerFound: observed.containerFound,
    ids: observed.ids as string[], atTop: observed.atTop, scrollTop: observed.scrollTop,
  });
};

const MATERIALIZE_STEP_BUDGET_MS = 12_000;
const MATERIALIZE_STEP_DEADLINE_MARGIN_MS = 3_000;
const MATERIALIZE_STEP_MIN_BUDGET_MS = 4_000;
const MATERIALIZE_STEP_INTERVAL_MS = 100;
const MATERIALIZE_STEP_INTERVAL_MARGIN_MS = 500;
const MATERIALIZE_STEP_MAX_COUNT = 80;

const wait = async (durationMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, durationMs));

/**
 * Scan the existing conversation from bottom to top. Only a complete walk can prove that
 * one Product marker belongs to one user turn; a partial walk returns unavailable.
 */
const materializeExactUserTurn = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  turnMarker: string,
  commandDeadlineAt: number,
): Promise<string | null> => {
  const budgetMs = Math.min(
    MATERIALIZE_STEP_BUDGET_MS, commandDeadlineAt - Date.now() - MATERIALIZE_STEP_DEADLINE_MARGIN_MS,
  );
  if (budgetMs < MATERIALIZE_STEP_MIN_BUDGET_MS) return null;
  const deadline = Date.now() + budgetMs;
  const runStep = async (step: number, restoreTop?: number): Promise<MaterializeStepResult> => {
      let objectId: string | null = null;
      try {
        const document = record(await runtime.send(target.tabId, "DOM.getDocument", { depth: 0, pierce: true }));
        const root = record(document.root);
        if (!Number.isSafeInteger(root.nodeId)) throw new Error("BROWSER_DOM_READ_INVALID");
        const resolved = record(await runtime.send(target.tabId, "DOM.resolveNode", { nodeId: root.nodeId }));
        objectId = record(resolved.object).objectId as string;
        if (typeof objectId !== "string" || objectId.length === 0) throw new Error("BROWSER_DOM_READ_INVALID");
        const call = record(await runtime.send(target.tabId, "Runtime.callFunctionOn", {
          objectId, functionDeclaration: MATERIALIZE_STEP_FUNCTION,
          arguments: [{ value: { turnMarker, step, ...(restoreTop === undefined ? {} : { restoreTop }) } }],
          returnByValue: true, awaitPromise: false, silent: true,
        }));
        if (call.exceptionDetails !== undefined) throw new Error("BROWSER_DOM_READ_INVALID");
        return decodeMaterializeStep(record(call.result).value);
      } finally {
        if (objectId !== null) await runtime.send(target.tabId, "Runtime.releaseObject", { objectId });
      }
  };
  const seen = new Set<string>();
  let hitScrollTop: number | null = null;
  for (let step = 0; step < MATERIALIZE_STEP_MAX_COUNT; step += 1) {
    if (Date.now() + MATERIALIZE_STEP_INTERVAL_MS + MATERIALIZE_STEP_INTERVAL_MARGIN_MS >= deadline) return null;
    const result = await runStep(step);
    if (!result.pageVisible) return null;
    if (!result.containerFound && !result.atTop) return null;
    if (result.ids.length > 1) throw new Error("BROWSER_DOM_CANDIDATE_AMBIGUOUS");
    for (const id of result.ids) {
      seen.add(id);
      hitScrollTop ??= result.scrollTop;
    }
    if (seen.size > 1) throw new Error("BROWSER_DOM_CANDIDATE_AMBIGUOUS");
    if (result.atTop) {
      if (hitScrollTop !== null && hitScrollTop !== result.scrollTop) {
        if (Date.now() + MATERIALIZE_STEP_INTERVAL_MS + MATERIALIZE_STEP_INTERVAL_MARGIN_MS >= deadline) return null;
        const restored = await runStep(step, hitScrollTop);
        if ([restored.pageVisible, restored.containerFound].includes(false)) return null;
        await wait(MATERIALIZE_STEP_INTERVAL_MS);
      }
      return seen.values().next().value ?? null;
    }
    await wait(MATERIALIZE_STEP_INTERVAL_MS);
  }
  return null;
};

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
  observed.pendingCause === null
    || observed.pendingCause === "exact-user-turn-unavailable"
    || observed.pendingCause === "adjacent-assistant-missing",
  observed.nativeStage === "runtime-call-function-on",
].every(Boolean);

const decodeObservation = (
  value: unknown,
  expectedCurrentUrl: string,
): ExactAssistantObservation => {
  const observed = record(value);
  const keys = ["rawCount", "rawDomHtml", "semanticText", "currentUrl", "assistantTurnId",
    "precedingUserTurnId", "generatingRaw", "observedAt", "pendingCause", "nativeStage"];
  const rawCount = count(observed.rawCount);
  if (!observationValueShapeValid(observed, keys)) {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  if (observed.currentUrl !== expectedCurrentUrl) throw new Error("BROWSER_DOCUMENT_INVALID");
  if (rawCount > 1) throw new Error("BROWSER_DOM_CANDIDATE_AMBIGUOUS");
  if (rawCount === 0) {
    const pendingCause = observed.pendingCause as ExactAssistantPendingCause;
    if (pendingCause !== "exact-user-turn-unavailable"
      && pendingCause !== "adjacent-assistant-missing") throw new Error("BROWSER_DOM_READ_INVALID");
    return Object.freeze({
      rawCount, pendingCause, rawDomHtml: "", semanticText: "",
      observedAt: observed.observedAt as string, currentUrl: observed.currentUrl as string,
      assistantTurnId: observed.assistantTurnId as string,
      precedingUserTurnId: observed.precedingUserTurnId as string,
      generatingRaw: observed.generatingRaw as number, nativeStage: "runtime-call-function-on",
    });
  }
  if (observed.pendingCause !== null) throw new Error("BROWSER_DOM_READ_INVALID");
  const rawDomHtml = observed.rawDomHtml as string;
  if (rawDomHtml.length === 0) throw new Error("BROWSER_DOM_READ_INVALID");
  return Object.freeze({
    rawCount, pendingCause: null, rawDomHtml,
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
  observedUserTurnId: string,
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
      arguments: [{ value: { ...intent, observedUserTurnId } }],
      returnByValue: true, awaitPromise: true, silent: true,
    }));
    if (call.exceptionDetails !== undefined) throw new Error("BROWSER_DOM_READ_INVALID");
    const loaderAfter = await mainFrameLoaderId(runtime, target.tabId);
    if (loaderAfter !== expectedMainFrameLoaderId) throw new Error("BROWSER_DOCUMENT_INVALID");
    const observed = decodeObservation(record(call.result).value, intent.canonicalConversationUrl);
    if (observed.pendingCause === null && observed.precedingUserTurnId !== observedUserTurnId) {
      throw new Error("BROWSER_DOM_READ_INVALID");
    }
    return observed;
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
  commandDeadlineAt?: number,
): Promise<unknown> => {
  assertCurrent();
  const observedUserTurnId = await materializeExactUserTurn(
    debuggerRuntime, target, intent.turnMarker, commandDeadlineAt ?? Date.now() + 15_000,
  );
  assertCurrent();
  const observed = await observeExactAssistantTurn(
    debuggerRuntime, target, intent, expectedMainFrameLoaderId, observedUserTurnId ?? "",
  );
  assertCurrent();
  const rawDomHash = await sha256Text(observed.rawDomHtml);
  const semanticTextHash = await sha256Text(observed.semanticText);
  const targetRefHash = await sha256Text(target.targetRef);
  const documentRefHash = await sha256Text(target.documentRef);
  const revisionInput = Object.freeze({
    targetRefHash, documentRefHash, assistantTurnId: observed.assistantTurnId,
    currentUrl: observed.currentUrl,
    turnMarkerHash: await sha256Text(intent.turnMarker),
    precedingUserTurnId: observed.precedingUserTurnId,
    generatingRaw: observed.generatingRaw, rawDomHash, semanticTextHash,
    observedAt: observed.observedAt,
  });
  const observationRevisionHash = await sha256Text(
    canonicalBrowserExactAssistantTurnRevision(revisionInput, observed.pendingCause),
  );
  return Object.freeze({
    schemaVersion: "grasseye.browser.exact-assistant-turn.v4" as const,
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
    ...(observed.pendingCause === null ? {} : { pendingCause: observed.pendingCause }),
  });
};
