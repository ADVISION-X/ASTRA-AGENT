import type { PrepareAiInputInput, PrepareVisualMissionInput, ScreenshotAbilityInput } from "../contract.js";
import { captureBrowserViewportChildCapability } from "../children/capture-browser-viewport/implementation.js";
import { captureDesktopScreenChildCapability } from "../children/capture-desktop-screen/implementation.js";
import { captureRegionChildCapability } from "../children/capture-region/implementation.js";
import { optimizeLosslessChildCapability } from "../children/optimize-lossless/implementation.js";
import { prepareAiInputChildCapability } from "../children/prepare-ai-input/implementation.js";
import { prepareVisualMissionInputChildCapability } from "../children/prepare-visual-mission-input/implementation.js";
import type { ScreenshotChildCapability, ScreenshotExecutionPlan } from "./screenshot-child-contract.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";

const screenshotChildCapabilities = new Map<ScreenshotAbilityInput["childCapabilityId"], ScreenshotChildCapability>([
  [captureBrowserViewportChildCapability.childCapabilityId, captureBrowserViewportChildCapability],
  [captureDesktopScreenChildCapability.childCapabilityId, captureDesktopScreenChildCapability],
  [captureRegionChildCapability.childCapabilityId, captureRegionChildCapability],
  [optimizeLosslessChildCapability.childCapabilityId, optimizeLosslessChildCapability],
  [prepareAiInputChildCapability.childCapabilityId, prepareAiInputChildCapability],
  [prepareVisualMissionInputChildCapability.childCapabilityId, prepareVisualMissionInputChildCapability],
]);

export const resolveScreenshotChildCapability = (
  childCapabilityId: ScreenshotAbilityInput["childCapabilityId"],
): ScreenshotChildCapability | null => screenshotChildCapabilities.get(childCapabilityId) ?? null;