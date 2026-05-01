import { z } from "zod";

import { POST_ACTION_EVIDENCE_KINDS } from "./shared/post-action-evidence.js";
import { POST_ACTION_FAILURE_REASONS } from "./shared/post-action-failure.js";
import {
  POST_ACTION_MAX_DATA_QUALITY_FLAGS,
  POST_ACTION_MAX_EVIDENCE_REFS,
  POST_ACTION_MAX_OBSERVATIONS,
  POST_ACTION_MAX_SIGNAL_TYPE_LENGTH,
  POST_ACTION_MAX_SOURCE_PROOF_REFS,
  POST_ACTION_MAX_STATUS_MESSAGE_LENGTH,
  POST_ACTION_MAX_SUMMARY_LENGTH,
  POST_ACTION_MAX_TARGET_TYPE_LENGTH,
  POST_ACTION_VERIFICATION_MODES,
} from "./shared/post-action-policy.js";
import { POST_ACTION_ACTION_STATUSES, POST_ACTION_VERIFICATION_CLOCK_KIND } from "./shared/post-action-proof.js";
import { POST_ACTION_VERIFICATION_DECISIONS, POST_ACTION_VERIFICATION_STATUSES } from "./shared/post-action-result.js";
import {
  POST_ACTION_OBSERVATION_KINDS,
  POST_ACTION_OBSERVATION_SOURCE_ABILITY_GROUP_IDS,
} from "./shared/post-action-observation.js";
import {
  POST_ACTION_EXPECTED_OUTCOME_TYPES,
  POST_ACTION_SOURCE_ABILITY_GROUP_IDS,
  POST_ACTION_SOURCE_CHILD_CAPABILITY_IDS,
  POST_ACTION_VERIFICATION_ABILITY_GROUP_ID,
  POST_ACTION_VERIFICATION_CHILD_CAPABILITY_IDS,
} from "./shared/post-action-types.js";

const nonNegativeInt = z.number().int().nonnegative();
const requiredString = z.string().min(1);
const requiredLimitedString = requiredString.max(POST_ACTION_MAX_SUMMARY_LENGTH);
const nullableString = requiredString.nullable().optional().default(null);
const nullableLimitedString = z.string().min(1).max(POST_ACTION_MAX_SUMMARY_LENGTH).nullable().optional().default(null);
const dataQualityFlagsSchema = z.array(z.string().min(1).max(120)).max(POST_ACTION_MAX_DATA_QUALITY_FLAGS).default([]);

const PostActionVerificationChildCapabilityIdSchema = z.enum(POST_ACTION_VERIFICATION_CHILD_CAPABILITY_IDS);
const PostActionVerificationStatusSchema = z.enum(POST_ACTION_VERIFICATION_STATUSES);
const PostActionVerificationDecisionSchema = z.enum(POST_ACTION_VERIFICATION_DECISIONS);
const PostActionFailureReasonSchema = z.enum(POST_ACTION_FAILURE_REASONS);
const PostActionActionStatusSchema = z.enum(POST_ACTION_ACTION_STATUSES);
const PostActionExpectedOutcomeTypeSchema = z.enum(POST_ACTION_EXPECTED_OUTCOME_TYPES);
const PostActionEvidenceKindSchema = z.enum(POST_ACTION_EVIDENCE_KINDS);
const PostActionObservationKindSchema = z.enum(POST_ACTION_OBSERVATION_KINDS);
const PostActionVerificationModeSchema = z.enum(POST_ACTION_VERIFICATION_MODES);
const PostActionSourceAbilityGroupIdSchema = z.enum(POST_ACTION_SOURCE_ABILITY_GROUP_IDS);
const PostActionSourceChildCapabilityIdSchema = z.enum(POST_ACTION_SOURCE_CHILD_CAPABILITY_IDS);
const PostActionObservationSourceAbilityGroupIdSchema = z.enum(POST_ACTION_OBSERVATION_SOURCE_ABILITY_GROUP_IDS);

