import { z } from "zod";

export const COMMANDER_CONSOLE_CHILD_ABILITY_IDS = [
  "issue-human-command",
  "show-mission-dashboard",
  "show-capability-roster",
  "show-capability-health",
  "show-operational-map-progress",
  "show-runtime-proof-timeline",
  "show-evidence-packets",
  "show-browse-ledger",
  "show-failed-records",
  "show-review-queue",
  "show-audit-summary",
  "pause-mission",
  "resume-mission",
  "stop-mission",
  "emergency-stop",
  "approve-candidate",
  "reject-candidate",
  "mark-review-required",
  "inspect-record-detail",
] as const;

export const COMMANDER_COMMAND_CHILD_IDS = [
  "issue-human-command",
  "pause-mission",
  "resume-mission",
  "stop-mission",
  "emergency-stop",
  "approve-candidate",
  "reject-candidate",
  "mark-review-required",
] as const;

export const COMMANDER_READ_CHILD_IDS = [
  "show-mission-dashboard",
  "show-capability-roster",
  "show-capability-health",
  "show-operational-map-progress",
  "show-runtime-proof-timeline",
  "show-evidence-packets",
  "show-browse-ledger",
  "show-failed-records",
  "show-review-queue",
  "show-audit-summary",
  "inspect-record-detail",
] as const;

const NonEmptyStringSchema = z.string().trim().min(1);

export const CommanderConsoleChildAbilityIdSchema = z.enum(COMMANDER_CONSOLE_CHILD_ABILITY_IDS);
export const CommanderCommandChildAbilityIdSchema = z.enum(COMMANDER_COMMAND_CHILD_IDS);
export const CommanderReadChildAbilityIdSchema = z.enum(COMMANDER_READ_CHILD_IDS);
export const CommanderDispatchChildCapabilityIdSchema = NonEmptyStringSchema;
export const CommanderChildKindSchema = z.enum(["command", "read"]);
export const CommanderConsoleStatusSchema = z.enum(["success", "failed", "review_required"]);
export const CommanderBoundaryDecisionSchema = z.enum(["command-transport-only", "read-port-only", "blocked"]);
export const CommanderCommandDecisionSchema = z.enum(["accepted-by-command-gate", "blocked-by-command-gate"]);
export const CommanderReadDecisionSchema = z.enum(["accepted-by-read-gate", "blocked-by-read-gate"]);
export const CommanderTransportDecisionSchema = z.enum(["accepted", "failed", "review_required", "not-dispatched"]);
export const CommanderHardStopDecisionSchema = z.enum([
  "not-hard-stop",
  "hard-stop-required",
  "hard-stop-dispatched",
  "hard-stop-dispatch-failed",
  "hard-stop-review-required",
]);
export const CommanderPolicyDecisionSchema = z.enum(["allowed", "blocked", "review_required"]);
export const CommanderCommandPrioritySchema = z.enum(["normal", "emergency"]);
export const CommanderAllowedCallerSchema = z.literal("commander-console");
export const CommanderIdempotencyPolicySchema = z.enum(["idempotent-read", "dedupe-command", "hard-stop-non-dedupe"]);
export const CommanderOperatorRefSchema = NonEmptyStringSchema.max(160);
export const RequestedPlatformIdSchema = z.enum(["facebook-web", "tiktok-web"]);
export const CommanderCommandTypeSchema = z.enum([
  "start-mission",
  "pause-mission",
  "resume-mission",
  "stop-mission",
  "emergency-stop",
  "approve-candidate",
  "reject-candidate",
  "mark-review-required",
]);
export const CommanderMissionStatusSchema = z.enum(["idle", "running", "paused", "review_required", "failed", "completed", "stopped"]);
export const CommanderReviewStatusSchema = z.enum(["pending", "approved", "rejected", "hold", "archived"]);
export const CommanderRecordTypeSchema = z.enum(["candidate", "evidence-packet", "browse-ledger", "failed-record", "runtime-event", "mission", "not-found"]);
export const CommanderEvidenceSourceSchema = z.enum([
  "command-transport",
  "mission-read-model",
  "forensics-read-model",
  "capability-health-read-model",
  "audit-read-model",
  "runtime-proof-read-model",
  "commander-console",
]);
export const CommanderDataQualityFlagCodeSchema = z.enum([
  "input_schema_failed",
  "output_schema_failed",
  "proof_schema_failed",
  "command_gate_blocked",
  "read_gate_blocked",
  "transport_guarded",
  "transport_missing_envelope",
  "hard_stop",
  "hard_stop_gate_failed",
  "hard_stop_guarded",
  "record_not_found",
  "execution_error",
  "dispatch_child_missing",
]);
export const CommanderDataQualitySeveritySchema = z.enum(["info", "warn", "fatal"]);
export const CommanderReadModelSourceSchema = z.enum([
  "mission-read-model",
  "forensics-read-model",
  "capability-health-read-model",
  "audit-read-model",
  "runtime-proof-read-model",
]);

