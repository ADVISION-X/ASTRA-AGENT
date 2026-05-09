import { z } from "zod";

import { POST_ACTION_EVIDENCE_KINDS } from "./shared/post-action-evidence.js";
import { POST_ACTION_ACTION_STATUSES, POST_ACTION_VERIFICATION_CLOCK_KIND } from "./shared/post-action-proof.js";
import { POST_ACTION_VERIFICATION_MODES } from "./shared/post-action-policy.js";
import { POST_ACTION_VERIFICATION_STATUSES, POST_ACTION_FAILURE_REASONS } from "./shared/post-action-result.js";
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
const POST_ACTION_MAX_OBSERVATIONS = 50;
const POST_ACTION_MAX_EVIDENCE_REFS = 50;
const POST_ACTION_MAX_SOURCE_PROOF_REFS = 50;
const POST_ACTION_MAX_SUMMARY_LENGTH = 1000;
const POST_ACTION_MAX_SIGNAL_TYPE_LENGTH = 120;
const POST_ACTION_MAX_TARGET_TYPE_LENGTH = 120;
const POST_ACTION_MAX_STATUS_MESSAGE_LENGTH = 1000;
const POST_ACTION_MAX_DATA_QUALITY_FLAGS = 30;

const nonNegativeInt = z.number().int().nonnegative();
const requiredString = z.string().min(1);
const requiredLimitedString = requiredString.max(POST_ACTION_MAX_SUMMARY_LENGTH);
const nullableString = requiredString.nullable().optional().default(null);
const nullableLimitedString = z.string().min(1).max(POST_ACTION_MAX_SUMMARY_LENGTH).nullable().optional().default(null);
const dataQualityFlagsSchema = z.array(z.string().min(1).max(120)).max(POST_ACTION_MAX_DATA_QUALITY_FLAGS).default([]);

const PostActionVerificationChildCapabilityIdSchema = z.enum(POST_ACTION_VERIFICATION_CHILD_CAPABILITY_IDS);
const PostActionVerificationStatusSchema = z.enum(POST_ACTION_VERIFICATION_STATUSES);
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
  loginState: z.enum(["unknown", "ready", "login_required", "review_required", "captcha", "security_review"]).default("unknown"),
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

const PostActionObservationSetSchema = z.object({
  observations: z.array(PostActionObservationSchema).max(POST_ACTION_MAX_OBSERVATIONS).default([]),
}).strict();

const PostActionVerificationAbilityInputSchema = z.object({
  abilityGroupId: z.literal(POST_ACTION_VERIFICATION_ABILITY_GROUP_ID).default(POST_ACTION_VERIFICATION_ABILITY_GROUP_ID),
  childCapabilityId: PostActionVerificationChildCapabilityIdSchema,
  requestedBy: z.literal("orchestration"),
  missionId: requiredString,
  runId: requiredString,
  sessionId: requiredString,
  roundId: nullableString,
  videoVisitId: nullableString,
  stepId: requiredString,
  mapPackageId: requiredString,
  mapPackageVersion: requiredString,
  selectedMapId: requiredString,
  selectedMapVersion: requiredString,
  activationSnapshotRef: requiredString,
  capabilityCallId: requiredString,
  nerveBusEnvelopeId: requiredString,
  sourceAbilityGroupId: PostActionSourceAbilityGroupIdSchema,
  sourceChildCapabilityId: PostActionSourceChildCapabilityIdSchema,
  sourceActionType: z.string().min(1).max(POST_ACTION_MAX_TARGET_TYPE_LENGTH),
  expectedOutcome: PostActionExpectedOutcomeSchema,
  actionProof: PostActionActionProofSchema,
  beforeAfterEvidence: PostActionBeforeAfterEvidenceSchema,
  observationSet: PostActionObservationSetSchema,
  verificationPolicy: PostActionVerificationPolicySchema,
  inputRef: requiredString,
  idempotencyKey: requiredString,
}).strict();

const PostActionVerificationClockSchema = z.object({
  portKind: z.literal(POST_ACTION_VERIFICATION_CLOCK_KIND),
  startedMonotonicMs: z.number().finite(),
  endedMonotonicMs: z.number().finite(),
}).strict();

