import { z } from "zod";

import {
  OrchestrationAllowedAbilityGroupIdSchemaSource,
  OrchestrationAllowedAbilityGroupIdsSchemaSource,
  OrchestrationOperationalMapSchemaSource,
  OrchestrationOperationalMapStepSchemaSource,
  OrchestrationPayloadRefKeySchemaSource,
  OrchestrationProofPolicySchemaSource,
  OrchestrationRequestedPlatformIdSchemaSource,
  OrchestrationSequencePolicySchemaSource,
  OrchestrationStepKindSchemaSource,
  OrchestrationTimeoutPolicySchemaSource,
  OrchestrationTransitionConditionSchemaSource,
  OrchestrationTransitionConditionSourceSchemaSource,
  OrchestrationTransitionSchemaSource,
  OrchestrationTransitionStatusSchemaSource,
} from "../../map-plugins/schema/orchestration-consumer.schema.js";

export const ORCHESTRATION_ABILITY_GROUP_ID = "orchestration";

export const ORCHESTRATION_CHILD_CAPABILITY_IDS = [
  "start-mission",
  "pause-mission",
  "resume-mission",
  "stop-mission",
  "emergency-stop",
  "execute-map-step",
  "evaluate-step-transition",
  "request-human-review",
  "finalize-mission",
] as const;

export const ORCHESTRATION_HUMAN_COMMAND_KINDS = [
  "start-mission",
  "pause-mission",
  "resume-mission",
  "stop-mission",
  "emergency-stop",
  "submit-review-decision",
] as const;

export const ORCHESTRATION_INTERNAL_OPERATION_KINDS = [
  "execute-map-step",
  "evaluate-step-transition",
  "request-human-review",
  "finalize-mission",
  "loop-guard",
] as const;

export const ORCHESTRATION_ALLOWED_ABILITY_GROUP_IDS = OrchestrationAllowedAbilityGroupIdsSchemaSource;
export const MissionConfiguredMaxRoundsSchema = z.number().int().min(1).max(9);
export const MissionConfiguredMaxMinutesSchema = z.number().int().min(1).max(180);
export const OrchestrationChildCapabilityIdSchema = z.enum(ORCHESTRATION_CHILD_CAPABILITY_IDS);
export const OperationalMapIdSchema = z.string().min(1);
export const AllowedAbilityGroupIdSchema = OrchestrationAllowedAbilityGroupIdSchemaSource;
export const MissionHumanCommandKindSchema = z.enum(ORCHESTRATION_HUMAN_COMMAND_KINDS);
export const MissionInternalOperationKindSchema = z.enum(ORCHESTRATION_INTERNAL_OPERATION_KINDS);
export const SelectedMapSourceSchema = z.enum(["preferred_map_id", "initial_payload_map_id", "task_template_id", "activation_id", "rejected_missing"]);
export const MissionStatusSchema = z.enum([
  "idle",
  "pending",
  "running",
  "paused",
  "completed",
  "failed",
  "review_required",
  "stopped",
]);
export const StepKindSchema = OrchestrationStepKindSchemaSource;
export const TransitionStatusSchema = OrchestrationTransitionStatusSchemaSource;
export const TransitionConditionSourceSchema = OrchestrationTransitionConditionSourceSchemaSource;
export const LoopDecisionSchema = z.enum(["continue", "stop_completed", "stop_failed", "stop_review_required"]);
export const MapDecisionSchema = z.enum(["selected", "rejected"]);
export const TransitionDecisionSchema = z.enum(["continue", "finalize", "review_required", "failed"]);
export const StateDecisionSchema = z.enum(["created", "updated", "paused", "resumed", "stopped", "emergency_stopped", "finalized"]);
export const EmergencyDecisionSchema = z.enum(["none", "latched", "executed"]);
export const AbortDecisionSchema = z.enum(["none", "timed_out", "emergency_stopped"]);
export const StepDispatchDecisionSchema = z.enum(["dispatched", "timeout_before_dispatch", "step_not_found", "missing_target", "missing_prompt_contract"]);
export const TransitionEvaluationDecisionSchema = z.enum(["matched", "no_valid_transition", "ambiguous_transition", "invalid_decision"]);
export const NerveBusDispatchDecisionSchema = z.enum(["dispatched", "pending_commander_channel", "dispatch_failed"]);

export const PayloadRefKeySchema = OrchestrationPayloadRefKeySchemaSource;

