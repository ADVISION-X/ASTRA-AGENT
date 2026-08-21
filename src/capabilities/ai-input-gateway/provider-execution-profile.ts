import {
  defaultGptWebProviderExecutionProfile,
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

const defaultOwnerForRawTask = (value: Record<string, unknown>):
  "amazon-product-mining" | "xuanxue-ai-production" | "generic-ai" => {
  const task = value.taskIdentity && typeof value.taskIdentity === "object"
    ? value.taskIdentity as Record<string, unknown>
    : {};
  const sourceProject = String(task.sourceProject ?? "").toLowerCase();
  const labelKey = String(task.labelKey ?? "").toLowerCase();
  if (sourceProject === "xuanxue-web" || labelKey.includes("bazi")
    || labelKey.includes("qimen") || labelKey.includes("hehun")
    || labelKey.includes("naming") || labelKey.includes("seo")) {
    return "xuanxue-ai-production";
  }
  if (sourceProject.includes("amazon-product-mining")
    || labelKey === "amazon_product_mining") {
    return "amazon-product-mining";
  }
  return "generic-ai";
};

/**
 * Single Gateway admission normalizer. It does not create another transport
 * route: it freezes a canonical default profile before AiFeedInputSchema
 * parsing/input hashing when a legacy production caller has not yet projected
 * its own governed profile. Split GPT controls are never promoted.
 */
export const governProductionGptExecutionProfileInput = (
  rawInput: unknown,
): unknown => {
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) return rawInput;
  const value = rawInput as Record<string, unknown>;
  if (value.providerKind !== "gpt-web-chat" || value.requestedBy !== "ai-capability") {
    return rawInput;
  }
  if (value.providerExecutionProfile) return rawInput;
  if (value.modelName != null || value.requestedReasoningEffort != null) {
    throw new Error("AI_INPUT_GATEWAY_GPT_SPLIT_PROFILE_FORBIDDEN");
  }
  return {
    ...value,
    providerExecutionProfile: defaultGptWebProviderExecutionProfile({
      owner: defaultOwnerForRawTask(value),
      reasoningTier: "high",
    }),
  };
};
