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

export const OPEN_TARGET_KINDS = [
  "platform-feed",
  "local-workbench",
] as const;

export const OPEN_POST_OPEN_CLASSIFICATIONS = [
  "platform_feed",
  "local_workbench",
  "wrong_domain",
  "login_wall",
  "security_wall",
  "blank_page",
  "unexpected_redirect",
  "unknown",
] as const;