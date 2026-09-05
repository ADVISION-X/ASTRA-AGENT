import { executionFailure } from "../../../../lib/execution-failure.js";

import type { GptChildCapabilityIntent } from "../../contract.js";
import {
  stringInput,
} from "../../web/child-handler.js";
import type {
  GptCoherentFactProjection,
  GptExactAssistantTurnObservation,
} from "../../web/gpt-dom-observation.js";

const HASH = /^sha256:[a-f0-9]{64}$/u;
const TURN = /^conversation-turn-[1-9][0-9]*$/u;

export const responseHashInput = (
  intent: GptChildCapabilityIntent<"checkpoint_gpt_text_response">,
  key: string,
): `sha256:${string}` => {
  const value = stringInput(intent, key);
  if (!HASH.test(value)) {
    throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:${key}`);
  }
  return value as `sha256:${string}`;
};

export const isGptTurnId = (value: string): boolean => TURN.test(value);

export const exactAssistantFacts = (
  facts: GptCoherentFactProjection,
  assistant: GptExactAssistantTurnObservation,
): GptCoherentFactProjection => {
  if (!facts.authorityRefHashes.includes(assistant.targetRefHash)
    || !facts.authorityRefHashes.includes(assistant.documentRefHash)) {
    throw executionFailure("failed", "GPT_EXACT_ASSISTANT_TURN_DOCUMENT_MISMATCH");
  }
  return Object.freeze({ ...facts, factResultIds: Object.freeze([
    ...facts.factResultIds, `gpt-assistant-turn-fact:${assistant.exactCallIdentityHash.slice(7)}`,
  ]) });
};
