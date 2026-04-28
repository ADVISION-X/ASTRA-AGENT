import { z } from "zod";

import { BrowserLoginStateSchema } from "../../types/local-browser-session.js";

export const PAGE_STATE_ABILITY_GROUP_ID = "page-state";

export const PageStateChildCapabilityIdSchema = z.enum([
  "detect-login-state",
  "detect-safety-page",
  "detect-feed-ready",
  "detect-video-stable",
  "detect-comment-panel-state",
  "detect-modal-overlay-state",
  "detect-page-abnormality",
  "detect-platform-page-kind",
]);

export const PageStateTypeSchema = z.enum([
  "unknown",
  "logged_in",
  "login_required",
  "review_required",
  "safety_page",
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
]);

export const PageStateStatusSchema = z.enum(["success", "failed"]);

export const PageStateFailureReasonSchema = z.enum([
  "missing_current_url",
  "missing_confidence_policy",
  "missing_state_policy",
  "missing_observation_support",
  "unsupported_platform",
  "insufficient_signal",
  "state_detection_failed",
]);

export const PageStateObservationKindSchema = z.enum([
  "browser_session",
  "runtime_signal",
  "visual_target",
  "page_marker",
  "platform_capture",
]);

export const PageStateObservationRefSchema = z.object({
  kind: PageStateObservationKindSchema,
  ref: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).nullable().default(null),
});

export const PageStateConfidencePolicySchema = z.object({
  minimumConfidence: z.number().min(0).max(1),
  allowReviewRequired: z.boolean().default(true),
});

export const PageStatePolicySchema = z.object({
  allowReviewRequired: z.boolean().default(true),
  expectedPlatformHost: z.string().min(1).nullable().default(null),
  allowUnknownState: z.boolean().default(true),
});

export const PageStateAbilityInputSchema = z.object({
  childCapabilityId: PageStateChildCapabilityIdSchema,
  currentUrl: z.string().min(1),
  currentTitle: z.string().default(""),
  browserLoginState: BrowserLoginStateSchema.default("unknown"),
  observationRefs: z.array(PageStateObservationRefSchema).default([]),
  sourceEvidenceRefs: z.array(z.string().min(1)).default([]),
  requestedBy: z.string().min(1),
  sessionId: z.string().min(1),
  roundId: z.string().min(1).nullable().default(null),
  videoVisitId: z.string().min(1).nullable().default(null),
  confidencePolicy: PageStateConfidencePolicySchema,
  statePolicy: PageStatePolicySchema,
});

export const PageStateAbilityResultSchema = z.object({
  status: PageStateStatusSchema,
  abilityGroupId: z.literal(PAGE_STATE_ABILITY_GROUP_ID),
  childCapabilityId: PageStateChildCapabilityIdSchema,
  sessionId: z.string().min(1),
  roundId: z.string().min(1).nullable().default(null),
  videoVisitId: z.string().min(1).nullable().default(null),
  pageStateType: PageStateTypeSchema,
  stateSummary: z.string().min(1),
  confidence: z.number().min(0).max(1),
  evidenceRefs: z.array(z.string().min(1)).default([]),
  observationRefs: z.array(z.string().min(1)).default([]),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: z.number().int().min(0),
  failureReason: PageStateFailureReasonSchema.nullable().default(null),
  reviewRequiredReason: z.string().min(1).nullable().default(null),
  dataQualityFlags: z.array(z.string().min(1)).default([]),
  debugLogRef: z.string().min(1),
});

export type PageStateAbilityGroupId = typeof PAGE_STATE_ABILITY_GROUP_ID;
export type PageStateChildCapabilityId = z.infer<typeof PageStateChildCapabilityIdSchema>;
export type PageStateType = z.infer<typeof PageStateTypeSchema>;
export type PageStateStatus = z.infer<typeof PageStateStatusSchema>;
export type PageStateFailureReason = z.infer<typeof PageStateFailureReasonSchema>;
export type PageStateObservationKind = z.infer<typeof PageStateObservationKindSchema>;
export type PageStateObservationRef = z.infer<typeof PageStateObservationRefSchema>;
export type PageStateConfidencePolicy = z.infer<typeof PageStateConfidencePolicySchema>;
export type PageStatePolicy = z.infer<typeof PageStatePolicySchema>;
export type PageStateAbilityInput = z.infer<typeof PageStateAbilityInputSchema>;
export type PageStateAbilityResult = z.infer<typeof PageStateAbilityResultSchema>;

export interface PageStateChildCapability {
  readonly abilityGroupId: PageStateAbilityGroupId;
  readonly childCapabilityId: PageStateChildCapabilityId;

  execute(input: PageStateAbilityInput): Promise<PageStateAbilityResult>;
}

export interface PageStateAbilityGroup {
  listChildCapabilityIds(): PageStateChildCapabilityId[];
  execute(input: PageStateAbilityInput): Promise<PageStateAbilityResult>;
}