import { z } from "zod";

import { MissionLastActionSummarySchema, MissionRoundProgressSchema } from "./runtime/orchestration-round-state-schema.js";
import {
  OrchestrationAllowedAbilityGroupIdSchemaSource,
  OrchestrationRuntimePlanSchemaSource,
  OrchestrationRuntimePlanStepSchemaSource,
  OrchestrationPayloadRefKeySchemaSource,
  OrchestrationRequestedPlatformIdSchemaSource,
  OrchestrationStepKindSchemaSource,
  OrchestrationTransitionSchemaSource,
  OrchestrationTransitionStatusSchemaSource,
} from "./schema-runtime-plan.js";

const ORCHESTRATION_ABILITY_GROUP_ID = "orchestration";

const OrchestrationAllowedAbilityGroupIdsSchemaSource = z.array(OrchestrationAllowedAbilityGroupIdSchemaSource).min(1);

const ORCHESTRATION_CHILD_CAPABILITY_IDS = [
  "start-mission",
  "pause-mission",
  "resume-mission",
  "stop-mission",
  "emergency-stop",
  "execute-runtime-step",
  "evaluate-step-transition",
  "finalize-mission",
] as const;

const ORCHESTRATION_HUMAN_COMMAND_KINDS = [
  "start-mission",
  "pause-mission",
  "resume-mission",
  "stop-mission",
  "emergency-stop",
] as const;

const ORCHESTRATION_INTERNAL_OPERATION_KINDS = [
  "execute-runtime-step",
  "evaluate-step-transition",
  "finalize-mission",
  "loop-guard",
] as const;

const ORCHESTRATION_ALLOWED_ABILITY_GROUP_IDS = OrchestrationAllowedAbilityGroupIdsSchemaSource;
const MissionConfiguredMaxRoundsSchema = z.number().int().positive();
const MissionConfiguredMaxMinutesSchema = z.number().int().positive();
const OrchestrationChildCapabilityIdSchema = z.enum([
  "start-mission",
  "pause-mission",
  "resume-mission",
  "stop-mission",
  "emergency-stop",
  "execute-runtime-step",
  "evaluate-step-transition",
  "finalize-mission",
]);
export const RuntimePlanIdSchema = z.string().min(1);
const AllowedAbilityGroupIdSchema = OrchestrationAllowedAbilityGroupIdSchemaSource;
const MissionHumanCommandKindSchema = z.enum(ORCHESTRATION_HUMAN_COMMAND_KINDS);
const MissionInternalOperationKindSchema = z.enum(ORCHESTRATION_INTERNAL_OPERATION_KINDS);
const RuntimePlanSourceSchema = z.enum(["preferred_runtime_plan", "rejected_missing"]);
const MissionStatusSchema = z.enum([
  "idle",
  "pending",
  "running",
  "paused",
  "completed",
  "failed",
  "review_required",
  "stopped",
]);
const StepKindSchema = OrchestrationStepKindSchemaSource;
const TransitionStatusSchema = OrchestrationTransitionStatusSchemaSource;
const TransitionConditionSourceSchema = z.string().min(1);
const TransitionConditionValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const BranchFieldValuesSchema = z.record(TransitionConditionValueSchema).default({});
const LoopDecisionSchema = z.enum(["continue", "stop_completed", "stop_failed"]);
const MapDecisionSchema = z.enum(["selected", "rejected"]);
const TransitionDecisionSchema = z.enum(["continue", "finalize", "failed"]);
const StateDecisionSchema = z.enum(["created", "updated", "paused", "resumed", "stopped", "emergency_stopped", "finalized"]);
const EmergencyDecisionSchema = z.enum(["none", "latched", "executed"]);
const AbortDecisionSchema = z.enum(["none", "timed_out", "emergency_stopped"]);
const StepDispatchDecisionSchema = z.enum(["dispatched", "timeout_before_dispatch", "step_not_found", "missing_target", "missing_prompt_contract"]);
const TransitionEvaluationDecisionSchema = z.enum(["matched", "no_valid_transition", "ambiguous_transition", "invalid_decision"]);
const NerveBusDispatchDecisionSchema = z.enum(["dispatched", "pending_commander_channel", "dispatch_failed"]);

