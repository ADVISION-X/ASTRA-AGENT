import {
  ScreenshotAbilityInputSchema,
  CaptureBrowserViewportInputSchema,
  CaptureDesktopScreenInputSchema,
  CaptureRegionInputSchema,
  OptimizeLosslessInputSchema,
  PrepareAiInputInputSchema,
} from "./schema.js";
import type { CreateScreenshotAbilityGroupInput, ScreenshotAbilityGroup, ScreenshotAbilityInput, ScreenshotChildCapabilityId } from "./contract.js";
import { DEFAULT_AI_INPUT_MAX_WIDTH } from "./shared/screenshot-policy.js";
import { listScreenshotChildren } from "./registry.js";
import { executeScreenshotRequest } from "./runtime/screenshot-executor.js";

export function createScreenshotAbilityGroup(input: CreateScreenshotAbilityGroupInput): ScreenshotAbilityGroup {
  const context = {
    capturePort: input.capturePort,
    artifactPort: input.artifactPort,
    imageProcessingPort: input.imageProcessingPort,
    clockPort: input.clockPort,
    defaultAiMaxWidth: input.defaultAiMaxWidth ?? DEFAULT_AI_INPUT_MAX_WIDTH,
  };

  const run = async (candidate: ScreenshotAbilityInput) => executeScreenshotRequest({
    request: ScreenshotAbilityInputSchema.parse(candidate),
    context,
  });

  const call = async <TInput extends ScreenshotAbilityInput>(childCapabilityId: ScreenshotChildCapabilityId, candidate: Omit<TInput, "childCapabilityId">) => {
    return run({ ...candidate, childCapabilityId } as ScreenshotAbilityInput);
  };

  return {
    listChildCapabilityIds() {
      return listScreenshotChildren();
    },
    execute(inputValue) {
      return run(inputValue);
    },
    captureBrowserViewport(inputValue) {
      return call("capture-browser-viewport", CaptureBrowserViewportInputSchema.parse({
        ...inputValue,
        childCapabilityId: "capture-browser-viewport",
      }));
    },
    captureDesktopScreen(inputValue) {
      return call("capture-desktop-screen", CaptureDesktopScreenInputSchema.parse({
        ...inputValue,
        childCapabilityId: "capture-desktop-screen",
      }));
    },
    captureRegion(inputValue) {
      return call("capture-region", CaptureRegionInputSchema.parse({
        ...inputValue,
        childCapabilityId: "capture-region",
      }));
    },
    optimizeLossless(inputValue) {
      return call("optimize-lossless", OptimizeLosslessInputSchema.parse({
        ...inputValue,
        childCapabilityId: "optimize-lossless",
      }));
    },
    prepareAiInput(inputValue) {
      return call("prepare-ai-input", PrepareAiInputInputSchema.parse({
        ...inputValue,
        childCapabilityId: "prepare-ai-input",
      }));
    },
  };
}
