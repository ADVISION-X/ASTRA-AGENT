import type { GptStoppedEmptyClick } from "../exact-target/browser-gpt-retry-contract.js";
import { canonicalizeBrowserAuthorityValue } from "../transport/browser-authority-frame-codec.js";
import { EXACT_ASSISTANT_TURN_FUNCTION } from "./dom-exact-assistant-turn.js";
import { BROWSER_MECHANICAL_FACTS_READER_SOURCE } from "./dom-mechanical-facts.js";
import { readFixedDocument } from "./dom-fixed-document-read.js";
import { hashBrowserExtensionText } from "./websocket-actor-crypto.js";
import { executeBoundedBrowserWait } from "./extension-target-observation.js";
import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";

type Sample = Readonly<{ user: string; assistant: string; generating: number; nonempty: boolean; observedAt: string }>;
type RetrySample = Readonly<{ state: "response-changed" | "menu-ready" | "candidate" | "generation-started" | "unproven";
  sample: Sample; point: Readonly<{ x: number; y: number }> | null;
  startedBy: "stop-present" | "generation-changed" | "completed-text" | null }>;

/** The existing answer resolver owns identity; this function only qualifies its two native controls. */
const GPT_RETRY_ACTION_FUNCTION = `function (spec) {
  ${BROWSER_MECHANICAL_FACTS_READER_SOURCE}
  const answer = (${EXACT_ASSISTANT_TURN_FUNCTION}).call(document, {
    canonicalConversationUrl: spec.request.canonicalConversationUrl,
    turnMarker: spec.request.turnMarker, observedUserTurnId: null
  });
  const afterRetry = spec.after && spec.request.action === "regenerate";
  if (!answer.precedingUserTurnId || (!afterRetry && (answer.pendingCause !== null || answer.rawCount !== 1))) {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  const sample = { user: answer.precedingUserTurnId, assistant: answer.assistantTurnId,
    generating: answer.generatingRaw, nonempty: answer.semanticText.trim().length > 0, observedAt: answer.observedAt };
  const result = (state, point = null, startedBy = null) => ({ state, sample, point, startedBy });
  if (spec.after && spec.request.action === "regenerate") {
    const started = sample.generating > 0 ? "stop-present" : sample.nonempty ? "completed-text"
      : sample.assistant && sample.assistant !== spec.before.assistant ? "generation-changed" : null;
    return result(started ? "generation-started" : "unproven", null, started);
  }
  if (sample.generating > 0 || sample.nonempty) return result("response-changed");
  const turns = Array.from(document.querySelectorAll("[data-turn-key]"))
    .filter(turn => turn.getAttribute("data-turn-key") === sample.user);
  if (turns.length !== 1) throw new Error("BROWSER_DOM_CANDIDATE_AMBIGUOUS");
  const triggers = Array.from(turns[0].querySelectorAll("button[aria-label='重新生成回复']"));
  if (triggers.length !== 1) throw new Error("BROWSER_DOM_CANDIDATE_AMBIGUOUS");
  const trigger = triggers[0], triggerId = trigger.getAttribute("id"), controlled = trigger.getAttribute("aria-controls");
  const menus = controlled ? Array.from(document.querySelectorAll("[role='menu']"))
    .filter(menu => menu.getAttribute("id") === controlled) : [];
  const owned = trigger.getAttribute("aria-expanded") === "true" && menus.length === 1
    && !!triggerId && menus[0].getAttribute("aria-labelledby") === triggerId;
  const items = owned ? Array.from(menus[0].querySelectorAll("[role='menuitem']"))
    .filter(item => /^重试(?:\\s*[•·]\\s*[^\\n]+)?$/.test((item.textContent || "").replace(/\\s+/g, " ").trim())) : [];
  const ready = owned && items.length === 1 && !items[0].hasAttribute("disabled")
    && items[0].getAttribute("aria-disabled") !== "true";
  if (spec.request.action === "open-menu" && ready) return result("menu-ready");
  if (spec.after) return result("unproven");
  if (spec.request.action === "regenerate" && !ready) throw new Error("BROWSER_DOM_READ_INVALID");
  const candidate = spec.request.action === "open-menu" ? trigger : items[0];
  const facts = browserMechanicalFacts(candidate, true);
  if (!facts.connected || !facts.layout || !facts.bounds || !facts.visible || facts.ariaHidden || facts.inert
    || facts.disabled || facts.ariaDisabled || !facts.viewport || !facts.hitTest
    || getComputedStyle(candidate).pointerEvents === "none") throw new Error("BROWSER_DOM_READ_INVALID");
  return result("candidate", { x: facts.bounds.x + facts.bounds.width / 2, y: facts.bounds.y + facts.bounds.height / 2 });
}`;