const PostActionObservationSourceSchema = z.object({
  sourceAbilityGroupId: PostActionObservationSourceAbilityGroupIdSchema,
  sourceChildCapabilityId: z.string().min(1).max(POST_ACTION_MAX_TARGET_TYPE_LENGTH),
  sourceProofRef: requiredString,
}).strict();

const PostActionExpectedOutcomeSchema = z.object({
  outcomeType: PostActionExpectedOutcomeTypeSchema,
  description: requiredLimitedString,
  expectedUrlHost: nullableLimitedString,
  expectedUrlPrefix: nullableLimitedString,
  expectedState: nullableLimitedString,
  expectedTargetType: z.string().min(1).max(POST_ACTION_MAX_TARGET_TYPE_LENGTH).nullable().optional().default(null),
  requiresBeforeAfterComparison: z.boolean().default(false),
  requiresVisualEvidence: z.boolean().default(false),
}).strict();

const PostActionActionProofSchema = z.object({
  actionProofRef: requiredString,
  actionLogRef: nullableString,
  actionRecordRef: nullableString,
  sourceRuntimeProofRef: requiredString,
  sourceActionResultRef: nullableString,
  sourceActionOutputRef: nullableString,
  sourceAbilityGroupId: PostActionSourceAbilityGroupIdSchema,
  sourceChildCapabilityId: PostActionSourceChildCapabilityIdSchema,
  actionType: z.string().min(1).max(POST_ACTION_MAX_TARGET_TYPE_LENGTH),
  actionStatus: PostActionActionStatusSchema,
  primitiveExecutionRef: nullableString,
  navigationAttemptRef: nullableString,
  scrollExecutionRef: nullableString,
  sessionId: requiredString,
  roundId: nullableString,
  videoVisitId: nullableString,
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  selfReportedOnly: z.boolean().default(false),
}).strict().superRefine((value, context) => {
  if (value.startedAt > value.endedAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "startedAt must not be after endedAt", path: ["startedAt"] });
  }
  if (value.actionLogRef === null && value.actionRecordRef === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "actionLogRef or actionRecordRef is required", path: ["actionLogRef"] });
  }
});

const PostActionEvidenceRefSchema = z.object({
  evidenceRef: requiredString,
  evidenceKind: PostActionEvidenceKindSchema,
  source: PostActionObservationSourceSchema,
  capturedAt: z.string().datetime(),
  sessionId: requiredString,
  roundId: nullableString,
  videoVisitId: nullableString,
}).strict();

const PageStateObservationPayloadSchema = z.object({
  kind: z.literal("page_state"),
  currentUrl: nullableLimitedString,
  loginState: z.enum(["unknown", "ready", "login_required", "review_required", "captcha", "security_wall"]).default("unknown"),
  commentsPanelOpen: z.boolean().nullable().default(null),
  modalOverlayPresent: z.boolean().nullable().default(null),
  recommendationChanged: z.boolean().nullable().default(null),
  changeSummary: nullableLimitedString,
  targetStateChanged: z.boolean().nullable().default(null),
  targetType: z.string().min(1).max(POST_ACTION_MAX_TARGET_TYPE_LENGTH).nullable().optional().default(null),
  wrongDomain: z.boolean().nullable().default(null),
}).strict();

const AiObservationPayloadSchema = z.object({
  kind: z.literal("ai_observation"),
  commentsPanelOpen: z.boolean().nullable().default(null),
  recommendationChanged: z.boolean().nullable().default(null),
  targetStateChanged: z.boolean().nullable().default(null),
  summary: nullableLimitedString,
  confidence: z.number().min(0).max(1).nullable().default(null),
}).strict();

const VisualTargetObservationPayloadSchema = z.object({
  kind: z.literal("visual_target"),
  targetType: z.string().min(1).max(POST_ACTION_MAX_TARGET_TYPE_LENGTH).nullable().optional().default(null),
  targetId: nullableLimitedString,
  targetStateChanged: z.boolean().nullable().default(null),
  commentsPanelOpen: z.boolean().nullable().default(null),
  visible: z.boolean().nullable().default(null),
  confidence: z.number().min(0).max(1).nullable().default(null),
}).strict();

