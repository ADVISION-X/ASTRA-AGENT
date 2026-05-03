const SCREENSHOT_ABILITY_GROUP_ID = "screenshot" as const;

const SCREENSHOT_CHILD_CAPABILITY_IDS = [
  "capture-browser-viewport",
  "capture-desktop-screen",
  "capture-region",
  "optimize-lossless",
  "prepare-ai-input",
] as const;

const SCREENSHOT_RESULT_STATUSES = [
  "success",
  "failed",
  "review_required",
] as const;

const SCREENSHOT_SOURCE_KINDS = [
  "browser_viewport",
  "desktop_screen",
  "stored_image",
] as const;

const SCREENSHOT_COORDINATE_SPACES = [
  "browser_viewport_pixels",
  "desktop_screen_pixels",
  "source_image_pixels",
  "region_crop_pixels",
  "optimized_equivalent_pixels",
  "ai_input_pixels",
  "contact_sheet_pixels",
] as const;

const SCREENSHOT_IMAGE_KINDS = [
  "evidence_original",
  "evidence_optimized",
  "region_crop",
  "ai_input",
  "contact_sheet",
] as const;

const SCREENSHOT_EVIDENCE_POLICIES = [
  "evidence_original",
  "evidence_optimized",
  "ai_input",
  "all",
] as const;

const SCREENSHOT_RETENTION_CLASSES = [
  "transient-capture",
  "transient-region",
  "transient-ai-input",
  "transient-contact-sheet",
  "diagnostic-debug",
  "promoted-evidence",
  "legal-hold-evidence",
] as const;

const SCREENSHOT_PROMOTION_STATUSES = [
  "not_promoted",
  "promotion_pending",
  "promoted",
  "legal_hold",
] as const;

const SCREENSHOT_FAILURE_CODES = [
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
  "artifact_budget_exceeded",
  "artifact_lifecycle_invalid",
  "artifact_path_invalid",
  "idempotency_conflict",
  "dispatch_failure",
] as const;

const SCREENSHOT_DATA_QUALITY_FLAGS = [
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
  "artifact_budget_verified",
  "artifact_lifecycle_manifest_written",
] as const;

const SCREENSHOT_DECISION_STATUSES = [
  "passed",
  "failed",
  "review_required",
  "blocked",
  "not_applicable",
] as const;

const SCREENSHOT_PAGE_STATE_STATUSES = [
  "approved",
  "stale",
  "login_wall",
  "safety_wall",
  "wrong_domain",
  "unknown",
] as const;

const SCREENSHOT_SENSITIVE_SCREEN_STATUSES = [
  "approved",
  "review_required",
  "blocked",
  "unknown",
] as const;


export { SCREENSHOT_ABILITY_GROUP_ID, SCREENSHOT_CHILD_CAPABILITY_IDS, SCREENSHOT_RESULT_STATUSES, SCREENSHOT_SOURCE_KINDS, SCREENSHOT_COORDINATE_SPACES, SCREENSHOT_IMAGE_KINDS, SCREENSHOT_EVIDENCE_POLICIES, SCREENSHOT_RETENTION_CLASSES, SCREENSHOT_PROMOTION_STATUSES, SCREENSHOT_FAILURE_CODES, SCREENSHOT_DATA_QUALITY_FLAGS, SCREENSHOT_DECISION_STATUSES, SCREENSHOT_PAGE_STATE_STATUSES, SCREENSHOT_SENSITIVE_SCREEN_STATUSES };