export const CommanderGoalSchema = NonEmptyStringSchema.max(400);
export const CommanderNoteSchema = NonEmptyStringSchema.max(400);
export const CommanderMaxRoundsSchema = z.number().int().min(1).max(9);
export const CommanderMaxMinutesSchema = z.number().int().min(1).max(180);
export const NullableMissionIdSchema = NonEmptyStringSchema.nullable();
export const NullableSelectedMapIdSchema = NonEmptyStringSchema.nullable();
export const NullableCommanderGoalSchema = CommanderGoalSchema.nullable();
export const NullableOperatorNoteSchema = CommanderNoteSchema.nullable();

export const CommanderTargetRecordRefSchema = z.object({
  recordType: CommanderRecordTypeSchema.exclude(["not-found"]),
  recordId: NonEmptyStringSchema,
}).strict();

export const CommanderCandidateTargetRecordRefSchema = z.object({
  recordType: z.literal("candidate"),
  recordId: NonEmptyStringSchema,
}).strict();

export const CommanderEvidenceRecordRefSchema = z.object({
  recordType: CommanderRecordTypeSchema,
  recordId: NonEmptyStringSchema,
}).strict();

export const CommanderEvidenceRefSchema = z.object({
  recordRef: CommanderEvidenceRecordRefSchema,
  sourceAbility: CommanderEvidenceSourceSchema,
  recordType: CommanderRecordTypeSchema,
  proofRef: NonEmptyStringSchema.nullable(),
}).strict().superRefine((value, ctx) => {
  if (value.recordRef.recordType !== value.recordType) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "recordRef.recordType must match recordType",
    });
  }
});

export const CommanderDataQualityFlagSchema = z.object({
  code: CommanderDataQualityFlagCodeSchema,
  severity: CommanderDataQualitySeveritySchema,
  message: NonEmptyStringSchema,
}).strict();

export const CommanderBoundaryPolicySchema = z.object({
  allowedCaller: CommanderAllowedCallerSchema,
  boundaryDecision: CommanderBoundaryDecisionSchema,
  ownedCommandType: CommanderCommandTypeSchema.nullable(),
  readModelSource: CommanderReadModelSourceSchema.nullable(),
  requiresOperatorRef: z.literal(true),
  hardStopPriority: CommanderCommandPrioritySchema.nullable(),
  maxDurationMs: z.number().int().positive(),
  idempotencyPolicy: CommanderIdempotencyPolicySchema,
}).strict();

export const CommanderProofPolicySchema = z.object({
  requiresRuntimeProof: z.literal(true),
  requiresGovernedReceipt: z.boolean(),
  requiresStructuredEvidenceRefs: z.literal(true),
  requiresFailureReceipt: z.boolean(),
  requiresTransportDecision: z.boolean(),
  requiresReadDecision: z.boolean(),
  requiresHardStopDecision: z.boolean(),
}).strict();

export const CommanderEvidencePolicySchema = z.object({
  sourceAbility: CommanderEvidenceSourceSchema,
  targetRecordRequired: z.boolean(),
  proofRefRequired: z.boolean(),
  recordTypes: z.array(CommanderRecordTypeSchema).min(1),
}).strict();

export const CommanderReadinessSchema = z.object({
  requiresCommandTransport: z.boolean(),
  requiresReadModel: z.boolean(),
  requiresHardPath: z.boolean(),
}).strict();

const StartMissionTransportPayloadBaseSchema = z.object({
  kind: z.literal("start-mission"),
  requestedBy: z.literal("commander-console"),
  requestedPlatformId: RequestedPlatformIdSchema.optional(),
  selectedMapId: NonEmptyStringSchema.optional(),
  taskTemplateId: NonEmptyStringSchema.optional(),
  activationId: NonEmptyStringSchema.optional(),
  humanGoal: CommanderGoalSchema.optional(),
  maxRounds: CommanderMaxRoundsSchema.optional(),
  maxMinutes: CommanderMaxMinutesSchema.optional(),
  operatorNote: CommanderNoteSchema.optional(),
}).strict();

