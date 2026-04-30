import type { z } from "zod";

import {
  CaptureBrowserViewportInputSchema,
  CaptureDesktopScreenInputSchema,
  CaptureRegionInputSchema,
  OptimizeLosslessInputSchema,
  PrepareAiInputInputSchema,
  ScreenshotAbilityInputSchema,
  ScreenshotArtifactRefSchema,
  ScreenshotBoundingBoxSchema,
  ScreenshotBrowserCaptureSchema,
  ScreenshotBrowserSessionSnapshotSchema,
  ScreenshotDesktopCaptureSchema,
  ScreenshotExecutionOutputSchema,
  ScreenshotFailureSchema,
  ScreenshotPageStateProofSchema,
  ScreenshotPrivacyPolicySchema,
  ScreenshotResultSchema,
  ScreenshotRuntimeProofSchema,
  ScreenshotScaleMappingSchema,
  ScreenshotSourceProofSchema,
} from "./schema.js";
import { SCREENSHOT_ABILITY_GROUP_ID } from "./shared/screenshot-types.js";

export { SCREENSHOT_ABILITY_GROUP_ID } from "./shared/screenshot-types.js";

export type ScreenshotAbilityGroupId = typeof SCREENSHOT_ABILITY_GROUP_ID;
export type ScreenshotAbilityInputCandidate = z.input<typeof ScreenshotAbilityInputSchema>;
export type ScreenshotAbilityInput = z.infer<typeof ScreenshotAbilityInputSchema>;
export type CaptureBrowserViewportInput = z.infer<typeof CaptureBrowserViewportInputSchema>;
export type CaptureDesktopScreenInput = z.infer<typeof CaptureDesktopScreenInputSchema>;
export type CaptureRegionInput = z.infer<typeof CaptureRegionInputSchema>;
export type OptimizeLosslessInput = z.infer<typeof OptimizeLosslessInputSchema>;
export type PrepareAiInputInput = z.infer<typeof PrepareAiInputInputSchema>;
export type ScreenshotAbilityResult = z.infer<typeof ScreenshotResultSchema>;
export type ScreenshotRuntimeProof = z.infer<typeof ScreenshotRuntimeProofSchema>;
export type ScreenshotExecutionOutput = z.infer<typeof ScreenshotExecutionOutputSchema>;
export type ScreenshotArtifactRef = z.infer<typeof ScreenshotArtifactRefSchema>;
export type ScreenshotBoundingBox = z.infer<typeof ScreenshotBoundingBoxSchema>;
export type ScreenshotScaleMapping = z.infer<typeof ScreenshotScaleMappingSchema>;
export type ScreenshotSourceProof = z.infer<typeof ScreenshotSourceProofSchema>;
export type ScreenshotFailure = z.infer<typeof ScreenshotFailureSchema>;
export type ScreenshotPageStateProof = z.infer<typeof ScreenshotPageStateProofSchema>;
export type ScreenshotPrivacyPolicy = z.infer<typeof ScreenshotPrivacyPolicySchema>;
export type ScreenshotBrowserSessionSnapshot = z.infer<typeof ScreenshotBrowserSessionSnapshotSchema>;
export type ScreenshotBrowserCapture = z.infer<typeof ScreenshotBrowserCaptureSchema>;
export type ScreenshotDesktopCapture = z.infer<typeof ScreenshotDesktopCaptureSchema>;
export type ScreenshotChildCapabilityId = ScreenshotAbilityInput["childCapabilityId"];
export type ScreenshotStatus = ScreenshotAbilityResult["status"];
export type ScreenshotCoordinateSpace = ScreenshotExecutionOutput["coordinateSpace"];
export type ScreenshotImageKind = ScreenshotExecutionOutput["imageKind"];

export interface ScreenshotAbilityGroup {
  listChildCapabilityIds(): ScreenshotChildCapabilityId[];
  execute(input: ScreenshotAbilityInputCandidate): Promise<ScreenshotAbilityResult>;
}
