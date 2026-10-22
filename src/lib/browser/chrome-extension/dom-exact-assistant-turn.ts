import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";
import type { BrowserDomIntent } from "../exact-target/browser-dom-intent.js";
import { canonicalBrowserExactAssistantTurnRevision } from "../exact-target/exact-assistant-turn-revision.js";
import { BROWSER_CANONICAL_SEMANTIC_TEXT_READER_SOURCE } from "./dom-semantic-text.js";
import { readFixedDocument } from "./dom-fixed-document-read.js";

type ExactIntent = Extract<BrowserDomIntent, { kind: "readExactAssistantTurn" }>;
type PendingCause = "exact-user-turn-unavailable" | "adjacent-assistant-missing" | null;
type Observation = Readonly<{
  rawCount: number; rawDomHtml: string; semanticText: string; currentUrl: string;
  assistantTurnId: string; precedingUserTurnId: string; generatingRaw: number;
  observedAt: string; pendingCause: PendingCause; nativeStage: "runtime-evaluate";
}>;
type ScanSample = Readonly<{
  ids: readonly string[]; containerFound: boolean; atTop: boolean;
  scrollTop: number; nextScrollTop: number;
}>;
type ReadContext = Readonly<{
  runtime: ExtensionDebuggerRuntime; target: ExtensionExactTarget;
  expectedMainFrameLoaderId: string; assertCurrent(): void;
}>;

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const MARKER_USER_SOURCE = `function browserMarkerUserId(turn, marker) {
  const units = Array.from(turn.querySelectorAll("[data-chatgpt-search-unit-key]"));
  const users = units.filter((unit) =>
    (unit.getAttribute("data-chatgpt-search-unit-key") || "").endsWith(":user"));
  const matches = users.filter((unit) => Array.from(unit.querySelectorAll("[data-user-message-bubble='true']"))
    .some((bubble) => (bubble.textContent || "").includes(marker)));
  if (matches.length === 0) return "";
  if (matches.length > 1) throw new Error("BROWSER_DOM_CANDIDATE_AMBIGUOUS");
  const id = turn.getAttribute("data-turn-key") || "";
  if (users.length !== 1 || matches[0].querySelectorAll("[data-user-message-bubble='true']").length !== 1
    || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)
    || matches[0].getAttribute("data-chatgpt-search-message-ids") !== id) {
    throw new Error("BROWSER_DOCUMENT_INVALID");
  }
  return id;
}
function browserExactUrl(expected) {
  const url = new URL(location.href);
  const parts = url.pathname.split("/");
  if (url.protocol !== "https:" || url.origin !== "https://chatgpt.com" || url.username || url.password
    || !(url.pathname === "/" || (parts.length === 3 && parts[1] === "c"
      && parts[2].length > 0 && parts[2].length <= 256))) throw new Error("BROWSER_ORIGIN_REJECTED");
  const current = url.origin + url.pathname;
  if (current !== expected) throw new Error("BROWSER_DOCUMENT_INVALID");
  return current;
}`;

