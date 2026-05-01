import type { ScreenshotAbilityInput } from "../contract.js";
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
    request: ScreenshotAbilityInput;
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
  const executor = screenshotChildPlanExecutors[input.request.childCapabilityId as keyof typeof screenshotChildPlanExecutors];
  return executor ? executor(input as never) : null;
}
