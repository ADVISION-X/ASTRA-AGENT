import { SCREENSHOT_CHILD_IDS, type ScreenshotChildId } from "./schema-ids.js";

export function listScreenshotChildren(): readonly ScreenshotChildId[] {
  return SCREENSHOT_CHILD_IDS;
}
