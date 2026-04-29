import { z } from "zod";

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

export const OPERATIONAL_MAP_IDS = [
  "product-video-detection",
  "browse-next-video",
  "comment-evidence",
  "recovery",
  "human-review",
] as const;

export const ORCHESTRATION_ALLOWED_ABILITY_GROUP_IDS = [
  "open",
  "screenshot",
  "ai",
  "visual-target",
  "mouse-click",
  "mouse-scroll",
  "forensics-persistence",
  "page-state",
  "post-action-verification",
] as const;

export const RequestedPlatformIdSchema = z.enum(["tiktok-web", "facebook-web"]);
export const OrchestrationChildCapabilityIdSchema = z.enum(ORCHESTRATION_CHILD_CAPABILITY_IDS);
export const OperationalMapIdSchema = z.enum(OPERATIONAL_MAP_IDS);
export const AllowedAbilityGroupIdSchema = z.enum(ORCHESTRATION_ALLOWED_ABILITY_GROUP_IDS);
export const MissionHumanCommandKindSchema = z.enum([
  "start-mission",
  "pause-mission",
  "resume-mission",
  "stop-mission",
  "emergency-stop",
  "submit-review-decision",
]);
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
export const StepKindSchema = z.enum(["ability", "ai", "review", "finalize"]);
export const TransitionStatusSchema = z.enum(["success", "failed", "review_required"]);
export const TransitionConditionSourceSchema = z.enum(["status", "decision"]);
export const LoopDecisionSchema = z.enum(["continue", "stop_failed", "stop_review_required"]);
export const MapDecisionSchema = z.enum(["selected", "rejected"]);
export const TransitionDecisionSchema = z.enum(["continue", "finalize", "review_required", "failed"]);
export const StateDecisionSchema = z.enum(["created", "updated", "paused", "resumed", "stopped", "emergency_stopped", "finalized"]);
export const EmergencyDecisionSchema = z.enum(["none", "latched", "executed"]);

export const PayloadRefKeySchema = z.enum([
  "requestedPlatformId",
  "selectedMapId",
  "operatorNote",
  "targetUrl",
  "targetTitle",
  "sourceEvidenceRef",
  "sourceTargetRef",
  "screenshotEvidenceRef",
  "commentsEvidenceRef",
  "visualTargetRef",
  "geometryProofRef",
  "pageStateRef",
  "aiResultRef",
  "abilityResultRef",
  "promptInputRef",
  "commandInputRef",
  "reviewReasonRef",
  "runtimeLogRef",
] as const);

export const PayloadRefBundleSchema = z.object({
  requestedPlatformId: RequestedPlatformIdSchema.nullable().optional().default(null),
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
  requestedPlatform: RequestedPlatformIdSchema,
  preferredMapId: OperationalMapIdSchema.nullable().optional().default(null),
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

export const TransitionConditionSchema = z.object({
  source: TransitionConditionSourceSchema,
  equals: z.union([z.string(), z.boolean(), z.null()]),
}).strict();

export const OrchestrationSequencePolicySchema = z.object({
  maxHops: z.number().int().positive(),
  maxRetriesPerStep: z.number().int().nonnegative(),
  loopDecisionOnLimit: z.enum(["failed", "review_required"]),
  branchPolicy: z.enum(["strict", "allow_review_handoff"]),
}).strict();

export const TimeoutPolicySchema = z.object({
  maxDurationMs: z.number().int().positive(),
}).strict();

export const ProofPolicySchema = z.object({
  requiresRuntimeProof: z.literal(true),
}).strict();

export const OperationalMapStepSchema = z.object({
  stepId: z.string().min(1),
  capabilityId: z.literal(ORCHESTRATION_ABILITY_GROUP_ID),
  childCapabilityId: z.string().min(1),
  stepKind: StepKindSchema,
  targetAbilityGroupId: AllowedAbilityGroupIdSchema.nullable().optional().default(null),
  inputRefs: z.array(PayloadRefKeySchema).default([]),
  outputRefPolicy: z.object({
    storeAs: z.array(PayloadRefKeySchema).default([]),
  }).strict(),
  promptContractId: z.string().min(1).nullable().optional().default(null),
  successCondition: TransitionConditionSchema,
  failureBranch: z.string().min(1),
  reviewBranch: z.string().min(1),
  timeoutPolicy: TimeoutPolicySchema,
  proofPolicy: ProofPolicySchema,
}).strict().superRefine((value, context) => {
  if (value.stepKind === "ai") {
    if (value.targetAbilityGroupId !== "ai") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "AI step must target ai ability group.", path: ["targetAbilityGroupId"] });
    }
    if (!value.promptContractId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "AI step must declare promptContractId.", path: ["promptContractId"] });
    }
  }
  if (value.stepKind === "ability" && value.targetAbilityGroupId === "ai") {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Non-AI step must not target ai ability group.", path: ["targetAbilityGroupId"] });
  }
  if ((value.stepKind === "review" || value.stepKind === "finalize") && value.targetAbilityGroupId !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Review/finalize steps must not target ability groups.", path: ["targetAbilityGroupId"] });
  }
});

