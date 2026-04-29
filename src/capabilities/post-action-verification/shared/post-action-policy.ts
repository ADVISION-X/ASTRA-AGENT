export const POST_ACTION_VERIFICATION_MODES = [
  "visual_evidence",
  "observation_only",
  "before_after_comparison",
] as const;

export const POST_ACTION_EVIDENCE_MAX_AGE_MS = 15_000;
export const POST_ACTION_AFTER_EVIDENCE_MAX_LAG_MS = 15_000;

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
