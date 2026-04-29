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

export const OpenLocalWorkbenchRequestSchema = OpenRequestSchema.and(z.object({
  childCapabilityId: z.literal("open-local-workbench"),
  platformId: z.literal("local-workbench"),
  targetKind: z.literal("local-workbench"),
}).strict());

export const OpenLocalWorkbenchBoundaryPolicySchema = OpenBoundaryPolicySchema.extend({
  allowedCaller: z.tuple([z.literal("orchestration"), z.literal("nerve-bus")]),
  requiresNerveBus: z.literal(true),
}).strict();

export const OpenLocalWorkbenchProofPolicySchema = OpenProofPolicySchema;
export const OpenLocalWorkbenchOutputPolicySchema = OpenOutputPolicySchema;
export const OpenLocalWorkbenchFailurePolicySchema = OpenFailurePolicySchema;

export const OpenLocalWorkbenchTargetProfileSchema = OpenTargetProfileSchema.extend({
  childCapabilityId: z.literal("open-local-workbench"),
  platformId: z.literal("local-workbench"),
  targetKind: z.literal("local-workbench"),
  purpose: z.literal("Open the local GrassEye workbench through the same governed Open runtime gates."),
  allowedHostnames: z.tuple([z.literal("localhost"), z.literal("127.0.0.1")]),
  allowedSchemes: z.tuple([z.literal("http"), z.literal("https")]),
  boundaryPolicy: OpenLocalWorkbenchBoundaryPolicySchema,
  proofPolicy: OpenLocalWorkbenchProofPolicySchema,
  outputPolicy: OpenLocalWorkbenchOutputPolicySchema,
  failurePolicy: OpenLocalWorkbenchFailurePolicySchema,
}).strict();

export const OpenLocalWorkbenchResultSchema = OpenResultSchema.and(z.object({
  childCapabilityId: z.literal("open-local-workbench"),
  platformId: z.literal("local-workbench"),
  targetKind: z.literal("local-workbench"),
}).strict());