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
import type { ScreenshotClockPort } from "./ports/screenshot-clock-port.js";
import type {
  ScreenshotCapturePort,
  ScreenshotCapturePortBrowserCapture,
  ScreenshotCapturePortDesktopCapture,
} from "./ports/screenshot-capture-port.js";
import type { ScreenshotArtifactPort } from "./ports/screenshot-artifact-port.js";
import type { ScreenshotImageProcessingPort } from "./ports/screenshot-image-processing-port.js";

export { SCREENSHOT_ABILITY_GROUP_ID } from "./shared/screenshot-types.js";

export type ScreenshotAbilityGroupId = typeof SCREENSHOT_ABILITY_GROUP_ID;
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

export type ScreenshotAbilityContext = {
  capturePort: ScreenshotCapturePort;
  artifactPort: ScreenshotArtifactPort;
  imageProcessingPort: ScreenshotImageProcessingPort;
  clockPort: ScreenshotClockPort;
  defaultAiMaxWidth: number;
};

export type ScreenshotChildRegistryEntry = {
  childCapabilityId: ScreenshotChildCapabilityId;
  inputSchema: typeof ScreenshotAbilityInputSchema;
  outputSchema: typeof ScreenshotExecutionOutputSchema;
  requiresBrowserSession: boolean;
  requiresPageStateProof: boolean;
  requiresPrivacyApproval: boolean;
  requiresSourceProof: boolean;
  requiresArtifactStorage: boolean;
  maxDurationMs: number;
  idempotencyPolicy: "strict" | "content-addressed";
  outputImageKind: ScreenshotImageKind;
  coordinateSpacePolicy: ScreenshotCoordinateSpace | "derived";
};

export type ScreenshotClockSnapshot = {
  startedAt: string;
  startedMonotonicMs: number;
};

export type ScreenshotExecutionPlan =
  | {
      kind: "capture";
      operation: "browser-viewport";
      regionLabel: string;
      contentLines: string[];
    }
  | {
      kind: "capture";
      operation: "desktop-screen";
      screenId: string;
    }
  | {
      kind: "image-processing";
      operation: "capture-region";
      sourceFilePath: string;
      sourceProof: ScreenshotSourceProof;
      region: ScreenshotBoundingBox;
    }
  | {
      kind: "image-processing";
      operation: "optimize-lossless";
      sourceFilePath: string;
      sourceProof: ScreenshotSourceProof;
    }
  | {
      kind: "image-processing";
      operation: "prepare-ai-input";
      sourceFilePath: string;
      sourceProof: ScreenshotSourceProof;
      region: ScreenshotBoundingBox | null;
      maxAiWidth: number;
    };

export type ScreenshotChildCapability<TInput extends ScreenshotAbilityInput = ScreenshotAbilityInput> = {
  childCapabilityId: ScreenshotChildCapabilityId;
  execute(input: { request: TInput; context: ScreenshotAbilityContext }): Promise<ScreenshotExecutionPlan>;
};

export interface ScreenshotAbilityGroup {
  listChildCapabilityIds(): ScreenshotChildCapabilityId[];
  execute(input: ScreenshotAbilityInput): Promise<ScreenshotAbilityResult>;
  captureBrowserViewport(input: {
    sessionId: string;
    roundId?: string | null;
    videoVisitId?: string | null;
    missionId?: string | null;
    runId?: string | null;
    requestedBy: string;
    purpose: string;
    maxAiWidth?: number | null;
    preservePixels?: boolean;
    evidencePolicy?: CaptureBrowserViewportInput["evidencePolicy"];
    region?: null;
    contentLines?: string[];
    source?: CaptureBrowserViewportInput["source"];
    pageStateProof?: ScreenshotPageStateProof | null;
    sourceAbilityGroupId?: string;
    sourceChildCapabilityId?: string | null;
    sourceProof?: ScreenshotSourceProof | null;
    privacyPolicy?: ScreenshotPrivacyPolicy;
    capturePolicy?: CaptureBrowserViewportInput["capturePolicy"];
    idempotencyKey?: string | null;
  }): Promise<ScreenshotAbilityResult>;
  captureDesktopScreen(input: {
    sessionId: string;
    roundId?: string | null;
    videoVisitId?: string | null;
    missionId?: string | null;
    runId?: string | null;
    requestedBy: string;
    purpose: string;
    maxAiWidth?: number | null;
    preservePixels?: boolean;
    evidencePolicy?: CaptureDesktopScreenInput["evidencePolicy"];
    region?: null;
    contentLines?: string[];
    source?: CaptureDesktopScreenInput["source"];
    sourceAbilityGroupId?: string;
    sourceChildCapabilityId?: string | null;
    sourceProof?: ScreenshotSourceProof | null;
    privacyPolicy?: ScreenshotPrivacyPolicy;
    capturePolicy?: CaptureDesktopScreenInput["capturePolicy"];
    idempotencyKey?: string | null;
  }): Promise<ScreenshotAbilityResult>;
  captureRegion(input: Omit<CaptureRegionInput, "childCapabilityId" | "abilityGroupId">): Promise<ScreenshotAbilityResult>;
  optimizeLossless(input: Omit<OptimizeLosslessInput, "childCapabilityId" | "abilityGroupId">): Promise<ScreenshotAbilityResult>;
  prepareAiInput(input: Omit<PrepareAiInputInput, "childCapabilityId" | "abilityGroupId">): Promise<ScreenshotAbilityResult>;
}

export type CreateScreenshotAbilityGroupInput = {
  capturePort: ScreenshotCapturePort;
  artifactPort: ScreenshotArtifactPort;
  imageProcessingPort: ScreenshotImageProcessingPort;
  clockPort: ScreenshotClockPort;
  defaultAiMaxWidth?: number;
};

export type ScreenshotRunnerCaptureResult = ScreenshotCapturePortBrowserCapture | ScreenshotCapturePortDesktopCapture;
