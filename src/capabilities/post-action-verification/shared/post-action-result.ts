export const POST_ACTION_VERIFICATION_STATUSES = ["success", "failed", "review_required"] as const;

export const POST_ACTION_FAILURE_REASONS = [
  "input_schema_invalid",
  "unknown_child_capability",
  "child_execution_failed",
  "missing_observation_support",
  "insufficient_evidence",
  "output_boundary_violation",
] as const;

export const POST_ACTION_CRITICAL_DATA_QUALITY_FLAGS = [
  "missing_observation",
  "missing_source_proof",
  "invalid_source_proof",
  "invalid_evidence_binding",
  "missing_after_evidence",
  "missing_before_after_evidence",
  "missing_visual_evidence",
  "self_reported_only",
  "low_confidence",
  "review_required_not_allowed",
] as const;