export const StartMissionTransportPayloadSchema = StartMissionTransportPayloadBaseSchema.superRefine((value, ctx) => {
  if (!value.requestedPlatformId || !value.selectedMapId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "start-mission payload requires both requestedPlatformId and selectedMapId",
    });
  }
});

export const PauseMissionTransportPayloadSchema = z.object({
  kind: z.literal("pause-mission"),
  requestedBy: z.literal("commander-console"),
  targetMissionId: NullableMissionIdSchema,
  operatorNote: NullableOperatorNoteSchema,
}).strict();

export const ResumeMissionTransportPayloadSchema = z.object({
  kind: z.literal("resume-mission"),
  requestedBy: z.literal("commander-console"),
  targetMissionId: NullableMissionIdSchema,
  operatorNote: NullableOperatorNoteSchema,
}).strict();

export const StopMissionTransportPayloadSchema = z.object({
  kind: z.literal("stop-mission"),
  requestedBy: z.literal("commander-console"),
  targetMissionId: NullableMissionIdSchema,
  operatorNote: NullableOperatorNoteSchema,
}).strict();

export const EmergencyStopTransportPayloadSchema = z.object({
  kind: z.literal("emergency-stop"),
  requestedBy: z.literal("commander-console"),
  targetMissionId: NullableMissionIdSchema,
  operatorNote: NullableOperatorNoteSchema,
}).strict();

export const ApproveCandidateTransportPayloadSchema = z.object({
  kind: z.literal("approve-candidate"),
  requestedBy: z.literal("commander-console"),
  candidateId: NonEmptyStringSchema,
  operatorNote: NullableOperatorNoteSchema,
}).strict();

export const RejectCandidateTransportPayloadSchema = z.object({
  kind: z.literal("reject-candidate"),
  requestedBy: z.literal("commander-console"),
  candidateId: NonEmptyStringSchema,
  operatorNote: NullableOperatorNoteSchema,
}).strict();

export const MarkReviewRequiredTransportPayloadSchema = z.object({
  kind: z.literal("mark-review-required"),
  requestedBy: z.literal("commander-console"),
  candidateId: NonEmptyStringSchema,
  operatorNote: NullableOperatorNoteSchema,
}).strict();

export const CommanderTransportPayloadSchema = z.discriminatedUnion("kind", [
  StartMissionTransportPayloadBaseSchema,
  PauseMissionTransportPayloadSchema,
  ResumeMissionTransportPayloadSchema,
  StopMissionTransportPayloadSchema,
  EmergencyStopTransportPayloadSchema,
  ApproveCandidateTransportPayloadSchema,
  RejectCandidateTransportPayloadSchema,
  MarkReviewRequiredTransportPayloadSchema,
]).superRefine((value, ctx) => {
  if (value.kind === "start-mission" && (!value.requestedPlatformId || !value.selectedMapId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "start-mission payload requires both requestedPlatformId and selectedMapId",
    });
  }
});

export const HumanCommandInputSchema = z.object({
  commandType: CommanderCommandTypeSchema,
  targetMissionId: NullableMissionIdSchema.optional(),
  selectedMapId: NullableSelectedMapIdSchema.optional(),
  targetRecordRef: CommanderTargetRecordRefSchema.nullable().optional(),
  requestedPlatformId: RequestedPlatformIdSchema.nullable().optional(),
  humanGoal: NullableCommanderGoalSchema.optional(),
  maxRounds: CommanderMaxRoundsSchema.optional(),
  maxMinutes: CommanderMaxMinutesSchema.optional(),
  operatorNote: NullableOperatorNoteSchema.optional(),
  initialPayload: CommanderTransportPayloadSchema.nullable().optional(),
}).strict().superRefine((value, ctx) => {
  const commandType = value.commandType;
  if (commandType === "start-mission") {
    if (!value.requestedPlatformId && !value.selectedMapId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "start-mission requires requestedPlatformId or selectedMapId" });
    }
    if (value.targetRecordRef) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "start-mission must not carry targetRecordRef" });
    }
  }
  if (commandType === "approve-candidate" || commandType === "reject-candidate" || commandType === "mark-review-required") {
    const targetRecord = value.targetRecordRef;
    if (!targetRecord || targetRecord.recordType !== "candidate") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "review commands require candidate targetRecordRef" });
    }
    if (value.targetMissionId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "review commands must not carry targetMissionId" });
    }
  }
  if (commandType !== "start-mission" && value.selectedMapId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "selectedMapId is only allowed on start-mission" });
  }
  if (commandType !== "start-mission" && value.requestedPlatformId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "requestedPlatformId is only allowed on start-mission" });
  }
  if (commandType !== "start-mission" && value.humanGoal) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "humanGoal is only allowed on start-mission" });
  }
  if (commandType !== "start-mission" && value.maxRounds) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "maxRounds is only allowed on start-mission" });
  }
  if (commandType !== "start-mission" && value.maxMinutes) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "maxMinutes is only allowed on start-mission" });
  }
});