/** No await: marker, adjacency, body and stop are one current Document sample. */
const EXACT_ASSISTANT_TURN_FUNCTION = `function (spec) {
  ${MARKER_USER_SOURCE}
  ${BROWSER_CANONICAL_SEMANTIC_TEXT_READER_SOURCE}
  if (this !== document) throw new Error("BROWSER_DOCUMENT_INVALID");
  const currentUrl = browserExactUrl(spec.canonicalConversationUrl);
  const matches = Array.from(document.querySelectorAll("[data-turn-key]"))
    .map((turn) => ({ turn, id: browserMarkerUserId(turn, spec.turnMarker) })).filter((item) => item.id);
  if (matches.length > 1) throw new Error("BROWSER_DOM_CANDIDATE_AMBIGUOUS");
  if (matches.length === 1 && matches[0].id !== spec.observedUserTurnId) throw new Error("BROWSER_DOCUMENT_INVALID");
  const precedingUserTurnId = matches[0]?.id || "";
  const units = matches.length ? Array.from(matches[0].turn.querySelectorAll("[data-chatgpt-search-unit-key]")) : [];
  const user = units.find((unit) => (unit.getAttribute("data-chatgpt-search-unit-key") || "").endsWith(":user"));
  const adjacent = user ? units[units.indexOf(user) + 1] : null;
  const assistants = units.filter((unit) => (unit.getAttribute("data-chatgpt-search-unit-key") || "").endsWith(":assistant"));
  if (assistants.length > 1) throw new Error("BROWSER_DOM_CANDIDATE_AMBIGUOUS");
  const assistant = adjacent && (adjacent.getAttribute("data-chatgpt-search-unit-key") || "").endsWith(":assistant")
    ? adjacent : null;
  if (assistants.length && !assistant) throw new Error("BROWSER_DOCUMENT_INVALID");
  const bodies = assistant ? Array.from(assistant.querySelectorAll("[data-markdown-text-style='assistant-message']")) : [];
  if (bodies.length > 1) throw new Error("BROWSER_DOM_CANDIDATE_AMBIGUOUS");
  const ids = (assistant?.getAttribute("data-chatgpt-search-message-ids") || "").split(/\\s+/).filter(Boolean);
  const assistantTurnId = ids[0] || "";
  if (assistant && (assistant.querySelectorAll("h4[data-conversation-role='assistant']").length !== 1
    || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(assistantTurnId)
    || ids.some((id) => id !== assistantTurnId))) throw new Error("BROWSER_DOCUMENT_INVALID");
  const node = bodies[0];
  const pendingCause = !matches.length ? "exact-user-turn-unavailable" : !node ? "adjacent-assistant-missing" : null;
  return { rawCount: bodies.length, rawDomHtml: node ? node.outerHTML : "",
    semanticText: node ? browserCanonicalSemanticText(node) : "", currentUrl, precedingUserTurnId,
    assistantTurnId, pendingCause, observedAt: new Date().toISOString(), nativeStage: "runtime-evaluate",
    generatingRaw: document.querySelectorAll("form[data-chatgpt-composer]:not([data-composer-placement='home']) button[aria-label='停止']").length };
}`;

/** Mounted markers return before scroll writes; absent markers follow live geometry. */
const MATERIALIZE_STEP_FUNCTION = `function (spec) {
  ${MARKER_USER_SOURCE}
  if (this !== document) throw new Error("BROWSER_DOCUMENT_INVALID");
  browserExactUrl(spec.canonicalConversationUrl);
  const turns = Array.from(document.querySelectorAll("[data-turn-key]"));
  const ids = turns.map((turn) => browserMarkerUserId(turn, spec.turnMarker)).filter(Boolean);
  if (ids.length > 1) throw new Error("BROWSER_DOM_CANDIDATE_AMBIGUOUS");
  if (ids.length) return { ids, containerFound: true, atTop: false, scrollTop: 0, nextScrollTop: 0 };
  let container = null;
  let unknown = false;
  let ancestor = turns[0]?.parentElement;
  while (ancestor && ancestor !== document.body) {
    const style = getComputedStyle(ancestor);
    if (ancestor.scrollHeight > ancestor.clientHeight) {
      if (!turns.every((turn) => ancestor.contains(turn))) unknown = true;
      else if (style.overflowY === "auto" || style.overflowY === "scroll") { container = ancestor; break; }
      else if (style.overflowY !== "visible") unknown = true;
    }
    ancestor = ancestor.parentElement;
  }
  if (!unknown && !container && document.scrollingElement?.scrollHeight > document.scrollingElement?.clientHeight) {
    container = document.scrollingElement;
  }
  if (unknown || !container) return { ids: [], containerFound: false, atTop: true, scrollTop: 0, nextScrollTop: 0 };
  const reverse = getComputedStyle(container).flexDirection === "column-reverse";
  const top = reverse ? container.clientHeight - container.scrollHeight : 0;
  const scrollTop = container.scrollTop;
  if (spec.resetBottom) container.scrollTop = reverse ? 0 : container.scrollHeight;
  else if (!spec.initial && scrollTop > top + 1) container.scrollTop = Math.max(top, scrollTop - 0.8 * container.clientHeight);
  return { ids: [], containerFound: true, atTop: scrollTop <= top + 1, scrollTop, nextScrollTop: container.scrollTop };
}`;

