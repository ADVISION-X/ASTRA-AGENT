import { z } from "zod";

import {
  CommanderBoundaryPolicySchema,
  CommanderCommandReceiptSchema,
  CommanderProofPolicySchema,
  CommanderReadinessSchema,
  MissionControlInputSchema,
} from "../../shared/commander-schema-base.js";

export const EmergencyStopInputSchema = MissionControlInputSchema.extend({});

export const EmergencyStopOutputSchema = CommanderCommandReceiptSchema.extend({
  commandType: z.literal("emergency-stop"),
  priority: z.literal("emergency"),
});

export const EmergencyStopBoundaryPolicySchema = CommanderBoundaryPolicySchema.extend({
  boundaryDecision: z.literal("command-transport-only"),
  ownedCommandType: z.literal("emergency-stop"),
  readModelSource: z.null(),
  hardStopPriority: z.literal("emergency"),
  maxDurationMs: z.literal(60_000),
  idempotencyPolicy: z.literal("hard-stop-non-dedupe"),
});

export const EmergencyStopProofPolicySchema = CommanderProofPolicySchema.extend({
  requiresGovernedReceipt: z.literal(true),
  requiresFailureReceipt: z.literal(true),
  requiresTransportDecision: z.literal(true),
  requiresReadDecision: z.literal(false),
  requiresHardStopDecision: z.literal(true),
});

export const EmergencyStopReadinessSchema = CommanderReadinessSchema.extend({
  requiresCommandTransport: z.literal(true),
  requiresReadModel: z.literal(false),
  requiresHardPath: z.literal(true),
});