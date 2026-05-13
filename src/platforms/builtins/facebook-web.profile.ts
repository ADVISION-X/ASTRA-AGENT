import type { PlatformProfile } from "../platform-profile.schema.js";

export const FACEBOOK_WEB_PROFILE: PlatformProfile = {
  platformId: "facebook-web",
  displayName: "Facebook Web",
  entryUrl: "https://www.facebook.com/reel/",
  targetTitle: "Facebook Reels",
  allowedHosts: ["facebook.com", "www.facebook.com", "m.facebook.com"],
  defaultRecoveryActionCode: "OPEN_PLATFORM_ENTRY_ONCE",
  supportedActionCodes: [
    "CAPTURE_SCREEN",
    "RENDER_COORDINATE_GRID_ONCE",
    "LEFT_CLICK_GRID_CELL_ONCE",
    "DOUBLE_LEFT_CLICK_GRID_CELL",
    "RIGHT_CLICK_GRID_CELL_ONCE",
    "SCROLL_BROWSER_VIEWPORT_ONCE",
    "TYPE_APPROVED_TEXT_ONCE",
    "PRESS_APPROVED_KEY_ONCE",
    "CLEAR_FOCUSED_INPUT_ONCE",
    "SAVE_RECORD_ONCE",
    "STOP_REVIEW_REQUIRED_ONCE",
    "OPEN_PLATFORM_ENTRY_ONCE",
  ],
  // Lightweight platform action hints for AI — not coordinates, not map bindings.
  nextVideoPreferredActionCode: "PRESS_APPROVED_KEY_ONCE",
  likeActionHint: "PRESS_APPROVED_KEY_ONCE",
  likeApprovedKey: "L",
  commentsActionHint: "LEFT_CLICK_GRID_CELL_ONCE",
};
