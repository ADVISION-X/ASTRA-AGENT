import { z } from "zod";

import { BrowserLoginStateSchema } from "../../types/local-browser-session.js";
import { validatePageStateAbilityResult, validatePageStateRuntimeProof } from "./page-state-schema-validation.js";

const MAX_OBSERVATIONS = 50;
const MAX_EVIDENCE_REFS = 50;
const MAX_TAGS = 20;
const MAX_DETAIL_LENGTH = 1000;
const MAX_SUMMARY_LENGTH = 1000;
const MAX_SUPPORTING_REASONS = 20;
const MAX_DATA_QUALITY_FLAGS = 20;

const PAGE_STATE_ABILITY_GROUP_ID = "page-state";

const PAGE_STATE_CHILD_CAPABILITY_IDS = [
  "detect-login-state",
  "detect-safety-page",
  "detect-feed-ready",
  "detect-video-stable",
  "detect-comment-panel-state",
  "detect-modal-overlay-state",
  "detect-page-abnormality",
  "detect-platform-page-kind",
] as const;

const PageStateChildCapabilityIdSchema = z.enum(PAGE_STATE_CHILD_CAPABILITY_IDS);
const PageStateStatusSchema = z.enum(["success", "failed", "review_required"]);
const PageStateDecisionSchema = z.enum(["proceed", "block", "review_required", "fail"]);
const PageStateTypeSchema = z.enum([
  "unknown_page",
  "logged_in",
  "login_required",
  "safety_wall",
  "captcha_challenge",
  "feed_ready",
  "feed_not_ready",
  "video_stable",
  "video_unstable",
  "comments_panel_open",
  "comments_panel_closed",
  "modal_overlay_present",
  "modal_overlay_absent",
  "page_abnormal",
  "page_normal",
  "platform_feed",
  "platform_video_page",
  "platform_unknown",
  "wrong_domain",
  "local_workbench",
]);
const PageStateFailureReasonSchema = z.enum([
  "invalid_input",
  "invalid_snapshot",
  "missing_snapshot_proof",
  "missing_open_handoff",
  "missing_observation_support",
  "observation_source_forbidden",
  "observation_source_mismatch",
  "snapshot_stale",
  "observation_stale",
  "platform_mismatch",
  "login_wall_detected",
  "safety_wall_detected",
  "modal_overlay_detected",
  "page_abnormal_detected",
  "insufficient_signal",
  "low_confidence",
  "classification_failed",
  "child_not_registered",
  "execution_failed",
  "payload_budget_exceeded",
  "output_boundary_violation",
]);
const PageStateDataQualityFlagSchema = z.enum([
  "low_confidence",
  "missing_observation",
  "stale_snapshot",
  "stale_observation",
  "source_mismatch",
  "platform_mismatch",
  "insufficient_signal",
  "unsupported_platform",
  "fingerprint_changed",
  "payload_budget_exceeded",
  "output_boundary_violation",
]);
const PageStateSourceAbilityGroupIdSchema = z.enum([
  "open",
  "screenshot",
  "visual-target",
  "post-action-verification",
  "runtime-signal",
]);

const LimitedStringSchema = z.string().min(1).max(MAX_DETAIL_LENGTH);
const OptionalLimitedStringSchema = z.string().min(1).max(MAX_DETAIL_LENGTH).nullable().default(null);

const PageStateViewportSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  deviceScaleFactor: z.number().positive().default(1),
});

const PageStateScrollOffsetSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

const PageStateObservationSourceSchema = z.object({
  sourceAbilityGroupId: PageStateSourceAbilityGroupIdSchema,
  sourceChildCapabilityId: z.string().min(1),
  sourceProofRef: z.string().min(1),
});

const RuntimeSignalObservationPayloadSchema = z.object({
  signalType: z.enum([
    "modal_overlay_present",
    "modal_overlay_absent",
    "comments_panel_open",
    "comments_panel_closed",
    "video_stable",
    "video_unstable",
    "page_abnormal",
    "page_normal",
  ]),
  value: z.boolean(),
  detail: OptionalLimitedStringSchema,
});

