import { createHash } from "node:crypto";
import { parse } from "node:path";

import { z } from "zod";
import { executionFailure } from "../../lib/execution-failure.js";
export const GptReasoningTierSchema = z.enum([
  "fast",
  "medium",
  "high",
  "extra_high",
  "pro_standard",
]);

export const GptReasoningRequirementSchema = z.discriminatedUnion("selectionPolicy", [
  z.object({
    selectionPolicy: z.literal("exact"),
    requestedTier: GptReasoningTierSchema,
  }).strict(),
  z.object({
    selectionPolicy: z.literal("exact-or-observed-maximum"),
    requestedTier: z.literal("pro_standard"),
  }).strict(),
]);

export const GptExecutionProfileSchema = z.object({
  schemaVersion: z.literal("gpt-execution-profile.v2"),
  profileRef: z.string().min(1).max(512),
  profileHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u)
    .transform((value): `sha256:${string}` => `sha256:${value.slice(7)}`),
  provider: z.literal("openai-chatgpt"),
  transport: z.literal("gpt-web"),
  accountCapabilityRef: z.string().min(1).max(512),
  modelDisplayName: z.string().min(1).max(120),
  modelFamily: z.string().min(1).max(120),
  reasoningRequirement: GptReasoningRequirementSchema,
  executorIdentityRef: z.string().min(1).max(512),
  acceptanceRef: z.string().min(1).max(512),
  acceptanceVersion: z.string().min(1).max(120),
}).strict();

export type GptReasoningTier = z.infer<typeof GptReasoningTierSchema>;
export type GptReasoningRequirement = z.infer<typeof GptReasoningRequirementSchema>;
export type GptExecutionProfile = z.infer<typeof GptExecutionProfileSchema>;

const hashProfile = (profile: Omit<GptExecutionProfile, "profileHash">): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(JSON.stringify(profile)).digest("hex")}`;

export const gptAttachmentProviderDisplayName = (
  displayName: string,
  jobId: string,
  artifactRef: string,
): string => {
  const parsed = parse(displayName);
  if (parsed.base !== displayName || !parsed.name) {
    throw executionFailure("failed", "GPT_ATTACHMENT_DISPLAY_NAME_INVALID");
  }
  const businessFileToken = createHash("sha256")
    .update(`${jobId}\u0000${artifactRef}`)
    .digest("hex")
    .slice(0, 12);
  return `${parsed.name}-${businessFileToken}${parsed.ext}`.normalize("NFC");
};

export const normalizeGptProviderAttachmentLabel = (
  observedLabel: string,
  expectedLabels: readonly string[],
): string => {
  const normalized = observedLabel.normalize("NFC");
  if (expectedLabels.includes(normalized)) return normalized;
  const providerDuplicateSuffix = /\((?:\d+|\d{8}-\d{6})\)(?=(?:\.[^./]+)?$)/u;
  const withoutProviderDuplicateSuffix = normalized.replace(providerDuplicateSuffix, "");
  return !providerDuplicateSuffix.test(withoutProviderDuplicateSuffix)
    && expectedLabels.includes(withoutProviderDuplicateSuffix)
    ? withoutProviderDuplicateSuffix
    : normalized;
};

export const buildGptExecutionProfile = (input: Readonly<{
  profileRef: string;
  accountCapabilityRef: string;
  modelDisplayName: string;
  modelFamily: string;
  reasoningRequirement: GptReasoningRequirement;
  executorIdentityRef: string;
  acceptanceRef: string;
  acceptanceVersion: string;
}>): GptExecutionProfile => {
  const profile = {
    schemaVersion: "gpt-execution-profile.v2" as const,
    profileRef: input.profileRef,
    provider: "openai-chatgpt" as const,
    transport: "gpt-web" as const,
    accountCapabilityRef: input.accountCapabilityRef,
    modelDisplayName: input.modelDisplayName,
    modelFamily: input.modelFamily,
    reasoningRequirement: input.reasoningRequirement,
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
