import type { PageStateChildCapabilityId, PageStateType } from "../schema.js";

const OBSERVATION_REQUIRED_CHILDREN = new Set<PageStateChildCapabilityId>([
  "detect-feed-ready",
  "detect-video-stable",
  "detect-comment-panel-state",
  "detect-modal-overlay-state",
  "detect-safety-page",
]);

const BLOCKED_PAGE_STATE_TYPES = new Set<PageStateType>([
  "wrong_domain",
  "safety_wall",
  "captcha_challenge",
]);

const REVIEW_REQUIRED_PAGE_STATE_TYPES = new Set<PageStateType>([
  "login_required",
  "page_abnormal",
  "unknown_page",
  "platform_unknown",
  "feed_not_ready",
  "video_unstable",
  "modal_overlay_present",
]);

const PROCEED_PAGE_STATE_TYPES_BY_CHILD: Record<PageStateChildCapabilityId, readonly PageStateType[]> = {
  "detect-login-state": ["logged_in"],
  "detect-safety-page": ["page_normal"],
  "detect-feed-ready": ["feed_ready"],
  "detect-video-stable": ["video_stable"],
  "detect-comment-panel-state": ["comments_panel_open", "comments_panel_closed"],
  "detect-modal-overlay-state": ["modal_overlay_absent"],
  "detect-page-abnormality": ["page_normal"],
  "detect-platform-page-kind": ["platform_feed", "platform_video_page", "local_workbench"],
};

export function childRequiresObservationSupport(childCapabilityId: PageStateChildCapabilityId): boolean {
  return OBSERVATION_REQUIRED_CHILDREN.has(childCapabilityId);
}

export function childAllowsProceed(childCapabilityId: PageStateChildCapabilityId, pageStateType: PageStateType): boolean {
  return PROCEED_PAGE_STATE_TYPES_BY_CHILD[childCapabilityId].includes(pageStateType);
}

export function isBlockedPageStateType(pageStateType: PageStateType): boolean {
  return BLOCKED_PAGE_STATE_TYPES.has(pageStateType);
}

export function isReviewRequiredPageStateType(pageStateType: PageStateType): boolean {
  return REVIEW_REQUIRED_PAGE_STATE_TYPES.has(pageStateType);
}