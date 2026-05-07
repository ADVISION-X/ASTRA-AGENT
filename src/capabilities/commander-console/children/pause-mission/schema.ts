import { z } from "zod";

import {
  CommanderBoundaryPolicySchema,
  CommanderCommandReceiptSchema,
  CommanderProofPolicySchema,
  CommanderReadinessSchema,
  MissionControlInputSchema,
} from "../../shared/commander-schema-base.js";

export const PauseMissionInputSchema = MissionControlInputSchema.extend({});

export const PauseMissionOutputSchema = CommanderCommandReceiptSchema.extend({
  commandType: z.literal("pause-mission"),
  priority: z.literal("normal"),
});

export const PauseMissionBoundaryPolicySchema = CommanderBoundaryPolicySchema.extend({
  boundaryDecision: z.literal("command-transport-only"),
  ownedCommandType: z.literal("pause-mission"),
  readModelSource: z.null(),
  hardStopPriority: z.null(),
  maxDurationMs: z.literal(60_000),
  idempotencyPolicy: z.literal("dedupe-command"),
});

export const PauseMissionProofPolicySchema = CommanderProofPolicySchema.extend({
  requiresGovernedReceipt: z.literal(true),
  requiresFailureReceipt: z.literal(true),
  requiresTransportDecision: z.literal(true),
  requiresReadDecision: z.literal(false),
  requiresHardStopDecision: z.literal(false),
});

export const PauseMissionReadinessSchema = CommanderReadinessSchema.extend({
  requiresCommandTransport: z.literal(true),
  requiresReadModel: z.literal(false),
  requiresHardPath: z.literal(false),
});