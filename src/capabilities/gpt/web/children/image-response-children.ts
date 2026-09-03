import { executionFailure } from "../../../../lib/execution-failure.js";

import type { GptChildHandlerMap } from "../child-handler.js";
import {
  recordInput,
  requireBrowser,
  requireExactInputKeys,
  stringInput,
} from "../child-handler.js";
import { canonicalGptConversationUrl } from "../contracts/target-document.contract.js";

const HASH = /^sha256:[a-f0-9]{64}$/u;
const TURN = /^conversation-turn-[1-9][0-9]*$/u;
const TEXT_CHECKPOINT_KEYS = [
  "artifactRef", "assistantTurnId", "canonicalConversationUrl", "checkpointKind", "evidenceHash",
  "evidenceRef", "promptHash", "rawDomHash", "semanticTextHash", "sourceAttemptId", "turnMarker",
] as const;
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

const predecessorInput = (intent: AnyIntent): void => {
  const checkpoint = recordInput(intent, "predecessorTextCheckpoint");
  if (Object.keys(checkpoint).sort().join("|") !== [...TEXT_CHECKPOINT_KEYS].sort().join("|")
    || checkpoint.checkpointKind !== "text"
    || typeof checkpoint.assistantTurnId !== "string" || !TURN.test(checkpoint.assistantTurnId)
    || typeof checkpoint.canonicalConversationUrl !== "string"
    || typeof checkpoint.sourceAttemptId !== "string" || checkpoint.sourceAttemptId.length === 0
    || typeof checkpoint.artifactRef !== "string" || checkpoint.artifactRef.length === 0
    || typeof checkpoint.evidenceRef !== "string" || checkpoint.evidenceRef.length === 0
    || typeof checkpoint.turnMarker !== "string" || checkpoint.turnMarker.length === 0
    || [checkpoint.evidenceHash, checkpoint.promptHash, checkpoint.rawDomHash, checkpoint.semanticTextHash]
      .some((value) => typeof value !== "string" || !HASH.test(value))) {
    throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:predecessorTextCheckpoint`);
  }
  canonicalGptConversationUrl(checkpoint.canonicalConversationUrl);
};

const coherentSemanticHandoffRequired = (context: AnyContext): never => {
  requireBrowser(context);
  throw executionFailure("failed", "GPT_BROWSER_COHERENT_SEMANTIC_HANDOFF_REQUIRED");
};

export const imageResponseChildHandlers = {
  async wait_for_stable_gpt_image(intent, context) {
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

  async checkpoint_gpt_generated_image(intent, context) {
    requireExactInputKeys(intent, [
      "assistantTurnId", "canonicalConversationUrl", "expectedMediaHash", "expectedPromptHash",
      "predecessorTextCheckpoint", "turnMarker",
    ]);
    conversationInputs(intent);
    if (!TURN.test(stringInput(intent, "assistantTurnId"))) {
      throw executionFailure("failed", "GPT_CHILD_INPUT_INVALID:checkpoint_gpt_generated_image:assistantTurnId");
    }
    hashInput(intent, "expectedMediaHash");
    predecessorInput(intent);
    return coherentSemanticHandoffRequired(context);
  },
} satisfies GptChildHandlerMap;
