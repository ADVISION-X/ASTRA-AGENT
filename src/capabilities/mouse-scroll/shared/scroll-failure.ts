export const MOUSE_SCROLL_FAILURE_REASONS = [
  "missing_requested_by",
  "missing_purpose",
  "missing_geometry_guard_ref",
  "guard_not_allowed",
  "missing_source_ref",
  "invalid_coordinate_space",
  "invalid_anchor_point",
  "invalid_bounds",
  "invalid_region",
  "missing_region_ref",
  "invalid_direction",
  "invalid_magnitude",
  "invalid_repeat",
  "repeat_limit_exceeded",
  "invalid_custom_delta",
  "delta_limit_exceeded",
  "invalid_duration_limit",
  "operator_manual_approval_required",
  "primitive_failed",
] as const;

export type MouseScrollFailureReason = typeof MOUSE_SCROLL_FAILURE_REASONS[number];