import { z } from "zod";

import { POST_ACTION_ACTION_STATUSES, POST_ACTION_VERIFICATION_CLOCK_KIND } from "./shared/post-action-proof.js";
import { POST_ACTION_VERIFICATION_MODES } from "./shared/post-action-policy.js";
import { POST_ACTION_VERIFICATION_STATUSES, POST_ACTION_FAILURE_REASONS } from "./shared/post-action-result.js";
import {
  POST_ACTION_EXPECTED_OUTCOME_TYPES,
  POST_ACTION_SOURCE_ABILITY_GROUP_IDS,
  POST_ACTION_SOURCE_CHILD_CAPABILITY_IDS,
  POST_ACTION_VERIFICATION_ABILITY_GROUP_ID,
  POST_ACTION_VERIFICATION_CHILD_CAPABILITY_IDS,
} from "./shared/post-action-types.js";
import { validatePostActionVerificationAbilityResult } from "./post-action-result-schema-refinements.js";
import {
  POST_ACTION_MAX_EVIDENCE_REFS,
  POST_ACTION_MAX_OBSERVATIONS,
  POST_ACTION_MAX_SOURCE_PROOF_REFS,
  POST_ACTION_MAX_STATUS_MESSAGE_LENGTH,
  POST_ACTION_MAX_SUMMARY_LENGTH,
  POST_ACTION_MAX_TARGET_TYPE_LENGTH,
  ActionCompletionObservationPayloadSchema,
  AiObservationPayloadSchema,
  PageStateObservationPayloadSchema,
  PostActionEvidenceKindSchema,
  PostActionEvidenceRefSchema,
  PostActionObservationKindSchema,
  PostActionObservationSourceAbilityGroupIdSchema,
  PostActionObservationSourceSchema,
  RuntimeSignalObservationPayloadSchema,
  ScreenshotDiffObservationPayloadSchema,
  VideoIdentityObservationPayloadSchema,
  VisualTargetObservationPayloadSchema,
  dataQualityFlagsSchema,
  nonNegativeInt,
  nullableLimitedString,
  nullableString,
  requiredString,
} from "./post-action-schema-primitives.js";

const PostActionVerificationChildCapabilityIdSchema = z.enum(POST_ACTION_VERIFICATION_CHILD_CAPABILITY_IDS);
const PostActionVerificationStatusSchema = z.enum(POST_ACTION_VERIFICATION_STATUSES);
const PostActionFailureReasonSchema = z.enum(POST_ACTION_FAILURE_REASONS);
const PostActionActionStatusSchema = z.enum(POST_ACTION_ACTION_STATUSES);
const PostActionExpectedOutcomeTypeSchema = z.enum(POST_ACTION_EXPECTED_OUTCOME_TYPES);
const PostActionVerificationModeSchema = z.enum(POST_ACTION_VERIFICATION_MODES);
const PostActionSourceAbilityGroupIdSchema = z.enum(POST_ACTION_SOURCE_ABILITY_GROUP_IDS);
const PostActionSourceChildCapabilityIdSchema = z.enum(POST_ACTION_SOURCE_CHILD_CAPABILITY_IDS);

const PostActionExpectedOutcomeSchema = z.object({
  outcomeType: PostActionExpectedOutcomeTypeSchema,
  description: z.string().min(1).max(POST_ACTION_MAX_SUMMARY_LENGTH),
  expectedUrlHost: nullableString,
  expectedUrlPrefix: nullableString,
  expectedState: nullableString,
  expectedTargetType: nullableString,
  requiresBeforeAfterComparison: z.boolean().default(false),
  requiresVisualEvidence: z.boolean().default(false),
}).strict();

const PostActionActionProofSchema = z.object({
  actionProofRef: requiredString,
  actionLogRef: requiredString,
  actionRecordRef: nullableString,
  sourceRuntimeProofRef: nullableString,
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
  bindingPackageId: requiredString,
  bindingPackageVersion: requiredString,
  selectedBindingId: requiredString,
  bindingVersion: requiredString,
  bindingSnapshotRef: requiredString,
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
  bindingPackageId: nullableString,
  bindingPackageVersion: nullableString,
  selectedBindingId: nullableString,
  bindingVersion: nullableString,
  bindingSnapshotRef: nullableString,
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
  bindingPackageId: nullableString,
  bindingPackageVersion: nullableString,
  selectedBindingId: nullableString,
  bindingVersion: nullableString,
  bindingSnapshotRef: nullableString,
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

const PostActionVerificationAbilityResultSchema = PostActionVerificationAbilityResultBaseSchema.superRefine((value, context) => {
  validatePostActionVerificationAbilityResult(value, context);
});

export { PostActionVerificationChildCapabilityIdSchema, PostActionVerificationStatusSchema, PostActionFailureReasonSchema, PostActionActionStatusSchema, PostActionExpectedOutcomeTypeSchema, PostActionEvidenceKindSchema, PostActionObservationKindSchema, PostActionVerificationModeSchema, PostActionSourceAbilityGroupIdSchema, PostActionSourceChildCapabilityIdSchema, PostActionObservationSourceAbilityGroupIdSchema, PostActionObservationSourceSchema, PostActionExpectedOutcomeSchema, PostActionActionProofSchema, PostActionEvidenceRefSchema, PageStateObservationPayloadSchema, AiObservationPayloadSchema, VisualTargetObservationPayloadSchema, ScreenshotDiffObservationPayloadSchema, VideoIdentityObservationPayloadSchema, ActionCompletionObservationPayloadSchema, RuntimeSignalObservationPayloadSchema, PostActionObservationPayloadSchema, PostActionObservationSchema, PostActionBeforeAfterEvidenceSchema, PostActionVerificationPolicySchema, PostActionObservationSetSchema, PostActionVerificationAbilityInputSchema, PostActionVerificationClockSchema, PostActionPackageStatusSchema, PostActionVerificationOutputSchema, PostActionRuntimeProofSchema, PostActionChildObservationSchema, PostActionVerificationAbilityResultSchema };
