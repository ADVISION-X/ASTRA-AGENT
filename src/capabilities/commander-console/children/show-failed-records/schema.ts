import { z } from "zod";

import { CommanderBoundaryPolicySchema, CommanderProofPolicySchema, CommanderReadinessSchema, CommanderRecordSummaryViewSchema, LimitedReadInputSchema } from "../../schema.js";

export const ShowFailedRecordsInputSchema = LimitedReadInputSchema;
export const ShowFailedRecordsOutputSchema = z.array(CommanderRecordSummaryViewSchema);

export const ShowFailedRecordsBoundaryPolicySchema = CommanderBoundaryPolicySchema.extend({
  boundaryDecision: z.literal("read-port-only"),
  ownedCommandType: z.null(),
  readModelSource: z.literal("forensics-read-model"),
  hardStopPriority: z.null(),
  maxDurationMs: z.literal(3000),
  idempotencyPolicy: z.literal("idempotent-read"),
});

export const ShowFailedRecordsProofPolicySchema = CommanderProofPolicySchema.extend({
  requiresGovernedReceipt: z.literal(false),
  requiresFailureReceipt: z.literal(false),
  requiresTransportDecision: z.literal(false),
  requiresReadDecision: z.literal(true),
  requiresHardStopDecision: z.literal(false),
});

export const ShowFailedRecordsReadinessSchema = CommanderReadinessSchema.extend({
  requiresCommandTransport: z.literal(false),
  requiresReadModel: z.literal(true),
  requiresHardPath: z.literal(false),
});