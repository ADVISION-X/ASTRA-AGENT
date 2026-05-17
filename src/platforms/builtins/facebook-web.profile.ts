import type { PlatformProfile } from "../platform-profile.schema.js";

export const FACEBOOK_WEB_PROFILE: PlatformProfile = {
  platformId: "facebook-web",
  displayName: "Facebook Web",
  entryUrl: "https://www.facebook.com/reel/",
  targetTitle: "Facebook Reels",
  allowedHosts: ["facebook.com", "www.facebook.com", "m.facebook.com"],
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
