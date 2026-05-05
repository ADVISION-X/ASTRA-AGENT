import { z } from "zod";

import {
  LocalProgramOpenTargetProfileSchema,
  OpenBoundaryPolicySchema,
  OpenFailurePolicySchema,
  OpenOutputPolicySchema,
  OpenProofPolicySchema,
  OpenRequestSchema,
  OpenResultBaseSchema,
} from "../../schema.js";

export const OpenLocalProgramRequestSchema = OpenRequestSchema.extend({
  childCapabilityId: z.literal("open-local-program"),
  platformId: z.literal("macos-local"),
  targetKind: z.literal("local-program"),
  targetUrl: z.null().default(null),
  targetProfileRef: z.string().min(1),
}).strict();

export const OpenLocalProgramBoundaryPolicySchema = OpenBoundaryPolicySchema.extend({
  allowedCaller: z.tuple([z.literal("orchestration"), z.literal("nerve-bus")]),
  requiresNerveBus: z.literal(true),
}).strict();

export const OpenLocalProgramProofPolicySchema = OpenProofPolicySchema;
export const OpenLocalProgramOutputPolicySchema = OpenOutputPolicySchema;
export const OpenLocalProgramFailurePolicySchema = OpenFailurePolicySchema;

export const OpenLocalProgramTargetProfileSchema = LocalProgramOpenTargetProfileSchema.extend({
  childCapabilityId: z.literal("open-local-program"),
  platformId: z.literal("macos-local"),
  targetKind: z.literal("local-program"),
  targetProfileRef: z.literal("macos-app:iphone-mirroring"),
  appName: z.literal("iPhone Mirroring"),
  allowedLaunchMethod: z.literal("macos-open-application"),
  boundaryPolicy: OpenLocalProgramBoundaryPolicySchema,
  proofPolicy: OpenLocalProgramProofPolicySchema,
  outputPolicy: OpenLocalProgramOutputPolicySchema,
  failurePolicy: OpenLocalProgramFailurePolicySchema,
}).strict();

export const OpenLocalProgramResultSchema = OpenResultBaseSchema.extend({
  childCapabilityId: z.literal("open-local-program"),
  platformId: z.literal("macos-local"),
  targetKind: z.literal("local-program"),
}).strict();
