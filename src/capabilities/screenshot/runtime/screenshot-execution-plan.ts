import type { ScreenshotExecutionPlan } from "./screenshot-child-contract.js";
import type { ScreenshotAbilityInput } from "../contract.js";
import { executeRegisteredScreenshotChildPlan } from "./screenshot-child-registry.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";

export async function executeScreenshotChildPlan(input: {
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  resolvedMaxAiWidth: number | null;
}): Promise<ScreenshotExecutionPlan | null> {
  return executeRegisteredScreenshotChildPlan(input);
}
