const GEOMETRY_GUARD_ABILITY_GROUP_ID = "geometry-guard";

const GEOMETRY_GUARD_CHILD_CAPABILITY_IDS = [
  "validate-coordinate-space",
  "validate-bbox-integrity",
  "validate-click-point",
  "validate-scale-mapping",
  "map-ai-input-to-viewport",
  "map-region-to-source",
  "validate-browser-viewport-bounds",
  "validate-desktop-screen-bounds",
] as const;

const GEOMETRY_GUARD_COORDINATE_SPACES = [
  "browserViewport",
  "desktopScreen",
  "imageEvidence",
  "aiInput",
  "regionCrop",
  "contactSheet",
] as const;

const GEOMETRY_GUARD_EXECUTION_SPACES = ["browserViewport", "desktopScreen"] as const;

const GEOMETRY_GUARD_RESULT_STATUSES = ["success", "failed", "review_required"] as const;

const GEOMETRY_GUARD_DECISIONS = ["allow", "block", "review_required"] as const;

const GEOMETRY_GUARD_CHECK_DECISIONS = ["passed", "failed", "review_required", "not_applicable"] as const;

const GEOMETRY_GUARD_ROUNDING_POLICIES = ["nearest_pixel"] as const;

const GEOMETRY_GUARD_FAILURE_REASONS = [
  "input_schema_invalid",
  "unknown_child_capability",
  "missing_requested_by",
  "missing_purpose",
  "missing_coordinate_space",
  "missing_source_ref",
  "missing_bbox",
  "invalid_bbox",
  "missing_click_point",
  "invalid_click_point",
  "click_point_outside_bbox",
  "click_point_in_safety_margin",
  "bbox_out_of_bounds",
  "missing_scale_mapping",
  "invalid_scale_mapping",
  "contact_sheet_coordinate_not_executable",
  "ai_input_mapping_required",
  "region_mapping_required",
  "execution_space_missing",
  "device_scale_factor_missing",
  "geometry_review_required",
  "confidence_below_threshold",
  "source_bounds_missing",
  "source_bounds_invalid",
  "target_bounds_missing",
  "target_bounds_invalid",
  "source_coordinate_space_mismatch",
  "requested_execution_space_mismatch",
  "child_execution_mismatch",
  "coordinate_transform_failed",
  "output_schema_invalid",
  "runtime_exception",
] as const;

export {
  GEOMETRY_GUARD_ABILITY_GROUP_ID,
  GEOMETRY_GUARD_CHECK_DECISIONS,
  GEOMETRY_GUARD_CHILD_CAPABILITY_IDS,
  GEOMETRY_GUARD_COORDINATE_SPACES,
  GEOMETRY_GUARD_DECISIONS,
  GEOMETRY_GUARD_EXECUTION_SPACES,
  GEOMETRY_GUARD_FAILURE_REASONS,
  GEOMETRY_GUARD_RESULT_STATUSES,
  GEOMETRY_GUARD_ROUNDING_POLICIES,
};