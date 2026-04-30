import { z } from "zod";

import { CommanderBoundaryPolicySchema, CommanderCapabilityHealthEntrySchema, CommanderProofPolicySchema, CommanderReadinessSchema, EmptyCommanderChildInputSchema } from "../../shared/commander-schema-base.js";

export const ShowCapabilityHealthInputSchema = EmptyCommanderChildInputSchema;
export const ShowCapabilityHealthOutputSchema = z.array(CommanderCapabilityHealthEntrySchema);

export const ShowCapabilityHealthBoundaryPolicySchema = CommanderBoundaryPolicySchema.extend({
  boundaryDecision: z.literal("read-port-only"),
  ownedCommandType: z.null(),
  readModelSource: z.literal("capability-health-read-model"),
  hardStopPriority: z.null(),
  maxDurationMs: z.literal(3000),
  idempotencyPolicy: z.literal("idempotent-read"),
});

export const ShowCapabilityHealthProofPolicySchema = CommanderProofPolicySchema.extend({
  requiresGovernedReceipt: z.literal(false),
  requiresFailureReceipt: z.literal(false),
  requiresTransportDecision: z.literal(false),
  requiresReadDecision: z.literal(true),
  requiresHardStopDecision: z.literal(false),
});

export const ShowCapabilityHealthReadinessSchema = CommanderReadinessSchema.extend({
  requiresCommandTransport: z.literal(false),
  requiresReadModel: z.literal(true),
  requiresHardPath: z.literal(false),
});