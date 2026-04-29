import { z } from "zod";

import { CommanderBoundaryPolicySchema, CommanderCapabilityRosterEntrySchema, CommanderProofPolicySchema, CommanderReadinessSchema, EmptyCommanderChildInputSchema } from "../../schema.js";

export const ShowCapabilityRosterInputSchema = EmptyCommanderChildInputSchema;
export const ShowCapabilityRosterOutputSchema = z.array(CommanderCapabilityRosterEntrySchema);

export const ShowCapabilityRosterBoundaryPolicySchema = CommanderBoundaryPolicySchema.extend({
  boundaryDecision: z.literal("read-port-only"),
  ownedCommandType: z.null(),
  readModelSource: z.literal("capability-health-read-model"),
  hardStopPriority: z.null(),
  maxDurationMs: z.literal(3000),
  idempotencyPolicy: z.literal("idempotent-read"),
});

export const ShowCapabilityRosterProofPolicySchema = CommanderProofPolicySchema.extend({
  requiresGovernedReceipt: z.literal(false),
  requiresFailureReceipt: z.literal(false),
  requiresTransportDecision: z.literal(false),
  requiresReadDecision: z.literal(true),
  requiresHardStopDecision: z.literal(false),
});

export const ShowCapabilityRosterReadinessSchema = CommanderReadinessSchema.extend({
  requiresCommandTransport: z.literal(false),
  requiresReadModel: z.literal(true),
  requiresHardPath: z.literal(false),
});