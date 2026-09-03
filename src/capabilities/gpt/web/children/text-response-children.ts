import { executionFailure } from "../../../../lib/execution-failure.js";

import type { GptChildHandlerMap } from "../child-handler.js";
import {
  requireBrowser,
  requireExactInputKeys,
  stringInput,
} from "../child-handler.js";
import { canonicalGptConversationUrl } from "../contracts/target-document.contract.js";

const HASH = /^sha256:[a-f0-9]{64}$/u;
const TURN = /^conversation-turn-[1-9][0-9]*$/u;
type AnyHandler = NonNullable<GptChildHandlerMap[keyof GptChildHandlerMap]>;
type AnyIntent = Parameters<AnyHandler>[0];
type AnyContext = Parameters<AnyHandler>[1];

const hashInput = (intent: AnyIntent, key: string): string => {
  const value = stringInput(intent, key);
  if (!HASH.test(value)) throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:${key}`);
  return value;
};

const conversationInputs = (intent: AnyIntent): void => {
  canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
  hashInput(intent, "expectedPromptHash");
  stringInput(intent, "turnMarker");
};

const coherentSemanticHandoffRequired = (context: AnyContext): never => {
  requireBrowser(context);
  throw executionFailure("failed", "GPT_BROWSER_COHERENT_SEMANTIC_HANDOFF_REQUIRED");
};

export const textResponseChildHandlers = {
  async wait_for_stable_gpt_text(intent, context) {
    requireExactInputKeys(intent, [
      "absoluteDeadline", "canonicalConversationUrl", "expectedPromptHash", "turnMarker",
    ]);
    conversationInputs(intent);
    const deadline = Date.parse(stringInput(intent, "absoluteDeadline"));
    if (!Number.isFinite(deadline) || deadline > Date.now() + 3_600_000) {
      throw executionFailure("failed", "GPT_RESPONSE_ABSOLUTE_DEADLINE_INVALID");
    }
    return coherentSemanticHandoffRequired(context);
  },

  async checkpoint_gpt_text_response(intent, context) {
    requireExactInputKeys(intent, [
      "assistantTurnId", "canonicalConversationUrl", "expectedPromptHash", "expectedResponseHash", "turnMarker",
    ]);
    conversationInputs(intent);
    if (!TURN.test(stringInput(intent, "assistantTurnId"))) {
      throw executionFailure("failed", "GPT_CHILD_INPUT_INVALID:checkpoint_gpt_text_response:assistantTurnId");
    }
    hashInput(intent, "expectedResponseHash");
    return coherentSemanticHandoffRequired(context);
  },
} satisfies GptChildHandlerMap;
