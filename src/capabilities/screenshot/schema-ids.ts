export const SCREENSHOT_ABILITY_GROUP_ID = "screenshot" as const;

export const SCREENSHOT_CHILD_IDS = [
  "capture-browser-viewport",
  "capture-grid-region",
  "render-coordinate-grid",
] as const;

export type ScreenshotChildId = (typeof SCREENSHOT_CHILD_IDS)[number];

export const SCREENSHOT_STATUSES = [
  "success",
  "failed",
  "review_required",
] as const;

export type ScreenshotStatus = (typeof SCREENSHOT_STATUSES)[number];
