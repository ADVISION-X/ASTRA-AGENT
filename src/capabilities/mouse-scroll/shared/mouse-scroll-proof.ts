export const MOUSE_SCROLL_CLOCK_KIND = "system-monotonic-clock";
export const MOUSE_SCROLL_POLICY_DECISIONS = ["allow", "block", "review_required", "duplicate_skipped"] as const;
export const MOUSE_SCROLL_GEOMETRY_DECISIONS = ["allow", "block", "review_required"] as const;
export const MOUSE_SCROLL_PRIMITIVE_DECISIONS = ["not_run", "succeeded", "failed", "threw"] as const;
export const MOUSE_SCROLL_VERIFICATION_REF_POLICY = "required-by-post-action-verification";