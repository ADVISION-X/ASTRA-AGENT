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
export const SEEDING_VIDEO_ROUTE_PLAN_REQUIREMENT_MESSAGE = "Seeding video map packages must keep only the open entry local while Route Plan owns capture-startup-video-viewport -> prepare-startup-ai-input -> startup-preparation -> capture-current-video-viewport -> prepare-current-video-ai-input -> judge-seeding-video. ProductPresence must stay binary route-only and must not leak target candidate ownership; maps keep only the weak promptInputRef binding and must not declare frame-specific sampling refs. Product-yes must pass observe-comments-entry-page-state -> analyze-comments-entry-target-candidate -> observe-comments-button -> normalize-comments-target -> click-comments-button -> capture-comments-panel -> extract-visible-comments -> write-seeding-evidence-record -> finalize-seeding-evidence-packet -> finalize-seeding-browse-ledger with vision.commentsEntryTargetCandidate.v1 plus comments.ocr_cleanup.v1. analyze-comment-intent, comment-intent-analysis, comments.intent_analysis.v1, and commentIntentAiResultRef are forbidden in the governed product-yes chain. Advance-next-item must pass observe-next-item-page-state -> press-next-video-key -> capture-next-item-verification-viewport -> prepare-next-item-verification-ai-input -> verify-next-item-advanced, then route both next-item-advanced and next-item-not-advanced back to capture-current-video-viewport for the lightweight product-presence chain. press-next-video-key must use text-input/press-navigation-key with pageStateRef. Non-AI video-changed PAV, product_uncertain/review_required/request-human-review handoff is forbidden.";