const ScreenshotDiffObservationPayloadSchema = z.object({
  kind: z.literal("screenshot_diff"),
  changed: z.boolean(),
  targetStateChanged: z.boolean().nullable().default(null),
  beforeFingerprint: nullableLimitedString,
  afterFingerprint: nullableLimitedString,
}).strict();

const VideoIdentityObservationPayloadSchema = z.object({
  kind: z.literal("video_identity"),
  role: z.enum(["before", "after"]),
  videoId: nullableLimitedString,
  visualSignature: nullableLimitedString,
  confirmed: z.boolean().nullable().default(null),
}).strict();

const ActionCompletionObservationPayloadSchema = z.object({
  kind: z.literal("action_completion"),
  ok: z.boolean(),
  fallbackUsed: z.boolean().nullable().default(null),
  targetType: z.string().min(1).max(POST_ACTION_MAX_TARGET_TYPE_LENGTH).nullable().optional().default(null),
}).strict();

const RuntimeSignalObservationPayloadSchema = z.object({
  kind: z.literal("runtime_signal"),
  signalType: z.string().min(1).max(POST_ACTION_MAX_SIGNAL_TYPE_LENGTH),
  recommendationChanged: z.boolean().nullable().default(null),
  targetStateChanged: z.boolean().nullable().default(null),
  afterConfirmed: z.boolean().nullable().default(null),
  summary: nullableLimitedString,
}).strict();

const PostActionObservationPayloadSchema = z.discriminatedUnion("kind", [
  PageStateObservationPayloadSchema,
  AiObservationPayloadSchema,
  VisualTargetObservationPayloadSchema,
  ScreenshotDiffObservationPayloadSchema,
  VideoIdentityObservationPayloadSchema,
  ActionCompletionObservationPayloadSchema,
  RuntimeSignalObservationPayloadSchema,
]);

const PostActionObservationSchema = z.object({
  kind: PostActionObservationKindSchema,
  ref: requiredString,
  source: PostActionObservationSourceSchema,
  capturedAt: z.string().datetime(),
  sessionId: requiredString,
  roundId: nullableString,
  videoVisitId: nullableString,
  payload: PostActionObservationPayloadSchema,
}).strict().superRefine((value, context) => {
  if (value.kind !== value.payload.kind) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "payload.kind must equal observation.kind", path: ["payload", "kind"] });
  }
});

const PostActionBeforeAfterEvidenceSchema = z.object({
  beforeEvidence: PostActionEvidenceRefSchema.nullable().default(null),
  afterEvidence: PostActionEvidenceRefSchema.nullable().default(null),
}).strict();

const PostActionVerificationPolicySchema = z.object({
  verificationMode: PostActionVerificationModeSchema,
  requireAfterEvidence: z.boolean().default(false),
  requireBeforeAfterComparison: z.boolean().default(false),
  allowSelfReportedSuccess: z.boolean().default(false),
}).strict();

const PostActionConfidencePolicySchema = z.object({
  minimumConfidence: z.number().gt(0).lte(1),
  allowReviewRequired: z.boolean().default(true),
}).strict();

const PostActionObservationSetSchema = z.object({
  observations: z.array(PostActionObservationSchema).max(POST_ACTION_MAX_OBSERVATIONS).default([]),
}).strict();

const PostActionVerificationAbilityInputSchema = z.object({
  abilityGroupId: z.literal(POST_ACTION_VERIFICATION_ABILITY_GROUP_ID).default(POST_ACTION_VERIFICATION_ABILITY_GROUP_ID),
  childCapabilityId: PostActionVerificationChildCapabilityIdSchema,
  requestedBy: requiredString,
  sessionId: requiredString,
  roundId: nullableString,
  videoVisitId: nullableString,
  expectedOutcome: PostActionExpectedOutcomeSchema,
  actionProof: PostActionActionProofSchema,
  beforeAfterEvidence: PostActionBeforeAfterEvidenceSchema,
  observationSet: PostActionObservationSetSchema,
  verificationPolicy: PostActionVerificationPolicySchema,
  confidencePolicy: PostActionConfidencePolicySchema,
  inputRef: requiredString,
}).strict();

