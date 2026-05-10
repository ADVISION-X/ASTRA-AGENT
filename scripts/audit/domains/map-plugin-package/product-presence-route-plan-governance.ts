export const PRODUCT_PRESENCE_OBSERVE_STEP_ID = "observe-current-video-page-state";
export const PRODUCT_PRESENCE_CAPTURE_STEP_ID = "capture-current-video-viewport";
export const PRODUCT_PRESENCE_PREPARE_STEP_ID = "prepare-current-video-ai-input";
export const PRODUCT_PRESENCE_PROMPT_INPUT_REFS = ["promptInputRef"] as const;
export const FORBIDDEN_PRODUCT_PRESENCE_FRAME_TOKENS = [
  "capture-video-frame-3s",
  "capture-video-frame-6s",
  "capture-video-frame-10s",
  "prepare-ai-input-frame-3s",
  "prepare-ai-input-frame-6s",
  "prepare-ai-input-frame-10s",
  "screenshotEvidenceRefFrame3s",
  "screenshotEvidenceRefFrame6s",
  "screenshotEvidenceRefFrame10s",
  "promptInputRefFrame3s",
  "promptInputRefFrame6s",
  "promptInputRefFrame10s",
] as const;
export const SEEDING_VIDEO_ROUTE_PLAN_REQUIREMENT_MESSAGE = "Seeding video map packages must keep only the open entry local while Route Plan owns capture-startup-video-viewport -> prepare-startup-ai-input -> startup-preparation -> observe-current-video-page-state -> capture-current-video-viewport -> prepare-current-video-ai-input -> judge-seeding-video. ProductPresence must stay binary route-only and must not leak target candidate ownership; maps keep only the weak promptInputRef binding and must not declare frame-specific sampling refs. V1 product-yes must pass write-product-lead-record -> like-current-video-keyboard -> observe-next-item-page-state, and write-product-lead-record must persist screenshot/url/title plus the product-presence AI summary into product_lead_record. like-current-video-keyboard must use text-input/press-key with pageStateRef and key L, and failed/review_required like outcomes must still continue to observe-next-item-page-state. V1 must not route product-yes into observe-comments-entry-page-state, analyze-comments-entry-target-candidate, observe-comments-button, normalize-comments-target, click-comments-button, verify-comments-open, capture-comments-panel, extract-visible-comments, write-seeding-evidence-record, or finalize-seeding-evidence-packet. comments.ocr_cleanup.v1, comment-intent-analysis, comments.intent_analysis.v1, and commentIntentAiResultRef are forbidden in the V1 governed main chain. Advance-next-item must pass observe-next-item-page-state -> press-next-video-key -> observe-current-video-page-state for success/failed/review_required direct action proof outcomes. press-next-video-key must use text-input/press-navigation-key with pageStateRef and screenshotEvidenceRef, and V1 next-item main transitions must not require capture-next-item-verification-viewport, prepare-next-item-verification-ai-input, verify-next-item-advanced, or vision.nextItemAdvanced.v1. Same-platform browser-session URL drift policy stays outside Route Plan: Facebook drift is Screenshot warning-only continue-capture, TikTok drift is Screenshot review_required plus Orchestration recovery to map.initialStepId, and maps/Route Plan must not declare platform-specific URL drift branches. Non-AI video-changed PAV, product_uncertain/review_required/request-human-review handoff is forbidden.";
