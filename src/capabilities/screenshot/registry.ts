import { SCREENSHOT_CHILD_IDS, type ScreenshotChildId } from "./schema.js";

export function listScreenshotChildren(): readonly ScreenshotChildId[] {
  return SCREENSHOT_CHILD_IDS;
}