const PageMarkerObservationPayloadSchema = z.object({
  marker: z.enum([
    "login_wall",
    "captcha",
    "safety_wall",
    "feed_shell",
    "video_player",
    "comment_panel",
    "modal_overlay",
    "abnormal_page",
  ]),
  present: z.boolean(),
  detail: OptionalLimitedStringSchema,
});

const VisualTargetObservationPayloadSchema = z.object({
  targetType: z.enum(["feed_card", "video_player", "comment_panel", "modal_overlay", "captcha", "login_form"]),
  targetCount: z.number().int().min(0),
  matched: z.boolean(),
  detail: OptionalLimitedStringSchema,
});

const PlatformCaptureObservationPayloadSchema = z.object({
  captureKind: z.enum(["page_snapshot", "viewport_capture", "post_open_capture"]),
  tags: z.array(LimitedStringSchema).max(MAX_TAGS).default([]),
  confidence: z.number().min(0).max(1),
  detail: OptionalLimitedStringSchema,
});

const PostActionVerificationObservationPayloadSchema = z.object({
  verificationKind: z.enum(["open_handoff", "page_transition", "safety_check"]),
  passed: z.boolean(),
  summary: LimitedStringSchema,
});

const PageStateObservationSchema = z.discriminatedUnion("kind", [
  z.object({
    observationId: z.string().min(1),
    kind: z.literal("runtime_signal"),
    capturedAt: z.string().datetime(),
    sourceAbilityGroupId: PageStateSourceAbilityGroupIdSchema,
    sourceChildCapabilityId: z.string().min(1),
    sourceProofRef: z.string().min(1),
    payload: RuntimeSignalObservationPayloadSchema,
  }),
  z.object({
    observationId: z.string().min(1),
    kind: z.literal("page_marker"),
    capturedAt: z.string().datetime(),
    sourceAbilityGroupId: PageStateSourceAbilityGroupIdSchema,
    sourceChildCapabilityId: z.string().min(1),
    sourceProofRef: z.string().min(1),
    payload: PageMarkerObservationPayloadSchema,
  }),
  z.object({
    observationId: z.string().min(1),
    kind: z.literal("visual_target"),
    capturedAt: z.string().datetime(),
    sourceAbilityGroupId: PageStateSourceAbilityGroupIdSchema,
    sourceChildCapabilityId: z.string().min(1),
    sourceProofRef: z.string().min(1),
    payload: VisualTargetObservationPayloadSchema,
  }),
  z.object({
    observationId: z.string().min(1),
    kind: z.literal("platform_capture"),
    capturedAt: z.string().datetime(),
    sourceAbilityGroupId: PageStateSourceAbilityGroupIdSchema,
    sourceChildCapabilityId: z.string().min(1),
    sourceProofRef: z.string().min(1),
    payload: PlatformCaptureObservationPayloadSchema,
  }),
  z.object({
    observationId: z.string().min(1),
    kind: z.literal("post_action_verification"),
    capturedAt: z.string().datetime(),
    sourceAbilityGroupId: PageStateSourceAbilityGroupIdSchema,
    sourceChildCapabilityId: z.string().min(1),
    sourceProofRef: z.string().min(1),
    payload: PostActionVerificationObservationPayloadSchema,
  }),
]);

const PageStateSnapshotSchema = z.object({
  snapshotId: z.string().min(1),
  currentUrl: z.string().url(),
  currentTitle: z.string().max(MAX_SUMMARY_LENGTH),
  browserLoginState: BrowserLoginStateSchema,
  viewport: PageStateViewportSchema,
  scrollOffset: PageStateScrollOffsetSchema,
  capturedAt: z.string().datetime(),
  sourceAbilityGroupId: PageStateSourceAbilityGroupIdSchema,
  sourceChildCapabilityId: z.string().min(1),
  sourceProofRef: z.string().min(1),
});

const PageStateFreshnessPolicySchema = z.object({
  maxSnapshotAgeMs: z.number().int().nonnegative(),
  maxObservationAgeMs: z.number().int().nonnegative(),
  maxObservationSkewMs: z.number().int().nonnegative(),
});

