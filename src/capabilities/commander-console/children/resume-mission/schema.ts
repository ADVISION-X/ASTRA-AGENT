import { z } from "zod";

import {
  CommanderBoundaryPolicySchema,
  CommanderCommandReceiptSchema,
  CommanderProofPolicySchema,
  CommanderReadinessSchema,
  MissionControlInputSchema,
} from "../../shared/commander-schema-base.js";

export const ResumeMissionInputSchema = MissionControlInputSchema.extend({});

export const ResumeMissionOutputSchema = CommanderCommandReceiptSchema.extend({
  commandType: z.literal("resume-mission"),
  priority: z.literal("normal"),
});

export const ResumeMissionBoundaryPolicySchema = CommanderBoundaryPolicySchema.extend({
  boundaryDecision: z.literal("command-transport-only"),
  ownedCommandType: z.literal("resume-mission"),
  readModelSource: z.null(),
  hardStopPriority: z.null(),
  maxDurationMs: z.literal(60_000),
  idempotencyPolicy: z.literal("dedupe-command"),
});

export const ResumeMissionProofPolicySchema = CommanderProofPolicySchema.extend({
  requiresGovernedReceipt: z.literal(true),
  requiresFailureReceipt: z.literal(true),
  requiresTransportDecision: z.literal(true),
  requiresReadDecision: z.literal(false),
  requiresHardStopDecision: z.literal(false),
});

export const ResumeMissionReadinessSchema = CommanderReadinessSchema.extend({
  requiresCommandTransport: z.literal(true),
  requiresReadModel: z.literal(false),
  requiresHardPath: z.literal(false),
});