const PayloadRefKeySchema = OrchestrationPayloadRefKeySchemaSource;

const PayloadRefBundleSchema = z.object({
  requestedPlatformId: OrchestrationRequestedPlatformIdSchemaSource.nullable().optional().default(null),
  selectedBindingId: RuntimePlanIdSchema.nullable().optional().default(null),
  userRequirementRef: z.string().min(1).nullable().optional().default(null),
  operatorNote: z.string().min(1).nullable().optional().default(null),
  targetUrl: z.string().min(1).nullable().optional().default(null),
  targetTitle: z.string().min(1).nullable().optional().default(null),
  targetProfileRef: z.string().min(1).nullable().optional().default(null),
  sourceEvidenceRef: z.string().min(1).nullable().optional().default(null),
  sourceTargetRef: z.string().min(1).nullable().optional().default(null),
  sourceAiResultRef: z.string().min(1).nullable().optional().default(null),
  screenshotEvidenceRef: z.string().min(1).nullable().optional().default(null),
  commentsEvidenceRef: z.string().min(1).nullable().optional().default(null),
  visualTargetRef: z.string().min(1).nullable().optional().default(null),
  visualTargetResultRef: z.string().min(1).nullable().optional().default(null),
  aiTargetCandidateRef: z.string().min(1).nullable().optional().default(null),
  targetCandidateRef: z.string().min(1).nullable().optional().default(null),
  nextItemTargetCandidateRef: z.string().min(1).nullable().optional().default(null),
  geometryProofRef: z.string().min(1).nullable().optional().default(null),
  geometryGuardResultRef: z.string().min(1).nullable().optional().default(null),
  nextItemAdvanceProofRef: z.string().min(1).nullable().optional().default(null),
  nextItemVerificationEvidenceRef: z.string().min(1).nullable().optional().default(null),
  nextItemVerificationPromptInputRef: z.string().min(1).nullable().optional().default(null),
  nextItemVerificationResultRef: z.string().min(1).nullable().optional().default(null),
  pageStateRef: z.string().min(1).nullable().optional().default(null),
  pagePreparationAiResultRef: z.string().min(1).nullable().optional().default(null),
  productPresenceAiResultRef: z.string().min(1).nullable().optional().default(null),
  commentCleanupAiResultRef: z.string().min(1).nullable().optional().default(null),
  originalScreenshotRef: z.string().min(1).nullable().optional().default(null),
  coordinateGridScreenshotRef: z.string().min(1).nullable().optional().default(null),
  gridSpecRef: z.string().min(1).nullable().optional().default(null),
  visualMissionInputRef: z.string().min(1).nullable().optional().default(null),
  systemManualRef: z.string().min(1).nullable().optional().default(null),
  outputSchemaRef: z.string().min(1).nullable().optional().default(null),
  platformContextRef: z.string().min(1).nullable().optional().default(null),
  roundMissionPacketRef: z.string().min(1).nullable().optional().default(null),
  aiResultRef: z.string().min(1).nullable().optional().default(null),
  abilityResultRef: z.string().min(1).nullable().optional().default(null),
  commentsClickActionRef: z.string().min(1).nullable().optional().default(null),
  clickResultRef: z.string().min(1).nullable().optional().default(null),
  commentsOpenVerificationRef: z.string().min(1).nullable().optional().default(null),
  postActionVerificationResultRef: z.string().min(1).nullable().optional().default(null),
  reviewRequiredRef: z.string().min(1).nullable().optional().default(null),
  seedingEvidenceRecordRef: z.string().min(1).nullable().optional().default(null),
  productLeadRecordRef: z.string().min(1).nullable().optional().default(null),
  evidencePacketRecordRef: z.string().min(1).nullable().optional().default(null),
  browseLedgerRecordRef: z.string().min(1).nullable().optional().default(null),
  previousPromptInputRef: z.string().min(1).nullable().optional().default(null),
  promptInputRef: z.string().min(1).nullable().optional().default(null),
  commandInputRef: z.string().min(1).nullable().optional().default(null),
  reviewReasonRef: z.string().min(1).nullable().optional().default(null),
  runtimeLogRef: z.string().min(1).nullable().optional().default(null),
}).strict();