export const PayloadRefBundleSchema = z.object({
  requestedPlatformId: OrchestrationRequestedPlatformIdSchemaSource.nullable().optional().default(null),
  selectedMapId: OperationalMapIdSchema.nullable().optional().default(null),
  operatorNote: z.string().min(1).nullable().optional().default(null),
  targetUrl: z.string().min(1).nullable().optional().default(null),
  targetTitle: z.string().min(1).nullable().optional().default(null),
  sourceEvidenceRef: z.string().min(1).nullable().optional().default(null),
  sourceTargetRef: z.string().min(1).nullable().optional().default(null),
  screenshotEvidenceRef: z.string().min(1).nullable().optional().default(null),
  commentsEvidenceRef: z.string().min(1).nullable().optional().default(null),
  visualTargetRef: z.string().min(1).nullable().optional().default(null),
  geometryProofRef: z.string().min(1).nullable().optional().default(null),
  pageStateRef: z.string().min(1).nullable().optional().default(null),
  aiResultRef: z.string().min(1).nullable().optional().default(null),
  abilityResultRef: z.string().min(1).nullable().optional().default(null),
  promptInputRef: z.string().min(1).nullable().optional().default(null),
  commandInputRef: z.string().min(1).nullable().optional().default(null),
  reviewReasonRef: z.string().min(1).nullable().optional().default(null),
  runtimeLogRef: z.string().min(1).nullable().optional().default(null),
}).strict();

export const MissionInitialPayloadSchema = z.object({
  requestedBy: z.string().min(1),
  selectedMapId: OperationalMapIdSchema.nullable().optional().default(null),
  maxRounds: MissionConfiguredMaxRoundsSchema.nullable().optional().default(null),
  maxMinutes: MissionConfiguredMaxMinutesSchema.nullable().optional().default(null),
  operatorNote: z.string().min(1).nullable().optional().default(null),
  targetUrl: z.string().min(1).nullable().optional().default(null),
  targetTitle: z.string().min(1).nullable().optional().default(null),
  sourceEvidenceRef: z.string().min(1).nullable().optional().default(null),
  sourceTargetRef: z.string().min(1).nullable().optional().default(null),
  promptInputRef: z.string().min(1).nullable().optional().default(null),
  commandInputRef: z.string().min(1).nullable().optional().default(null),
}).strict();

export const MissionCommandSchema = z.object({
  missionId: z.string().min(1),
  humanGoal: z.string().min(1),
  requestedPlatform: OrchestrationRequestedPlatformIdSchemaSource,
  preferredMapId: OperationalMapIdSchema.nullable().optional().default(null),
  taskTemplateId: z.string().min(1).nullable().optional().default(null),
  activationId: z.string().min(1).nullable().optional().default(null),
  maxRounds: MissionConfiguredMaxRoundsSchema.nullable().optional().default(null),
  maxMinutes: MissionConfiguredMaxMinutesSchema.nullable().optional().default(null),
  initialPayload: MissionInitialPayloadSchema,
}).strict();

export const MissionReviewDecisionInputSchema = z.object({
  missionId: z.string().min(1),
  decision: z.enum(["resume", "stop", "hold"]),
  note: z.string().min(1).nullable().optional().default(null),
}).strict();

export const MissionControlCommandSchema = z.object({
  missionId: z.string().min(1),
  reason: z.string().min(1).nullable().optional().default(null),
  note: z.string().min(1).nullable().optional().default(null),
}).strict();

export const TransitionConditionSchema = OrchestrationTransitionConditionSchemaSource;
export const OrchestrationSequencePolicySchema = OrchestrationSequencePolicySchemaSource;
export const TimeoutPolicySchema = OrchestrationTimeoutPolicySchemaSource;
export const ProofPolicySchema = OrchestrationProofPolicySchemaSource;
export const OperationalMapStepSchema = OrchestrationOperationalMapStepSchemaSource;
export const TransitionSchema = OrchestrationTransitionSchemaSource;
export const OperationalMapSchema = OrchestrationOperationalMapSchemaSource;

