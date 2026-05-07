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
  "observe-login-surface",
  "observe-safety-surface",
  "observe-feed-surface",
  "observe-video-surface",
  "observe-comment-panel-surface",
  "observe-modal-overlay-surface",
  "observe-page-abnormality-surface",
  "observe-platform-surface",
] as const;

const PageStateChildCapabilityIdSchema = z.enum(PAGE_STATE_CHILD_CAPABILITY_IDS);
const PageStateRequestedBySchema = z.enum(["orchestration", "post-action-verification", "commander-read-model"]);
const PageStateStatusSchema = z.enum(["success", "failed", "review_required"]);
const PageStateFailureReasonSchema = z.enum([
  "invalid_input",
  "missing_observation_support",
  "missing_source_evidence",
  "insufficient_signal",
  "child_not_registered",
  "execution_failed",
  "output_boundary_violation",
]);
const PageStateDataQualityFlagSchema = z.enum([
  "missing_observation",
  "stale_snapshot",
  "stale_observation",
  "source_mismatch",
  "insufficient_signal",
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
    "login_surface",
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
  abilityGroupId: z.literal(PAGE_STATE_ABILITY_GROUP_ID),
  childCapabilityId: PageStateChildCapabilityIdSchema,
  requestedBy: PageStateRequestedBySchema,
  runId: z.string().min(1),
  missionId: z.string().min(1),
  sessionId: z.string().min(1),
  roundId: z.string().min(1).nullable().default(null),
  videoVisitId: z.string().min(1).nullable().default(null),
  stepId: z.string().min(1),
  mapPackageId: z.string().min(1),
  mapPackageVersion: z.string().min(1),
  selectedMapId: z.string().min(1),
  selectedMapVersion: z.string().min(1),
  activationSnapshotRef: z.string().min(1),
  capabilityCallId: z.string().min(1),
  nerveBusEnvelopeId: z.string().min(1),
  snapshot: PageStateSnapshotSchema,
  observations: z.array(PageStateObservationSchema).max(MAX_OBSERVATIONS),
  sourceEvidenceRefs: z.array(z.string().min(1)).min(1).max(MAX_EVIDENCE_REFS),
  statePolicy: PageStatePolicySchema,
  openHandoff: PageStateOpenHandoffPolicySchema,
  previousPageStateFingerprint: z.string().min(1).nullable().default(null),
  inputRef: z.string().min(1),
  idempotencyKey: z.string().min(1),
}).strict();

const PageStateOutputSchema = z.object({
  packageLabel: z.string().min(1).max(MAX_SUMMARY_LENGTH),
  observationSummary: z.string().min(1).max(MAX_SUMMARY_LENGTH),
  evidenceRefs: z.array(z.string().min(1)).max(MAX_EVIDENCE_REFS),
  observationRefs: z.array(z.string().min(1)).max(MAX_OBSERVATIONS),
  observationFingerprint: z.string().min(1),
}).strict();

const PageStateRuntimeProofSchema = z.object({
  proofId: z.string().min(1),
  runId: z.string().min(1).nullable(),
  missionId: z.string().min(1).nullable(),
  sessionId: z.string().min(1).nullable(),
  roundId: z.string().min(1).nullable(),
  videoVisitId: z.string().min(1).nullable(),
  stepId: z.string().min(1).nullable(),
  mapPackageId: z.string().min(1).nullable(),
  mapPackageVersion: z.string().min(1).nullable(),
  selectedMapId: z.string().min(1).nullable(),
  selectedMapVersion: z.string().min(1).nullable(),
  activationSnapshotRef: z.string().min(1).nullable(),
  capabilityCallId: z.string().min(1).nullable(),
  nerveBusEnvelopeId: z.string().min(1).nullable(),
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
  sourceAbilityGroupId: PageStateSourceAbilityGroupIdSchema.nullable(),
  sourceChildCapabilityId: z.string().min(1).nullable(),
  observationRefs: z.array(z.string().min(1)).max(MAX_OBSERVATIONS),
  sourceEvidenceRefs: z.array(z.string().min(1)).max(MAX_EVIDENCE_REFS),
  inputPayloadHash: z.string().min(1),
  snapshotHash: z.string().min(1).nullable(),
  observationHash: z.string().min(1).nullable(),
  observationFingerprint: z.string().min(1).nullable(),
  currentUrl: z.string().url().nullable(),
  currentTitle: z.string().max(MAX_SUMMARY_LENGTH).nullable(),
  processingMode: z.enum(["observation_packaging", "invalid_input_failure"]),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative(),
  status: PageStateStatusSchema,
  failureReason: PageStateFailureReasonSchema.nullable(),
  reviewRequiredReason: z.string().min(1).max(MAX_SUMMARY_LENGTH).nullable(),
  dataQualityFlags: z.array(PageStateDataQualityFlagSchema).max(MAX_DATA_QUALITY_FLAGS),
  receivedShapeHash: z.string().min(1).nullable().default(null),
}).strict().superRefine(validatePageStateRuntimeProof);