const MissionInitialPayloadSchema = z.object({
  requestedBy: z.string().min(1),
  selectedBindingId: RuntimePlanIdSchema.nullable().optional().default(null),
  userRequirementRef: z.string().min(1).nullable().optional().default(null),
  primaryPlatformId: OrchestrationRequestedPlatformIdSchemaSource.nullable().optional().default(null),
  selectedPlatforms: z.array(OrchestrationRequestedPlatformIdSchemaSource).default([]),
  maxRounds: MissionConfiguredMaxRoundsSchema.nullable().optional().default(null),
  maxMinutes: MissionConfiguredMaxMinutesSchema.nullable().optional().default(null),
  operatorNote: z.string().min(1).nullable().optional().default(null),
  targetUrl: z.string().min(1).nullable().optional().default(null),
  targetTitle: z.string().min(1).nullable().optional().default(null),
  targetProfileRef: z.string().min(1).nullable().optional().default(null),
  sourceEvidenceRef: z.string().min(1).nullable().optional().default(null),
  sourceTargetRef: z.string().min(1).nullable().optional().default(null),
  promptInputRef: z.string().min(1).nullable().optional().default(null),
  commandInputRef: z.string().min(1).nullable().optional().default(null),
}).strict();

const MissionCommandSchema = z.object({
  missionId: z.string().min(1),
  runId: z.string().min(1),
  humanGoal: z.string().min(1),
  requestedPlatform: OrchestrationRequestedPlatformIdSchemaSource,
  preferredBindingId: RuntimePlanIdSchema.nullable().optional().default(null),
  bindingActivationRef: z.string().min(1).nullable().optional().default(null),
  maxRounds: MissionConfiguredMaxRoundsSchema.nullable().optional().default(null),
  maxMinutes: MissionConfiguredMaxMinutesSchema.nullable().optional().default(null),
  initialPayload: MissionInitialPayloadSchema,
}).strict();

const MissionControlCommandSchema = z.object({
  missionId: z.string().min(1),
  reason: z.string().min(1).nullable().optional().default(null),
  note: z.string().min(1).nullable().optional().default(null),
}).strict();

const OrchestrationSequencePolicySchema = z.object({
  maxHops: z.number().int().positive(),
  maxRetriesPerStep: z.number().int().nonnegative(),
  loopDecisionOnLimit: z.literal("failed"),
  branchPolicy: z.literal("strict"),
}).strict();
const ProofPolicySchema = z.object({
  requiresRuntimeProof: z.literal(true),
}).strict();
const RuntimePlanStepSchema = OrchestrationRuntimePlanStepSchemaSource;
const TransitionSchema = OrchestrationTransitionSchemaSource;
const RuntimePlanSchema = OrchestrationRuntimePlanSchemaSource;

const MissionStepResultSchema = z.object({
  status: TransitionStatusSchema,
  missionId: z.string().min(1),
  mapId: RuntimePlanIdSchema,
  stepId: z.string().min(1),
  childCapabilityId: z.string().min(1),
  targetAbilityGroupId: AllowedAbilityGroupIdSchema.nullable().optional().default(null),
  envelopeId: z.string().min(1).nullable().optional().default(null),
  resultRef: z.string().min(1).nullable().optional().default(null),
  outputRef: z.string().min(1).nullable().optional().default(null),
  decision: z.string().min(1).nullable().optional().default(null),
  branchFieldValues: BranchFieldValuesSchema,
  failureReason: z.string().min(1).nullable().optional().default(null),
  reviewRequiredReason: z.string().min(1).nullable().optional().default(null),
  transitionId: z.string().min(1).nullable().optional().default(null),
  nextStepId: z.string().min(1).nullable().optional().default(null),
  payloadRefs: PayloadRefBundleSchema,
}).strict();

