export const OPEN_ABILITY_GROUP_ID = "open" as const;

export const OPEN_CHILD_CAPABILITY_IDS = [
  "open-tiktok",
  "open-facebook",
  "open-local-workbench",
  "open-local-program",
] as const;

export const OPEN_PLATFORM_IDS = [
  "tiktok-web",
  "facebook-web",
  "local-workbench",
  "macos-local",
] as const;

export const TIKTOK_PLATFORM_ID = "tiktok-web" as const;
export const DEFAULT_TIKTOK_URL = "https://www.tiktok.com/foryou";

export const OPEN_TARGET_KINDS = [
  "platform-feed",
  "local-workbench",
  "local-program",
] as const;

export const OPEN_ALLOWED_CALLERS = [
  "orchestration",
  "nerve-bus",
] as const;

export const OPEN_POST_OPEN_CLASSIFICATIONS = [
  "browser_navigation_observation",
  "session_reuse_observation",
  "local_program_observation",
  "navigation_failure_observation",
] as const;
