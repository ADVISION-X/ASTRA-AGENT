import type { z } from "zod";

import {
  CaptureBrowserViewportInputSchema,
  CaptureDesktopScreenInputSchema,
  CaptureRegionInputSchema,
  OptimizeLosslessInputSchema,
  PrepareAiInputInputSchema,
  ScreenshotAbilityInputSchema,
  ScreenshotArtifactRefSchema,
  ScreenshotArtifactBudgetPolicySchema,
  ScreenshotArtifactBudgetSnapshotSchema,
  ScreenshotArtifactCleanupGateSchema,
  ScreenshotArtifactLifecycleManifestSchema,
  ScreenshotBoundingBoxSchema,
  ScreenshotBrowserCaptureSchema,
  ScreenshotBrowserSessionSnapshotSchema,
  ScreenshotDesktopCaptureSchema,
  ScreenshotExecutionOutputSchema,
  ScreenshotFailureSchema,
  ScreenshotPageStateProofSchema,
  ScreenshotPromotionStatusSchema,
  ScreenshotPrivacyPolicySchema,
  ScreenshotRetentionClassSchema,
  ScreenshotResultSchema,
  ScreenshotRuntimeProofSchema,
  ScreenshotScaleMappingSchema,
  ScreenshotStoredArtifactSchema,
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
type ScreenshotArtifactBudgetPolicy = z.infer<typeof ScreenshotArtifactBudgetPolicySchema>;
type ScreenshotArtifactBudgetSnapshot = z.infer<typeof ScreenshotArtifactBudgetSnapshotSchema>;
type ScreenshotArtifactCleanupGate = z.infer<typeof ScreenshotArtifactCleanupGateSchema>;
type ScreenshotArtifactLifecycleManifest = z.infer<typeof ScreenshotArtifactLifecycleManifestSchema>;
type ScreenshotBoundingBox = z.infer<typeof ScreenshotBoundingBoxSchema>;
type ScreenshotScaleMapping = z.infer<typeof ScreenshotScaleMappingSchema>;
type ScreenshotSourceProof = z.infer<typeof ScreenshotSourceProofSchema>;
type ScreenshotFailure = z.infer<typeof ScreenshotFailureSchema>;
type ScreenshotPageStateProof = z.infer<typeof ScreenshotPageStateProofSchema>;
type ScreenshotPromotionStatus = z.infer<typeof ScreenshotPromotionStatusSchema>;
type ScreenshotPrivacyPolicy = z.infer<typeof ScreenshotPrivacyPolicySchema>;
type ScreenshotRetentionClass = z.infer<typeof ScreenshotRetentionClassSchema>;
type ScreenshotBrowserSessionSnapshot = z.infer<typeof ScreenshotBrowserSessionSnapshotSchema>;
type ScreenshotBrowserCapture = z.infer<typeof ScreenshotBrowserCaptureSchema>;
type ScreenshotDesktopCapture = z.infer<typeof ScreenshotDesktopCaptureSchema>;
type ScreenshotStoredArtifact = z.infer<typeof ScreenshotStoredArtifactSchema>;
type ScreenshotChildCapabilityId = ScreenshotAbilityInput["childCapabilityId"];
type ScreenshotStatus = ScreenshotAbilityResult["status"];
type ScreenshotCoordinateSpace = ScreenshotExecutionOutput["coordinateSpace"];
type ScreenshotImageKind = ScreenshotExecutionOutput["imageKind"];

interface ScreenshotAbilityGroup {
  listChildCapabilityIds(): ScreenshotChildCapabilityId[];
  execute(input: ScreenshotAbilityInputCandidate): Promise<ScreenshotAbilityResult>;
}


export type { ScreenshotAbilityGroupId, ScreenshotAbilityInputCandidate, ScreenshotAbilityInput, CaptureBrowserViewportInput, CaptureDesktopScreenInput, CaptureRegionInput, OptimizeLosslessInput, PrepareAiInputInput, ScreenshotAbilityResult, ScreenshotRuntimeProof, ScreenshotExecutionOutput, ScreenshotArtifactRef, ScreenshotArtifactBudgetPolicy, ScreenshotArtifactBudgetSnapshot, ScreenshotArtifactCleanupGate, ScreenshotArtifactLifecycleManifest, ScreenshotBoundingBox, ScreenshotScaleMapping, ScreenshotSourceProof, ScreenshotFailure, ScreenshotPageStateProof, ScreenshotPromotionStatus, ScreenshotPrivacyPolicy, ScreenshotRetentionClass, ScreenshotBrowserSessionSnapshot, ScreenshotBrowserCapture, ScreenshotDesktopCapture, ScreenshotStoredArtifact, ScreenshotChildCapabilityId, ScreenshotStatus, ScreenshotCoordinateSpace, ScreenshotImageKind, ScreenshotAbilityGroup };