const PageStateConfidencePolicySchema = z.object({
  minimumConfidence: z.number().min(0).max(1),
  allowReviewRequired: z.boolean().default(true),
});

const PageStatePolicySchema = z.object({
  expectedPlatformHost: z.string().min(1).nullable().default(null),
  allowLocalWorkbench: z.boolean().default(false),
  allowModalOverlay: z.boolean().default(false),
  allowUnknownState: z.boolean().default(false),
});

const PageStateOpenHandoffPolicySchema = z.object({
  openProofRef: z.string().min(1),
  browserSessionRef: z.string().min(1),
  platformProfileId: z.string().min(1),
});

const PageStateAbilityInputSchema = z.object({
  childCapabilityId: PageStateChildCapabilityIdSchema,
  runId: z.string().min(1),
  missionId: z.string().min(1),
  sessionId: z.string().min(1),
  roundId: z.string().min(1),
  videoVisitId: z.string().min(1),
  requestedBy: z.string().min(1),
  snapshot: PageStateSnapshotSchema,
  observations: z.array(PageStateObservationSchema).max(MAX_OBSERVATIONS),
  sourceEvidenceRefs: z.array(z.string().min(1)).min(1).max(MAX_EVIDENCE_REFS),
  freshnessPolicy: PageStateFreshnessPolicySchema,
  confidencePolicy: PageStateConfidencePolicySchema,
  statePolicy: PageStatePolicySchema,
  openHandoff: PageStateOpenHandoffPolicySchema,
  previousPageStateFingerprint: z.string().min(1).nullable().default(null),
});

const PageStateOutputSchema = z.object({
  pageStateType: PageStateTypeSchema,
  stateSummary: z.string().min(1).max(MAX_SUMMARY_LENGTH),
  confidence: z.number().min(0).max(1),
  evidenceRefs: z.array(z.string().min(1)).max(MAX_EVIDENCE_REFS),
  observationRefs: z.array(z.string().min(1)).max(MAX_OBSERVATIONS),
  pageStateFingerprint: z.string().min(1),
});

const PageStateRuntimeProofSchema = z.object({
  proofId: z.string().min(1),
  runId: z.string().min(1).nullable(),
  missionId: z.string().min(1).nullable(),
  sessionId: z.string().min(1).nullable(),
  roundId: z.string().min(1).nullable(),
  videoVisitId: z.string().min(1).nullable(),
  abilityGroupId: z.literal(PAGE_STATE_ABILITY_GROUP_ID),
  childCapabilityId: PageStateChildCapabilityIdSchema.nullable(),
  inputRef: z.string().min(1),
  outputRef: z.string().min(1).nullable(),
  diagnosticPayloadRef: z.string().min(1).nullable(),
  debugLogRef: z.string().min(1),
  structuredRuntimeEventRef: z.string().min(1).nullable(),
  snapshotId: z.string().min(1).nullable(),
  snapshotProofRef: z.string().min(1).nullable(),
  openHandoffProofRef: z.string().min(1).nullable(),
  browserSessionRef: z.string().min(1).nullable(),
  platformProfileId: z.string().min(1).nullable(),
  resolvedPlatformProfileId: z.string().min(1).nullable(),
  matchedHost: z.string().min(1).nullable(),
  sourceAbilityGroupId: PageStateSourceAbilityGroupIdSchema.nullable(),
  sourceChildCapabilityId: z.string().min(1).nullable(),
  observationRefs: z.array(z.string().min(1)).max(MAX_OBSERVATIONS),
  sourceEvidenceRefs: z.array(z.string().min(1)).max(MAX_EVIDENCE_REFS),
  inputPayloadHash: z.string().min(1),
  snapshotHash: z.string().min(1).nullable(),
  observationHash: z.string().min(1).nullable(),
  pageStateFingerprint: z.string().min(1).nullable(),
  previousPageStateFingerprint: z.string().min(1).nullable(),
  currentUrl: z.string().url().nullable(),
  currentTitle: z.string().max(MAX_SUMMARY_LENGTH).nullable(),
  classificationSource: z.enum(["child_capability", "invalid_input_failure"]),
  inputDecision: z.enum(["allow", "fail"]),
  sourceBindingDecision: z.enum(["allow", "review_required", "fail"]),
  observationBindingDecision: z.enum(["bound", "review_required", "fail"]),
  freshnessDecision: z.enum(["fresh", "review_required", "fail"]),
  platformDecision: z.enum(["match", "review_required", "block", "fail"]),
  classificationDecision: z.enum(["proceed", "review_required", "block", "fail"]),
  outputBoundaryDecision: z.enum(["allow", "review_required", "fail"]),
  criticalDataQualityDecision: z.enum(["allow", "review_required", "fail"]),
  proceedDecision: PageStateDecisionSchema,
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative(),
  status: PageStateStatusSchema,
  decision: PageStateDecisionSchema,
  failureReason: PageStateFailureReasonSchema.nullable(),
  reviewRequiredReason: z.string().min(1).max(MAX_SUMMARY_LENGTH).nullable(),
  dataQualityFlags: z.array(PageStateDataQualityFlagSchema).max(MAX_DATA_QUALITY_FLAGS),
  receivedShapeHash: z.string().min(1).nullable().default(null),
}).superRefine(validatePageStateRuntimeProof);