export const ReadRequestInputSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  recordId: NonEmptyStringSchema.optional(),
}).strict();

export const ReviewDecisionInputSchema = z.object({
  candidateId: NonEmptyStringSchema,
  operatorNote: NullableOperatorNoteSchema.optional(),
}).strict();

export const EmptyCommanderChildInputSchema = z.object({}).strict();

export const LimitedReadInputSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
}).strict();

export const InspectRecordInputSchema = z.object({
  recordId: NonEmptyStringSchema,
}).strict();

export const MissionControlInputSchema = z.object({
  targetMissionId: NullableMissionIdSchema.optional(),
  operatorNote: NullableOperatorNoteSchema.optional(),
}).strict();

export const CommandTransportResultSchema = z.object({
  commandId: NonEmptyStringSchema,
  envelopeRef: NonEmptyStringSchema.nullable(),
  resultEnvelopeRef: NonEmptyStringSchema.nullable(),
  status: z.enum(["accepted", "failed", "review_required"]),
  failureReason: NonEmptyStringSchema.nullable(),
  reviewRequiredReason: NonEmptyStringSchema.nullable(),
  message: NonEmptyStringSchema,
  debugLogRef: NonEmptyStringSchema.nullable(),
}).strict();

export const CommanderCommandReceiptSchema = z.object({
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

export const CommanderMissionViewSchema = z.object({
  missionId: NonEmptyStringSchema.nullable(),
  humanGoal: z.string(),
  status: CommanderMissionStatusSchema,
  missionRunRef: NonEmptyStringSchema.nullable(),
  currentRoundIndex: z.number().int().min(0),
  requestedPlatform: RequestedPlatformIdSchema.nullable(),
  selectedMapId: NonEmptyStringSchema.nullable(),
  lastHumanCommand: CommanderCommandTypeSchema.nullable(),
  reviewRequiredReason: z.string().nullable(),
  failureReason: z.string().nullable(),
  startedAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
}).strict();

export const CommanderRuntimeSummaryViewSchema = z.object({
  runtimeStatus: CommanderMissionStatusSchema,
  currentStep: z.string().nullable(),
  reviewReason: z.string().nullable(),
  totalSeenCount: z.number().int().min(0),
  evidencePacketCount: z.number().int().min(0),
  browseLedgerCount: z.number().int().min(0),
  candidateCount: z.number().int().min(0),
  lastAiFailureReason: z.string().nullable(),
}).strict();

export const CommanderBrowserSummaryViewSchema = z.object({
  browserMode: NonEmptyStringSchema,
  browserExecutable: z.string().nullable(),
  browserProfileRef: NonEmptyStringSchema,
  browserProfileStatus: NonEmptyStringSchema,
  loginState: NonEmptyStringSchema,
  executionMode: NonEmptyStringSchema,
  geometryGuard: NonEmptyStringSchema,
  viewport: NonEmptyStringSchema,
  calibration: NonEmptyStringSchema,
}).strict();

export const CommanderCapabilityHealthEntrySchema = z.object({
  id: NonEmptyStringSchema,
  label: NonEmptyStringSchema,
  tone: z.enum(["normal", "good", "warn", "danger", "muted"]),
  detail: NonEmptyStringSchema,
  ownerResponsible: NonEmptyStringSchema.nullable().optional(),
  actionableMessage: NonEmptyStringSchema.nullable().optional(),
}).strict();

export const CommanderCapabilityRosterEntrySchema = z.object({
  abilityGroupId: NonEmptyStringSchema,
  displayName: NonEmptyStringSchema,
  currentStrength: NonEmptyStringSchema,
  purpose: NonEmptyStringSchema,
}).strict();

export const CommanderCandidateViewSchema = z.object({
  id: NonEmptyStringSchema,
  category: NonEmptyStringSchema,
  useCase: NonEmptyStringSchema,
  score: z.number(),
  purchaseIntent: NonEmptyStringSchema,
  reviewStatus: CommanderReviewStatusSchema,
  evidenceCount: z.number().int().min(0),
  notes: z.array(z.string()),
  createdAt: NonEmptyStringSchema,
  updatedAt: NonEmptyStringSchema,
}).strict();

export const CommanderRecordSummaryViewSchema = z.object({
  id: NonEmptyStringSchema,
  primary: NonEmptyStringSchema,
  secondary: NonEmptyStringSchema,
  detail: NonEmptyStringSchema,
}).strict();

export const CommanderRuntimeProofTimelineEntrySchema = z.object({
  id: NonEmptyStringSchema,
  createdAt: NonEmptyStringSchema,
  step: NonEmptyStringSchema,
  status: NonEmptyStringSchema,
  message: NonEmptyStringSchema,
}).strict();

export const CommanderAuditSummarySchema = z.object({
  phase: NonEmptyStringSchema,
  activeCapabilityDomains: z.array(NonEmptyStringSchema),
  lastGeneratedAt: z.string().nullable(),
  lastRunGeneratedAt: z.string().nullable(),
  totals: z.object({
    inspectors: z.number().int().min(0),
    passed: z.number().int().min(0),
    failed: z.number().int().min(0),
    blocking: z.number().int().min(0),
  }).nullable(),
}).strict();

export const CommanderRecordDetailViewSchema = z.object({
  recordType: CommanderRecordTypeSchema,
  recordId: NonEmptyStringSchema.nullable(),
  title: NonEmptyStringSchema,
  summary: NonEmptyStringSchema,
  details: z.array(z.string()),
  status: z.string().nullable(),
  createdAt: z.string().nullable(),
}).strict();

export const CommanderMissionDashboardViewSchema = z.object({
  mission: CommanderMissionViewSchema,
  runtime: CommanderRuntimeSummaryViewSchema,
  browser: CommanderBrowserSummaryViewSchema,
  health: z.array(CommanderCapabilityHealthEntrySchema),
  capabilityRoster: z.array(CommanderCapabilityRosterEntrySchema),
  candidates: z.array(CommanderCandidateViewSchema),
  reviewQueue: z.array(CommanderRecordSummaryViewSchema),
  evidencePackets: z.array(CommanderRecordSummaryViewSchema),
  browseLedger: z.array(CommanderRecordSummaryViewSchema),
  failedRecords: z.array(CommanderRecordSummaryViewSchema),
  runtimeProof: z.array(CommanderRuntimeProofTimelineEntrySchema),
  auditSummary: CommanderAuditSummarySchema,
}).strict();

export const RuntimeProofSchema = z.object({
  proofId: NonEmptyStringSchema,
  runId: NonEmptyStringSchema.nullable(),
  missionId: NonEmptyStringSchema.nullable(),
  traceId: NonEmptyStringSchema.nullable(),
  abilityGroupId: z.literal("commander-console"),
  childCapabilityId: CommanderDispatchChildCapabilityIdSchema,
  childKind: CommanderChildKindSchema,
  commandId: NonEmptyStringSchema.nullable(),
  readRequestId: NonEmptyStringSchema.nullable(),
  operatorRef: CommanderOperatorRefSchema,
  inputRef: NonEmptyStringSchema,
  outputRef: NonEmptyStringSchema.nullable(),
  commandEnvelopeRef: NonEmptyStringSchema.nullable(),
  resultEnvelopeRef: NonEmptyStringSchema.nullable(),
  readModelSource: CommanderReadModelSourceSchema.nullable(),
  targetRecordRef: CommanderTargetRecordRefSchema.nullable(),
  evidenceRefs: z.array(CommanderEvidenceRefSchema),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: z.number().min(0),
  status: CommanderConsoleStatusSchema,
  failureReason: NonEmptyStringSchema.nullable(),
  reviewRequiredReason: NonEmptyStringSchema.nullable(),
  boundaryDecision: CommanderBoundaryDecisionSchema,
  commandDecision: CommanderCommandDecisionSchema.nullable(),
  readDecision: CommanderReadDecisionSchema.nullable(),
  transportDecision: CommanderTransportDecisionSchema.nullable(),
  hardStopDecision: CommanderHardStopDecisionSchema.nullable(),
  policyDecision: CommanderPolicyDecisionSchema,
  dataQualityFlags: z.array(CommanderDataQualityFlagSchema),
}).strict().superRefine((value, ctx) => {
  if (value.status === "failed" && !value.failureReason) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "failed proof requires failureReason" });
  }
  if (value.status === "review_required" && !value.reviewRequiredReason) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "review proof requires reviewRequiredReason" });
  }
  if (value.childKind === "command" && (!value.commandDecision || !value.transportDecision)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "command proof requires commandDecision and transportDecision" });
  }
  if (value.childKind === "read" && !value.readDecision) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "read proof requires readDecision" });
  }
  if (value.startedAt > value.endedAt) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "startedAt must be before or equal to endedAt" });
  }
});