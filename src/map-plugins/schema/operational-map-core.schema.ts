import { z } from "zod";

export const MAP_PLUGIN_ALLOWED_ABILITY_GROUP_IDS = [
  "open",
  "screenshot",
  "ai",
  "visual-target",
  "geometry-guard",
  "mouse-click",
  "text-input",
  "mouse-scroll",
  "forensics-persistence",
  "page-state",
  "post-action-verification",
] as const;

const MAP_PLUGIN_CAPABILITY_ID = "orchestration";

export const MapPluginAllowedAbilityGroupIdSchema = z.enum(MAP_PLUGIN_ALLOWED_ABILITY_GROUP_IDS);
export const MapPluginPayloadRefKeySchema = z.enum([
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
export const MapPluginStepKindSchema = z.enum(["ability", "ai", "review", "finalize"]);
export const MapPluginTransitionStatusSchema = z.enum(["success", "failed", "review_required"]);
export const MapPluginTransitionConditionSourceSchema = z.enum(["status", "decision"]);
export const MapPluginMissionTerminalStatusSchema = z.enum(["completed", "failed", "review_required", "stopped"]);

export const MapPluginTransitionConditionSchema = z.object({
  source: MapPluginTransitionConditionSourceSchema,
  equals: z.union([z.string(), z.boolean(), z.null()]),
}).strict();

export const MapPluginOrchestrationSequencePolicySchema = z.object({
  maxHops: z.number().int().positive(),
  maxRetriesPerStep: z.number().int().nonnegative(),
  loopDecisionOnLimit: z.enum(["failed", "review_required"]),
  branchPolicy: z.enum(["strict", "allow_review_handoff"]),
}).strict();

export const MapPluginTimeoutPolicySchema = z.object({
  maxDurationMs: z.number().int().positive(),
}).strict();

export const MapPluginProofPolicySchema = z.object({
  requiresRuntimeProof: z.literal(true),
}).strict();

export const MapPluginOperationalMapStepSchema = z.object({
  stepId: z.string().min(1),
  capabilityId: z.literal(MAP_PLUGIN_CAPABILITY_ID),
  childCapabilityId: z.string().min(1),
  stepKind: MapPluginStepKindSchema,
  targetAbilityGroupId: MapPluginAllowedAbilityGroupIdSchema.nullable().optional().default(null),
  inputRefs: z.array(MapPluginPayloadRefKeySchema).default([]),
  outputRefPolicy: z.object({
    storeAs: z.array(MapPluginPayloadRefKeySchema).default([]),
  }).strict(),
  promptContractId: z.string().min(1).nullable().optional().default(null),
  successCondition: MapPluginTransitionConditionSchema,
  failureBranch: z.string().min(1),
  reviewBranch: z.string().min(1),
  timeoutPolicy: MapPluginTimeoutPolicySchema,
  proofPolicy: MapPluginProofPolicySchema,
}).strict().superRefine((value, context) => {
  if (value.stepKind === "ai") {
    if (value.targetAbilityGroupId !== "ai") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "AI step must target ai ability group.", path: ["targetAbilityGroupId"] });
    }
    if (!value.promptContractId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "AI step must declare promptContractId.", path: ["promptContractId"] });
    }
  }
  if (value.stepKind === "ability") {
    if (!value.targetAbilityGroupId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Ability step must declare a non-null targetAbilityGroupId.", path: ["targetAbilityGroupId"] });
    }
    if (value.targetAbilityGroupId === "ai") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Non-AI step must not target ai ability group.", path: ["targetAbilityGroupId"] });
    }
  }
  if ((value.stepKind === "review" || value.stepKind === "finalize") && value.targetAbilityGroupId !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Review/finalize steps must not target ability groups.", path: ["targetAbilityGroupId"] });
  }
});

export const MapPluginTransitionSchema = z.object({
  transitionId: z.string().min(1),
  fromStepId: z.string().min(1),
  onStatus: MapPluginTransitionStatusSchema,
  condition: MapPluginTransitionConditionSchema,
  toStepId: z.string().min(1).nullable().optional().default(null),
  finalStatus: MapPluginMissionTerminalStatusSchema.nullable().optional().default(null),
}).strict();

export const MapPluginOperationalMapSchema = z.object({
  mapId: z.string().min(1),
  displayName: z.string().min(1),
  humanGoal: z.string().min(1),
  allowedAbilityGroups: z.array(MapPluginAllowedAbilityGroupIdSchema).min(1),
  initialStepId: z.string().min(1),
  steps: z.array(MapPluginOperationalMapStepSchema).min(1),
  transitions: z.array(MapPluginTransitionSchema).min(1),
  failureBranches: z.array(z.string().min(1)).default([]),
  reviewBranches: z.array(z.string().min(1)).default([]),
  finalStates: z.array(MapPluginMissionTerminalStatusSchema).min(1),
  forbiddenDirectCalls: z.array(z.string().min(1)).default([]),
  sequencePolicy: MapPluginOrchestrationSequencePolicySchema,
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
  for (const transitionId of value.failureBranches) {
    if (!transitionIds.has(transitionId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `failureBranch ${transitionId} must reference an existing transitionId.`, path: ["failureBranches"] });
    }
  }
  for (const transitionId of value.reviewBranches) {
    if (!transitionIds.has(transitionId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `reviewBranch ${transitionId} must reference an existing transitionId.`, path: ["reviewBranches"] });
    }
  }
  for (const finalState of value.finalStates) {
    const canReachFinal = value.transitions.some((transition) => transition.finalStatus === finalState);
    if (!canReachFinal) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `finalState ${finalState} must be reachable via at least one transition.`, path: ["finalStates"] });
    }
  }
});