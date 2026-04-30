export const POST_ACTION_VERIFICATION_MODES = [
  "visual_evidence",
  "observation_only",
  "before_after_comparison",
] as const;

export const POST_ACTION_EVIDENCE_MAX_AGE_MS = 15_000;
export const POST_ACTION_AFTER_EVIDENCE_MAX_LAG_MS = 15_000;
export const POST_ACTION_MAX_OBSERVATIONS = 50;
export const POST_ACTION_MAX_EVIDENCE_REFS = 50;
export const POST_ACTION_MAX_SOURCE_PROOF_REFS = 50;
export const POST_ACTION_MAX_SUMMARY_LENGTH = 1_000;
export const POST_ACTION_MAX_SIGNAL_TYPE_LENGTH = 120;
export const POST_ACTION_MAX_TARGET_TYPE_LENGTH = 120;
export const POST_ACTION_MAX_STATUS_MESSAGE_LENGTH = 1_000;
export const POST_ACTION_MAX_DATA_QUALITY_FLAGS = 30;

export const POST_ACTION_CHILD_OUTCOME_MAP = {
  "verify-page-opened": "page_opened",
  "verify-comments-panel-opened": "comments_panel_opened",
  "verify-comments-panel-closed": "comments_panel_closed",
  "verify-video-changed-after-scroll": "video_changed_after_scroll",
  "verify-not-interested-result": "not_interested_result",
  "verify-target-state-changed": "target_state_changed",
} as const;

export const POST_ACTION_CHILD_VERIFICATION_MODE_MAP = {
  "verify-page-opened": "observation_only",
  "verify-comments-panel-opened": "visual_evidence",
  "verify-comments-panel-closed": "visual_evidence",
  "verify-video-changed-after-scroll": "before_after_comparison",
  "verify-not-interested-result": "before_after_comparison",
  "verify-target-state-changed": "before_after_comparison",
} as const;

export const POST_ACTION_CHILD_POLICY_MAP = {
  "verify-page-opened": {
    expectedOutcomeType: "page_opened",
    verificationMode: "observation_only",
    requireAfterEvidence: false,
    requireBeforeAfterComparison: false,
    allowedSourceAbilityGroupId: "open",
    allowedSourceChildCapabilityIds: ["open-tiktok", "open-facebook", "open-local-workbench"],
    allowedActionTypes: ["open_feed", "open_target_page", "open_comments"],
    requiredExecutionRef: "navigationAttemptRef",
    allowedObservationKinds: ["page_state", "runtime_signal"],
  },
  "verify-comments-panel-opened": {
    expectedOutcomeType: "comments_panel_opened",
    verificationMode: "visual_evidence",
    requireAfterEvidence: true,
    requireBeforeAfterComparison: false,
    allowedSourceAbilityGroupId: "mouse-click",
    allowedSourceChildCapabilityIds: ["click-browser-coordinate"],
    allowedActionTypes: ["open_comments", "click_open_comments"],
    requiredExecutionRef: "primitiveExecutionRef",
    allowedObservationKinds: ["page_state", "visual_target", "ai_observation"],
  },
  "verify-comments-panel-closed": {
    expectedOutcomeType: "comments_panel_closed",
    verificationMode: "visual_evidence",
    requireAfterEvidence: true,
    requireBeforeAfterComparison: false,
    allowedSourceAbilityGroupId: "mouse-click",
    allowedSourceChildCapabilityIds: ["click-browser-coordinate"],
    allowedActionTypes: ["close_comments", "click_close_comments"],
    requiredExecutionRef: "primitiveExecutionRef",
    allowedObservationKinds: ["page_state", "visual_target", "ai_observation"],
  },
  "verify-video-changed-after-scroll": {
    expectedOutcomeType: "video_changed_after_scroll",
    verificationMode: "before_after_comparison",
    requireAfterEvidence: true,
    requireBeforeAfterComparison: true,
    allowedSourceAbilityGroupId: "mouse-scroll",
    allowedSourceChildCapabilityIds: ["scroll-browser-viewport", "scroll-region"],
    allowedActionTypes: ["continue_next", "scroll", "scroll_next_video"],
    requiredExecutionRef: "scrollExecutionRef",
    allowedObservationKinds: ["video_identity", "runtime_signal"],
  },
  "verify-not-interested-result": {
    expectedOutcomeType: "not_interested_result",
    verificationMode: "before_after_comparison",
    requireAfterEvidence: true,
    requireBeforeAfterComparison: true,
    allowedSourceAbilityGroupId: "mouse-click",
    allowedSourceChildCapabilityIds: ["click-browser-coordinate"],
    allowedActionTypes: ["click_not_interested", "not_interested"],
    requiredExecutionRef: "primitiveExecutionRef",
    allowedObservationKinds: ["page_state", "runtime_signal", "video_identity", "screenshot_diff"],
  },
  "verify-target-state-changed": {
    expectedOutcomeType: "target_state_changed",
    verificationMode: "before_after_comparison",
    requireAfterEvidence: true,
    requireBeforeAfterComparison: true,
    allowedSourceAbilityGroupId: "mouse-click",
    allowedSourceChildCapabilityIds: ["click-browser-coordinate"],
    allowedActionTypes: ["like_or_save_candidate", "click_like_or_save_marker", "click_target_state_change"],
    requiredExecutionRef: "primitiveExecutionRef",
    allowedObservationKinds: ["page_state", "visual_target", "screenshot_diff"],
  },
} as const;

export const POST_ACTION_OBSERVATION_SOURCE_ALLOWLIST = {
  page_state: {
    sourceAbilityGroupIds: ["page-state"],
    sourceChildCapabilityIds: [
      "detect-login-state",
      "detect-feed-ready",
      "detect-comment-panel-state",
      "detect-modal-overlay-state",
      "detect-page-abnormality",
      "detect-platform-page-kind",
    ],
  },
  ai_observation: {
    sourceAbilityGroupIds: ["ai"],
    sourceChildCapabilityIds: ["ask-product-presence", "classify-comment-signals", "describe-page-state", "local-vision-ai"],
  },
  visual_target: {
    sourceAbilityGroupIds: ["visual-target"],
    sourceChildCapabilityIds: ["detect-target", "detect-comment-panel", "detect-video-area", "detect-marker-state"],
  },
  screenshot_diff: {
    sourceAbilityGroupIds: ["screenshot", "visual-target"],
    sourceChildCapabilityIds: ["capture-browser-viewport", "compare-screenshot-diff", "detect-target"],
  },
  video_identity: {
    sourceAbilityGroupIds: ["screenshot", "page-state", "visual-target", "post-action-verification"],
    sourceChildCapabilityIds: ["capture-browser-viewport", "detect-video-stable", "detect-target", "verify-video-changed-after-scroll"],
  },
  action_completion: {
    sourceAbilityGroupIds: ["page-state", "post-action-verification"],
    sourceChildCapabilityIds: [
      "detect-feed-ready",
      "detect-comment-panel-state",
      "page_opened",
      "comments_panel_opened",
      "comments_panel_closed",
      "video_changed_after_scroll",
      "not_interested_result",
      "target_state_changed",
    ],
  },
  runtime_signal: {
    sourceAbilityGroupIds: ["page-state", "post-action-verification"],
    sourceChildCapabilityIds: ["detect-feed-ready", "detect-video-stable", "detect-comment-panel-state", "verify-video-changed-after-scroll"],
  },
} as const;
