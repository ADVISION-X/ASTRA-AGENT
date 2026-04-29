import { z } from "zod";

import {
  CommanderAllowedCallerSchema,
  CommanderBoundaryDecisionSchema,
  CommanderBoundaryPolicySchema,
  CommanderCommandReceiptSchema,
  CommanderEvidencePolicySchema,
  CommanderProofPolicySchema,
  CommanderReadinessSchema,
  NullableCommanderGoalSchema,
  NullableOperatorNoteSchema,
  NullableSelectedMapIdSchema,
  RequestedPlatformIdSchema,
  StartMissionTransportPayloadSchema,
} from "../../schema.js";

export const IssueHumanCommandInputSchema = z.object({
  commandType: z.literal("start-mission"),
  requestedPlatformId: RequestedPlatformIdSchema.nullable().optional(),
  selectedMapId: NullableSelectedMapIdSchema.optional(),
  humanGoal: NullableCommanderGoalSchema.optional(),
  operatorNote: NullableOperatorNoteSchema.optional(),
  initialPayload: StartMissionTransportPayloadSchema.nullable().optional(),
}).strict().superRefine((value, ctx) => {
  if (!value.requestedPlatformId && !value.selectedMapId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "start-mission requires requestedPlatformId or selectedMapId" });
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
  maxDurationMs: z.literal(5000),
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