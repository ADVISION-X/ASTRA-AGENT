import {
  hashProviderExecutionProfile,
  type AiFeedProviderExecutionProfile,
} from "./schema.js";

const GPT_WEB_PROVIDER = "openai-chatgpt-web" as const;
const GPT_WEB_TRANSPORT = "gpt-web-chat" as const;

export const assertProviderExecutionProfileIntegrity = (
  profile: AiFeedProviderExecutionProfile,
): void => {
  const { profileHash: _profileHash, ...payload } = profile;
  const expected = hashProviderExecutionProfile(payload);
  if (profile.profileHash !== expected) {
    throw new Error(
      `AI_INPUT_GATEWAY_PROVIDER_EXECUTION_PROFILE_HASH_MISMATCH:expected=${expected};actual=${profile.profileHash}`,
    );
  }
  if (
    profile.provider !== GPT_WEB_PROVIDER
    || profile.transport !== GPT_WEB_TRANSPORT
  ) {
    throw new Error(
      "AI_INPUT_GATEWAY_PROVIDER_EXECUTION_PROFILE_CANONICAL_VOCABULARY_INVALID",
    );
  }
};

/**
 * The only production GPT admission preflight. It preserves the caller's
 * canonical profile verbatim: profile inference, defaulting and split-control
 * compatibility are all rejected before schema parsing and input hashing.
 */
export const governProductionGptExecutionProfileInput = (
  rawInput: unknown,
): unknown => {
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) return rawInput;
  const value = rawInput as Record<string, unknown>;
  if (value.providerKind !== "gpt-web-chat" || value.requestedBy !== "ai-capability") {
    return rawInput;
  }
  if (value.providerExecutionProfile == null) {
    throw new Error("AI_INPUT_GATEWAY_GPT_EXECUTION_PROFILE_REQUIRED");
  }
  if (value.modelName != null || "requestedReasoningEffort" in value) {
    throw new Error("AI_INPUT_GATEWAY_GPT_SPLIT_PROFILE_FORBIDDEN");
  }
  return rawInput;
};
