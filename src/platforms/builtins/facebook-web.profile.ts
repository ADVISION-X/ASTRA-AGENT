import type { PlatformProfile } from "../platform-profile.schema.js";

export const FACEBOOK_WEB_PROFILE: PlatformProfile = {
  platformId: "facebook-web",
  displayName: "Facebook Web",
  entryUrl: "https://www.facebook.com/reel/",
  targetTitle: "Facebook Reels",
  allowedHosts: ["facebook.com", "www.facebook.com", "m.facebook.com"],
  defaultRecoveryActionCode: "OPEN_FACEBOOK_ENTRY",
  supportedActionCodes: [
    "CAPTURE_SCREEN",
    "PREPARE_VISUAL_MISSION_INPUT",
    "SAVE_LEAD",
    "CLICK_CELL",
    "STOP_REVIEW_REQUIRED",
    "OPEN_FACEBOOK_ENTRY",
  ],
};