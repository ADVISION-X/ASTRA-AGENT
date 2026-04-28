import type { ScreenshotChildCapability, ScreenshotChildCapabilityId } from "./contract.js";
import { createCaptureBrowserViewportCapability } from "./children/capture-browser-viewport/implementation.js";
import { createCaptureDesktopScreenCapability } from "./children/capture-desktop-screen/implementation.js";
import { createCaptureRegionCapability } from "./children/capture-region/implementation.js";
import { createOptimizeLosslessCapability } from "./children/optimize-lossless/implementation.js";
import { createPrepareAiInputCapability } from "./children/prepare-ai-input/implementation.js";

export function createScreenshotCapabilityRegistry(): Map<ScreenshotChildCapabilityId, ScreenshotChildCapability> {
  return new Map<ScreenshotChildCapabilityId, ScreenshotChildCapability>([
    ["capture-browser-viewport", createCaptureBrowserViewportCapability()],
    ["capture-desktop-screen", createCaptureDesktopScreenCapability()],
    ["capture-region", createCaptureRegionCapability()],
    ["optimize-lossless", createOptimizeLosslessCapability()],
    ["prepare-ai-input", createPrepareAiInputCapability()],
  ]);
}