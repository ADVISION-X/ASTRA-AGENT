import { z } from "zod";

import { BrowserLoginStateSchema } from "../../types/local-browser-session.js";

export const PAGE_STATE_ABILITY_GROUP_ID = "page-state";

export const PAGE_STATE_CHILD_CAPABILITY_IDS = [
  "detect-login-state",
  "detect-safety-page",
  "detect-feed-ready",
  "detect-video-stable",
  "detect-comment-panel-state",
  "detect-modal-overlay-state",
  "detect-page-abnormality",
  "detect-platform-page-kind",
] as const;

export const PageStateChildCapabilityIdSchema = z.enum(PAGE_STATE_CHILD_CAPABILITY_IDS);

export const PageStateStatusSchema = z.enum(["success", "failed", "review_required", "blocked"]);

export const PageStateDecisionSchema = z.enum(["proceed", "block", "review_required", "fail"]);

export const PageStateTypeSchema = z.enum([
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

export const PageStateFailureReasonSchema = z.enum([
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
]);

export const PageStateDataQualityFlagSchema = z.enum([
  "low_confidence",
  "missing_observation",
  "stale_snapshot",
  "stale_observation",
  "source_mismatch",
  "platform_mismatch",
  "insufficient_signal",
  "unsupported_platform",
  "fingerprint_changed",
]);

export const PageStateSourceAbilityGroupIdSchema = z.enum([
  "open",
  "screenshot",
  "visual-target",
  "post-action-verification",
  "runtime-signal",
]);

export const PageStateViewportSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  deviceScaleFactor: z.number().positive().default(1),
});

export const PageStateScrollOffsetSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

export const PageStateObservationSourceSchema = z.object({
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
  detail: z.string().min(1).nullable().default(null),
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
  detail: z.string().min(1).nullable().default(null),
});

const VisualTargetObservationPayloadSchema = z.object({
  targetType: z.enum(["feed_card", "video_player", "comment_panel", "modal_overlay", "captcha", "login_form"]),
  targetCount: z.number().int().min(0),
  matched: z.boolean(),
});

const PlatformCaptureObservationPayloadSchema = z.object({
  captureKind: z.enum(["page_snapshot", "viewport_capture", "post_open_capture"]),
  tags: z.array(z.string().min(1)).default([]),
  confidence: z.number().min(0).max(1),
});

const PostActionVerificationObservationPayloadSchema = z.object({
  verificationKind: z.enum(["open_handoff", "page_transition", "safety_check"]),
  passed: z.boolean(),
  summary: z.string().min(1),
});

