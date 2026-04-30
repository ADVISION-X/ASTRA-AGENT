import type { ScreenshotArtifactPort } from "../ports/screenshot-artifact-port.js";
import type { ScreenshotCapturePort } from "../ports/screenshot-capture-port.js";
import type { ScreenshotClockPort } from "../ports/screenshot-clock-port.js";
import type { ScreenshotImageProcessingPort } from "../ports/screenshot-image-processing-port.js";
import { DEFAULT_AI_INPUT_MAX_WIDTH } from "../shared/screenshot-policy.js";

export type ScreenshotRuntimeContext = {
  capturePort: ScreenshotCapturePort;
  artifactPort: ScreenshotArtifactPort;
  imageProcessingPort: ScreenshotImageProcessingPort;
  clockPort: ScreenshotClockPort;
  defaultAiMaxWidth: number;
};

export type CreateScreenshotAbilityGroupInput = {
  capturePort: ScreenshotCapturePort;
  artifactPort: ScreenshotArtifactPort;
  imageProcessingPort: ScreenshotImageProcessingPort;
  clockPort: ScreenshotClockPort;
  defaultAiMaxWidth?: number;
};

export function createScreenshotRuntimeContext(input: CreateScreenshotAbilityGroupInput): ScreenshotRuntimeContext {
  return {
    capturePort: input.capturePort,
    artifactPort: input.artifactPort,
    imageProcessingPort: input.imageProcessingPort,
    clockPort: input.clockPort,
    defaultAiMaxWidth: input.defaultAiMaxWidth ?? DEFAULT_AI_INPUT_MAX_WIDTH,
  };
}