const asSample = (value: unknown): RetrySample => {
  const row = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  const sample = row?.sample as Record<string, unknown> | undefined;
  if (!row || Object.keys(row).sort().join("|") !== "point|sample|startedBy|state" || !sample
    || Object.keys(sample).sort().join("|") !== "assistant|generating|nonempty|observedAt|user"
    || typeof sample.user !== "string" || !sample.user || typeof sample.assistant !== "string"
    || !Number.isSafeInteger(sample.generating) || Number(sample.generating) < 0 || typeof sample.nonempty !== "boolean"
    || typeof sample.observedAt !== "string" || !Number.isFinite(Date.parse(sample.observedAt))
    || !["response-changed", "menu-ready", "candidate", "generation-started", "unproven"].includes(String(row.state))) {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  const point = row.point as Record<string, unknown> | null;
  if (row.state === "candidate" && (!point || Object.keys(point).sort().join("|") !== "x|y"
    || typeof point.x !== "number" || typeof point.y !== "number" || !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  return row as RetrySample;
};

const revision = (request: GptStoppedEmptyClick, sample: Sample): Promise<`sha256:${string}`> =>
  hashBrowserExtensionText(canonicalizeBrowserAuthorityValue({ originalEffectIdentityHash: request.originalEffectIdentityHash,
    previousEffectIdentityHash: request.previousEffectIdentityHash, retryOrdinal: request.retryOrdinal, ...sample }));

export const executeGptStoppedEmptyClick = async (input: Readonly<{
  runtime: ExtensionDebuggerRuntime; target: ExtensionExactTarget; request: GptStoppedEmptyClick;
  assertCurrent(): void; dispatch(point: Readonly<{ x: number; y: number }>): Promise<void>;
}>): Promise<unknown> => {
  const read = (after: boolean, before: Sample | null) => readFixedDocument({ runtime: input.runtime,
    target: input.target, expectedMainFrameLoaderId: input.target.loaderId,
    stage: "exact-assistant-observation", assertCurrent: input.assertCurrent,
    script: GPT_RETRY_ACTION_FUNCTION, argument: { request: input.request, after, before }, decode: asSample });
  const before = await read(false, null);
  const action = before.state === "candidate";
  if (action) {
    input.assertCurrent();
    await input.dispatch(before.point!);
    await executeBoundedBrowserWait(2_500);
    input.assertCurrent();
  }
  const after = action ? await read(true, before.sample) : before;
  const [preRevision, postRevision] = await Promise.all([
    revision(input.request, before.sample), revision(input.request, after.sample),
  ]);
  const changed = after.state === "response-changed" && !action;
  const verified = changed || after.state === "menu-ready" || after.state === "generation-started";
  return { candidateCount: 1, identityRevalidated: true, mutationCount: action ? 1 : 0,
    ...(action ? { clicked: true } : { zeroActionSatisfied: true }), postconditionVerified: verified,
    gptRetryState: verified ? after.state : "unproven", gptRetryObservationRevisionHash: postRevision,
    gptRetryFact: changed ? null : { preEmptyObservationRevisionHash: preRevision,
      preEmptyObservedAt: before.sample.observedAt, observationRevisionHash: postRevision,
      observedAt: after.sample.observedAt, generationStartedBy: after.startedBy } };
};
