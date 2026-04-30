import { z } from "zod";

import { CommanderBoundaryPolicySchema, CommanderProofPolicySchema, CommanderReadinessSchema, CommanderRecordSummaryViewSchema, EmptyCommanderChildInputSchema } from "../../shared/commander-schema-base.js";

export const ShowReviewQueueInputSchema = EmptyCommanderChildInputSchema;
export const ShowReviewQueueOutputSchema = z.array(CommanderRecordSummaryViewSchema);

export const ShowReviewQueueBoundaryPolicySchema = CommanderBoundaryPolicySchema.extend({
  boundaryDecision: z.literal("read-port-only"),
  ownedCommandType: z.null(),
  readModelSource: z.literal("forensics-read-model"),
  hardStopPriority: z.null(),
  maxDurationMs: z.literal(3000),
  idempotencyPolicy: z.literal("idempotent-read"),
});

export const ShowReviewQueueProofPolicySchema = CommanderProofPolicySchema.extend({
  requiresGovernedReceipt: z.literal(false),
  requiresFailureReceipt: z.literal(false),
  requiresTransportDecision: z.literal(false),
  requiresReadDecision: z.literal(true),
  requiresHardStopDecision: z.literal(false),
});

export const ShowReviewQueueReadinessSchema = CommanderReadinessSchema.extend({
  requiresCommandTransport: z.literal(false),
  requiresReadModel: z.literal(true),
  requiresHardPath: z.literal(false),
});