import { executionFailure } from "../../../../lib/execution-failure.js";
import type { BrowserTargetLease } from "../../../../lib/browser/browser-authority-api.js";
import type { GptExecutionContext } from "../../contract.js";
import {
  projectCoherentObservation, readCoherentObservation, type GptCoherentFactProjection,
} from "../../web/gpt-dom-observation.js";
import {
  GPT_ASSISTANT_TURN_SELECTOR, GPT_GENERATING_STOP_SELECTOR, GPT_USER_TURN_SELECTOR,
} from "./selectors.js";
import { canonicalGptConversationUrl } from "../../web/contracts/target-document.contract.js";

const HASH = /^sha256:[a-f0-9]{64}$/u;
const TURN = /^conversation-turn-([1-9][0-9]*)$/u;

type GptResponsePageState = Readonly<{
  currentUrl: string;
  userTurns: readonly Readonly<{ testId: string; promptHash: string }>[];
  assistantTurns: readonly Readonly<{ testId: string; semanticTextHash: string }>[];
  generatingRaw: number;
  facts: GptCoherentFactProjection;
}>;

const turnOrdinal = (turnId: string): number => {
  const match = TURN.exec(turnId);
  const ordinal = match ? Number(match[1]) : Number.NaN;
  if (!Number.isSafeInteger(ordinal) || ordinal < 1) throw executionFailure("failed", "GPT_TURN_ID_INVALID");
  return ordinal;
};

const readResponsePage = async (browser: BrowserTargetLease): Promise<GptResponsePageState> => {
  const observation = await readCoherentObservation(browser, [
    { queryId: "user-turns", selector: GPT_USER_TURN_SELECTOR, maxMatches: 20,
      fields: ["testId", "exactGptUserPromptHash"] },
    { queryId: "assistant-turns", selector: GPT_ASSISTANT_TURN_SELECTOR, maxMatches: 20,
      fields: ["testId", "semanticTextHash"] },
    { queryId: "generating", selector: GPT_GENERATING_STOP_SELECTOR, maxMatches: 2, fields: [] },
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
  return Object.freeze({
    currentUrl: observation.currentUrl,
    userTurns: Object.freeze(userTurns),
    assistantTurns: Object.freeze(assistantTurns),
    generatingRaw: row("generating").rawCount,
    facts: projectCoherentObservation(observation, "user-turns"),
  });
};

export const ensureResponseConversation = async (
  input: Readonly<{ browser: BrowserTargetLease; canonicalConversationUrl: string;
    context: GptExecutionContext; deadline: number }>,
): Promise<GptResponsePageState> => {
  const expected = canonicalGptConversationUrl(input.canonicalConversationUrl);
  for (;;) {
    if (input.context.signal?.aborted) throw executionFailure("failed", "GPT_IMAGE_WAIT_ABORTED");
    if (Date.now() >= input.deadline) throw executionFailure("failed", "GPT_IMAGE_TIMEOUT");
    const observed = await readResponsePage(input.browser);
    if (observed.currentUrl === expected) return observed;
    if (!input.context.navigateExactProviderConversation) {
      throw executionFailure("failed", "GPT_PROVIDER_CONVERSATION_GATE_REQUIRED");
    }
    const outcome = await input.context.navigateExactProviderConversation(expected, input.deadline);
    if (outcome === "deadline") throw executionFailure("failed", "GPT_IMAGE_TIMEOUT");
  }
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

export const directPredecessorTextTurn = (
  state: GptResponsePageState,
  currentAssistantTurnId: string,
): Readonly<{ testId: string; semanticTextHash: string }> | null => {
  const currentOrdinal = turnOrdinal(currentAssistantTurnId);
  if (currentOrdinal <= 2) return null;
  const predecessorTurnId = `conversation-turn-${currentOrdinal - 2}`;
  const matches = state.assistantTurns.filter((turn) => turn.testId === predecessorTurnId);
  if (matches.length > 1) throw executionFailure("failed", `GPT_ASSISTANT_TURN_COUNT_${matches.length}`);
  return matches[0] ?? null;
};
