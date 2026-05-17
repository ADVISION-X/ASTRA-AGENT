import type { PlatformProfile } from "../platform-profile.schema.js";

export const TIKTOK_WEB_PROFILE: PlatformProfile = {
  platformId: "tiktok-web",
  displayName: "TikTok Web",
  entryUrl: "https://www.tiktok.com/foryou",
  targetTitle: "TikTok For You",
  allowedHosts: ["tiktok.com", "www.tiktok.com"],
  supportedAtomicActionCodes: [
    "LEFT_CLICK_GRID_CELL_ONCE",
    "DOUBLE_LEFT_CLICK_GRID_CELL",
    "RIGHT_CLICK_GRID_CELL_ONCE",
    "TYPE_APPROVED_TEXT_ONCE",
    "PRESS_APPROVED_KEY_ONCE",
    "CLEAR_FOCUSED_INPUT_ONCE",
    "SCROLL_BROWSER_VIEWPORT_ONCE",
    "STOP_REVIEW_REQUIRED_ONCE",
  ],
  visualNotes: "Use the visible screen and coordinate grid only; platform data carries no semantic action policy.",
};
