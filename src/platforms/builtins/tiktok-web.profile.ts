import type { PlatformProfile } from "../platform-profile.schema.js";

export const TIKTOK_WEB_PROFILE: PlatformProfile = {
  platformId: "tiktok-web",
  displayName: "TikTok Web",
  entryUrl: "https://www.tiktok.com/foryou",
  targetTitle: "TikTok For You",
  allowedHosts: ["tiktok.com", "www.tiktok.com"],
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
    "SAVE_CURRENT_VIDEO_EVIDENCE_ONCE",
    "STOP_REVIEW_REQUIRED_ONCE",
    "OPEN_PLATFORM_ENTRY_ONCE",
  ],
  // Lightweight platform action hints for AI — not coordinates, not map bindings.
  nextVideoPreferredActionCode: "SCROLL_BROWSER_VIEWPORT_ONCE",
  likeActionHint: "LEFT_CLICK_GRID_CELL_ONCE",
  commentsActionHint: "LEFT_CLICK_GRID_CELL_ONCE",
};