const RuntimeProofSchema = z.object({
  proofId: z.string().min(1),
  runId: z.string().min(1),
  missionId: z.string().min(1),
  mapId: RuntimePlanIdSchema,
  bindingActivationRef: z.string().min(1).nullable().optional().default(null),
  bindingPackageId: z.string().min(1).nullable().optional().default(null),
  bindingPackageVersion: z.string().min(1).nullable().optional().default(null),
  mapVersion: z.string().min(1).nullable().optional().default(null),
  bindingVersion: z.string().min(1).nullable().optional().default(null),
  bindingSnapshotRef: z.string().min(1).nullable().optional().default(null),
  promptContractVersion: z.string().min(1).nullable().optional().default(null),
  capabilityCatalogVersion: z.string().min(1).nullable().optional().default(null),
  runtimePlanSource: RuntimePlanSourceSchema.nullable().optional().default(null),
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
  transitionConditionExpected: TransitionConditionValueSchema.optional().default(null),
  transitionConditionActual: TransitionConditionValueSchema.optional().default(null),
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
  status: MissionStatusSchema.exclude(["idle", "pending"]),
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

const MissionStateSchema = z.object({
  missionId: z.string().min(1).nullable().optional().default(null),
  mapId: RuntimePlanIdSchema.nullable().optional().default(null),
  bindingActivationRef: z.string().min(1).nullable().optional().default(null),
  bindingPackageId: z.string().min(1).nullable().optional().default(null),
  bindingPackageVersion: z.string().min(1).nullable().optional().default(null),
  bindingVersion: z.string().min(1).nullable().optional().default(null),
  bindingSnapshotRef: z.string().min(1).nullable().optional().default(null),
  promptContractVersion: z.string().min(1).nullable().optional().default(null),
  capabilityCatalogVersion: z.string().min(1).nullable().optional().default(null),
  runtimePlanSource: RuntimePlanSourceSchema.nullable().optional().default(null),
  requestedPlatform: OrchestrationRequestedPlatformIdSchemaSource.nullable().optional().default(null),
  userRequirementRef: z.string().min(1).nullable().optional().default(null),
  selectedPlatforms: z.array(OrchestrationRequestedPlatformIdSchemaSource).default([]),
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
  roundProgress: MissionRoundProgressSchema.default({
    savedLeadCount: 0,
    skippedCount: 0,
    reviewRequiredCount: 0,
    failedActionCount: 0,
    consecutiveFailureCount: 0,
  }),
  lastActionSummary: MissionLastActionSummarySchema.default({
    sourceActionCode: null,
    status: "pending",
    gridCell: null,
    targetName: null,
    summary: null,
    actionInputRef: null,
    outputRef: null,
    failureReason: null,
    completedAt: null,
  }),
  reviewRequiredReason: z.string().min(1).nullable().optional().default(null),
  failureReason: z.string().min(1).nullable().optional().default(null),
  lastHumanCommand: MissionHumanCommandKindSchema.nullable().optional().default(null),
  lastEnvelopeId: z.string().min(1).nullable().optional().default(null),
  lastResultRef: z.string().min(1).nullable().optional().default(null),
  lastRuntimeProofRef: z.string().min(1).nullable().optional().default(null),
  runtimeProofRefs: z.array(z.string().min(1)).default([]),
  payloadRefs: PayloadRefBundleSchema,
  runLockId: z.string().min(1).nullable().optional().default(null),
  cancellationTokenRef: z.string().min(1).nullable().optional().default(null),
  resumeCheckpointRef: z.string().min(1).nullable().optional().default(null),
  emergencyStopLatched: z.boolean().default(false),
  startedAt: z.string().datetime().nullable().optional().default(null),
  updatedAt: z.string().datetime().nullable().optional().default(null),
  pausedAt: z.string().datetime().nullable().optional().default(null),
  endedAt: z.string().datetime().nullable().optional().default(null),
}).strict();

const MissionExecutionResultSchema = z.object({
  status: MissionStatusSchema.exclude(["idle", "pending"]),
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

const OrchestrationExecuteInputSchema = z.object({
  childCapabilityId: OrchestrationChildCapabilityIdSchema,
  payload: z.unknown(),
}).strict();

const OrchestrationExecuteResultSchema = z.object({
  status: MissionStatusSchema.exclude(["idle", "pending"]),
  output: z.object({
    missionState: MissionStateSchema,
    currentStepResult: MissionStepResultSchema.nullable().default(null),
  }).nullable().default(null),
  stateSnapshot: MissionStateSchema,
  failureReason: z.string().min(1).nullable().default(null),
  reviewRequiredReason: z.string().min(1).nullable().default(null),
  runtimeProof: RuntimeProofSchema,
  policyDecision: z.literal("allowed").default("allowed"),
  dataQualityFlags: z.array(z.string().min(1)).default([]),
}).strict();

const StartMissionChildInputSchema = MissionCommandSchema;
const PauseMissionChildInputSchema = MissionControlCommandSchema;
const ResumeMissionChildInputSchema = MissionControlCommandSchema;
const StopMissionChildInputSchema = MissionControlCommandSchema;
const EmergencyStopChildInputSchema = MissionControlCommandSchema;
const ExecuteRuntimeStepChildInputSchema = z.object({ missionId: z.string().min(1) }).strict();
const EvaluateStepTransitionChildInputSchema = z.object({ missionId: z.string().min(1) }).strict();
const FinalizeMissionChildInputSchema = z.object({ missionId: z.string().min(1), status: MissionStatusSchema.exclude(["idle", "pending", "running", "paused"]) }).strict();

const StartMissionChildOutputSchema = OrchestrationExecuteResultSchema;
const PauseMissionChildOutputSchema = OrchestrationExecuteResultSchema;
const ResumeMissionChildOutputSchema = OrchestrationExecuteResultSchema;
const StopMissionChildOutputSchema = OrchestrationExecuteResultSchema;
const EmergencyStopChildOutputSchema = OrchestrationExecuteResultSchema;
const ExecuteRuntimeStepChildOutputSchema = OrchestrationExecuteResultSchema;
const EvaluateStepTransitionChildOutputSchema = OrchestrationExecuteResultSchema;
const FinalizeMissionChildOutputSchema = OrchestrationExecuteResultSchema;

export {
  ORCHESTRATION_ABILITY_GROUP_ID,
  ORCHESTRATION_CHILD_CAPABILITY_IDS,
  ORCHESTRATION_HUMAN_COMMAND_KINDS,
  ORCHESTRATION_INTERNAL_OPERATION_KINDS,
  ORCHESTRATION_ALLOWED_ABILITY_GROUP_IDS,
  MissionConfiguredMaxRoundsSchema,
  MissionConfiguredMaxMinutesSchema,
  OrchestrationChildCapabilityIdSchema,
  AllowedAbilityGroupIdSchema,
  MissionHumanCommandKindSchema,
  MissionInternalOperationKindSchema,
  RuntimePlanSourceSchema,
  MissionStatusSchema,
  StepKindSchema,
  TransitionStatusSchema,
  TransitionConditionSourceSchema,
  TransitionConditionValueSchema,
  BranchFieldValuesSchema,
  LoopDecisionSchema,
  MapDecisionSchema,
  TransitionDecisionSchema,
  StateDecisionSchema,
  EmergencyDecisionSchema,
  AbortDecisionSchema,
  StepDispatchDecisionSchema,
  TransitionEvaluationDecisionSchema,
  NerveBusDispatchDecisionSchema,
  PayloadRefKeySchema,
  PayloadRefBundleSchema,
  MissionInitialPayloadSchema,
  MissionCommandSchema,
  MissionControlCommandSchema,
  OrchestrationSequencePolicySchema,
  ProofPolicySchema,
  RuntimePlanStepSchema,
  TransitionSchema,
  RuntimePlanSchema as RuntimePlanSchema,
  MissionStepResultSchema,
  RuntimeProofSchema,
  MissionStateSchema,
  MissionExecutionResultSchema,
  OrchestrationExecuteInputSchema,
  OrchestrationExecuteResultSchema,
  StartMissionChildInputSchema,
  PauseMissionChildInputSchema,
  ResumeMissionChildInputSchema,
  StopMissionChildInputSchema,
  EmergencyStopChildInputSchema,
  ExecuteRuntimeStepChildInputSchema,
  EvaluateStepTransitionChildInputSchema,
  FinalizeMissionChildInputSchema,
  StartMissionChildOutputSchema,
  PauseMissionChildOutputSchema,
  ResumeMissionChildOutputSchema,
  StopMissionChildOutputSchema,
  EmergencyStopChildOutputSchema,
  ExecuteRuntimeStepChildOutputSchema,
  EvaluateStepTransitionChildOutputSchema,
  FinalizeMissionChildOutputSchema,
};
