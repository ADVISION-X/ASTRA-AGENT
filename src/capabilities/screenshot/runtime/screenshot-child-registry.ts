import type { PrepareAiInputInput, ScreenshotAbilityInput } from "../contract.js";
import { captureBrowserViewportChildCapability } from "../children/capture-browser-viewport/implementation.js";
import { captureDesktopScreenChildCapability } from "../children/capture-desktop-screen/implementation.js";
import { captureRegionChildCapability } from "../children/capture-region/implementation.js";
import { optimizeLosslessChildCapability } from "../children/optimize-lossless/implementation.js";
import { prepareAiInputChildCapability } from "../children/prepare-ai-input/implementation.js";
import type { ScreenshotChildCapability, ScreenshotExecutionPlan } from "./screenshot-child-contract.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";

const screenshotChildCapabilities = new Map<ScreenshotAbilityInput["childCapabilityId"], ScreenshotChildCapability>([
  [captureBrowserViewportChildCapability.childCapabilityId, captureBrowserViewportChildCapability],
  [captureDesktopScreenChildCapability.childCapabilityId, captureDesktopScreenChildCapability],
  [captureRegionChildCapability.childCapabilityId, captureRegionChildCapability],
  [optimizeLosslessChildCapability.childCapabilityId, optimizeLosslessChildCapability],
  [prepareAiInputChildCapability.childCapabilityId, prepareAiInputChildCapability],
]);

type ScreenshotChildPlanInput = {
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  resolvedMaxAiWidth: number | null;
};

function executePrepareAiInputPlan(input: {
  request: PrepareAiInputInput;
  context: ScreenshotRuntimeContext;
  resolvedMaxAiWidth: number | null;
}): Promise<ScreenshotExecutionPlan> {
  return prepareAiInputChildCapability.execute({
    request: {
      ...input.request,
      maxAiWidth: input.resolvedMaxAiWidth,
    },
    context: input.context,
  });
}

export const resolveScreenshotChildCapability = (
  childCapabilityId: ScreenshotAbilityInput["childCapabilityId"],
): ScreenshotChildCapability | null => screenshotChildCapabilities.get(childCapabilityId) ?? null;

export async function executeRegisteredScreenshotChildPlan(
  input: ScreenshotChildPlanInput,
): Promise<ScreenshotExecutionPlan | null> {
  let plan: ScreenshotExecutionPlan | null = null;

  switch (input.request.childCapabilityId) {
    case "capture-browser-viewport":
      plan = await captureBrowserViewportChildCapability.execute({ request: input.request, context: input.context });
      break;
    case "capture-desktop-screen":
      plan = await captureDesktopScreenChildCapability.execute({ request: input.request, context: input.context });
      break;
    case "capture-region":
      plan = await captureRegionChildCapability.execute({ request: input.request, context: input.context });
      break;
    case "optimize-lossless":
      plan = await optimizeLosslessChildCapability.execute({ request: input.request, context: input.context });
      break;
    case "prepare-ai-input":
      plan = await executePrepareAiInputPlan({
        request: input.request,
        context: input.context,
        resolvedMaxAiWidth: input.resolvedMaxAiWidth,
      });
      break;
    default:
      break;
  }

  return plan;
}