import { z } from "zod";

import { CommanderBoundaryPolicySchema, CommanderProofPolicySchema, CommanderReadinessSchema, CommanderRecordSummaryViewSchema, LimitedReadInputSchema } from "../../shared/commander-schema-base.js";

export const ShowEvidencePacketsInputSchema = LimitedReadInputSchema;
export const ShowEvidencePacketsOutputSchema = z.array(CommanderRecordSummaryViewSchema);

export const ShowEvidencePacketsBoundaryPolicySchema = CommanderBoundaryPolicySchema.extend({
  boundaryDecision: z.literal("read-port-only"),
  ownedCommandType: z.null(),
  readModelSource: z.literal("forensics-read-model"),
  hardStopPriority: z.null(),
  maxDurationMs: z.literal(3000),
  idempotencyPolicy: z.literal("idempotent-read"),
});

export const ShowEvidencePacketsProofPolicySchema = CommanderProofPolicySchema.extend({
  requiresGovernedReceipt: z.literal(false),
  requiresFailureReceipt: z.literal(false),
  requiresTransportDecision: z.literal(false),
  requiresReadDecision: z.literal(true),
  requiresHardStopDecision: z.literal(false),
});

export const ShowEvidencePacketsReadinessSchema = CommanderReadinessSchema.extend({
  requiresCommandTransport: z.literal(false),
  requiresReadModel: z.literal(true),
  requiresHardPath: z.literal(false),
});