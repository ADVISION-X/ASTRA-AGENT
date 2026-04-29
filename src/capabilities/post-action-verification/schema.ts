import { z } from "zod";

import { POST_ACTION_EVIDENCE_KINDS } from "./shared/post-action-evidence.js";
import { POST_ACTION_FAILURE_REASONS } from "./shared/post-action-failure.js";
import { POST_ACTION_VERIFICATION_MODES } from "./shared/post-action-policy.js";
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
const nullableString = z.string().min(1).nullable().optional().default(null);
const requiredString = z.string().min(1);

export const PostActionVerificationChildCapabilityIdSchema = z.enum(POST_ACTION_VERIFICATION_CHILD_CAPABILITY_IDS);
export const PostActionVerificationStatusSchema = z.enum(POST_ACTION_VERIFICATION_STATUSES);
export const PostActionVerificationDecisionSchema = z.enum(POST_ACTION_VERIFICATION_DECISIONS);
export const PostActionFailureReasonSchema = z.enum(POST_ACTION_FAILURE_REASONS);
export const PostActionActionStatusSchema = z.enum(POST_ACTION_ACTION_STATUSES);
export const PostActionExpectedOutcomeTypeSchema = z.enum(POST_ACTION_EXPECTED_OUTCOME_TYPES);
export const PostActionEvidenceKindSchema = z.enum(POST_ACTION_EVIDENCE_KINDS);
export const PostActionObservationKindSchema = z.enum(POST_ACTION_OBSERVATION_KINDS);
export const PostActionVerificationModeSchema = z.enum(POST_ACTION_VERIFICATION_MODES);
export const PostActionSourceAbilityGroupIdSchema = z.enum(POST_ACTION_SOURCE_ABILITY_GROUP_IDS);
export const PostActionSourceChildCapabilityIdSchema = z.enum(POST_ACTION_SOURCE_CHILD_CAPABILITY_IDS);
export const PostActionObservationSourceAbilityGroupIdSchema = z.enum(POST_ACTION_OBSERVATION_SOURCE_ABILITY_GROUP_IDS);

export const PostActionObservationSourceSchema = z.object({
  sourceAbilityGroupId: PostActionObservationSourceAbilityGroupIdSchema,
  sourceChildCapabilityId: requiredString,
  sourceProofRef: requiredString,
}).strict();

export const PostActionExpectedOutcomeSchema = z.object({
  outcomeType: PostActionExpectedOutcomeTypeSchema,
  description: requiredString,
  expectedUrlHost: nullableString,
  expectedUrlPrefix: nullableString,
  expectedState: nullableString,
  expectedTargetType: nullableString,
  requiresBeforeAfterComparison: z.boolean().default(false),
  requiresVisualEvidence: z.boolean().default(false),
}).strict();

export const PostActionActionProofSchema = z.object({
  actionProofRef: requiredString,
  sourceAbilityGroupId: PostActionSourceAbilityGroupIdSchema,
  sourceChildCapabilityId: PostActionSourceChildCapabilityIdSchema,
  actionType: requiredString,
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
});

export const PostActionEvidenceRefSchema = z.object({
  evidenceRef: requiredString,
  evidenceKind: PostActionEvidenceKindSchema,
  source: PostActionObservationSourceSchema,
  capturedAt: z.string().datetime(),
  sessionId: requiredString,
  roundId: nullableString,
  videoVisitId: nullableString,
}).strict();

export const PageStateObservationPayloadSchema = z.object({
  kind: z.literal("page_state"),
  currentUrl: nullableString,
  loginState: z.enum(["unknown", "ready", "login_required", "review_required", "captcha", "security_wall"]).default("unknown"),
  commentsPanelOpen: z.boolean().nullable().default(null),
  modalOverlayPresent: z.boolean().nullable().default(null),
  recommendationChanged: z.boolean().nullable().default(null),
  changeSummary: nullableString,
  targetStateChanged: z.boolean().nullable().default(null),
  targetType: nullableString,
  wrongDomain: z.boolean().nullable().default(null),
}).strict();

