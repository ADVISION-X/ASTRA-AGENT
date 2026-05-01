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

type ScreenshotAbilityGroupId = typeof SCREENSHOT_ABILITY_GROUP_ID;
type ScreenshotAbilityInputCandidate = z.input<typeof ScreenshotAbilityInputSchema>;
type ScreenshotAbilityInput = z.infer<typeof ScreenshotAbilityInputSchema>;
type CaptureBrowserViewportInput = z.infer<typeof CaptureBrowserViewportInputSchema>;
type CaptureDesktopScreenInput = z.infer<typeof CaptureDesktopScreenInputSchema>;
type CaptureRegionInput = z.infer<typeof CaptureRegionInputSchema>;
type OptimizeLosslessInput = z.infer<typeof OptimizeLosslessInputSchema>;
type PrepareAiInputInput = z.infer<typeof PrepareAiInputInputSchema>;
type ScreenshotAbilityResult = z.infer<typeof ScreenshotResultSchema>;
type ScreenshotRuntimeProof = z.infer<typeof ScreenshotRuntimeProofSchema>;
type ScreenshotExecutionOutput = z.infer<typeof ScreenshotExecutionOutputSchema>;
type ScreenshotArtifactRef = z.infer<typeof ScreenshotArtifactRefSchema>;
type ScreenshotBoundingBox = z.infer<typeof ScreenshotBoundingBoxSchema>;
type ScreenshotScaleMapping = z.infer<typeof ScreenshotScaleMappingSchema>;
type ScreenshotSourceProof = z.infer<typeof ScreenshotSourceProofSchema>;
type ScreenshotFailure = z.infer<typeof ScreenshotFailureSchema>;
type ScreenshotPageStateProof = z.infer<typeof ScreenshotPageStateProofSchema>;
type ScreenshotPrivacyPolicy = z.infer<typeof ScreenshotPrivacyPolicySchema>;
type ScreenshotBrowserSessionSnapshot = z.infer<typeof ScreenshotBrowserSessionSnapshotSchema>;
type ScreenshotBrowserCapture = z.infer<typeof ScreenshotBrowserCaptureSchema>;
type ScreenshotDesktopCapture = z.infer<typeof ScreenshotDesktopCaptureSchema>;
type ScreenshotChildCapabilityId = ScreenshotAbilityInput["childCapabilityId"];
type ScreenshotStatus = ScreenshotAbilityResult["status"];
type ScreenshotCoordinateSpace = ScreenshotExecutionOutput["coordinateSpace"];
type ScreenshotImageKind = ScreenshotExecutionOutput["imageKind"];

interface ScreenshotAbilityGroup {
  listChildCapabilityIds(): ScreenshotChildCapabilityId[];
  execute(input: ScreenshotAbilityInputCandidate): Promise<ScreenshotAbilityResult>;
}


export type { ScreenshotAbilityGroupId, ScreenshotAbilityInputCandidate, ScreenshotAbilityInput, CaptureBrowserViewportInput, CaptureDesktopScreenInput, CaptureRegionInput, OptimizeLosslessInput, PrepareAiInputInput, ScreenshotAbilityResult, ScreenshotRuntimeProof, ScreenshotExecutionOutput, ScreenshotArtifactRef, ScreenshotBoundingBox, ScreenshotScaleMapping, ScreenshotSourceProof, ScreenshotFailure, ScreenshotPageStateProof, ScreenshotPrivacyPolicy, ScreenshotBrowserSessionSnapshot, ScreenshotBrowserCapture, ScreenshotDesktopCapture, ScreenshotChildCapabilityId, ScreenshotStatus, ScreenshotCoordinateSpace, ScreenshotImageKind, ScreenshotAbilityGroup };
