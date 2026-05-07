import { z } from "zod";

import { CommanderAuditSummarySchema, CommanderBoundaryPolicySchema, CommanderProofPolicySchema, CommanderReadinessSchema, EmptyCommanderChildInputSchema } from "../../shared/commander-schema-base.js";

export const ShowAuditSummaryInputSchema = EmptyCommanderChildInputSchema;
export const ShowAuditSummaryOutputSchema = CommanderAuditSummarySchema;

export const ShowAuditSummaryBoundaryPolicySchema = CommanderBoundaryPolicySchema.extend({
  boundaryDecision: z.literal("read-port-only"),
  ownedCommandType: z.null(),
  readModelSource: z.literal("audit-read-model"),
  hardStopPriority: z.null(),
  maxDurationMs: z.literal(60_000),
  idempotencyPolicy: z.literal("idempotent-read"),
});

export const ShowAuditSummaryProofPolicySchema = CommanderProofPolicySchema.extend({
  requiresGovernedReceipt: z.literal(false),
  requiresFailureReceipt: z.literal(false),
  requiresTransportDecision: z.literal(false),
  requiresReadDecision: z.literal(true),
  requiresHardStopDecision: z.literal(false),
});

export const ShowAuditSummaryReadinessSchema = CommanderReadinessSchema.extend({
  requiresCommandTransport: z.literal(false),
  requiresReadModel: z.literal(true),
  requiresHardPath: z.literal(false),
});