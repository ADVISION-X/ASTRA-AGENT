export const SCREENSHOT_ABILITY_GROUP_ID = "screenshot" as const;

export const SCREENSHOT_CHILD_CAPABILITY_IDS = [
  "capture-browser-viewport",
  "capture-desktop-screen",
  "capture-region",
  "optimize-lossless",
  "prepare-ai-input",
] as const;

export const SCREENSHOT_RESULT_STATUSES = [
  "success",
  "failed",
  "review_required",
] as const;

export const SCREENSHOT_SOURCE_KINDS = [
  "browser_viewport",
  "desktop_screen",
  "stored_image",
] as const;

export const SCREENSHOT_COORDINATE_SPACES = [
  "browser_viewport_pixels",
  "desktop_screen_pixels",
  "source_image_pixels",
  "ai_input_pixels",
] as const;

export const SCREENSHOT_IMAGE_KINDS = [
  "evidence_original",
  "evidence_optimized",
  "ai_input",
] as const;

export const SCREENSHOT_EVIDENCE_POLICIES = [
  "evidence_original",
  "evidence_optimized",
  "ai_input",
  "all",
] as const;

export const SCREENSHOT_FAILURE_CODES = [
  "unknown_child",
  "input_schema_invalid",
  "output_schema_invalid",
  "source_policy_violation",
  "browser_session_invalid",
  "page_state_missing",
  "page_state_invalid",
  "privacy_policy_blocked",
  "region_proof_invalid",
  "capture_failed",
  "capture_timeout",
  "image_processing_failed",
  "image_processing_timeout",
  "artifact_write_failed",
  "artifact_path_invalid",
  "idempotency_conflict",
  "dispatch_failure",
] as const;

export const SCREENSHOT_DATA_QUALITY_FLAGS = [
  "browser_session_verified",
  "page_state_unverified",
  "page_state_verified",
  "region_proof_verified",
  "artifact_persisted",
  "lossless_equivalence_verified",
  "scale_mapping_verified",
  "desktop_capture_requested",
  "desktop_full_screen_requested",
  "privacy_review_required",
  "capture_fresh",
] as const;

export const SCREENSHOT_DECISION_STATUSES = [
  "passed",
  "failed",
  "review_required",
  "blocked",
  "not_applicable",
] as const;

export const SCREENSHOT_PAGE_STATE_STATUSES = [
  "approved",
  "stale",
  "login_wall",
  "safety_wall",
  "wrong_domain",
  "unknown",
] as const;

export const SCREENSHOT_SENSITIVE_SCREEN_STATUSES = [
  "approved",
  "review_required",
  "blocked",
  "unknown",
] as const;
