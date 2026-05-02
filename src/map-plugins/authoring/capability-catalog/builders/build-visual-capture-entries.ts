import type { CapabilityCatalogEntry } from "../schema.js";
import { buildScreenshotCaptureEntries } from "./build-screenshot-capture-entries.js";
import { buildVisualTargetCaptureEntries } from "./build-visual-target-capture-entries.js";

export const buildVisualCaptureEntries = (): CapabilityCatalogEntry[] => [
  ...buildScreenshotCaptureEntries(),
  ...buildVisualTargetCaptureEntries(),
];