export const PageStateObservationSchema = z.discriminatedUnion("kind", [
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

export const PageStateSnapshotSchema = z.object({
  snapshotId: z.string().min(1),
  currentUrl: z.string().url(),
  currentTitle: z.string(),
  browserLoginState: BrowserLoginStateSchema,
  viewport: PageStateViewportSchema,
  scrollOffset: PageStateScrollOffsetSchema,
  capturedAt: z.string().datetime(),
  sourceAbilityGroupId: PageStateSourceAbilityGroupIdSchema,
  sourceChildCapabilityId: z.string().min(1),
  sourceProofRef: z.string().min(1),
});

export const PageStateFreshnessPolicySchema = z.object({
  maxSnapshotAgeMs: z.number().int().nonnegative(),
  maxObservationAgeMs: z.number().int().nonnegative(),
  maxObservationSkewMs: z.number().int().nonnegative(),
});

export const PageStateConfidencePolicySchema = z.object({
  minimumConfidence: z.number().min(0).max(1),
  allowReviewRequired: z.boolean().default(true),
});

export const PageStatePolicySchema = z.object({
  expectedPlatformHost: z.string().min(1).nullable().default(null),
  allowLocalWorkbench: z.boolean().default(false),
  allowModalOverlay: z.boolean().default(false),
  allowUnknownState: z.boolean().default(false),
});

export const PageStateOpenHandoffPolicySchema = z.object({
  openProofRef: z.string().min(1),
  browserSessionRef: z.string().min(1),
  platformProfileId: z.string().min(1),
});

export const PageStateAbilityInputSchema = z.object({
  childCapabilityId: PageStateChildCapabilityIdSchema,
  runId: z.string().min(1),
  missionId: z.string().min(1),
  sessionId: z.string().min(1),
  roundId: z.string().min(1),
  videoVisitId: z.string().min(1),
  requestedBy: z.string().min(1),
  snapshot: PageStateSnapshotSchema,
  observations: z.array(PageStateObservationSchema),
  sourceEvidenceRefs: z.array(z.string().min(1)).min(1),
  freshnessPolicy: PageStateFreshnessPolicySchema,
  confidencePolicy: PageStateConfidencePolicySchema,
  statePolicy: PageStatePolicySchema,
  openHandoff: PageStateOpenHandoffPolicySchema,
  previousPageStateFingerprint: z.string().min(1).nullable().default(null),
});

export const PageStateRuntimeProofSchema = z.object({
  proofId: z.string().min(1),
  runId: z.string().min(1),
  missionId: z.string().min(1),
  sessionId: z.string().min(1),
  roundId: z.string().min(1),
  videoVisitId: z.string().min(1),
  abilityGroupId: z.literal(PAGE_STATE_ABILITY_GROUP_ID),
  childCapabilityId: PageStateChildCapabilityIdSchema,
  sourceAbilityGroupId: PageStateSourceAbilityGroupIdSchema,
  sourceChildCapabilityId: z.string().min(1),
  inputRef: z.string().min(1),
  outputRef: z.string().min(1),
  snapshotId: z.string().min(1),
  snapshotProofRef: z.string().min(1),
  observationRefs: z.array(z.string().min(1)),
  sourceEvidenceRefs: z.array(z.string().min(1)),
  currentUrl: z.string().url(),
  currentTitle: z.string(),
  pageStateFingerprint: z.string().min(1),
  previousPageStateFingerprint: z.string().min(1).nullable(),
  capturedAt: z.string().datetime(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative(),
  status: PageStateStatusSchema,
  decision: PageStateDecisionSchema,
  pageStateType: PageStateTypeSchema,
  confidence: z.number().min(0).max(1),
  failureReason: PageStateFailureReasonSchema.nullable(),
  reviewRequiredReason: z.string().min(1).nullable(),
  inputDecision: z.enum(["allow", "fail"]),
  sourceDecision: z.enum(["allow", "review_required", "fail"]),
  freshnessDecision: z.enum(["fresh", "review_required", "fail"]),
  platformDecision: z.enum(["match", "review_required", "block"]),
  classificationDecision: z.enum(["proceed", "review_required", "block", "fail"]),
  proceedDecision: PageStateDecisionSchema,
  dataQualityFlags: z.array(PageStateDataQualityFlagSchema),
}).superRefine((proof, ctx) => {
  if (proof.reviewRequiredReason && proof.status === "success") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "reviewRequiredReason cannot coexist with success status",
      path: ["status"],
    });
  }

  if ((proof.status === "blocked" || proof.status === "review_required") && proof.decision === "proceed") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "blocked or review_required proof cannot proceed",
      path: ["decision"],
    });
  }

  if (proof.status === "success" && proof.decision !== "proceed") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "success proof must proceed",
      path: ["decision"],
    });
  }
});

