import { z } from "zod";

import {
  CommanderBoundaryPolicySchema,
  CommanderMissionDashboardViewSchema,
  CommanderProofPolicySchema,
  CommanderReadinessSchema,
  EmptyCommanderChildInputSchema,
} from "../../schema.js";

export const ShowMissionDashboardInputSchema = EmptyCommanderChildInputSchema;
export const ShowMissionDashboardOutputSchema = CommanderMissionDashboardViewSchema;

export const ShowMissionDashboardBoundaryPolicySchema = CommanderBoundaryPolicySchema.extend({
  boundaryDecision: z.literal("read-port-only"),
  ownedCommandType: z.null(),
  readModelSource: z.literal("mission-read-model"),
  hardStopPriority: z.null(),
  maxDurationMs: z.literal(4000),
  idempotencyPolicy: z.literal("idempotent-read"),
});

export const ShowMissionDashboardProofPolicySchema = CommanderProofPolicySchema.extend({
  requiresGovernedReceipt: z.literal(false),
  requiresFailureReceipt: z.literal(false),
  requiresTransportDecision: z.literal(false),
  requiresReadDecision: z.literal(true),
  requiresHardStopDecision: z.literal(false),
});

export const ShowMissionDashboardReadinessSchema = CommanderReadinessSchema.extend({
  requiresCommandTransport: z.literal(false),
  requiresReadModel: z.literal(true),
  requiresHardPath: z.literal(false),
});