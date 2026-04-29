import { z } from "zod";

import {
  OpenBoundaryPolicySchema,
  OpenFailurePolicySchema,
  OpenOutputPolicySchema,
  OpenProofPolicySchema,
  OpenRequestSchema,
  OpenResultSchema,
  OpenTargetProfileSchema,
} from "../../schema.js";

export const OpenFacebookRequestSchema = OpenRequestSchema.and(z.object({
  childCapabilityId: z.literal("open-facebook"),
  platformId: z.literal("facebook-web"),
  targetKind: z.literal("platform-feed"),
}).strict());

export const OpenFacebookBoundaryPolicySchema = OpenBoundaryPolicySchema.extend({
  allowedCaller: z.tuple([z.literal("orchestration"), z.literal("nerve-bus")]),
  requiresNerveBus: z.literal(true),
}).strict();

export const OpenFacebookProofPolicySchema = OpenProofPolicySchema;
export const OpenFacebookOutputPolicySchema = OpenOutputPolicySchema;
export const OpenFacebookFailurePolicySchema = OpenFailurePolicySchema;

export const OpenFacebookTargetProfileSchema = OpenTargetProfileSchema.extend({
  childCapabilityId: z.literal("open-facebook"),
  platformId: z.literal("facebook-web"),
  targetKind: z.literal("platform-feed"),
  purpose: z.literal("Open the governed Facebook Reels feed without bypassing Open runtime gates."),
  allowedHostnames: z.tuple([z.literal("facebook.com"), z.literal("www.facebook.com"), z.literal("m.facebook.com")]),
  allowedSchemes: z.tuple([z.literal("https")]),
  boundaryPolicy: OpenFacebookBoundaryPolicySchema,
  proofPolicy: OpenFacebookProofPolicySchema,
  outputPolicy: OpenFacebookOutputPolicySchema,
  failurePolicy: OpenFacebookFailurePolicySchema,
}).strict();

export const OpenFacebookResultSchema = OpenResultSchema.and(z.object({
  childCapabilityId: z.literal("open-facebook"),
  platformId: z.literal("facebook-web"),
  targetKind: z.literal("platform-feed"),
}).strict());