const PageStateAbilityResultSchema = z.object({
  status: PageStateStatusSchema,
  decision: PageStateDecisionSchema,
  abilityGroupId: z.literal(PAGE_STATE_ABILITY_GROUP_ID),
  childCapabilityId: PageStateChildCapabilityIdSchema.nullable(),
  runId: z.string().min(1).nullable(),
  missionId: z.string().min(1).nullable(),
  sessionId: z.string().min(1).nullable(),
  roundId: z.string().min(1).nullable(),
  videoVisitId: z.string().min(1).nullable(),
  output: PageStateOutputSchema.nullable(),
  pageStateType: PageStateTypeSchema.nullable(),
  stateSummary: z.string().min(1).max(MAX_SUMMARY_LENGTH).nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  evidenceRefs: z.array(z.string().min(1)).max(MAX_EVIDENCE_REFS),
  observationRefs: z.array(z.string().min(1)).max(MAX_OBSERVATIONS),
  sourceEvidenceRefs: z.array(z.string().min(1)).max(MAX_EVIDENCE_REFS),
  pageStateFingerprint: z.string().min(1).nullable(),
  previousPageStateFingerprint: z.string().min(1).nullable(),
  failureReason: PageStateFailureReasonSchema.nullable(),
  reviewRequiredReason: z.string().min(1).max(MAX_SUMMARY_LENGTH).nullable(),
  dataQualityFlags: z.array(PageStateDataQualityFlagSchema).max(MAX_DATA_QUALITY_FLAGS),
  debugLogRef: z.string().min(1),
  structuredRuntimeEventRef: z.string().min(1).nullable(),
  diagnosticPayloadRef: z.string().min(1).nullable(),
  receivedShapeHash: z.string().min(1).nullable().default(null),
  runtimeProof: PageStateRuntimeProofSchema,
}).superRefine(validatePageStateAbilityResult);

const PageStateChildDetectionSchema = z.object({
  childCapabilityId: PageStateChildCapabilityIdSchema,
  pageStateType: PageStateTypeSchema,
  stateSummary: z.string().min(1).max(MAX_SUMMARY_LENGTH),
  confidence: z.number().min(0).max(1),
  reviewRequiredReason: z.string().min(1).max(MAX_SUMMARY_LENGTH).nullable().default(null),
  dataQualityFlags: z.array(PageStateDataQualityFlagSchema).max(MAX_DATA_QUALITY_FLAGS).default([]),
  matchedObservationIds: z.array(z.string().min(1)).max(MAX_OBSERVATIONS).default([]),
  supportingEvidenceRefs: z.array(z.string().min(1)).max(MAX_EVIDENCE_REFS).default([]),
  supportingReasons: z.array(z.string().min(1).max(MAX_DETAIL_LENGTH)).max(MAX_SUPPORTING_REASONS).default([]),
});

