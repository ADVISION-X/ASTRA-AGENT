import type { BrowserController } from "../../lib/browser/browser-controller.js";
import { createScreenshotCapabilityRegistry } from "./registry.js";
import { DEFAULT_AI_INPUT_MAX_WIDTH, type ScreenshotAbilityGroup, type ScreenshotAbilityInput, type ScreenshotChildCapabilityId } from "./contract.js";

type CreateScreenshotAbilityGroupInput = {
  browserController: BrowserController;
  outputRootDir: string;
  defaultAiMaxWidth?: number;
};

type CallInput = Omit<ScreenshotAbilityInput, "childCapabilityId">;

export function createScreenshotAbilityGroup(input: CreateScreenshotAbilityGroupInput): ScreenshotAbilityGroup {
  const registry = createScreenshotCapabilityRegistry();
  const context = {
    browserController: input.browserController,
    outputRootDir: input.outputRootDir,
    defaultAiMaxWidth: input.defaultAiMaxWidth ?? DEFAULT_AI_INPUT_MAX_WIDTH,
  };

  const executeById = async (childCapabilityId: ScreenshotChildCapabilityId, callInput: CallInput) => {
    const capability = registry.get(childCapabilityId);
    if (!capability) {
      throw new Error(`Screenshot child capability is not registered for ${childCapabilityId}`);
    }

    return capability.execute({ childCapabilityId, ...callInput }, context);
  };

  return {
    listChildCapabilityIds() {
      return [...registry.keys()];
    },
    execute(inputValue) {
      return executeById(inputValue.childCapabilityId, inputValue);
    },
    captureBrowserViewport(callInput) {
      return executeById("capture-browser-viewport", {
        ...callInput,
        source: callInput.source ?? { kind: "browser_viewport" },
      });
    },
    captureDesktopScreen(callInput) {
      return executeById("capture-desktop-screen", {
        ...callInput,
        source: callInput.source ?? { kind: "desktop_screen", screenId: "primary" },
      });
    },
    captureRegion(callInput) {
      return executeById("capture-region", callInput);
    },
    optimizeLossless(callInput) {
      return executeById("optimize-lossless", callInput);
    },
    prepareAiInput(callInput) {
      return executeById("prepare-ai-input", callInput);
    },
  };
}