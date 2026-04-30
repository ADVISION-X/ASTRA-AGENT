export const TEXT_INPUT_PROOF = {
	POLICY_DECISIONS: ["allow", "block", "review_required"] as const,
	PRIMITIVE_DECISIONS: ["not_run", "started", "succeeded", "failed", "aborted", "timed_out"] as const,
	CLIPBOARD_DECISIONS: ["not_used", "snapshot_captured", "prepared", "restored", "cleared", "failed"] as const,
	SENSITIVE_TEXT_DECISIONS: ["allowed", "blocked", "review_required"] as const,
	REDACTION_DECISIONS: ["masked", "hash_only", "none"] as const,
	KEY_POLICY_DECISIONS: ["allowed", "blocked_enter", "blocked_modifier", "blocked_unknown"] as const,
	OUTPUT_BOUNDARY_DECISIONS: ["valid", "invalid_success_payload", "invalid_failure_payload", "review_required_clipboard_restore_failed"] as const,
	CLOCK_KIND: "system-monotonic-clock" as const,
	VERIFICATION_REF_POLICY: "target_proof_ref+focus_proof_ref+approved_text_ref+action_execution_ref" as const,
} as const;