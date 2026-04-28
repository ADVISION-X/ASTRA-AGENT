import type { BrowserLoginState } from "../../../types/local-browser-session.js";

export const TIKTOK_REVIEW_REQUIRED_TAG = "platform-review-required";

export function summarizeTikTokLoginState(loginState: BrowserLoginState): string {
  switch (loginState) {
    case "logged_in":
      return "logged_in_visual_session";
    case "login_required":
      return "login_required_visual_review";
    case "review_required":
      return "review_required_visual_session";
    default:
      return "unknown_visual_session";
  }
}