const record = (value: unknown, keys: readonly string[]): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).length !== keys.length || !keys.every((key) => Object.hasOwn(value, key))) {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  return value as Record<string, unknown>;
};

const decodeScan = (value: unknown): ScanSample => {
  const row = record(value, ["ids", "containerFound", "atTop", "scrollTop", "nextScrollTop"]);
  if (!Array.isArray(row.ids) || !row.ids.every((id) => typeof id === "string" && UUID.test(id))
    || typeof row.containerFound !== "boolean" || typeof row.atTop !== "boolean"
    || typeof row.scrollTop !== "number" || !Number.isFinite(row.scrollTop)
    || typeof row.nextScrollTop !== "number" || !Number.isFinite(row.nextScrollTop)) throw new Error("BROWSER_DOM_READ_INVALID");
  if (row.ids.length > 1) throw new Error("BROWSER_DOM_CANDIDATE_AMBIGUOUS");
  return Object.freeze(row) as ScanSample;
};

const observationShapeValid = (row: Record<string, unknown>): boolean => [
  ["rawDomHtml", "semanticText", "currentUrl", "assistantTurnId", "precedingUserTurnId", "observedAt"]
    .every((key) => typeof row[key] === "string"),
  Number.isSafeInteger(row.rawCount) && (row.rawCount as number) >= 0,
  Number.isSafeInteger(row.generatingRaw) && (row.generatingRaw as number) >= 0,
  typeof row.observedAt === "string" && Number.isFinite(Date.parse(row.observedAt))
    && new Date(row.observedAt).toISOString() === row.observedAt,
  row.nativeStage === "runtime-evaluate",
].every(Boolean);

const assertObservationLocation = (row: Record<string, unknown>, url: string, userId: string): void => {
  if (row.currentUrl !== url) throw new Error("BROWSER_DOCUMENT_INVALID");
  if (row.rawCount === 1 && (!UUID.test(row.assistantTurnId as string) || row.precedingUserTurnId !== userId)) {
    throw new Error("BROWSER_DOCUMENT_INVALID");
  }
};

const decodeObservation = (value: unknown, expected: Readonly<{
  url: string; userId: string;
}>): Observation => {
  const row = record(value, ["rawCount", "rawDomHtml", "semanticText", "currentUrl", "assistantTurnId",
    "precedingUserTurnId", "generatingRaw", "observedAt", "pendingCause", "nativeStage"]);
  if (!observationShapeValid(row)) throw new Error("BROWSER_DOM_READ_INVALID");
  assertObservationLocation(row, expected.url, expected.userId);
  if ((row.rawCount as number) > 1) throw new Error("BROWSER_DOM_CANDIDATE_AMBIGUOUS");
  const pending = row.pendingCause;
  if (row.rawCount === 0) {
    if ((pending !== "exact-user-turn-unavailable" && pending !== "adjacent-assistant-missing")
      || row.rawDomHtml !== "" || row.semanticText !== "") throw new Error("BROWSER_DOM_READ_INVALID");
    if (pending === "exact-user-turn-unavailable" ? row.precedingUserTurnId !== "" || row.assistantTurnId !== ""
      : !expected.userId || row.precedingUserTurnId !== expected.userId) throw new Error("BROWSER_DOCUMENT_INVALID");
  } else {
    if (pending !== null || row.rawDomHtml === "") throw new Error("BROWSER_DOM_READ_INVALID");
  }
  return Object.freeze(row) as Observation;
};

