import { executionFailure } from "../../../../lib/execution-failure.js";

import type { GptChildCapabilityIntent } from "../../contract.js";
import {
  stringInput,
} from "../../web/child-handler.js";

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