export const MissionStepResultSchema = z.object({
  status: TransitionStatusSchema,
  missionId: z.string().min(1),
  mapId: OperationalMapIdSchema,
  stepId: z.string().min(1),
  childCapabilityId: z.string().min(1),
  targetAbilityGroupId: AllowedAbilityGroupIdSchema.nullable().optional().default(null),
  envelopeId: z.string().min(1).nullable().optional().default(null),
  resultRef: z.string().min(1).nullable().optional().default(null),
  outputRef: z.string().min(1).nullable().optional().default(null),
  decision: z.string().min(1).nullable().optional().default(null),
  failureReason: z.string().min(1).nullable().optional().default(null),
  reviewRequiredReason: z.string().min(1).nullable().optional().default(null),
  transitionId: z.string().min(1).nullable().optional().default(null),
  nextStepId: z.string().min(1).nullable().optional().default(null),
  payloadRefs: PayloadRefBundleSchema,
}).strict();

export const RuntimeProofSchema = z.object({
  proofId: z.string().min(1),
  missionId: z.string().min(1),
  mapId: OperationalMapIdSchema,
  taskTemplateId: z.string().min(1).nullable().optional().default(null),
  activationId: z.string().min(1).nullable().optional().default(null),
  mapPackageId: z.string().min(1).nullable().optional().default(null),
  mapPackageVersion: z.string().min(1).nullable().optional().default(null),
  mapVersion: z.string().min(1).nullable().optional().default(null),
  selectedMapSource: SelectedMapSourceSchema.nullable().optional().default(null),
  stepId: z.string().min(1),
  targetAbilityGroupId: AllowedAbilityGroupIdSchema.nullable().optional().default(null),
  targetChildCapabilityId: z.string().min(1).nullable().optional().default(null),
  childCapabilityId: z.string().min(1),
  commandKind: MissionHumanCommandKindSchema,
  internalOperationKind: MissionInternalOperationKindSchema.nullable().optional().default(null),
  caller: z.enum(["commander-console", "orchestration"]),
  idempotencyKey: z.string().min(1),
  sequenceNo: z.number().int().nonnegative(),
  stateRevisionBefore: z.number().int().nonnegative().nullable().optional().default(null),
  stateRevisionAfter: z.number().int().nonnegative().nullable().optional().default(null),
  stateHashBefore: z.string().min(1).nullable().optional().default(null),
  stateHashAfter: z.string().min(1).nullable().optional().default(null),
  stepDispatchCallId: z.string().min(1).nullable().optional().default(null),
  stepTimeoutMs: z.number().int().positive().nullable().optional().default(null),
  timeoutDecision: AbortDecisionSchema.nullable().optional().default(null),
  abortDecision: AbortDecisionSchema.nullable().optional().default(null),
  nerveBusEnvelopeId: z.string().min(1).nullable().optional().default(null),
  nerveBusDispatchDecision: NerveBusDispatchDecisionSchema.nullable().optional().default(null),
  transitionId: z.string().min(1).nullable().optional().default(null),
  transitionEvaluationDecision: TransitionEvaluationDecisionSchema.nullable().optional().default(null),
  transitionConditionSource: TransitionConditionSourceSchema.nullable().optional().default(null),
  transitionConditionExpected: z.union([z.string(), z.boolean(), z.null()]).optional().default(null),
  transitionConditionActual: z.union([z.string(), z.boolean(), z.null()]).optional().default(null),
  inputRef: z.string().min(1).nullable().optional().default(null),
  outputRef: z.string().min(1).nullable().optional().default(null),
  abilityResultRef: z.string().min(1).nullable().optional().default(null),
  reviewDispatchEnvelopeId: z.string().min(1).nullable().optional().default(null),
  finalizationDecision: z.enum(["finalized", "pending", "skipped"]).nullable().optional().default(null),
  structuredRuntimeEventRef: z.string().min(1).nullable().optional().default(null),
  previousStepId: z.string().min(1).nullable().optional().default(null),
  nextStepId: z.string().min(1).nullable().optional().default(null),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative(),
  status: MissionStatusSchema.exclude(["idle", "pending", "running", "paused"]),
  failureReason: z.string().min(1).nullable().optional().default(null),
  reviewRequiredReason: z.string().min(1).nullable().optional().default(null),
  mapDecision: MapDecisionSchema,
  transitionDecision: TransitionDecisionSchema,
  loopDecision: LoopDecisionSchema,
  stateDecision: StateDecisionSchema,
  emergencyDecision: EmergencyDecisionSchema,
  dataQualityFlags: z.array(z.string().min(1)).default([]),
}).strict().superRefine((value, context) => {
  if (value.startedAt > value.endedAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "startedAt must not be after endedAt", path: ["startedAt"] });
  }
});

