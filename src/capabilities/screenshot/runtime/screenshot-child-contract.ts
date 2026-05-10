import type { z } from "zod";

import type {
  ScreenshotAbilityInput,
  ScreenshotBoundingBox,
  ScreenshotChildCapabilityId,
  ScreenshotCoordinateSpace,
  ScreenshotImageKind,
  ScreenshotSourceProof,
} from "../contract.js";
import type {
  ScreenshotCapturePortBrowserCapture,
  ScreenshotCapturePortDesktopCapture,
} from "../ports/screenshot-capture-port.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";

export type ScreenshotChildRegistryEntry = {
  childCapabilityId: ScreenshotChildCapabilityId;
  inputSchema: z.ZodType<unknown>;
  outputSchema: z.ZodType<unknown>;
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
      sampleDelayMs: number | null;
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
    }
  | {
      kind: "image-processing";
      operation: "prepare-visual-mission-input";
      sourceFilePath: string;
      sourceProof: ScreenshotSourceProof;
      rowCount: number;
      columnCount: number;
    };

export type ScreenshotChildCapability<TInput extends ScreenshotAbilityInput = ScreenshotAbilityInput> = {
  childCapabilityId: ScreenshotChildCapabilityId;
  execute(input: { request: TInput; context: ScreenshotRuntimeContext }): Promise<ScreenshotExecutionPlan>;
};

export type ScreenshotRunnerCaptureResult = ScreenshotCapturePortBrowserCapture | ScreenshotCapturePortDesktopCapture;