export const TransitionSchema = z.object({
  transitionId: z.string().min(1),
  fromStepId: z.string().min(1),
  onStatus: TransitionStatusSchema,
  condition: TransitionConditionSchema,
  toStepId: z.string().min(1).nullable().optional().default(null),
  finalStatus: MissionStatusSchema.exclude(["idle", "pending", "running", "paused"]).nullable().optional().default(null),
}).strict();

export const OperationalMapSchema = z.object({
  mapId: OperationalMapIdSchema,
  displayName: z.string().min(1),
  humanGoal: z.string().min(1),
  allowedAbilityGroups: z.array(AllowedAbilityGroupIdSchema).min(1),
  initialStepId: z.string().min(1),
  steps: z.array(OperationalMapStepSchema).min(1),
  transitions: z.array(TransitionSchema).min(1),
  failureBranches: z.array(z.string().min(1)).default([]),
  reviewBranches: z.array(z.string().min(1)).default([]),
  finalStates: z.array(MissionStatusSchema.exclude(["idle", "pending", "running", "paused"])) .min(1),
  forbiddenDirectCalls: z.array(z.string().min(1)).default([]),
  sequencePolicy: OrchestrationSequencePolicySchema,
}).strict().superRefine((value, context) => {
  const stepIds = new Set<string>();
  for (const step of value.steps) {
    if (stepIds.has(step.stepId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Operational map stepId must be unique.", path: ["steps"] });
    }
    stepIds.add(step.stepId);
    if (step.targetAbilityGroupId && !value.allowedAbilityGroups.includes(step.targetAbilityGroupId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Step targetAbilityGroupId must be in allowedAbilityGroups.", path: ["steps"] });
    }
  }
  if (!stepIds.has(value.initialStepId)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Operational map must reference an existing initialStepId.", path: ["initialStepId"] });
  }
  const transitionIds = new Set<string>();
  for (const transition of value.transitions) {
    if (transitionIds.has(transition.transitionId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Transition ids must be unique.", path: ["transitions"] });
    }
    transitionIds.add(transition.transitionId);
    if (!stepIds.has(transition.fromStepId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Transition fromStepId must exist.", path: ["transitions"] });
    }
    if (transition.toStepId && !stepIds.has(transition.toStepId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Transition toStepId must exist.", path: ["transitions"] });
    }
  }
});

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
  stepId: z.string().min(1),
  childCapabilityId: z.string().min(1),
  commandKind: MissionHumanCommandKindSchema,
  caller: z.enum(["commander-console", "orchestration"]),
  idempotencyKey: z.string().min(1),
  sequenceNo: z.number().int().nonnegative(),
  inputRef: z.string().min(1).nullable().optional().default(null),
  outputRef: z.string().min(1).nullable().optional().default(null),
  nerveBusEnvelopeId: z.string().min(1).nullable().optional().default(null),
  abilityResultRef: z.string().min(1).nullable().optional().default(null),
  transitionId: z.string().min(1).nullable().optional().default(null),
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
  requestedPlatform: RequestedPlatformIdSchema.nullable().optional().default(null),
  humanGoal: z.string().min(1).nullable().optional().default(null),
  status: MissionStatusSchema,
  currentStepId: z.string().min(1).nullable().optional().default(null),
  previousStepId: z.string().min(1).nullable().optional().default(null),
  activeTaskRunId: z.string().min(1).nullable().optional().default(null),
  currentRoundIndex: z.number().int().nonnegative().default(0),
  sequenceNo: z.number().int().nonnegative().default(0),
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
  missionState: MissionStateSchema,
  status: MissionStatusSchema.exclude(["idle", "pending", "running", "paused"]),
  currentStepResult: MissionStepResultSchema.nullable().optional().default(null),
  runtimeProof: RuntimeProofSchema,
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