const PostActionPackageStatusSchema = z.enum(["built", "failed", "review_required"]);

const PostActionVerificationOutputSchema = z.object({
  packageLabel: z.string().min(1).max(POST_ACTION_MAX_SUMMARY_LENGTH),
  observationSummary: z.string().min(1).max(POST_ACTION_MAX_SUMMARY_LENGTH),
  evidenceRefs: z.array(requiredString).max(POST_ACTION_MAX_EVIDENCE_REFS).default([]),
  observationRefs: z.array(requiredString).max(POST_ACTION_MAX_OBSERVATIONS).default([]),
  postActionObservationRef: requiredString,
  actionObservationBundleRef: requiredString,
  observationFingerprint: requiredString,
  supportingSourceProofRefs: z.array(requiredString).max(POST_ACTION_MAX_SOURCE_PROOF_REFS).default([]),
}).strict();

const PostActionRuntimeProofSchema = z.object({
  proofId: requiredString,
  missionId: nullableString,
  runId: requiredString,
  sessionId: nullableString,
  roundId: nullableString,
  videoVisitId: nullableString,
  stepId: nullableString,
  mapPackageId: nullableString,
  mapPackageVersion: nullableString,
  selectedMapId: nullableString,
  selectedMapVersion: nullableString,
  activationSnapshotRef: nullableString,
  capabilityCallId: nullableString,
  nerveBusEnvelopeId: nullableString,
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
  observationFingerprint: nullableString,
  receivedShapeHash: nullableString,
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: nonNegativeInt,
  status: PostActionVerificationStatusSchema,
  failureReason: PostActionFailureReasonSchema.nullable().default(null),
  reviewRequiredReason: nullableLimitedString,
  processingMode: z.enum(["observation_packaging", "invalid_input_failure"]),
  dataQualityFlags: dataQualityFlagsSchema,
  clock: PostActionVerificationClockSchema,
}).strict().superRefine((value, context) => {
  if (value.startedAt > value.endedAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "startedAt must not be after endedAt", path: ["startedAt"] });
  }
  if (value.status === "success") {
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

const PostActionChildObservationSchema = z.object({
  packageLabel: z.string().min(1).max(POST_ACTION_MAX_SUMMARY_LENGTH),
  observationSummary: z.string().min(1).max(POST_ACTION_MAX_SUMMARY_LENGTH),
  failureReason: PostActionFailureReasonSchema.nullable().default(null),
  reviewRequiredReason: nullableLimitedString,
  statusMessage: z.string().min(1).max(POST_ACTION_MAX_STATUS_MESSAGE_LENGTH),
  dataQualityFlags: dataQualityFlagsSchema,
  supportingEvidenceRefs: z.array(requiredString).max(POST_ACTION_MAX_EVIDENCE_REFS).default([]),
  supportingObservationRefs: z.array(requiredString).max(POST_ACTION_MAX_OBSERVATIONS).default([]),
  supportingSourceProofRefs: z.array(requiredString).max(POST_ACTION_MAX_SOURCE_PROOF_REFS).default([]),
}).strict();

const PostActionVerificationAbilityResultBaseSchema = z.object({
  status: PostActionVerificationStatusSchema,
  abilityGroupId: z.literal(POST_ACTION_VERIFICATION_ABILITY_GROUP_ID),
  childCapabilityId: PostActionVerificationChildCapabilityIdSchema.nullable(),
  missionId: nullableString,
  runId: nullableString,
  sessionId: nullableString,
  roundId: nullableString,
  videoVisitId: nullableString,
  stepId: nullableString,
  mapPackageId: nullableString,
  mapPackageVersion: nullableString,
  selectedMapId: nullableString,
  selectedMapVersion: nullableString,
  activationSnapshotRef: nullableString,
  capabilityCallId: nullableString,
  nerveBusEnvelopeId: nullableString,
  postActionVerificationResultRef: nullableString,
  actionProofRef: nullableString,
  sourceActionResultRef: nullableString,
  sourceActionRuntimeProofRef: nullableString,
  sourceActionAbilityGroupId: PostActionSourceAbilityGroupIdSchema.nullable().optional().default(null),
  sourceActionChildCapabilityId: z.string().min(1).max(POST_ACTION_MAX_TARGET_TYPE_LENGTH).nullable().optional().default(null),
  expectedOutcome: PostActionExpectedOutcomeSchema.nullable(),
  beforeEvidenceRefs: z.array(requiredString).max(POST_ACTION_MAX_EVIDENCE_REFS).default([]),
  afterEvidenceRefs: z.array(requiredString).max(POST_ACTION_MAX_EVIDENCE_REFS).default([]),
  observationRefs: z.array(requiredString).max(POST_ACTION_MAX_OBSERVATIONS).default([]),
  supportingSourceProofRefs: z.array(requiredString).max(POST_ACTION_MAX_SOURCE_PROOF_REFS).default([]),
  observationFingerprint: nullableString,
  packageStatus: PostActionPackageStatusSchema,
  output: PostActionVerificationOutputSchema.nullable(),
  failureReason: PostActionFailureReasonSchema.nullable().default(null),
  reviewRequiredReason: nullableLimitedString,
  statusMessage: z.string().min(1).max(POST_ACTION_MAX_STATUS_MESSAGE_LENGTH),
  debugLogRef: requiredString,
  structuredRuntimeEventRef: nullableString,
  diagnosticPayloadRef: nullableString,
  runtimeProof: PostActionRuntimeProofSchema,
  dataQualityFlags: dataQualityFlagsSchema,
}).strict();

type PostActionVerificationAbilityResultValue = z.output<typeof PostActionVerificationAbilityResultBaseSchema>;
const RESULT_RUNTIME_PROOF_CHAIN_FIELDS = [
  "missionId",
  "runId",
  "sessionId",
  "roundId",
  "videoVisitId",
  "stepId",
  "mapPackageId",
  "mapPackageVersion",
  "selectedMapId",
  "selectedMapVersion",
  "activationSnapshotRef",
  "capabilityCallId",
  "nerveBusEnvelopeId",
] as const;

const OPTIONAL_GOVERNED_RESULT_CHAIN_FIELDS = new Set<(typeof RESULT_RUNTIME_PROOF_CHAIN_FIELDS)[number]>([
  "roundId",
  "videoVisitId",
]);

const validateRuntimeProofChain = (
  value: PostActionVerificationAbilityResultValue,
  context: z.RefinementCtx,
): void => {
  for (const field of RESULT_RUNTIME_PROOF_CHAIN_FIELDS) {
    if (value.runtimeProof[field] !== value[field]) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `runtimeProof.${field} must equal result.${field}`, path: ["runtimeProof", field] });
    }
  }
  if (value.runtimeProof.status !== value.status) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "runtimeProof.status must equal result.status", path: ["runtimeProof", "status"] });
  }
  if (value.postActionVerificationResultRef !== value.runtimeProof.outputRef) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "postActionVerificationResultRef must equal runtimeProof.outputRef", path: ["postActionVerificationResultRef"] });
  }
};

