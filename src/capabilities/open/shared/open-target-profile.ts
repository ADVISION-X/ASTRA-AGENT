export const OPEN_ABILITY_GROUP_ID = "open" as const;

export const OPEN_CHILD_CAPABILITY_IDS = [
  "open-tiktok",
  "open-facebook",
  "open-local-workbench",
] as const;

export const OPEN_PLATFORM_IDS = [
  "tiktok-web",
  "facebook-web",
  "local-workbench",
] as const;

export const TIKTOK_PLATFORM_ID = "tiktok-web" as const;
export const DEFAULT_TIKTOK_URL = "https://www.tiktok.com/foryou";

export const OPEN_TARGET_KINDS = [
  "platform-feed",
  "local-workbench",
] as const;

export const OPEN_ALLOWED_CALLERS = [
  "orchestration",
  "nerve-bus",
] as const;

export const OPEN_POST_OPEN_CLASSIFICATIONS = [
  "platform_feed",
  "local_workbench",
  "wrong_domain",
  "login_wall",
  "security_wall",
  "captcha_wall",
  "permission_wall",
  "blank_page",
  "unexpected_redirect",
  "unknown",
] as const;

export const OPEN_TRACE_FIELD_SOURCES = [
  "provided",
  "policy_resolved",
  "unavailable",
] as const;

export const OPEN_FAILURE_INPUT_PARSE_DECISIONS = [
  "parsed",
  "fallback_trace_only",
] as const;
