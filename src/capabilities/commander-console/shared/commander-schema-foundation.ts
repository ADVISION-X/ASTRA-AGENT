import { z } from "zod";

const COMMANDER_CONSOLE_CHILD_ABILITY_IDS = [
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

const COMMANDER_COMMAND_CHILD_IDS = [
  "issue-human-command",
  "pause-mission",
  "resume-mission",
  "stop-mission",
  "emergency-stop",
  "approve-candidate",
  "reject-candidate",
  "mark-review-required",
] as const;

const COMMANDER_READ_CHILD_IDS = [
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
const CommanderConsoleChildAbilityIdSchema = z.enum(COMMANDER_CONSOLE_CHILD_ABILITY_IDS);
const CommanderCommandChildAbilityIdSchema = z.enum(COMMANDER_COMMAND_CHILD_IDS);
const CommanderReadChildAbilityIdSchema = z.enum(COMMANDER_READ_CHILD_IDS);
const CommanderDispatchChildCapabilityIdSchema = NonEmptyStringSchema;
const CommanderChildKindSchema = z.enum(["command", "read"]);
const CommanderConsoleStatusSchema = z.enum(["success", "failed", "review_required"]);
const CommanderBoundaryDecisionSchema = z.enum(["command-transport-only", "read-port-only", "blocked"]);
const CommanderCommandDecisionSchema = z.enum(["accepted-by-command-gate", "blocked-by-command-gate"]);
const CommanderReadDecisionSchema = z.enum(["accepted-by-read-gate", "blocked-by-read-gate"]);
const CommanderTransportDecisionSchema = z.enum(["accepted", "failed", "review_required", "not-dispatched"]);
const CommanderHardStopDecisionSchema = z.enum([
  "not-hard-stop",
  "hard-stop-required",
  "hard-stop-dispatched",
  "hard-stop-dispatch-failed",
  "hard-stop-review-required",
]);
const CommanderPolicyDecisionSchema = z.enum(["allowed", "blocked", "review_required"]);
const CommanderCommandPrioritySchema = z.enum(["normal", "emergency"]);
const CommanderAllowedCallerSchema = z.literal("commander-console");
const CommanderIdempotencyPolicySchema = z.enum(["idempotent-read", "dedupe-command", "hard-stop-non-dedupe"]);
const CommanderIdempotencyDecisionSchema = z.enum([
  "not-applicable",
  "first-execution",
  "reused-inflight-result",
  "reused-cached-result",
  "emergency-bypass",
]);
const CommanderTimeoutDecisionSchema = z.enum([
  "not-applicable",
  "within-timeout",
  "timed-out-failed",
  "timed-out-review-required",
]);
const CommanderOperatorRefSchema = NonEmptyStringSchema.max(160);
const RequestedPlatformIdSchema = z.enum(["facebook-web", "tiktok-web"]);
const CommanderCommandTypeSchema = z.enum([
  "start-mission",
  "pause-mission",
  "resume-mission",
  "stop-mission",
  "emergency-stop",
  "approve-candidate",
  "reject-candidate",
  "mark-review-required",
]);
const CommanderMissionStatusSchema = z.enum(["idle", "running", "paused", "review_required", "failed", "completed", "stopped"]);
const CommanderReviewStatusSchema = z.enum(["pending", "approved", "rejected", "hold", "archived"]);
const CommanderRecordTypeSchema = z.enum(["candidate", "evidence-packet", "browse-ledger", "failed-record", "runtime-event", "mission", "not-found"]);
const CommanderEvidenceSourceSchema = z.enum([
  "command-transport",
  "mission-read-model",
  "forensics-read-model",
  "capability-health-read-model",
  "audit-read-model",
  "runtime-proof-read-model",
  "commander-console",
]);
const CommanderDataQualityFlagCodeSchema = z.enum([
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
  "idempotency_guarded",
  "record_not_found",
  "read_proof_guarded",
  "timeout_guarded",
  "transport_semantic_guarded",
  "execution_error",
  "dispatch_child_missing",
]);
const CommanderDataQualitySeveritySchema = z.enum(["info", "warn", "fatal"]);
const CommanderReadModelSourceSchema = z.enum([
  "mission-read-model",
  "forensics-read-model",
  "capability-health-read-model",
  "audit-read-model",
  "runtime-proof-read-model",
]);
const CommanderGoalSchema = NonEmptyStringSchema.max(400);
const CommanderNoteSchema = NonEmptyStringSchema.max(400);
const CommanderMaxRoundsSchema = z.number().int().min(1).max(9);
const CommanderMaxMinutesSchema = z.number().int().min(1).max(180);
const NullableMissionIdSchema = NonEmptyStringSchema.nullable();
const NullableSelectedMapIdSchema = NonEmptyStringSchema.nullable();
const NullableCommanderGoalSchema = CommanderGoalSchema.nullable();
const NullableOperatorNoteSchema = CommanderNoteSchema.nullable();

const CommanderTargetRecordRefSchema = z.object({
  recordType: CommanderRecordTypeSchema.exclude(["not-found"]),
  recordId: NonEmptyStringSchema,
}).strict();

const CommanderCandidateTargetRecordRefSchema = z.object({
  recordType: z.literal("candidate"),
  recordId: NonEmptyStringSchema,
}).strict();

const CommanderEvidenceRecordRefSchema = z.object({
  recordType: CommanderRecordTypeSchema,
  recordId: NonEmptyStringSchema,
}).strict();

const CommanderEvidenceRefSchema = z.object({
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

const CommanderDataQualityFlagSchema = z.object({
  code: CommanderDataQualityFlagCodeSchema,
  severity: CommanderDataQualitySeveritySchema,
  message: NonEmptyStringSchema,
}).strict();

const CommanderBoundaryPolicySchema = z.object({
  allowedCaller: CommanderAllowedCallerSchema,
  boundaryDecision: CommanderBoundaryDecisionSchema,
  ownedCommandType: CommanderCommandTypeSchema.nullable(),
  readModelSource: CommanderReadModelSourceSchema.nullable(),
  requiresOperatorRef: z.literal(true),
  hardStopPriority: CommanderCommandPrioritySchema.nullable(),
  maxDurationMs: z.number().int().positive(),
  idempotencyPolicy: CommanderIdempotencyPolicySchema,
}).strict();

const CommanderProofPolicySchema = z.object({
  requiresRuntimeProof: z.literal(true),
  requiresGovernedReceipt: z.boolean(),
  requiresStructuredEvidenceRefs: z.literal(true),
  requiresFailureReceipt: z.boolean(),
  requiresTransportDecision: z.boolean(),
  requiresReadDecision: z.boolean(),
  requiresHardStopDecision: z.boolean(),
}).strict();

const CommanderEvidencePolicySchema = z.object({
  sourceAbility: CommanderEvidenceSourceSchema,
  targetRecordRequired: z.boolean(),
  proofRefRequired: z.boolean(),
  recordTypes: z.array(CommanderRecordTypeSchema).min(1),
}).strict();

const CommanderReadinessSchema = z.object({
  requiresCommandTransport: z.boolean(),
  requiresReadModel: z.boolean(),
  requiresHardPath: z.boolean(),
}).strict();

export {
  COMMANDER_COMMAND_CHILD_IDS,
  COMMANDER_CONSOLE_CHILD_ABILITY_IDS,
  COMMANDER_READ_CHILD_IDS,
  CommanderAllowedCallerSchema,
  CommanderBoundaryDecisionSchema,
  CommanderBoundaryPolicySchema,
  CommanderCandidateTargetRecordRefSchema,
  CommanderChildKindSchema,
  CommanderCommandChildAbilityIdSchema,
  CommanderCommandDecisionSchema,
  CommanderCommandPrioritySchema,
  CommanderCommandTypeSchema,
  CommanderConsoleChildAbilityIdSchema,
  CommanderConsoleStatusSchema,
  CommanderDataQualityFlagCodeSchema,
  CommanderDataQualityFlagSchema,
  CommanderDataQualitySeveritySchema,
  CommanderDispatchChildCapabilityIdSchema,
  CommanderEvidencePolicySchema,
  CommanderEvidenceRecordRefSchema,
  CommanderEvidenceRefSchema,
  CommanderEvidenceSourceSchema,
  CommanderGoalSchema,
  CommanderHardStopDecisionSchema,
  CommanderIdempotencyDecisionSchema,
  CommanderIdempotencyPolicySchema,
  CommanderMaxMinutesSchema,
  CommanderMaxRoundsSchema,
  CommanderMissionStatusSchema,
  CommanderNoteSchema,
  CommanderOperatorRefSchema,
  CommanderPolicyDecisionSchema,
  CommanderProofPolicySchema,
  CommanderReadChildAbilityIdSchema,
  CommanderReadDecisionSchema,
  CommanderReadModelSourceSchema,
  CommanderReadinessSchema,
  CommanderRecordTypeSchema,
  CommanderReviewStatusSchema,
  CommanderTargetRecordRefSchema,
  CommanderTimeoutDecisionSchema,
  CommanderTransportDecisionSchema,
  NonEmptyStringSchema,
  NullableCommanderGoalSchema,
  NullableMissionIdSchema,
  NullableOperatorNoteSchema,
  NullableSelectedMapIdSchema,
  RequestedPlatformIdSchema,
};