const validateSuccessfulPostActionVerificationResultShape = (
  value: PostActionVerificationAbilityResultValue,
  context: z.RefinementCtx,
): void => {
  if (value.output === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "success result requires output", path: ["output"] });
  }
  if (value.diagnosticPayloadRef !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "success result must not expose diagnosticPayloadRef", path: ["diagnosticPayloadRef"] });
  }
  if (value.output !== null && value.output.supportingSourceProofRefs.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "success output requires supportingSourceProofRefs", path: ["output", "supportingSourceProofRefs"] });
  }
  if (value.postActionVerificationResultRef === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "success result requires postActionVerificationResultRef", path: ["postActionVerificationResultRef"] });
  }
  if (value.packageStatus !== "built") {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "success result must keep packageStatus=built", path: ["packageStatus"] });
  }
};

const validateUnsuccessfulPostActionVerificationResultShape = (
  value: PostActionVerificationAbilityResultValue,
  context: z.RefinementCtx,
): void => {
  if (value.output !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "failed/review_required result must not expose output", path: ["output"] });
  }
  if (value.diagnosticPayloadRef === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "failed/review_required result requires diagnosticPayloadRef", path: ["diagnosticPayloadRef"] });
  }
  if (value.status === "failed" && value.failureReason === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "failed result requires failureReason", path: ["failureReason"] });
  }
  if (value.status === "review_required" && value.reviewRequiredReason === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "review_required result requires reviewRequiredReason", path: ["reviewRequiredReason"] });
  }
  if (value.status === "failed" && value.packageStatus !== "failed") {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "failed result must keep packageStatus=failed", path: ["packageStatus"] });
  }
  if (value.status === "review_required" && value.packageStatus !== "review_required") {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "review_required result must keep packageStatus=review_required", path: ["packageStatus"] });
  }
};

