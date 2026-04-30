import { z } from "zod";

import {
  CommanderBoundaryPolicySchema,
  CommanderCommandReceiptSchema,
  CommanderProofPolicySchema,
  CommanderReadinessSchema,
  MissionControlInputSchema,
} from "../../shared/commander-schema-base.js";

export const StopMissionInputSchema = MissionControlInputSchema.extend({});

export const StopMissionOutputSchema = CommanderCommandReceiptSchema.extend({
  commandType: z.literal("stop-mission"),
  priority: z.literal("normal"),
});

export const StopMissionBoundaryPolicySchema = CommanderBoundaryPolicySchema.extend({
  boundaryDecision: z.literal("command-transport-only"),
  ownedCommandType: z.literal("stop-mission"),
  readModelSource: z.null(),
  hardStopPriority: z.null(),
  maxDurationMs: z.literal(4000),
  idempotencyPolicy: z.literal("dedupe-command"),
});

export const StopMissionProofPolicySchema = CommanderProofPolicySchema.extend({
  requiresGovernedReceipt: z.literal(true),
  requiresFailureReceipt: z.literal(true),
  requiresTransportDecision: z.literal(true),
  requiresReadDecision: z.literal(false),
  requiresHardStopDecision: z.literal(false),
});

export const StopMissionReadinessSchema = CommanderReadinessSchema.extend({
  requiresCommandTransport: z.literal(true),
  requiresReadModel: z.literal(false),
  requiresHardPath: z.literal(false),
});