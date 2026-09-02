import { executionFailure } from "../../../../lib/typed-failure.js";

import type { GptChildHandlerMap } from "../child-handler.js";
import {
  numberInput,
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

const timeoutInput = (intent: AnyIntent): number => {
  const value = numberInput(intent, "timeoutMs");
  if (!Number.isSafeInteger(value) || value < 1 || value > 60_000) {
    throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:timeoutMs`);
  }
  return value;
};

const sourceCheckpointInput = (intent: AnyIntent): void => {
  if (!TURN.test(stringInput(intent, "sourceAssistantTurnId"))) {
    throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:sourceAssistantTurnId`);
  }
  canonicalGptConversationUrl(stringInput(intent, "sourceCanonicalConversationUrl"));
  hashInput(intent, "sourcePromptHash");
  hashInput(intent, "sourceResponseHash");
  stringInput(intent, "sourceTurnMarker");
  timeoutInput(intent);
};

const coherentPageHandoffRequired = (context: AnyContext): never => {
  requireBrowser(context);
  throw executionFailure("failed", "GPT_BROWSER_COHERENT_PAGE_HANDOFF_REQUIRED");
};

export const conversationChildHandlers = {
  async prepare_clean_gpt_chat(intent, context) {
    requireExactInputKeys(intent, ["timeoutMs"]);
    timeoutInput(intent);
    return coherentPageHandoffRequired(context);
  },

  async focus_exact_gpt_conversation(intent, context) {
    requireExactInputKeys(intent, ["canonicalConversationUrl"]);
    canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
    return coherentPageHandoffRequired(context);
  },

  async verify_gpt_conversation_identity(intent, context) {
    requireExactInputKeys(intent, [
      "canonicalConversationUrl", "expectedPromptHash", "expectedResponseHash", "timeoutMs", "turnMarker",
    ]);
    canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
    hashInput(intent, "expectedPromptHash");
    hashInput(intent, "expectedResponseHash");
    timeoutInput(intent);
    stringInput(intent, "turnMarker");
    return coherentPageHandoffRequired(context);
  },

  async open_gpt_checkpoint_actions_menu(intent, context) {
    requireExactInputKeys(intent, [
      "sourceAssistantTurnId", "sourceCanonicalConversationUrl", "sourcePromptHash",
      "sourceResponseHash", "sourceTurnMarker", "timeoutMs",
    ]);
    sourceCheckpointInput(intent);
    return coherentPageHandoffRequired(context);
  },

  async fork_exact_gpt_conversation_at_checkpoint(intent, context) {
    requireExactInputKeys(intent, [
      "sourceAssistantTurnId", "sourceCanonicalConversationUrl", "sourcePromptHash",
      "sourceResponseHash", "sourceTurnMarker", "timeoutMs",
    ]);
    sourceCheckpointInput(intent);
    return coherentPageHandoffRequired(context);
  },
} satisfies GptChildHandlerMap;