const validatePostActionVerificationAbilityResultOutputParity = (
  value: PostActionVerificationAbilityResultValue,
  context: z.RefinementCtx,
): void => {
  if (value.output === null) {
    return;
  }
  if (value.output.observationRefs.length !== value.observationRefs.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "output.observationRefs must equal result.observationRefs", path: ["output", "observationRefs"] });
  }
  if (value.output.supportingSourceProofRefs.length !== value.supportingSourceProofRefs.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "output.supportingSourceProofRefs must equal result.supportingSourceProofRefs", path: ["output", "supportingSourceProofRefs"] });
  }
  if (value.output.observationFingerprint !== value.observationFingerprint) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "output.observationFingerprint must equal result.observationFingerprint", path: ["output", "observationFingerprint"] });
  }
};

const validatePostActionVerificationAbilityResultShape = (
  value: PostActionVerificationAbilityResultValue,
  context: z.RefinementCtx,
): void => {
  if (value.status === "success") {
    validateSuccessfulPostActionVerificationResultShape(value, context);
    return;
  }

  validateUnsuccessfulPostActionVerificationResultShape(value, context);
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
  for (const field of RESULT_RUNTIME_PROOF_CHAIN_FIELDS) {
    if (OPTIONAL_GOVERNED_RESULT_CHAIN_FIELDS.has(field)) {
      continue;
    }
    if (value[field] === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${field} is required for governed results`, path: [field] });
    }
  }
  if (value.expectedOutcome === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "expectedOutcome is required for governed results", path: ["expectedOutcome"] });
  }
  if (value.actionProofRef === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "actionProofRef is required for governed results", path: ["actionProofRef"] });
  }
};

const PostActionVerificationAbilityResultSchema = PostActionVerificationAbilityResultBaseSchema.superRefine((value, context) => {
  validateRuntimeProofChain(value, context);
  validatePostActionVerificationAbilityResultShape(value, context);
  validatePostActionVerificationAbilityResultGovernedFields(value, context);
  validatePostActionVerificationAbilityResultOutputParity(value, context);
});

export { PostActionVerificationChildCapabilityIdSchema, PostActionVerificationStatusSchema, PostActionFailureReasonSchema, PostActionActionStatusSchema, PostActionExpectedOutcomeTypeSchema, PostActionEvidenceKindSchema, PostActionObservationKindSchema, PostActionVerificationModeSchema, PostActionSourceAbilityGroupIdSchema, PostActionSourceChildCapabilityIdSchema, PostActionObservationSourceAbilityGroupIdSchema, PostActionObservationSourceSchema, PostActionExpectedOutcomeSchema, PostActionActionProofSchema, PostActionEvidenceRefSchema, PageStateObservationPayloadSchema, AiObservationPayloadSchema, VisualTargetObservationPayloadSchema, ScreenshotDiffObservationPayloadSchema, VideoIdentityObservationPayloadSchema, ActionCompletionObservationPayloadSchema, RuntimeSignalObservationPayloadSchema, PostActionObservationPayloadSchema, PostActionObservationSchema, PostActionBeforeAfterEvidenceSchema, PostActionVerificationPolicySchema, PostActionObservationSetSchema, PostActionVerificationAbilityInputSchema, PostActionVerificationClockSchema, PostActionPackageStatusSchema, PostActionVerificationOutputSchema, PostActionRuntimeProofSchema, PostActionChildObservationSchema, PostActionVerificationAbilityResultSchema };