export const MissionStateSchema = z.object({
  missionId: z.string().min(1).nullable().optional().default(null),
  mapId: OperationalMapIdSchema.nullable().optional().default(null),
  requestedPlatform: OrchestrationRequestedPlatformIdSchemaSource.nullable().optional().default(null),
  humanGoal: z.string().min(1).nullable().optional().default(null),
  configuredMaxRounds: MissionConfiguredMaxRoundsSchema.nullable().optional().default(null),
  configuredMaxMinutes: MissionConfiguredMaxMinutesSchema.nullable().optional().default(null),
  status: MissionStatusSchema,
  currentStepId: z.string().min(1).nullable().optional().default(null),
  previousStepId: z.string().min(1).nullable().optional().default(null),
  activeTaskRunId: z.string().min(1).nullable().optional().default(null),
  currentRoundIndex: z.number().int().nonnegative().default(0),
  sequenceNo: z.number().int().nonnegative().default(0),
  stateRevision: z.number().int().nonnegative().default(0),
  stateHash: z.string().min(1).nullable().optional().default(null),
  hopCount: z.number().int().nonnegative().default(0),
  reviewRequiredReason: z.string().min(1).nullable().optional().default(null),
  failureReason: z.string().min(1).nullable().optional().default(null),
  lastHumanCommand: MissionHumanCommandKindSchema.nullable().optional().default(null),
  lastEnvelopeId: z.string().min(1).nullable().optional().default(null),
  lastResultRef: z.string().min(1).nullable().optional().default(null),
  lastRuntimeProofRef: z.string().min(1).nullable().optional().default(null),
  runtimeProofRefs: z.array(z.string().min(1)).default([]),
  payloadRefs: PayloadRefBundleSchema,
  emergencyStopLatched: z.boolean().default(false),
  startedAt: z.string().datetime().nullable().optional().default(null),
  updatedAt: z.string().datetime().nullable().optional().default(null),
  pausedAt: z.string().datetime().nullable().optional().default(null),
  endedAt: z.string().datetime().nullable().optional().default(null),
}).strict();

export const MissionExecutionResultSchema = z.object({
  status: MissionStatusSchema.exclude(["idle", "pending", "running", "paused"]),
  output: z.object({
    missionState: MissionStateSchema,
    currentStepResult: MissionStepResultSchema.nullable().default(null),
  }).nullable(),
  stateSnapshot: MissionStateSchema,
  failureReason: z.string().min(1).nullable().default(null),
  reviewRequiredReason: z.string().min(1).nullable().default(null),
  runtimeProof: RuntimeProofSchema,
  policyDecision: z.literal("allowed").default("allowed"),
  dataQualityFlags: z.array(z.string().min(1)).default([]),
}).strict();

export const StartMissionChildInputSchema = MissionCommandSchema;
export const PauseMissionChildInputSchema = MissionControlCommandSchema;
export const ResumeMissionChildInputSchema = MissionControlCommandSchema;
export const StopMissionChildInputSchema = MissionControlCommandSchema;
export const EmergencyStopChildInputSchema = MissionControlCommandSchema;
export const ExecuteMapStepChildInputSchema = z.object({ missionId: z.string().min(1) }).strict();
export const EvaluateStepTransitionChildInputSchema = z.object({ missionId: z.string().min(1) }).strict();
export const RequestHumanReviewChildInputSchema = z.object({ missionId: z.string().min(1), reason: z.string().min(1) }).strict();
export const FinalizeMissionChildInputSchema = z.object({ missionId: z.string().min(1), status: MissionStatusSchema.exclude(["idle", "pending", "running", "paused"]) }).strict();

export const StartMissionChildOutputSchema = MissionStateSchema;
export const PauseMissionChildOutputSchema = MissionStateSchema;
export const ResumeMissionChildOutputSchema = MissionStateSchema;
export const StopMissionChildOutputSchema = MissionStateSchema;
export const EmergencyStopChildOutputSchema = MissionStateSchema;
export const ExecuteMapStepChildOutputSchema = MissionExecutionResultSchema;
export const EvaluateStepTransitionChildOutputSchema = MissionStepResultSchema;
export const RequestHumanReviewChildOutputSchema = MissionStateSchema;
export const FinalizeMissionChildOutputSchema = MissionStateSchema;