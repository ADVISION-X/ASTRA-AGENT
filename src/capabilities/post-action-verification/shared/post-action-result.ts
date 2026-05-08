export const POST_ACTION_VERIFICATION_STATUSES = ["success", "failed", "review_required"] as const;

export const POST_ACTION_FAILURE_REASONS = [
  "input_schema_invalid",
  "unknown_child_capability",
  "child_execution_failed",
  "missing_observation_support",
  "insufficient_evidence",
  "output_boundary_violation",
] as const;