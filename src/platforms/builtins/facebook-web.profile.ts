import type { PlatformProfile } from "../platform-profile.schema.js";

export const FACEBOOK_WEB_PROFILE: PlatformProfile = {
  platformId: "facebook-web",
  displayName: "Facebook Web",
  entryUrl: "https://www.facebook.com/reel/",
  targetTitle: "Facebook Reels",
  allowedHosts: ["facebook.com", "www.facebook.com", "m.facebook.com"],
  defaultRecoveryActionCode: "REOPEN_ENTRY_PAGE",
  supportedActionCodes: [
    "CAPTURE_SCREEN",
    "PREPARE_VISUAL_MISSION_INPUT",
    "SAVE_LEAD",
    "PRESS_KEY",
    "CLICK_CELL",
    "WAIT_SHORT",
    "REOPEN_ENTRY_PAGE",
    "STOP_REVIEW_REQUIRED",
    "LIKE_CURRENT_VIDEO",
    "NEXT_VIDEO",
    "SAVE_PRODUCT_AND_LIKE",
    "YES_SEEDING_VIDEO_FLOW",
    "CLOSE_POPUP_AND_WAIT",
  ],
};