import type { PlatformProfile } from "../platform-profile.schema.js";

export const TIKTOK_WEB_PROFILE: PlatformProfile = {
  platformId: "tiktok-web",
  displayName: "TikTok Web",
  entryUrl: "https://www.tiktok.com/foryou",
  targetTitle: "TikTok For You",
  allowedHosts: ["tiktok.com", "www.tiktok.com"],
  defaultRecoveryActionCode: "OPEN_TIKTOK_ENTRY",
  supportedActionCodes: [
    "CAPTURE_SCREEN",
    "PREPARE_VISUAL_MISSION_INPUT",
    "SAVE_LEAD",
    "PRESS_KEY",
    "CLICK_CELL",
    "STOP_REVIEW_REQUIRED",
    "OPEN_TIKTOK_ENTRY",
    "LIKE_CURRENT_VIDEO",
    "NEXT_VIDEO",
    "SAVE_PRODUCT_AND_LIKE",
    "YES_SEEDING_VIDEO_FLOW",
    "NO_SEEDING_VIDEO_FLOW",
  ],
};