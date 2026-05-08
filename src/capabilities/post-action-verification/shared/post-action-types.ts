export const POST_ACTION_VERIFICATION_ABILITY_GROUP_ID = "post-action-verification";

export const POST_ACTION_VERIFICATION_CHILD_CAPABILITY_IDS = [
  "observe-page-open-attempt",
  "observe-comments-panel-open-attempt",
  "observe-comments-panel-close-attempt",
  "observe-not-interested-attempt",
  "observe-target-state-transition",
  "verify-action-result",
] as const;

export type PostActionVerificationChildCapabilityId = (typeof POST_ACTION_VERIFICATION_CHILD_CAPABILITY_IDS)[number];

export const POST_ACTION_EXPECTED_OUTCOME_TYPES = [
  "page_opened",
  "comments_panel_opened",
  "comments_panel_closed",
  "not_interested_applied",
  "target_state_changed",
] as const;

export const POST_ACTION_SOURCE_ABILITY_GROUP_IDS = [
  "open",
  "mouse-click",
  "mouse-scroll",
] as const;

export const POST_ACTION_SOURCE_CHILD_CAPABILITY_IDS = [
  "open-tiktok",
  "open-facebook",
  "click-browser-coordinate",
  "click-desktop-coordinate",
  "scroll-browser-viewport",
  "scroll-desktop-screen",
  "scroll-region",
] as const;