export const AiObservationPayloadSchema = z.object({
  kind: z.literal("ai_observation"),
  commentsPanelOpen: z.boolean().nullable().default(null),
  recommendationChanged: z.boolean().nullable().default(null),
  targetStateChanged: z.boolean().nullable().default(null),
  summary: nullableString,
  confidence: z.number().min(0).max(1).nullable().default(null),
}).strict();

export const VisualTargetObservationPayloadSchema = z.object({
  kind: z.literal("visual_target"),
  targetType: nullableString,
  targetId: nullableString,
  targetStateChanged: z.boolean().nullable().default(null),
  commentsPanelOpen: z.boolean().nullable().default(null),
  visible: z.boolean().nullable().default(null),
  confidence: z.number().min(0).max(1).nullable().default(null),
}).strict();

export const ScreenshotDiffObservationPayloadSchema = z.object({
  kind: z.literal("screenshot_diff"),
  changed: z.boolean(),
  targetStateChanged: z.boolean().nullable().default(null),
  beforeFingerprint: nullableString,
  afterFingerprint: nullableString,
}).strict();

export const VideoIdentityObservationPayloadSchema = z.object({
  kind: z.literal("video_identity"),
  role: z.enum(["before", "after"]),
  videoId: nullableString,
  visualSignature: nullableString,
  confirmed: z.boolean().nullable().default(null),
}).strict();

export const ActionCompletionObservationPayloadSchema = z.object({
  kind: z.literal("action_completion"),
  ok: z.boolean(),
  fallbackUsed: z.boolean().nullable().default(null),
  targetType: nullableString,
}).strict();

export const RuntimeSignalObservationPayloadSchema = z.object({
  kind: z.literal("runtime_signal"),
  signalType: requiredString,
  recommendationChanged: z.boolean().nullable().default(null),
  targetStateChanged: z.boolean().nullable().default(null),
  afterConfirmed: z.boolean().nullable().default(null),
  summary: nullableString,
}).strict();

export const PostActionObservationPayloadSchema = z.discriminatedUnion("kind", [
  PageStateObservationPayloadSchema,
  AiObservationPayloadSchema,
  VisualTargetObservationPayloadSchema,
  ScreenshotDiffObservationPayloadSchema,
  VideoIdentityObservationPayloadSchema,
  ActionCompletionObservationPayloadSchema,
  RuntimeSignalObservationPayloadSchema,
]);

