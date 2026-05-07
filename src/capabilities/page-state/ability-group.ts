import type {
  PageStateAbilityGroup,
  PageStateAbilityInput,
  PageStateChildCapabilityId,
} from "./contract.js";
import { PageStateAbilityInputSchema } from "./contract.js";
import { executePageState } from "./runtime/page-state-executor.js";
import { createInvalidPageStateInputResult, createPageStateFailureResult } from "./runtime/page-state-result-builders.js";
import type { PageStateRuntimeContext } from "./runtime/page-state-runtime-context.js";

type CallInput = Omit<PageStateAbilityInput, "childCapabilityId">;

async function executePageStateChildCapability(context: PageStateRuntimeContext, childCapabilityId: PageStateChildCapabilityId, callInput: CallInput) {
  const parsedInput = PageStateAbilityInputSchema.safeParse({ childCapabilityId, ...callInput });
  if (!parsedInput.success) {
    return createInvalidPageStateInputResult({
      rawInput: { childCapabilityId, ...callInput },
      issues: parsedInput.error.issues,
      clock: context.clock,
    });
  }

  const capability = context.registry.get(childCapabilityId);
  if (!capability) {
    return createPageStateFailureResult({
      request: parsedInput.data,
      failureReason: "child_not_registered",
      reviewRequiredReason: null,
      status: "failed",
      clock: context.clock,
    });
  }

  return executePageState({
    request: parsedInput.data,
    childCapability: capability,
    clock: context.clock,
  });
}

export function createPageStateAbilityGroup(context: PageStateRuntimeContext): PageStateAbilityGroup {
  return {
    listChildCapabilityIds() {
      return [...context.registry.keys()] as PageStateChildCapabilityId[];
    },
    execute(input) {
      return executePageStateChildCapability(context, input.childCapabilityId, input);
    },
  };
}