const PostActionVerificationClockSchema = z.object({
  portKind: z.literal(POST_ACTION_VERIFICATION_CLOCK_KIND),
  startedMonotonicMs: z.number().finite(),
  endedMonotonicMs: z.number().finite(),
}).strict();

const PostActionVerificationOutputSchema = z.object({
  observedOutcome: z.string().min(1).max(POST_ACTION_MAX_SUMMARY_LENGTH),
  verificationDecision: z.literal("verified"),
  confidence: z.number().min(0).max(1),
  evidenceRefs: z.array(requiredString).max(POST_ACTION_MAX_EVIDENCE_REFS).default([]),
  observationRefs: z.array(requiredString).max(POST_ACTION_MAX_OBSERVATIONS).default([]),
  actionResultVerifiedRef: requiredString,
  confidenceSource: z.string().min(1).max(POST_ACTION_MAX_SIGNAL_TYPE_LENGTH),
  verifiedByEvidenceKinds: z.array(PostActionEvidenceKindSchema).max(POST_ACTION_MAX_EVIDENCE_REFS).default([]),
  supportingSourceProofRefs: z.array(requiredString).max(POST_ACTION_MAX_SOURCE_PROOF_REFS).default([]),
}).strict();

const PostActionRuntimeProofSchema = z.object({
  proofId: requiredString,
  runId: requiredString,
  missionId: nullableString,
  sessionId: nullableString,
  roundId: nullableString,
  videoVisitId: nullableString,
  abilityGroupId: z.literal(POST_ACTION_VERIFICATION_ABILITY_GROUP_ID),
  childCapabilityId: PostActionVerificationChildCapabilityIdSchema.nullable(),
  actionProofRef: nullableString,
  actionLogRef: nullableString,
  sourceActionRuntimeProofRef: nullableString,
  sourceActionResultRef: nullableString,
  sourceActionOutputRef: nullableString,
  sourceActionAbilityGroupId: PostActionSourceAbilityGroupIdSchema.nullable(),
  sourceActionChildCapabilityId: z.string().min(1).max(POST_ACTION_MAX_TARGET_TYPE_LENGTH).nullable().optional().default(null),
  actionType: z.string().min(1).max(POST_ACTION_MAX_TARGET_TYPE_LENGTH).nullable().optional().default(null),
  actionStatus: PostActionActionStatusSchema.nullable().optional().default(null),
  expectedOutcomeType: PostActionExpectedOutcomeTypeSchema.nullable().optional().default(null),
  beforeEvidenceRefs: z.array(requiredString).max(POST_ACTION_MAX_EVIDENCE_REFS).default([]),
  afterEvidenceRefs: z.array(requiredString).max(POST_ACTION_MAX_EVIDENCE_REFS).default([]),
  observationRefs: z.array(requiredString).max(POST_ACTION_MAX_OBSERVATIONS).default([]),
  evidenceSourceRefs: z.array(requiredString).max(POST_ACTION_MAX_SOURCE_PROOF_REFS).default([]),
  inputRef: requiredString,
  outputRef: nullableString,
  diagnosticPayloadRef: nullableString,
  debugLogRef: requiredString,
  structuredRuntimeEventRef: nullableString,
  inputPayloadHash: requiredString,
  actionProofHash: nullableString,
  expectedOutcomeHash: nullableString,
  beforeEvidenceHash: nullableString,
  afterEvidenceHash: nullableString,
  observationSetHash: requiredString,
  receivedShapeHash: nullableString,
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: nonNegativeInt,
  status: PostActionVerificationStatusSchema,
  verificationDecision: PostActionVerificationDecisionSchema,
  confidence: z.number().min(0).max(1),
  failureReason: PostActionFailureReasonSchema.nullable().default(null),
  reviewRequiredReason: nullableLimitedString,
  inputDecision: requiredString,
  actionProofDecision: requiredString,
  evidenceSourceDecision: requiredString,
  beforeAfterDecision: requiredString,
  policyDecision: requiredString,
  outputBoundaryDecision: requiredString,
  criticalDataQualityDecision: requiredString,
  observationBindingDecision: requiredString,
  beforeAfterPairDecision: requiredString,
  verificationDecisionTrace: z.array(requiredString).max(POST_ACTION_MAX_SOURCE_PROOF_REFS),
  dataQualityFlags: dataQualityFlagsSchema,
  clock: PostActionVerificationClockSchema,
}).strict().superRefine((value, context) => {
  if (value.startedAt > value.endedAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "startedAt must not be after endedAt", path: ["startedAt"] });
  }
  if (value.status === "success") {
    if (value.verificationDecision !== "verified") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "success status requires verified decision", path: ["verificationDecision"] });
    }
    if (value.outputRef === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "success proof requires outputRef", path: ["outputRef"] });
    }
    if (value.diagnosticPayloadRef !== null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "success proof must not expose diagnosticPayloadRef", path: ["diagnosticPayloadRef"] });
    }
  } else if (value.diagnosticPayloadRef === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "failed/review_required proof requires diagnosticPayloadRef", path: ["diagnosticPayloadRef"] });
  }
});

