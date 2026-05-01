import type { PrepareAiInputInput, ScreenshotAbilityInput } from "../contract.js";
import { captureBrowserViewportChildCapability } from "../children/capture-browser-viewport/implementation.js";
import { captureDesktopScreenChildCapability } from "../children/capture-desktop-screen/implementation.js";
import { captureRegionChildCapability } from "../children/capture-region/implementation.js";
import { optimizeLosslessChildCapability } from "../children/optimize-lossless/implementation.js";
import { prepareAiInputChildCapability } from "../children/prepare-ai-input/implementation.js";
import type { ScreenshotExecutionPlan } from "./screenshot-child-contract.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";

const screenshotChildPlanExecutors = {
  "capture-browser-viewport": captureBrowserViewportChildCapability.execute,
  "capture-desktop-screen": captureDesktopScreenChildCapability.execute,
  "capture-region": captureRegionChildCapability.execute,
  "optimize-lossless": optimizeLosslessChildCapability.execute,
  "prepare-ai-input": (input: {
    request: PrepareAiInputInput;
    context: ScreenshotRuntimeContext;
    resolvedMaxAiWidth: number | null;
  }) => prepareAiInputChildCapability.execute({
    request: {
      ...input.request,
      maxAiWidth: input.resolvedMaxAiWidth,
    },
    context: input.context,
  }),
} as const;

export async function executeScreenshotChildPlan(input: {
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  resolvedMaxAiWidth: number | null;
}): Promise<ScreenshotExecutionPlan | null> {
  switch (input.request.childCapabilityId) {
    case "capture-browser-viewport":
      return screenshotChildPlanExecutors["capture-browser-viewport"]({ request: input.request, context: input.context });
    case "capture-desktop-screen":
      return screenshotChildPlanExecutors["capture-desktop-screen"]({ request: input.request, context: input.context });
    case "capture-region":
      return screenshotChildPlanExecutors["capture-region"]({ request: input.request, context: input.context });
    case "optimize-lossless":
      return screenshotChildPlanExecutors["optimize-lossless"]({ request: input.request, context: input.context });
    case "prepare-ai-input":
      return screenshotChildPlanExecutors["prepare-ai-input"]({
        request: input.request,
        context: input.context,
        resolvedMaxAiWidth: input.resolvedMaxAiWidth,
      });
    default:
      return null;
  }
}
