import { z } from "zod";

import {
  CommanderAllowedCallerSchema,
  CommanderBoundaryDecisionSchema,
  CommanderBoundaryPolicySchema,
  CommanderCommandReceiptSchema,
  CommanderEvidencePolicySchema,
  CommanderMaxMinutesSchema,
  CommanderMaxRoundsSchema,
  CommanderProofPolicySchema,
  CommanderReadinessSchema,
  NullableCommanderGoalSchema,
  NullableOperatorNoteSchema,
  RequestedPlatformIdSchema,
  StartMissionTransportPayloadSchema,
} from "../../shared/commander-schema-base.js";

export const IssueHumanCommandInputSchema = z.object({
  commandType: z.literal("start-mission"),
  requestedPlatformId: RequestedPlatformIdSchema.nullable().optional(),
  humanGoal: NullableCommanderGoalSchema.optional(),
  maxRounds: CommanderMaxRoundsSchema.optional(),
  maxMinutes: CommanderMaxMinutesSchema.optional(),
  operatorNote: NullableOperatorNoteSchema.optional(),
  initialPayload: StartMissionTransportPayloadSchema.nullable().optional(),
}).strict().superRefine((value, ctx) => {
  if (!value.requestedPlatformId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "start-mission requires requestedPlatformId" });
  }
  if (!value.initialPayload) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "start-mission requires governed initialPayload" });
  }
});

export const IssueHumanCommandOutputSchema = CommanderCommandReceiptSchema.extend({
  commandType: z.literal("start-mission"),
  priority: z.literal("normal"),
});

export const IssueHumanCommandBoundaryPolicySchema = CommanderBoundaryPolicySchema.extend({
  boundaryDecision: z.literal("command-transport-only"),
  ownedCommandType: z.literal("start-mission"),
  readModelSource: z.null(),
  hardStopPriority: z.null(),
  maxDurationMs: z.literal(60_000),
  idempotencyPolicy: z.literal("dedupe-command"),
});

export const IssueHumanCommandProofPolicySchema = CommanderProofPolicySchema.extend({
  requiresGovernedReceipt: z.literal(true),
  requiresFailureReceipt: z.literal(true),
  requiresTransportDecision: z.literal(true),
  requiresReadDecision: z.literal(false),
  requiresHardStopDecision: z.literal(false),
});

export const IssueHumanCommandReadinessSchema = CommanderReadinessSchema.extend({
  requiresCommandTransport: z.literal(true),
  requiresReadModel: z.literal(false),
  requiresHardPath: z.literal(false),
});