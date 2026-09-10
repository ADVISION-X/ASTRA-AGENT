import { executionFailure } from "../../../../lib/execution-failure.js";
import type { BrowserTargetLease } from "../../../../lib/browser/browser-authority-api.js";
import type { GptExecutionContext } from "../../contract.js";
import { projectCoherentObservation, readCoherentObservation, type GptCoherentFactProjection } from "../../web/gpt-dom-observation.js";
import { canonicalGptConversationUrl } from "../../web/contracts/target-document.contract.js";

const USER = "[data-testid^='conversation-turn-']:has([data-message-author-role='user'])";
const ASSISTANT = "[data-testid^='conversation-turn-']:has([data-message-author-role='assistant'])";
const GENERATING = "#composer-submit-button[data-testid='stop-button']";
const TURN = /^conversation-turn-([1-9][0-9]*)$/u;
const HASH = /^sha256:[a-f0-9]{64}$/u;

export type ResponsePage = Readonly<{
  currentUrl: string;
  userTurns: readonly Readonly<{ testId: string; promptHash: string }>[];
  assistantTurns: readonly Readonly<{ testId: string; semanticTextHash: string }>[];
  generating: number;
  facts: GptCoherentFactProjection;
}>;

const ordinal = (id: string): number => {
  const value = Number(TURN.exec(id)?.[1]);
  if (!Number.isSafeInteger(value)) throw executionFailure("failed", "GPT_TURN_ID_INVALID");
  return value;
};

const readPage = async (browser: BrowserTargetLease): Promise<ResponsePage> => {
  const observation = await readCoherentObservation(browser, [
    { queryId: "users", selector: USER, maxMatches: 20, fields: ["testId", "exactGptUserPromptHash"] },
    { queryId: "assistants", selector: ASSISTANT, maxMatches: 20, fields: ["testId", "semanticTextHash"] },
    { queryId: "generating", selector: GENERATING, maxMatches: 2, fields: [] },
  ]);
  const row = (id: string) => observation.rows.find((candidate) => candidate.queryId === id)!;
  const users = row("users").matches.map((match) => {
    if (typeof match.testId !== "string" || !TURN.test(match.testId)
      || typeof match.exactGptUserPromptHash !== "string" || !HASH.test(match.exactGptUserPromptHash)) {
      throw executionFailure("failed", "GPT_DOM_RESULT_INVALID");
    }
    return Object.freeze({ testId: match.testId, promptHash: match.exactGptUserPromptHash });
  });
  const assistants = row("assistants").matches.map((match) => {
    if (typeof match.testId !== "string" || !TURN.test(match.testId)
      || typeof match.semanticTextHash !== "string" || !HASH.test(match.semanticTextHash)) {
      throw executionFailure("failed", "GPT_DOM_RESULT_INVALID");
    }
    return Object.freeze({ testId: match.testId, semanticTextHash: match.semanticTextHash });
  });
  return Object.freeze({ currentUrl: observation.currentUrl, userTurns: Object.freeze(users),
    assistantTurns: Object.freeze(assistants), generating: row("generating").rawCount,
    facts: projectCoherentObservation(observation, "users") });
};

export const readExactResponsePage = async (input: Readonly<{
  browser: BrowserTargetLease; canonicalConversationUrl: string; context: GptExecutionContext; deadline: number;
}>): Promise<ResponsePage> => {
  const expected = canonicalGptConversationUrl(input.canonicalConversationUrl);
  for (;;) {
    if (input.context.signal?.aborted) throw executionFailure("failed", "GPT_RESPONSE_WAIT_ABORTED");
    if (Date.now() >= input.deadline) throw executionFailure("failed", "GPT_RESPONSE_TIMEOUT");
    const page = await readPage(input.browser);
    if (page.currentUrl === expected) return page;
    if (!input.context.navigateCrossConversationPoll) throw executionFailure("failed", "GPT_CROSS_CONVERSATION_POLL_GATE_REQUIRED");
    const outcome = await input.context.navigateCrossConversationPoll(expected, input.deadline);
    if (outcome === "deadline") throw executionFailure("failed", "GPT_RESPONSE_TIMEOUT");
  }
};

export const adjacentAssistantId = (page: ResponsePage, promptHash: string): string | null => {
  const users = page.userTurns.filter((turn) => turn.promptHash === promptHash);
  if (users.length > 1) throw executionFailure("failed", `GPT_USER_TURN_COUNT_${users.length}`);
  if (!users[0]) return null;
  const id = `conversation-turn-${ordinal(users[0].testId) + 1}`;
  return page.assistantTurns.some((turn) => turn.testId === id) ? id : null;
};
