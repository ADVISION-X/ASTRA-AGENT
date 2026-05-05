import { z, type RefinementCtx } from "zod";

import {
  CommanderCommandPrioritySchema,
  CommanderCommandTypeSchema,
  CommanderGoalSchema,
  CommanderMaxMinutesSchema,
  CommanderMaxRoundsSchema,
  CommanderNoteSchema,
  CommanderTargetRecordRefSchema,
  NonEmptyStringSchema,
  NullableMissionIdSchema,
  NullableOperatorNoteSchema,
  NullableSelectedMapIdSchema,
  RequestedPlatformIdSchema,
} from "./commander-schema-foundation.js";

const addCommanderIssue = (ctx: RefinementCtx, message: string) => {
  ctx.addIssue({ code: z.ZodIssueCode.custom, message });
};

const StartMissionTransportPayloadBaseSchema = z.object({
  kind: z.literal("start-mission"),
  requestedBy: z.literal("commander-console"),
  requestedPlatformId: RequestedPlatformIdSchema.optional(),
  selectedMapId: NonEmptyStringSchema.optional(),
  taskTemplateId: NonEmptyStringSchema.optional(),
  activationId: NonEmptyStringSchema.optional(),
  activationSnapshotRef: NonEmptyStringSchema.optional(),
  humanGoal: CommanderGoalSchema.optional(),
  maxRounds: CommanderMaxRoundsSchema.optional(),
  maxMinutes: CommanderMaxMinutesSchema.optional(),
  operatorNote: CommanderNoteSchema.optional(),
  targetUrl: NonEmptyStringSchema.optional(),
  targetTitle: NonEmptyStringSchema.optional(),
  targetProfileRef: NonEmptyStringSchema.optional(),
  sourceEvidenceRef: NonEmptyStringSchema.optional(),
  sourceTargetRef: NonEmptyStringSchema.optional(),
  promptInputRef: NonEmptyStringSchema.optional(),
  commandInputRef: NonEmptyStringSchema.optional(),
}).strict();

const validateStartMissionPayload = (
  value: z.infer<typeof StartMissionTransportPayloadBaseSchema>,
  ctx: RefinementCtx,
) => {
  if (!value.requestedPlatformId || !value.selectedMapId) {
    addCommanderIssue(ctx, "start-mission payload requires both requestedPlatformId and selectedMapId");
  }
};

const StartMissionTransportPayloadSchema = StartMissionTransportPayloadBaseSchema.superRefine(validateStartMissionPayload);

const PauseMissionTransportPayloadSchema = z.object({
  kind: z.literal("pause-mission"),
  requestedBy: z.literal("commander-console"),
  targetMissionId: NullableMissionIdSchema,
  operatorNote: NullableOperatorNoteSchema,
}).strict();

const ResumeMissionTransportPayloadSchema = z.object({
  kind: z.literal("resume-mission"),
  requestedBy: z.literal("commander-console"),
  targetMissionId: NullableMissionIdSchema,
  operatorNote: NullableOperatorNoteSchema,
}).strict();

const StopMissionTransportPayloadSchema = z.object({
  kind: z.literal("stop-mission"),
  requestedBy: z.literal("commander-console"),
  targetMissionId: NullableMissionIdSchema,
  operatorNote: NullableOperatorNoteSchema,
}).strict();

const EmergencyStopTransportPayloadSchema = z.object({
  kind: z.literal("emergency-stop"),
  requestedBy: z.literal("commander-console"),
  targetMissionId: NullableMissionIdSchema,
  operatorNote: NullableOperatorNoteSchema,
}).strict();

const ApproveCandidateTransportPayloadSchema = z.object({
  kind: z.literal("approve-candidate"),
  requestedBy: z.literal("commander-console"),
  candidateId: NonEmptyStringSchema,
  operatorNote: NullableOperatorNoteSchema,
}).strict();

const RejectCandidateTransportPayloadSchema = z.object({
  kind: z.literal("reject-candidate"),
  requestedBy: z.literal("commander-console"),
  candidateId: NonEmptyStringSchema,
  operatorNote: NullableOperatorNoteSchema,
}).strict();

const MarkReviewRequiredTransportPayloadSchema = z.object({
  kind: z.literal("mark-review-required"),
  requestedBy: z.literal("commander-console"),
  candidateId: NonEmptyStringSchema,
  operatorNote: NullableOperatorNoteSchema,
}).strict();

const CommanderTransportPayloadSchema = z.discriminatedUnion("kind", [
  StartMissionTransportPayloadBaseSchema,
  PauseMissionTransportPayloadSchema,
  ResumeMissionTransportPayloadSchema,
  StopMissionTransportPayloadSchema,
  EmergencyStopTransportPayloadSchema,
  ApproveCandidateTransportPayloadSchema,
  RejectCandidateTransportPayloadSchema,
  MarkReviewRequiredTransportPayloadSchema,
]).superRefine((value, ctx) => {
  if (value.kind === "start-mission") {
    validateStartMissionPayload(value, ctx);
  }
});

const HumanCommandInputSchemaBase = z.object({
  commandType: CommanderCommandTypeSchema,
  targetMissionId: NullableMissionIdSchema.optional(),
  selectedMapId: NullableSelectedMapIdSchema.optional(),
  targetRecordRef: CommanderTargetRecordRefSchema.nullable().optional(),
  requestedPlatformId: RequestedPlatformIdSchema.nullable().optional(),
  humanGoal: CommanderGoalSchema.nullable().optional(),
  maxRounds: CommanderMaxRoundsSchema.optional(),
  maxMinutes: CommanderMaxMinutesSchema.optional(),
  operatorNote: NullableOperatorNoteSchema.optional(),
  initialPayload: CommanderTransportPayloadSchema.nullable().optional(),
}).strict();