const PageStateAbilityResultSchema = z.object({
  status: PageStateStatusSchema,
  abilityGroupId: z.literal(PAGE_STATE_ABILITY_GROUP_ID),
  childCapabilityId: PageStateChildCapabilityIdSchema.nullable(),
  runId: z.string().min(1).nullable(),
  missionId: z.string().min(1).nullable(),
  sessionId: z.string().min(1).nullable(),
  roundId: z.string().min(1).nullable(),
  videoVisitId: z.string().min(1).nullable(),
  stepId: z.string().min(1).nullable(),
  mapPackageId: z.string().min(1).nullable(),
  mapPackageVersion: z.string().min(1).nullable(),
  selectedMapId: z.string().min(1).nullable(),
  selectedMapVersion: z.string().min(1).nullable(),
  activationSnapshotRef: z.string().min(1).nullable(),
  capabilityCallId: z.string().min(1).nullable(),
  nerveBusEnvelopeId: z.string().min(1).nullable(),
  output: PageStateOutputSchema.nullable(),
  observationSummary: z.string().min(1).max(MAX_SUMMARY_LENGTH).nullable(),
  evidenceRefs: z.array(z.string().min(1)).max(MAX_EVIDENCE_REFS),
  observationRefs: z.array(z.string().min(1)).max(MAX_OBSERVATIONS),
  sourceEvidenceRefs: z.array(z.string().min(1)).max(MAX_EVIDENCE_REFS),
  observationFingerprint: z.string().min(1).nullable(),
  failureReason: PageStateFailureReasonSchema.nullable(),
  reviewRequiredReason: z.string().min(1).max(MAX_SUMMARY_LENGTH).nullable(),
  dataQualityFlags: z.array(PageStateDataQualityFlagSchema).max(MAX_DATA_QUALITY_FLAGS),
  debugLogRef: z.string().min(1),
  structuredRuntimeEventRef: z.string().min(1).nullable(),
  diagnosticPayloadRef: z.string().min(1).nullable(),
  receivedShapeHash: z.string().min(1).nullable().default(null),
  runtimeProof: PageStateRuntimeProofSchema,
}).strict().superRefine(validatePageStateAbilityResult);

const PageStateChildObservationSchema = z.object({
  childCapabilityId: PageStateChildCapabilityIdSchema,
  packageLabel: z.string().min(1).max(MAX_SUMMARY_LENGTH),
  observationSummary: z.string().min(1).max(MAX_SUMMARY_LENGTH),
  reviewRequiredReason: z.string().min(1).max(MAX_SUMMARY_LENGTH).nullable().default(null),
  dataQualityFlags: z.array(PageStateDataQualityFlagSchema).max(MAX_DATA_QUALITY_FLAGS).default([]),
  matchedObservationIds: z.array(z.string().min(1)).max(MAX_OBSERVATIONS).default([]),
  supportingEvidenceRefs: z.array(z.string().min(1)).max(MAX_EVIDENCE_REFS).default([]),
  supportingReasons: z.array(z.string().min(1).max(MAX_DETAIL_LENGTH)).max(MAX_SUPPORTING_REASONS).default([]),
}).strict();

function createPageStateChildInputSchema<TChildId extends PageStateChildCapabilityId>(childCapabilityId: TChildId) {
  return PageStateAbilityInputSchema.extend({
    childCapabilityId: z.literal(childCapabilityId),
  });
}

function createPageStateChildOutputSchema<TChildId extends PageStateChildCapabilityId>(childCapabilityId: TChildId) {
  return PageStateChildObservationSchema.extend({
    childCapabilityId: z.literal(childCapabilityId),
  });
}

type PageStateChildCapabilityId = z.infer<typeof PageStateChildCapabilityIdSchema>;
type PageStateRequestedBy = z.infer<typeof PageStateRequestedBySchema>;
type PageStateStatus = z.infer<typeof PageStateStatusSchema>;
type PageStateFailureReason = z.infer<typeof PageStateFailureReasonSchema>;
type PageStateDataQualityFlag = z.infer<typeof PageStateDataQualityFlagSchema>;
type PageStateSourceAbilityGroupId = z.infer<typeof PageStateSourceAbilityGroupIdSchema>;
type PageStateViewport = z.infer<typeof PageStateViewportSchema>;
type PageStateScrollOffset = z.infer<typeof PageStateScrollOffsetSchema>;
type PageStateObservationSource = z.infer<typeof PageStateObservationSourceSchema>;
type PageStateObservation = z.infer<typeof PageStateObservationSchema>;
type PageStateSnapshot = z.infer<typeof PageStateSnapshotSchema>;
type PageStatePolicy = z.infer<typeof PageStatePolicySchema>;
type PageStateOpenHandoffPolicy = z.infer<typeof PageStateOpenHandoffPolicySchema>;
type PageStateAbilityInput = z.infer<typeof PageStateAbilityInputSchema>;
type PageStateOutput = z.infer<typeof PageStateOutputSchema>;
type PageStateRuntimeProof = z.infer<typeof PageStateRuntimeProofSchema>;
type PageStateAbilityResult = z.infer<typeof PageStateAbilityResultSchema>;
type PageStateChildObservation = z.infer<typeof PageStateChildObservationSchema>;

export { PAGE_STATE_ABILITY_GROUP_ID, PAGE_STATE_CHILD_CAPABILITY_IDS, PageStateChildCapabilityIdSchema, PageStateStatusSchema, PageStateFailureReasonSchema, PageStateDataQualityFlagSchema, PageStateSourceAbilityGroupIdSchema, PageStateViewportSchema, PageStateScrollOffsetSchema, PageStateObservationSourceSchema, PageStateObservationSchema, PageStateSnapshotSchema, PageStatePolicySchema, PageStateOpenHandoffPolicySchema, PageStateAbilityInputSchema, PageStateOutputSchema, PageStateRuntimeProofSchema, PageStateAbilityResultSchema, PageStateChildObservationSchema, createPageStateChildInputSchema, createPageStateChildOutputSchema };
export type { PageStateChildCapabilityId, PageStateRequestedBy, PageStateStatus, PageStateFailureReason, PageStateDataQualityFlag, PageStateSourceAbilityGroupId, PageStateViewport, PageStateScrollOffset, PageStateObservationSource, PageStateObservation, PageStateSnapshot, PageStatePolicy, PageStateOpenHandoffPolicy, PageStateAbilityInput, PageStateOutput, PageStateRuntimeProof, PageStateAbilityResult, PageStateChildObservation };
