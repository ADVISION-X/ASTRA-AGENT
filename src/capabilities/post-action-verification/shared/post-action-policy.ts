export const POST_ACTION_VERIFICATION_MODES = [
  "strict",
  "evidence-weighted",
  "review-on-ambiguous",
] as const;

export const POST_ACTION_VERIFICATION_DECISIONS = [
  "verified",
  "failed",
  "review_required",
] as const;