const validateStartMissionCommand = (
  value: z.infer<typeof HumanCommandInputSchemaBase>,
  ctx: RefinementCtx,
) => {
  if (!value.requestedPlatformId || !value.selectedMapId) {
    addCommanderIssue(ctx, "start-mission requires both requestedPlatformId and selectedMapId");
  }
  if (value.targetRecordRef) {
    addCommanderIssue(ctx, "start-mission must not carry targetRecordRef");
  }
};

const validateReviewCommand = (
  value: z.infer<typeof HumanCommandInputSchemaBase>,
  ctx: RefinementCtx,
) => {
  const targetRecord = value.targetRecordRef;
  if (!targetRecord || targetRecord.recordType !== "candidate") {
    addCommanderIssue(ctx, "review commands require candidate targetRecordRef");
  }
  if (value.targetMissionId) {
    addCommanderIssue(ctx, "review commands must not carry targetMissionId");
  }
};

const validateNonStartMissionFields = (
  value: z.infer<typeof HumanCommandInputSchemaBase>,
  ctx: RefinementCtx,
) => {
  if (value.commandType === "start-mission") {
    return;
  }
  if (value.selectedMapId) {
    addCommanderIssue(ctx, "selectedMapId is only allowed on start-mission");
  }
  if (value.requestedPlatformId) {
    addCommanderIssue(ctx, "requestedPlatformId is only allowed on start-mission");
  }
  if (value.humanGoal) {
    addCommanderIssue(ctx, "humanGoal is only allowed on start-mission");
  }
  if (value.maxRounds) {
    addCommanderIssue(ctx, "maxRounds is only allowed on start-mission");
  }
  if (value.maxMinutes) {
    addCommanderIssue(ctx, "maxMinutes is only allowed on start-mission");
  }
};

const validateHumanCommandInput = (
  value: z.infer<typeof HumanCommandInputSchemaBase>,
  ctx: RefinementCtx,
) => {
  if (value.commandType === "start-mission") {
    validateStartMissionCommand(value, ctx);
  }
  if (["approve-candidate", "reject-candidate", "mark-review-required"].includes(value.commandType)) {
    validateReviewCommand(value, ctx);
  }
  validateNonStartMissionFields(value, ctx);
};

const HumanCommandInputSchema = HumanCommandInputSchemaBase.superRefine(validateHumanCommandInput);

const ReadRequestInputSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  recordId: NonEmptyStringSchema.optional(),
}).strict();

const ReviewDecisionInputSchema = z.object({
  candidateId: NonEmptyStringSchema,
  operatorNote: NullableOperatorNoteSchema.optional(),
}).strict();

const EmptyCommanderChildInputSchema = z.object({}).strict();

const LimitedReadInputSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
}).strict();

const InspectRecordInputSchema = z.object({
  recordId: NonEmptyStringSchema,
}).strict();

const MissionControlInputSchema = z.object({
  targetMissionId: NullableMissionIdSchema.optional(),
  operatorNote: NullableOperatorNoteSchema.optional(),
}).strict();

const CommandTransportResultSchema = z.object({
  commandId: NonEmptyStringSchema,
  runId: NonEmptyStringSchema,
  envelopeRef: NonEmptyStringSchema.nullable(),
  resultEnvelopeRef: NonEmptyStringSchema.nullable(),
  status: z.enum(["accepted", "failed", "review_required"]),
  failureReason: NonEmptyStringSchema.nullable(),
  reviewRequiredReason: NonEmptyStringSchema.nullable(),
  message: NonEmptyStringSchema,
  debugLogRef: NonEmptyStringSchema.nullable(),
}).strict();

const CommanderCommandReceiptSchema = z.object({
  commandId: NonEmptyStringSchema,
  commandType: CommanderCommandTypeSchema,
  priority: CommanderCommandPrioritySchema,
  envelopeRef: NonEmptyStringSchema.nullable(),
  resultEnvelopeRef: NonEmptyStringSchema.nullable(),
  transportStatus: z.enum(["accepted", "failed", "review_required"]),
  failureReason: NonEmptyStringSchema.nullable(),
  reviewRequiredReason: NonEmptyStringSchema.nullable(),
  targetMissionId: NonEmptyStringSchema.nullable(),
  targetRecordId: NonEmptyStringSchema.nullable(),
  message: NonEmptyStringSchema,
}).strict();

export {
  ApproveCandidateTransportPayloadSchema,
  CommandTransportResultSchema,
  CommanderCommandReceiptSchema,
  CommanderTransportPayloadSchema,
  EmergencyStopTransportPayloadSchema,
  EmptyCommanderChildInputSchema,
  HumanCommandInputSchema,
  InspectRecordInputSchema,
  LimitedReadInputSchema,
  MarkReviewRequiredTransportPayloadSchema,
  MissionControlInputSchema,
  PauseMissionTransportPayloadSchema,
  ReadRequestInputSchema,
  RejectCandidateTransportPayloadSchema,
  ResumeMissionTransportPayloadSchema,
  ReviewDecisionInputSchema,
  StartMissionTransportPayloadSchema,
  StopMissionTransportPayloadSchema,
};
