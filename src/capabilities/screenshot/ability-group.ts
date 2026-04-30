import type { ScreenshotAbilityGroup, ScreenshotAbilityInputCandidate } from "./contract.js";
import { ScreenshotAbilityInputSchema } from "./schema.js";
import { listScreenshotChildren } from "./registry.js";
import { executeScreenshotRequest } from "./runtime/screenshot-executor.js";
import { createScreenshotRuntimeContext, type CreateScreenshotAbilityGroupInput } from "./runtime/screenshot-runtime-context.js";

export function createScreenshotAbilityGroup(input: CreateScreenshotAbilityGroupInput): ScreenshotAbilityGroup {
  const context = createScreenshotRuntimeContext(input);

  const run = async (candidate: ScreenshotAbilityInputCandidate) => executeScreenshotRequest({
    request: ScreenshotAbilityInputSchema.parse(candidate),
    context,
  });

  return {
    listChildCapabilityIds() {
      return listScreenshotChildren();
    },
    execute(inputValue) {
      return run(inputValue);
    },
  };
}