function createPageStateChildInputSchema<TChildId extends PageStateChildCapabilityId>(childCapabilityId: TChildId) {
  return PageStateAbilityInputSchema.extend({
    childCapabilityId: z.literal(childCapabilityId),
  });
}

function createPageStateChildOutputSchema<TChildId extends PageStateChildCapabilityId>(childCapabilityId: TChildId) {
  return PageStateChildDetectionSchema.extend({
    childCapabilityId: z.literal(childCapabilityId),
  });
}

type PageStateChildCapabilityId = z.infer<typeof PageStateChildCapabilityIdSchema>;
type PageStateStatus = z.infer<typeof PageStateStatusSchema>;
type PageStateDecision = z.infer<typeof PageStateDecisionSchema>;
type PageStateType = z.infer<typeof PageStateTypeSchema>;
type PageStateFailureReason = z.infer<typeof PageStateFailureReasonSchema>;
type PageStateDataQualityFlag = z.infer<typeof PageStateDataQualityFlagSchema>;
type PageStateSourceAbilityGroupId = z.infer<typeof PageStateSourceAbilityGroupIdSchema>;
type PageStateViewport = z.infer<typeof PageStateViewportSchema>;
type PageStateScrollOffset = z.infer<typeof PageStateScrollOffsetSchema>;
type PageStateObservationSource = z.infer<typeof PageStateObservationSourceSchema>;
type PageStateObservation = z.infer<typeof PageStateObservationSchema>;
type PageStateSnapshot = z.infer<typeof PageStateSnapshotSchema>;
type PageStateFreshnessPolicy = z.infer<typeof PageStateFreshnessPolicySchema>;
type PageStateConfidencePolicy = z.infer<typeof PageStateConfidencePolicySchema>;
type PageStatePolicy = z.infer<typeof PageStatePolicySchema>;
type PageStateOpenHandoffPolicy = z.infer<typeof PageStateOpenHandoffPolicySchema>;
type PageStateAbilityInput = z.infer<typeof PageStateAbilityInputSchema>;
type PageStateOutput = z.infer<typeof PageStateOutputSchema>;
type PageStateRuntimeProof = z.infer<typeof PageStateRuntimeProofSchema>;
type PageStateAbilityResult = z.infer<typeof PageStateAbilityResultSchema>;
type PageStateChildDetection = z.infer<typeof PageStateChildDetectionSchema>;

export { PAGE_STATE_ABILITY_GROUP_ID, PAGE_STATE_CHILD_CAPABILITY_IDS, PageStateChildCapabilityIdSchema, PageStateStatusSchema, PageStateDecisionSchema, PageStateTypeSchema, PageStateFailureReasonSchema, PageStateDataQualityFlagSchema, PageStateSourceAbilityGroupIdSchema, PageStateViewportSchema, PageStateScrollOffsetSchema, PageStateObservationSourceSchema, PageStateObservationSchema, PageStateSnapshotSchema, PageStateFreshnessPolicySchema, PageStateConfidencePolicySchema, PageStatePolicySchema, PageStateOpenHandoffPolicySchema, PageStateAbilityInputSchema, PageStateOutputSchema, PageStateRuntimeProofSchema, PageStateAbilityResultSchema, PageStateChildDetectionSchema, createPageStateChildInputSchema, createPageStateChildOutputSchema };
export type { PageStateChildCapabilityId, PageStateStatus, PageStateDecision, PageStateType, PageStateFailureReason, PageStateDataQualityFlag, PageStateSourceAbilityGroupId, PageStateViewport, PageStateScrollOffset, PageStateObservationSource, PageStateObservation, PageStateSnapshot, PageStateFreshnessPolicy, PageStateConfidencePolicy, PageStatePolicy, PageStateOpenHandoffPolicy, PageStateAbilityInput, PageStateOutput, PageStateRuntimeProof, PageStateAbilityResult, PageStateChildDetection };
