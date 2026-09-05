import { executionFailure } from "../../../../lib/execution-failure.js";
import type { BrowserTargetLease } from "../../../../lib/browser/browser-authority-api.js";
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
