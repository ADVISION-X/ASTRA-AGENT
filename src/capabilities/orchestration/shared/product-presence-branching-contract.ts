export const BROWSER_ROUND_STEPS = [
  "open_target_page",
  "detect_login_or_safety",
  "wait_feed_ready",
  "single_video_round_start",
  "wait_video_stable",
  "identify_current_video",
  "calibrate_geometry",
  "screenshot_video_area",
  "record_video_evidence",
  "ask_ai_product_presence",
  "validate_ai_output",
  "collect_pre_action_metrics",
  "like_or_save_marker",
  "open_comments",
  "screenshot_comments",
  "extract_visible_comments",
  "summarize_comment_signals",
  "create_pending_candidate",
  "create_video_only_pending_candidate",
  "decide_negative_action",
  "click_not_interested",
  "scroll_next_video",
  "record_skip_reason",
  "record_round_complete",
  "review_required",
  "stop",
] as const;

export const PRODUCT_PRESENCE_DECISIONS = [
  "product_yes_high_confidence",
  "product_no_high_confidence",
  "product_uncertain",
  "local_ai_unavailable",
  "blocked_by_login",
  "blocked_by_captcha",
  "blocked_by_safety_page",
  "geometry_mismatch",
  "invalid_ai_output",
] as const;

export const ROUND_OUTCOMES = [
  "candidate_created",
  "video_only_candidate_created",
  "skipped_non_product",
  "skipped_uncertain",
  "skipped_duplicate",
  "skipped_unstable_video",
  "review_required",
  "failed_with_reason",
] as const;

export type BrowserRoundStep = (typeof BROWSER_ROUND_STEPS)[number];
export type ProductPresenceDecision = (typeof PRODUCT_PRESENCE_DECISIONS)[number];
export type RoundOutcome = (typeof ROUND_OUTCOMES)[number];

export interface LikeSaveMarkerPolicy {
  meaning: "recommendation_tuning_marker";
  onlyAfterProductYesHighConfidence: true;
  requirePreActionMetrics: true;
  requireExplicitUiTarget: true;
  requireRateLimit: true;
  requireActionLog: true;
  failureDoesNotImplySuccess: true;
  forbiddenPurposes: string[];
}

export interface CommentSamplingPolicy {
  commentEntryRequiresProductYesHighConfidence: true;
  defaultSamplingWindow: "first_screen";
  maxCommentScreenshots: number;
  maxVisibleComments: number;
  allowInfiniteScroll: false;
  allowCommenterProfileEntry: false;
  allowPrivateMessageCapture: false;
  allowNonPublicContentCapture: false;
}

export interface MetricsCollectionPolicy {
  requiredPreActionMetrics: readonly string[];
  metricCaptureStages: readonly ["pre_action", "post_action"];
  missingMetricPolicy: "record_unavailable_reason";
}

export interface CandidateCreationPolicy {
  allowedCandidateStatus: "pending_analysis";
  videoOnlyAllowedForProductYes: true;
  richerCandidateRequiresCommentEvidence: true;
  allowProductNoCandidate: false;
  allowUncertainCandidateByDefault: false;
}

export interface AgentBrowseDecisionInput {
  pageReadyStatus: string;
  currentUrl: string;
  screenshotEvidenceId: string | null;
  isDuplicateVideo: boolean;
  geometryGuardStatus: string;
  localAiAvailable: boolean;
  aiOutputValid: boolean;
  productPresenceConfidence: number | null;
  decisionReason: string;
}

export interface AgentBrowseDecisionOutput {
  decision: ProductPresenceDecision;
  nextStep: BrowserRoundStep;
  roundOutcome: RoundOutcome | null;
  shouldCollectPreActionMetrics: boolean;
  shouldRunLikeSaveMarker: boolean;
  shouldOpenComments: boolean;
  shouldCreateVideoOnlyCandidate: boolean;
  shouldCreateRicherCandidate: boolean;
  shouldScrollNext: boolean;
  shouldClickNotInterested: boolean;
  mustReview: boolean;
  reason: string;
}

export const LIKE_SAVE_MARKER_POLICY: LikeSaveMarkerPolicy = {
  meaning: "recommendation_tuning_marker",
  onlyAfterProductYesHighConfidence: true,
  requirePreActionMetrics: true,
  requireExplicitUiTarget: true,
  requireRateLimit: true,
  requireActionLog: true,
  failureDoesNotImplySuccess: true,
  forbiddenPurposes: ["growth", "engagement_manipulation", "final_business_judgment"],
};

export const COMMENT_SAMPLING_POLICY: CommentSamplingPolicy = {
  commentEntryRequiresProductYesHighConfidence: true,
  defaultSamplingWindow: "first_screen",
  maxCommentScreenshots: 3,
  maxVisibleComments: 20,
  allowInfiniteScroll: false,
  allowCommenterProfileEntry: false,
  allowPrivateMessageCapture: false,
  allowNonPublicContentCapture: false,
};

export const METRICS_COLLECTION_POLICY: MetricsCollectionPolicy = {
  requiredPreActionMetrics: ["likeCount", "commentCount", "shareCount", "saveCount", "sourceUrl", "captureTime"],
  metricCaptureStages: ["pre_action", "post_action"],
  missingMetricPolicy: "record_unavailable_reason",
};

export const CANDIDATE_CREATION_POLICY: CandidateCreationPolicy = {
  allowedCandidateStatus: "pending_analysis",
  videoOnlyAllowedForProductYes: true,
  richerCandidateRequiresCommentEvidence: true,
  allowProductNoCandidate: false,
  allowUncertainCandidateByDefault: false,
};