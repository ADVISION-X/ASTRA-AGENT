import { z } from "zod";

import { CommanderBoundaryPolicySchema, CommanderMissionViewSchema, CommanderProofPolicySchema, CommanderReadinessSchema, EmptyCommanderChildInputSchema } from "../../shared/commander-schema-base.js";

export const ShowOperationalMapProgressInputSchema = EmptyCommanderChildInputSchema;
export const ShowOperationalMapProgressOutputSchema = CommanderMissionViewSchema;

export const ShowOperationalMapProgressBoundaryPolicySchema = CommanderBoundaryPolicySchema.extend({
  boundaryDecision: z.literal("read-port-only"),
  ownedCommandType: z.null(),
  readModelSource: z.literal("mission-read-model"),
  hardStopPriority: z.null(),
  maxDurationMs: z.literal(2500),
  idempotencyPolicy: z.literal("idempotent-read"),
});

export const ShowOperationalMapProgressProofPolicySchema = CommanderProofPolicySchema.extend({
  requiresGovernedReceipt: z.literal(false),
  requiresFailureReceipt: z.literal(false),
  requiresTransportDecision: z.literal(false),
  requiresReadDecision: z.literal(true),
  requiresHardStopDecision: z.literal(false),
});

export const ShowOperationalMapProgressReadinessSchema = CommanderReadinessSchema.extend({
  requiresCommandTransport: z.literal(false),
  requiresReadModel: z.literal(true),
  requiresHardPath: z.literal(false),
});