const PostActionChildAssessmentSchema = z.object({
  observedOutcome: z.string().min(1).max(POST_ACTION_MAX_SUMMARY_LENGTH),
  verificationDecision: PostActionVerificationDecisionSchema,
  confidence: z.number().min(0).max(1),
  failureReason: PostActionFailureReasonSchema.nullable().default(null),
  reviewRequiredReason: nullableLimitedString,
  statusMessage: z.string().min(1).max(POST_ACTION_MAX_STATUS_MESSAGE_LENGTH),
  dataQualityFlags: dataQualityFlagsSchema,
  supportingEvidenceRefs: z.array(requiredString).max(POST_ACTION_MAX_EVIDENCE_REFS).default([]),
  supportingObservationRefs: z.array(requiredString).max(POST_ACTION_MAX_OBSERVATIONS).default([]),
  supportingSourceProofRefs: z.array(requiredString).max(POST_ACTION_MAX_SOURCE_PROOF_REFS).default([]),
  verifiedByEvidenceKinds: z.array(PostActionEvidenceKindSchema).max(POST_ACTION_MAX_EVIDENCE_REFS).default([]),
  confidenceSource: z.string().min(1).max(POST_ACTION_MAX_SIGNAL_TYPE_LENGTH),
}).strict();

const PostActionVerificationAbilityResultSchema = z.object({
  status: PostActionVerificationStatusSchema,
  abilityGroupId: z.literal(POST_ACTION_VERIFICATION_ABILITY_GROUP_ID),
  childCapabilityId: PostActionVerificationChildCapabilityIdSchema.nullable(),
  sessionId: nullableString,
  roundId: nullableString,
  videoVisitId: nullableString,
  actionProofRef: nullableString,
  expectedOutcome: PostActionExpectedOutcomeSchema.nullable(),
  output: PostActionVerificationOutputSchema.nullable(),
  verificationDecision: PostActionVerificationDecisionSchema,
  failureReason: PostActionFailureReasonSchema.nullable().default(null),
  reviewRequiredReason: nullableLimitedString,
  statusMessage: z.string().min(1).max(POST_ACTION_MAX_STATUS_MESSAGE_LENGTH),
  debugLogRef: requiredString,
  structuredRuntimeEventRef: nullableString,
  diagnosticPayloadRef: nullableString,
  policyDecision: requiredString,
  runtimeProof: PostActionRuntimeProofSchema,
  dataQualityFlags: dataQualityFlagsSchema,
}).strict().superRefine(postActionVerificationAbilityResultSuperRefine);

