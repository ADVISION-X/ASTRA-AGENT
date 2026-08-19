import { createHash } from "node:crypto";

import type { AiFeedProviderExecutionProfile } from "./schema.js";

export const GPT_WEB_EXECUTION_PROFILE_SCHEMA_VERSION =
  "gpt-web-execution-profile.v1" as const;

export const GPT_WEB_PROVIDER = "openai-chatgpt-web" as const;
export const GPT_WEB_TRANSPORT = "gpt-web-chat" as const;

export type GptWebReasoningTier =
  | "medium"
  | "high"
  | "extra_high"
  | "pro_standard"
  | "pro_extended";

const canonicalProfilePayload = (
  profile: Omit<AiFeedProviderExecutionProfile, "profileHash">,
): string => JSON.stringify({
  schemaVersion: profile.schemaVersion,
  profileRef: profile.profileRef,
  provider: profile.provider,
  transport: profile.transport,
  accountCapabilityRef: profile.accountCapabilityRef,
  modelDisplayName: profile.modelDisplayName,
  modelFamily: profile.modelFamily,
  reasoningTier: profile.reasoningTier,
  executorIdentityRef: profile.executorIdentityRef,
  acceptanceRef: profile.acceptanceRef,
  acceptanceVersion: profile.acceptanceVersion,
  sourceProfileRef: profile.sourceProfileRef,
  sourceProfileHash: profile.sourceProfileHash,
});

export const hashProviderExecutionProfile = (
  profile: Omit<AiFeedProviderExecutionProfile, "profileHash">,
): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(canonicalProfilePayload(profile)).digest("hex")}`;

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

export const normalizeGptWebReasoningTier = (
  value: string | null | undefined,
): GptWebReasoningTier => {
  const normalized = String(value ?? "high").trim().toLowerCase();
  if (["medium", "中"].includes(normalized)) return "medium";
  if (["high", "高"].includes(normalized)) return "high";
  if (["xhigh", "extra_high", "extra high", "极高"].includes(normalized)) {
    return "extra_high";
  }
  if (["pro", "pro_standard", "pro standard"].includes(normalized)) {
    return "pro_standard";
  }
  if (["pro_extended", "pro extended", "extended pro"].includes(normalized)) {
    return "pro_extended";
  }
  throw new Error(`AI_INPUT_GATEWAY_REASONING_TIER_UNSUPPORTED:${value ?? "null"}`);
};

export const legacyReasoningEffortForProof = (
  tier: GptWebReasoningTier,
): string => {
  if (tier === "extra_high") return "xhigh";
  if (tier === "pro_standard" || tier === "pro_extended") return "pro";
  return tier;
};

export const buildGptWebProviderExecutionProfile = (input: {
  profileRef: string;
  accountCapabilityRef: string;
  modelDisplayName?: string;
  modelFamily?: string;
  reasoningTier?: string | null;
  executorIdentityRef: string;
  acceptanceRef: string;
  acceptanceVersion: string;
  sourceProfileRef?: string | null;
  sourceProfileHash?: `sha256:${string}` | null;
}): AiFeedProviderExecutionProfile => {
  const payload: Omit<AiFeedProviderExecutionProfile, "profileHash"> = {
    schemaVersion: GPT_WEB_EXECUTION_PROFILE_SCHEMA_VERSION,
    profileRef: input.profileRef,
    provider: GPT_WEB_PROVIDER,
    transport: GPT_WEB_TRANSPORT,
    accountCapabilityRef: input.accountCapabilityRef,
    modelDisplayName: input.modelDisplayName ?? "GPT-5.6 Sol",
    modelFamily: input.modelFamily ?? "gpt-5.6",
    reasoningTier: normalizeGptWebReasoningTier(input.reasoningTier),
    executorIdentityRef: input.executorIdentityRef,
    acceptanceRef: input.acceptanceRef,
    acceptanceVersion: input.acceptanceVersion,
    sourceProfileRef: input.sourceProfileRef ?? null,
    sourceProfileHash: input.sourceProfileHash ?? null,
  };
  return { ...payload, profileHash: hashProviderExecutionProfile(payload) };
};

export const defaultGptWebProviderExecutionProfile = (input: {
  owner: "deep-research" | "amazon-product-mining" | "xuanxue-ai-production" | "generic-ai";
  reasoningTier?: string | null;
}): AiFeedProviderExecutionProfile => buildGptWebProviderExecutionProfile({
  profileRef: `agent:${input.owner}:gpt-web-production:v1`,
  accountCapabilityRef: "agent:gpt-web-chat:supervised-production",
  reasoningTier: input.reasoningTier ?? "high",
  executorIdentityRef: "supervised_local_gpt_web",
  acceptanceRef: "APEX-AI-INPUT-GATEWAY-005-V3",
  acceptanceVersion: "2026-08-19.1",
});


const defaultOwnerForRawTask = (value: Record<string, unknown>):
  "deep-research" | "amazon-product-mining" | "xuanxue-ai-production" | "generic-ai" => {
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
  if (sourceProject.includes("deep-research") || labelKey === "deep_research") {
    return "deep-research";
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