export const PageStateAbilityResultSchema = z.object({
  status: PageStateStatusSchema,
  decision: PageStateDecisionSchema,
  abilityGroupId: z.literal(PAGE_STATE_ABILITY_GROUP_ID),
  childCapabilityId: PageStateChildCapabilityIdSchema,
  runId: z.string().min(1),
  missionId: z.string().min(1),
  sessionId: z.string().min(1),
  roundId: z.string().min(1),
  videoVisitId: z.string().min(1),
  pageStateType: PageStateTypeSchema,
  stateSummary: z.string().min(1),
  confidence: z.number().min(0).max(1),
  evidenceRefs: z.array(z.string().min(1)),
  observationRefs: z.array(z.string().min(1)),
  sourceEvidenceRefs: z.array(z.string().min(1)),
  pageStateFingerprint: z.string().min(1),
  previousPageStateFingerprint: z.string().min(1).nullable(),
  failureReason: PageStateFailureReasonSchema.nullable(),
  reviewRequiredReason: z.string().min(1).nullable(),
  dataQualityFlags: z.array(PageStateDataQualityFlagSchema),
  runtimeProof: PageStateRuntimeProofSchema,
}).superRefine((result, ctx) => {
  if (result.reviewRequiredReason && result.status === "success") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "reviewRequiredReason cannot coexist with success status",
      path: ["status"],
    });
  }

  if (result.runtimeProof.status !== result.status) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "runtime proof status must match result status",
      path: ["runtimeProof", "status"],
    });
  }

  if (result.runtimeProof.decision !== result.decision) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "runtime proof decision must match result decision",
      path: ["runtimeProof", "decision"],
    });
  }

  if (result.status === "success" && result.decision !== "proceed") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "success result must proceed",
      path: ["decision"],
    });
  }

  if ((result.status === "blocked" || result.status === "review_required") && result.decision === "proceed") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "blocked or review_required result cannot proceed",
      path: ["decision"],
    });
  }
});

export type PageStateChildCapabilityId = z.infer<typeof PageStateChildCapabilityIdSchema>;
export type PageStateStatus = z.infer<typeof PageStateStatusSchema>;
export type PageStateDecision = z.infer<typeof PageStateDecisionSchema>;
export type PageStateType = z.infer<typeof PageStateTypeSchema>;
export type PageStateFailureReason = z.infer<typeof PageStateFailureReasonSchema>;
export type PageStateDataQualityFlag = z.infer<typeof PageStateDataQualityFlagSchema>;
export type PageStateSourceAbilityGroupId = z.infer<typeof PageStateSourceAbilityGroupIdSchema>;
export type PageStateViewport = z.infer<typeof PageStateViewportSchema>;
export type PageStateScrollOffset = z.infer<typeof PageStateScrollOffsetSchema>;
export type PageStateObservationSource = z.infer<typeof PageStateObservationSourceSchema>;
export type PageStateObservation = z.infer<typeof PageStateObservationSchema>;
export type PageStateSnapshot = z.infer<typeof PageStateSnapshotSchema>;
export type PageStateFreshnessPolicy = z.infer<typeof PageStateFreshnessPolicySchema>;
export type PageStateConfidencePolicy = z.infer<typeof PageStateConfidencePolicySchema>;
export type PageStatePolicy = z.infer<typeof PageStatePolicySchema>;
export type PageStateOpenHandoffPolicy = z.infer<typeof PageStateOpenHandoffPolicySchema>;
export type PageStateAbilityInput = z.infer<typeof PageStateAbilityInputSchema>;
export type PageStateRuntimeProof = z.infer<typeof PageStateRuntimeProofSchema>;
export type PageStateAbilityResult = z.infer<typeof PageStateAbilityResultSchema>;

export const PageStateChildDetectionSchema = z.object({
  childCapabilityId: PageStateChildCapabilityIdSchema,
  pageStateType: PageStateTypeSchema,
  stateSummary: z.string().min(1),
  confidence: z.number().min(0).max(1),
  reviewRequiredReason: z.string().min(1).nullable().default(null),
  dataQualityFlags: z.array(PageStateDataQualityFlagSchema).default([]),
  matchedObservationIds: z.array(z.string().min(1)).default([]),
  supportingEvidenceRefs: z.array(z.string().min(1)).default([]),
  supportingReasons: z.array(z.string().min(1)).default([]),
});

export function createPageStateChildInputSchema<TChildId extends PageStateChildCapabilityId>(childCapabilityId: TChildId) {
  return PageStateAbilityInputSchema.extend({
    childCapabilityId: z.literal(childCapabilityId),
  });
}

export function createPageStateChildOutputSchema<TChildId extends PageStateChildCapabilityId>(childCapabilityId: TChildId) {
  return PageStateChildDetectionSchema.extend({
    childCapabilityId: z.literal(childCapabilityId),
  });
}

export type PageStateChildDetection = z.infer<typeof PageStateChildDetectionSchema>;