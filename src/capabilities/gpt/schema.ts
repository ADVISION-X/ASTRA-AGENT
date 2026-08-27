import { createHash } from "node:crypto";

import { z } from "zod";

export const GptTaskLabelKeySchema = z.enum([
  "seo_research",
  "seo_article",
  "hehun_analysis",
  "bazi_analysis",
  "qimen_analysis",
  "naming_analysis",
  "full_corpus_analysis",
  "system_acceptance",
  "generic_ai",
]);

export const GptReasoningTierSchema = z.enum([
  "medium",
  "high",
  "extra_high",
  "pro_standard",
  "pro_extended",
]);

export const GptExecutionProfileSchema = z.object({
  schemaVersion: z.literal("gpt-execution-profile.v1"),
  profileRef: z.string().min(1).max(512),
  profileHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u)
    .transform((value): `sha256:${string}` => `sha256:${value.slice(7)}`),
  provider: z.literal("openai-chatgpt"),
  transport: z.literal("gpt-web"),
  accountCapabilityRef: z.string().min(1).max(512),
  modelDisplayName: z.string().min(1).max(120),
  modelFamily: z.string().min(1).max(120),
  reasoningTier: GptReasoningTierSchema,
  executorIdentityRef: z.string().min(1).max(512),
  acceptanceRef: z.string().min(1).max(512),
  acceptanceVersion: z.string().min(1).max(120),
}).strict();

export type GptTaskLabelKey = z.infer<typeof GptTaskLabelKeySchema>;
export type GptReasoningTier = z.infer<typeof GptReasoningTierSchema>;
export type GptExecutionProfile = z.infer<typeof GptExecutionProfileSchema>;

const hashProfile = (profile: Omit<GptExecutionProfile, "profileHash">): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(JSON.stringify(profile)).digest("hex")}`;

export const buildGptExecutionProfile = (input: Readonly<{
  profileRef: string;
  accountCapabilityRef: string;
  modelDisplayName: string;
  modelFamily: string;
  reasoningTier: GptReasoningTier;
  executorIdentityRef: string;
  acceptanceRef: string;
  acceptanceVersion: string;
}>): GptExecutionProfile => {
  const profile = {
    schemaVersion: "gpt-execution-profile.v1" as const,
    profileRef: input.profileRef,
    provider: "openai-chatgpt" as const,
    transport: "gpt-web" as const,
    accountCapabilityRef: input.accountCapabilityRef,
    modelDisplayName: input.modelDisplayName,
    modelFamily: input.modelFamily,
    reasoningTier: input.reasoningTier,
    executorIdentityRef: input.executorIdentityRef,
    acceptanceRef: input.acceptanceRef,
    acceptanceVersion: input.acceptanceVersion,
  };
  return GptExecutionProfileSchema.parse({ ...profile, profileHash: hashProfile(profile) });
};

export const assertGptExecutionProfileIntegrity = (value: unknown): GptExecutionProfile => {
  const profile = GptExecutionProfileSchema.parse(value);
  const { profileHash, ...payload } = profile;
  if (hashProfile(payload) !== profileHash) {
    throw new Error("GPT_EXECUTION_PROFILE_HASH_MISMATCH");
  }
  return profile;
};
