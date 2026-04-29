export const OPEN_CLOCK_KIND = "open-clock-port" as const;

export const OPEN_NAVIGATION_DECISION_STATUSES = [
  "navigated",
  "already_on_target",
  "timeout",
  "browser_failed",
  "review_required",
] as const;

export const OPEN_TARGET_POLICY_DECISION_STATUSES = [
  "allow",
  "block",
] as const;

export const OPEN_URL_SAFETY_DECISION_STATUSES = [
  "allow",
  "block",
] as const;

export const OPEN_SESSION_DECISION_STATUSES = [
  "allow",
  "block",
  "review_required",
] as const;