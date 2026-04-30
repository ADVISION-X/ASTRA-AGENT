export const MOUSE_CLICK_PROOF = {
	GEOMETRY_DECISIONS: ["allow", "block"] as const,
	POLICY_DECISIONS: ["allow", "block", "review_required", "duplicate_review_required"] as const,
	SAFETY_DECISIONS: ["allow", "block"] as const,
	PRIMITIVE_DECISIONS: ["not_run", "succeeded", "failed", "threw", "aborted"] as const,
	IDEMPOTENCY_DECISIONS: ["reserved", "duplicate_review_required", "cooldown_blocked"] as const,
	TIMEOUT_DECISIONS: ["within_limit", "timed_out"] as const,
	ABORT_DECISIONS: ["not_requested", "timeout_abort_requested"] as const,
	CIRCUIT_BREAKER_STATES: ["closed", "open"] as const,
	VERIFICATION_REF_POLICY: "geometry_guard_proof_ref+source_target_ref+action_execution_ref" as const,
	CLOCK_KIND: "system-monotonic-clock" as const,
} as const;