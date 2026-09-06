import { createHash } from "node:crypto";

import type { BrowserTargetLease } from "../../../../lib/browser/browser-authority-api.js";
import { executionFailure } from "../../../../lib/execution-failure.js";
import type { GptChildCapabilityIntent } from "../../contract.js";
import { numberInput, stringInput } from "../../web/child-handler.js";
import {
  projectCoherentObservation,
  readCoherentObservation,
  type GptCoherentFactProjection,
} from "../../web/gpt-dom-observation.js";
import {
  GPT_ASSISTANT_TURN_SELECTOR,
  GPT_COMPOSER_SELECTOR,
  GPT_USER_TURN_SELECTOR,
} from "./selectors.js";

const HASH = /^sha256:[a-f0-9]{64}$/u;
const TURN = /^conversation-turn-([1-9][0-9]*)$/u;

export const hashConversationValue = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

export const hashInput = (
  intent: GptChildCapabilityIntent<"verify_gpt_conversation_identity">,
  key: string,
): `sha256:${string}` => {
  const value = stringInput(intent, key);
  if (!HASH.test(value)) {
    throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:${key}`);
  }
  return value as `sha256:${string}`;
};

export const timeoutInput = (
  intent: GptChildCapabilityIntent<"verify_gpt_conversation_identity">,
): number => {
  const value = numberInput(intent, "timeoutMs");
  if (!Number.isSafeInteger(value) || value < 1 || value > 60_000) {
    throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:timeoutMs`);
  }
  return value;
};

export const turnOrdinal = (turnId: string): number => {
  const match = TURN.exec(turnId);
  const ordinal = match ? Number(match[1]) : Number.NaN;
  if (!Number.isSafeInteger(ordinal) || ordinal < 1) {
    throw executionFailure("failed", "GPT_TURN_ID_INVALID");
  }
  return ordinal;
};

type PageTurn = Readonly<{ testId: string; contentHash: string }>;
type ConversationState = Readonly<{
  currentUrl: string;
  composerEligible: number;
  userTurns: readonly PageTurn[];
  assistantTurnIds: readonly string[];
  facts: GptCoherentFactProjection;
}>;

export const readConversationState = async (
  browser: BrowserTargetLease,
): Promise<ConversationState> => {
  const observation = await readCoherentObservation(browser, [
    { queryId: "composer", selector: GPT_COMPOSER_SELECTOR, maxMatches: 2, fields: [] },
    { queryId: "user-turns", selector: GPT_USER_TURN_SELECTOR, maxMatches: 20,
      fields: ["testId" as const, "exactGptUserPromptHash" as const] },
    { queryId: "assistant-turns", selector: GPT_ASSISTANT_TURN_SELECTOR, maxMatches: 20,
      fields: ["testId" as const] },
  ]);
  const row = (queryId: string) => observation.rows.find((candidate) => candidate.queryId === queryId)!;
  const userTurns = row("user-turns").matches.map((match) => {
    if (typeof match.testId !== "string" || !TURN.test(match.testId)
      || typeof match.exactGptUserPromptHash !== "string" || !HASH.test(match.exactGptUserPromptHash)) {
      throw executionFailure("failed", "GPT_DOM_RESULT_INVALID");
    }
    return Object.freeze({ testId: match.testId, contentHash: match.exactGptUserPromptHash });
  });
  const assistantTurnIds = row("assistant-turns").matches.map((match) => {
    if (typeof match.testId !== "string" || !TURN.test(match.testId)) {
      throw executionFailure("failed", "GPT_DOM_RESULT_INVALID");
    }
    return match.testId;
  });
  return Object.freeze({
    currentUrl: observation.currentUrl,
    composerEligible: row("composer").eligibleCount,
    userTurns: Object.freeze(userTurns),
    assistantTurnIds: Object.freeze(assistantTurnIds),
    facts: projectCoherentObservation(observation, "composer"),
  });
};