export const PostActionObservationSchema = z.object({
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

export const PostActionBeforeAfterEvidenceSchema = z.object({
  beforeEvidence: PostActionEvidenceRefSchema.nullable().default(null),
  afterEvidence: PostActionEvidenceRefSchema.nullable().default(null),
}).strict();

export const PostActionVerificationPolicySchema = z.object({
  verificationMode: PostActionVerificationModeSchema,
  requireAfterEvidence: z.boolean().default(false),
  requireBeforeAfterComparison: z.boolean().default(false),
  allowSelfReportedSuccess: z.boolean().default(false),
}).strict();

export const PostActionConfidencePolicySchema = z.object({
  minimumConfidence: z.number().gt(0).lte(1),
  allowReviewRequired: z.boolean().default(true),
}).strict();

export const PostActionObservationSetSchema = z.object({
  observations: z.array(PostActionObservationSchema).default([]),
}).strict();

export const PostActionVerificationAbilityInputSchema = z.object({
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

export const PostActionVerificationClockSchema = z.object({
  portKind: z.literal(POST_ACTION_VERIFICATION_CLOCK_KIND),
  startedMonotonicMs: z.number().finite(),
  endedMonotonicMs: z.number().finite(),
}).strict();

export const PostActionRuntimeProofSchema = z.object({
  proofId: requiredString,
  runId: requiredString,
  missionId: requiredString,
  sessionId: requiredString,
  roundId: nullableString,
  videoVisitId: nullableString,
  abilityGroupId: z.literal(POST_ACTION_VERIFICATION_ABILITY_GROUP_ID),
  childCapabilityId: PostActionVerificationChildCapabilityIdSchema,
  actionProofRef: requiredString,
  sourceActionAbilityGroupId: PostActionSourceAbilityGroupIdSchema,
  sourceActionChildCapabilityId: PostActionSourceChildCapabilityIdSchema,
  actionType: requiredString,
  actionStatus: PostActionActionStatusSchema,
  expectedOutcomeType: PostActionExpectedOutcomeTypeSchema,
  beforeEvidenceRefs: z.array(requiredString).default([]),
  afterEvidenceRefs: z.array(requiredString).default([]),
  observationRefs: z.array(requiredString).default([]),
  evidenceSourceRefs: z.array(requiredString).default([]),
  inputRef: requiredString,
  outputRef: requiredString,
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: nonNegativeInt,
  status: PostActionVerificationStatusSchema,
  verificationDecision: PostActionVerificationDecisionSchema,
  confidence: z.number().min(0).max(1),
  failureReason: PostActionFailureReasonSchema.nullable().default(null),
  reviewRequiredReason: nullableString,
  inputDecision: requiredString,
  actionProofDecision: requiredString,
  evidenceSourceDecision: requiredString,
  beforeAfterDecision: requiredString,
  policyDecision: requiredString,
  verificationDecisionTrace: requiredString,
  dataQualityFlags: z.array(requiredString).default([]),
  clock: PostActionVerificationClockSchema,
}).strict().superRefine((value, context) => {
  if (value.startedAt > value.endedAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "startedAt must not be after endedAt", path: ["startedAt"] });
  }
  if (value.status === "success" && value.verificationDecision !== "verified") {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "success status requires verified decision", path: ["verificationDecision"] });
  }
  if (value.reviewRequiredReason !== null && value.status === "success") {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "reviewRequiredReason cannot exist on success", path: ["reviewRequiredReason"] });
  }
});

export const PostActionChildAssessmentSchema = z.object({
  observedOutcome: requiredString,
  verificationDecision: PostActionVerificationDecisionSchema,
  confidence: z.number().min(0).max(1),
  failureReason: PostActionFailureReasonSchema.nullable().default(null),
  reviewRequiredReason: nullableString,
  statusMessage: requiredString,
  dataQualityFlags: z.array(requiredString).default([]),
}).strict();

export const PostActionVerificationAbilityResultSchema = z.object({
  status: PostActionVerificationStatusSchema,
  abilityGroupId: z.literal(POST_ACTION_VERIFICATION_ABILITY_GROUP_ID),
  childCapabilityId: PostActionVerificationChildCapabilityIdSchema,
  sessionId: requiredString,
  roundId: nullableString,
  videoVisitId: nullableString,
  actionProofRef: requiredString,
  expectedOutcome: PostActionExpectedOutcomeSchema,
  observedOutcome: requiredString,
  verificationDecision: PostActionVerificationDecisionSchema,
  confidence: z.number().min(0).max(1),
  evidenceRefs: z.array(requiredString).default([]),
  observationRefs: z.array(requiredString).default([]),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: nonNegativeInt,
  failureReason: PostActionFailureReasonSchema.nullable().default(null),
  reviewRequiredReason: nullableString,
  statusMessage: requiredString,
  debugLogRef: requiredString,
  runtimeProof: PostActionRuntimeProofSchema,
  dataQualityFlags: z.array(requiredString).default([]),
}).strict().superRefine((value, context) => {
  if (value.startedAt > value.endedAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "startedAt must not be after endedAt", path: ["startedAt"] });
  }
  if (value.status === "success" && value.verificationDecision !== "verified") {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "success status requires verified decision", path: ["verificationDecision"] });
  }
  if (value.reviewRequiredReason !== null && value.status === "success") {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "reviewRequiredReason cannot exist on success", path: ["reviewRequiredReason"] });
  }
  if (value.runtimeProof.status !== value.status) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "runtimeProof.status must equal result.status", path: ["runtimeProof", "status"] });
  }
  if (value.runtimeProof.verificationDecision !== value.verificationDecision) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "runtimeProof.verificationDecision must equal result.verificationDecision", path: ["runtimeProof", "verificationDecision"] });
  }
});
