import { executionFailure } from "../../../lib/execution-failure.js";
import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import {
  projectCoherentObservation, readCoherentObservation, type GptCoherentFactProjection,
} from "./gpt-dom-observation.js";
import {
  GPT_ASSISTANT_TURN_SELECTOR, GPT_GENERATING_STOP_SELECTOR, GPT_RATE_LIMIT_ACK_SELECTOR,
  GPT_RATE_LIMIT_ACK_TEXT, GPT_RATE_LIMIT_DIALOG_SELECTOR, GPT_RATE_LIMIT_HEADING_SELECTOR,
  GPT_RATE_LIMIT_HEADING_TEXT, GPT_RATE_LIMIT_ROOT_SELECTOR, GPT_USER_TURN_SELECTOR,
} from "./gpt-page-selectors.js";
import { canonicalGptConversationUrl } from "./contracts/target-document.contract.js";

const HASH = /^sha256:[a-f0-9]{64}$/u;
const TURN = /^conversation-turn-([1-9][0-9]*)$/u;

export type GptResponsePageState = Readonly<{
  currentUrl: string;
  userTurns: readonly Readonly<{ testId: string; promptHash: string }>[];
  assistantTurns: readonly Readonly<{ testId: string; semanticTextHash: string }>[];
  generatingRaw: number;
  rateLimit: Readonly<{
    rootRaw: number;
    rootEligible: number;
    dialogEligible: number;
    headingEligible: number;
    ackEligible: number;
    ackTag: string | null;
    ackDisabled: boolean | null;
    ackAriaDisabled: boolean | null;
  }>;
  facts: GptCoherentFactProjection;
}>;

export const turnOrdinal = (turnId: string): number => {
  const match = TURN.exec(turnId);
  const ordinal = match ? Number(match[1]) : Number.NaN;
  if (!Number.isSafeInteger(ordinal) || ordinal < 1) throw executionFailure("failed", "GPT_TURN_ID_INVALID");
  return ordinal;
};

export const readResponsePage = async (browser: BrowserTargetLease): Promise<GptResponsePageState> => {
  const observation = await readCoherentObservation(browser, [
    { queryId: "user-turns", selector: GPT_USER_TURN_SELECTOR, maxMatches: 20,
      fields: ["testId", "exactGptUserPromptHash"] },
    { queryId: "assistant-turns", selector: GPT_ASSISTANT_TURN_SELECTOR, maxMatches: 20,
      fields: ["testId", "semanticTextHash"] },
    { queryId: "generating", selector: GPT_GENERATING_STOP_SELECTOR, maxMatches: 2, fields: [] },
    { queryId: "rate-root", selector: GPT_RATE_LIMIT_ROOT_SELECTOR, maxMatches: 2, fields: [] },
    { queryId: "rate-dialog", selector: GPT_RATE_LIMIT_DIALOG_SELECTOR, maxMatches: 2, fields: [] },
    { queryId: "rate-heading", selector: GPT_RATE_LIMIT_HEADING_SELECTOR,
      textEquals: GPT_RATE_LIMIT_HEADING_TEXT, maxMatches: 2, fields: [] },
    { queryId: "rate-ack", selector: GPT_RATE_LIMIT_ACK_SELECTOR,
      textEquals: GPT_RATE_LIMIT_ACK_TEXT, maxMatches: 2,
      fields: ["tagName", "disabled", "ariaDisabled"] },
  ]);
  const row = (queryId: string) => observation.rows.find((candidate) => candidate.queryId === queryId)!;
  const userTurns = row("user-turns").matches.map((match) => {
    if (typeof match.testId !== "string" || !TURN.test(match.testId)
      || typeof match.exactGptUserPromptHash !== "string" || !HASH.test(match.exactGptUserPromptHash)) {
      throw executionFailure("failed", "GPT_DOM_RESULT_INVALID");
    }
    return Object.freeze({ testId: match.testId, promptHash: match.exactGptUserPromptHash });
  });
  const assistantTurns = row("assistant-turns").matches.map((match) => {
    if (typeof match.testId !== "string" || !TURN.test(match.testId)
      || typeof match.semanticTextHash !== "string" || !HASH.test(match.semanticTextHash)) {
      throw executionFailure("failed", "GPT_DOM_RESULT_INVALID");
    }
    return Object.freeze({ testId: match.testId, semanticTextHash: match.semanticTextHash });
  });
  const ack = row("rate-ack").matches[0];
  return Object.freeze({
    currentUrl: observation.currentUrl,
    userTurns: Object.freeze(userTurns),
    assistantTurns: Object.freeze(assistantTurns),
    generatingRaw: row("generating").rawCount,
    rateLimit: Object.freeze({
      rootRaw: row("rate-root").rawCount,
      rootEligible: row("rate-root").eligibleCount,
      dialogEligible: row("rate-dialog").eligibleCount,
      headingEligible: row("rate-heading").eligibleCount,
      ackEligible: row("rate-ack").eligibleCount,
      ackTag: typeof ack?.tagName === "string" ? ack.tagName : null,
      ackDisabled: typeof ack?.disabled === "boolean" ? ack.disabled : null,
      ackAriaDisabled: typeof ack?.ariaDisabled === "boolean" ? ack.ariaDisabled : null,
    }),
    facts: projectCoherentObservation(observation, "user-turns"),
  });
};

export const ensureResponseConversation = async (
  browser: BrowserTargetLease,
  canonicalConversationUrl: string,
): Promise<GptResponsePageState> => {
  const expected = canonicalGptConversationUrl(canonicalConversationUrl);
  let observed = await readResponsePage(browser);
  if (observed.currentUrl !== expected) {
    await browser.navigate({ url: expected, title: "poll exact GPT conversation" });
    observed = await readResponsePage(browser);
  }
  if (observed.currentUrl !== expected) throw executionFailure("failed", "GPT_CONVERSATION_URL_MISMATCH");
  return observed;
};

export const assistantTurnForPrompt = (
  state: GptResponsePageState,
  expectedPromptHash: string,
): string | null => {
  const users = state.userTurns.filter((turn) => turn.promptHash === expectedPromptHash);
  if (users.length > 1) throw executionFailure("failed", `GPT_USER_TURN_COUNT_${users.length}`);
  if (users.length === 0) return null;
  const assistantTurnId = `conversation-turn-${turnOrdinal(users[0]!.testId) + 1}`;
  return state.assistantTurns.some((turn) => turn.testId === assistantTurnId) ? assistantTurnId : null;
};

export const rateLimitState = (state: GptResponsePageState): "absent" | "exact" => {
  const rate = state.rateLimit;
  if (rate.rootRaw === 0 && rate.rootEligible === 0 && rate.dialogEligible === 0
    && rate.headingEligible === 0 && rate.ackEligible === 0) return "absent";
  if (rate.rootRaw === 1 && rate.rootEligible === 1 && rate.dialogEligible === 1
    && rate.headingEligible === 1 && rate.ackEligible === 1 && rate.ackTag === "BUTTON"
    && rate.ackDisabled === false && rate.ackAriaDisabled === false) return "exact";
  throw executionFailure("failed", "GPT_PROVIDER_RATE_LIMIT_DIALOG_INVALID");
};
