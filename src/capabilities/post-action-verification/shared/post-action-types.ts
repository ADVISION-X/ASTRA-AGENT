export const POST_ACTION_VERIFICATION_ABILITY_GROUP_ID = "post-action-verification";

export const POST_ACTION_VERIFICATION_CHILD_CAPABILITY_IDS = [
  "verify-page-opened",
  "verify-comments-panel-opened",
  "verify-comments-panel-closed",
  "verify-not-interested-result",
  "verify-target-state-changed",
] as const;

export const POST_ACTION_EXPECTED_OUTCOME_TYPES = [
  "page_opened",
  "comments_panel_opened",
  "comments_panel_closed",
  "not_interested_result",
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
  "open-local-workbench",
  "click-browser-coordinate",
  "click-desktop-coordinate",
  "scroll-browser-viewport",
  "scroll-desktop-screen",
  "scroll-region",
] as const;