const pause = async (duration: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, duration));

const materializeExactUserTurn = async (
  context: ReadContext, intent: ExactIntent, commandDeadlineAt: number,
): Promise<string | null> => {
  const deadline = Math.min(Date.now() + 12_000, commandDeadlineAt - 3_000);
  const runStep = (options: Readonly<{ initial?: boolean; resetBottom?: boolean }> = {}) => readFixedDocument({
    ...context, script: MATERIALIZE_STEP_FUNCTION, argument: { ...intent, ...options },
    stage: "exact-user-materialization", decode: decodeScan,
  });
  let sample = await runStep({ initial: true });
  if (sample.ids.length === 1) return sample.ids[0]!;
  if (!sample.containerFound || Date.now() + 500 >= deadline) return null;
  sample = await runStep({ resetBottom: true });
  if (sample.ids.length === 1) return sample.ids[0]!;
  while (sample.containerFound && Date.now() + 525 < deadline) {
    sample = await runStep();
    if (sample.ids.length === 1) return sample.ids[0]!;
    if (!sample.containerFound || sample.atTop) return null;
    if (sample.nextScrollTop === sample.scrollTop) {
      await pause(100);
      const settled = await runStep({ initial: true });
      if (settled.ids.length === 1) return settled.ids[0]!;
      if (!settled.containerFound || settled.atTop || settled.scrollTop === sample.scrollTop) return null;
      sample = settled;
    } else await pause(25);
  }
  return null;
};

const sha256 = async (value: string): Promise<`sha256:${string}`> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
};

const bindReply = async (target: ExtensionExactTarget, intent: ExactIntent, observed: Observation): Promise<unknown> => {
  const [rawDomHash, semanticTextHash, targetRefHash, documentRefHash, turnMarkerHash] = await Promise.all([
    sha256(observed.rawDomHtml), sha256(observed.semanticText), sha256(target.targetRef),
    sha256(target.documentRef), sha256(intent.turnMarker),
  ]);
  const observationRevisionHash = await sha256(canonicalBrowserExactAssistantTurnRevision({
    targetRefHash, documentRefHash, turnMarkerHash, rawDomHash, semanticTextHash,
    currentUrl: observed.currentUrl, assistantTurnId: observed.assistantTurnId,
    precedingUserTurnId: observed.precedingUserTurnId, generatingRaw: observed.generatingRaw, observedAt: observed.observedAt,
  }, observed.pendingCause));
  return Object.freeze({ schemaVersion: "grasseye.browser.exact-assistant-turn.v4", targetRefHash,
    documentRefHash, observationRevisionHash, rawDomHash, semanticTextHash,
    rawDomHtml: observed.rawDomHtml, semanticText: observed.semanticText, currentUrl: observed.currentUrl,
    assistantTurnId: observed.assistantTurnId, precedingUserTurnId: observed.precedingUserTurnId,
    generatingRaw: observed.generatingRaw, observedAt: observed.observedAt,
    ...(observed.pendingCause === null ? {} : { pendingCause: observed.pendingCause }),
  });
};

export const executeExactAssistantTurnRead = async (
  runtime: ExtensionDebuggerRuntime, target: ExtensionExactTarget, intent: ExactIntent,
  assertCurrent: () => void, expectedMainFrameLoaderId: string, commandDeadlineAt = Date.now() + 15_000,
): Promise<unknown> => {
  const context = { runtime, target, assertCurrent, expectedMainFrameLoaderId };
  const userId = await materializeExactUserTurn(context, intent, commandDeadlineAt);
  const observed = await readFixedDocument({ ...context, stage: "exact-assistant-observation",
    script: EXACT_ASSISTANT_TURN_FUNCTION, argument: { ...intent, observedUserTurnId: userId ?? "" },
    decode: (value) => decodeObservation(value, { url: intent.canonicalConversationUrl, userId: userId ?? "" }),
  });
  assertCurrent();
  return bindReply(target, intent, observed);
};
