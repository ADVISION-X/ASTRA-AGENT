import { z } from "zod";

import { CommanderBoundaryPolicySchema, CommanderProofPolicySchema, CommanderReadinessSchema, CommanderRecordDetailViewSchema, InspectRecordInputSchema } from "../../schema.js";

export const InspectRecordDetailInputSchema = InspectRecordInputSchema;
export const InspectRecordDetailOutputSchema = CommanderRecordDetailViewSchema;

export const InspectRecordDetailBoundaryPolicySchema = CommanderBoundaryPolicySchema.extend({
  boundaryDecision: z.literal("read-port-only"),
  ownedCommandType: z.null(),
  readModelSource: z.literal("forensics-read-model"),
  hardStopPriority: z.null(),
  maxDurationMs: z.literal(3000),
  idempotencyPolicy: z.literal("idempotent-read"),
});

export const InspectRecordDetailProofPolicySchema = CommanderProofPolicySchema.extend({
  requiresGovernedReceipt: z.literal(false),
  requiresFailureReceipt: z.literal(false),
  requiresTransportDecision: z.literal(false),
  requiresReadDecision: z.literal(true),
  requiresHardStopDecision: z.literal(false),
});

export const InspectRecordDetailReadinessSchema = CommanderReadinessSchema.extend({
  requiresCommandTransport: z.literal(false),
  requiresReadModel: z.literal(true),
  requiresHardPath: z.literal(false),
});