const validatePostActionVerificationAbilityResultRuntimeProofConsistency = (
  value: z.output<typeof PostActionVerificationAbilityResultSchema>,
  context: z.RefinementCtx,
): void => {
  if (value.runtimeProof.status !== value.status) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "runtimeProof.status must equal result.status", path: ["runtimeProof", "status"] });
  }
  if (value.runtimeProof.verificationDecision !== value.verificationDecision) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "runtimeProof.verificationDecision must equal result.verificationDecision", path: ["runtimeProof", "verificationDecision"] });
  }
};

const validatePostActionVerificationAbilityResultShape = (
  value: z.output<typeof PostActionVerificationAbilityResultSchema>,
  context: z.RefinementCtx,
): void => {
  if (value.status === "success") {
    if (value.output === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "success result requires output", path: ["output"] });
    }
    if (value.verificationDecision !== "verified") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "success result requires verified decision", path: ["verificationDecision"] });
    }
    if (value.diagnosticPayloadRef !== null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "success result must not expose diagnosticPayloadRef", path: ["diagnosticPayloadRef"] });
    }
    return;
  }

  if (value.output !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "failed/review_required result must not expose output", path: ["output"] });
  }
  if (value.diagnosticPayloadRef === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "failed/review_required result requires diagnosticPayloadRef", path: ["diagnosticPayloadRef"] });
  }
};

const validatePostActionVerificationAbilityResultGovernedFields = (
  value: z.output<typeof PostActionVerificationAbilityResultSchema>,
  context: z.RefinementCtx,
): void => {
  if (value.failureReason === "input_schema_invalid") {
    return;
  }
  if (value.childCapabilityId === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "childCapabilityId is required for governed results", path: ["childCapabilityId"] });
  }
  if (value.expectedOutcome === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "expectedOutcome is required for governed results", path: ["expectedOutcome"] });
  }
  if (value.actionProofRef === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "actionProofRef is required for governed results", path: ["actionProofRef"] });
  }
};

const postActionVerificationAbilityResultSuperRefine = (
  value: z.output<typeof PostActionVerificationAbilityResultSchema>,
  context: z.RefinementCtx,
): void => {
  validatePostActionVerificationAbilityResultRuntimeProofConsistency(value, context);
  validatePostActionVerificationAbilityResultShape(value, context);
  validatePostActionVerificationAbilityResultGovernedFields(value, context);
};


export { PostActionVerificationChildCapabilityIdSchema, PostActionVerificationStatusSchema, PostActionVerificationDecisionSchema, PostActionFailureReasonSchema, PostActionActionStatusSchema, PostActionExpectedOutcomeTypeSchema, PostActionEvidenceKindSchema, PostActionObservationKindSchema, PostActionVerificationModeSchema, PostActionSourceAbilityGroupIdSchema, PostActionSourceChildCapabilityIdSchema, PostActionObservationSourceAbilityGroupIdSchema, PostActionObservationSourceSchema, PostActionExpectedOutcomeSchema, PostActionActionProofSchema, PostActionEvidenceRefSchema, PageStateObservationPayloadSchema, AiObservationPayloadSchema, VisualTargetObservationPayloadSchema, ScreenshotDiffObservationPayloadSchema, VideoIdentityObservationPayloadSchema, ActionCompletionObservationPayloadSchema, RuntimeSignalObservationPayloadSchema, PostActionObservationPayloadSchema, PostActionObservationSchema, PostActionBeforeAfterEvidenceSchema, PostActionVerificationPolicySchema, PostActionConfidencePolicySchema, PostActionObservationSetSchema, PostActionVerificationAbilityInputSchema, PostActionVerificationClockSchema, PostActionVerificationOutputSchema, PostActionRuntimeProofSchema, PostActionChildAssessmentSchema, PostActionVerificationAbilityResultSchema };
