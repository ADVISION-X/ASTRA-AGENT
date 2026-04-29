import { z } from "zod";

import { CommanderBoundaryPolicySchema, CommanderProofPolicySchema, CommanderReadinessSchema, CommanderRuntimeProofTimelineEntrySchema, LimitedReadInputSchema } from "../../schema.js";

export const ShowRuntimeProofTimelineInputSchema = LimitedReadInputSchema;
export const ShowRuntimeProofTimelineOutputSchema = z.array(CommanderRuntimeProofTimelineEntrySchema);

export const ShowRuntimeProofTimelineBoundaryPolicySchema = CommanderBoundaryPolicySchema.extend({
  boundaryDecision: z.literal("read-port-only"),
  ownedCommandType: z.null(),
  readModelSource: z.literal("runtime-proof-read-model"),
  hardStopPriority: z.null(),
  maxDurationMs: z.literal(3000),
  idempotencyPolicy: z.literal("idempotent-read"),
});

export const ShowRuntimeProofTimelineProofPolicySchema = CommanderProofPolicySchema.extend({
  requiresGovernedReceipt: z.literal(false),
  requiresFailureReceipt: z.literal(false),
  requiresTransportDecision: z.literal(false),
  requiresReadDecision: z.literal(true),
  requiresHardStopDecision: z.literal(false),
});

export const ShowRuntimeProofTimelineReadinessSchema = CommanderReadinessSchema.extend({
  requiresCommandTransport: z.literal(false),
  requiresReadModel: z.literal(true),
  requiresHardPath: z.literal(false),
});