import { z } from "zod";

import {
  OpenBoundaryPolicySchema,
  OpenFailurePolicySchema,
  OpenOutputPolicySchema,
  OpenProofPolicySchema,
  OpenRequestSchema,
  OpenResultBaseSchema,
  OpenTargetProfileSchema,
} from "../../schema.js";

export const OpenTikTokRequestSchema = OpenRequestSchema.extend({
  childCapabilityId: z.literal("open-tiktok"),
  platformId: z.literal("tiktok-web"),
  targetKind: z.literal("platform-feed"),
}).strict();

export const OpenTikTokBoundaryPolicySchema = OpenBoundaryPolicySchema.extend({
  allowedCaller: z.tuple([z.literal("orchestration"), z.literal("nerve-bus")]),
  requiresNerveBus: z.literal(true),
}).strict();

export const OpenTikTokProofPolicySchema = OpenProofPolicySchema;
export const OpenTikTokOutputPolicySchema = OpenOutputPolicySchema;
export const OpenTikTokFailurePolicySchema = OpenFailurePolicySchema;

export const OpenTikTokTargetProfileSchema = OpenTargetProfileSchema.extend({
  childCapabilityId: z.literal("open-tiktok"),
  platformId: z.literal("tiktok-web"),
  targetKind: z.literal("platform-feed"),
  purpose: z.literal("Open the governed TikTok feed without bypassing Open runtime gates."),
  allowedHostnames: z.tuple([z.literal("tiktok.com"), z.literal("www.tiktok.com")]),
  allowedSchemes: z.tuple([z.literal("https")]),
  boundaryPolicy: OpenTikTokBoundaryPolicySchema,
  proofPolicy: OpenTikTokProofPolicySchema,
  outputPolicy: OpenTikTokOutputPolicySchema,
  failurePolicy: OpenTikTokFailurePolicySchema,
}).strict();

export const OpenTikTokResultSchema = OpenResultBaseSchema.extend({
  childCapabilityId: z.literal("open-tiktok"),
  platformId: z.literal("tiktok-web"),
  targetKind: z.literal("platform-feed"),
}).strict();