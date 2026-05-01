import type {
  PageStateAbilityGroup,
  PageStateAbilityInput,
  PageStateChildCapabilityId,
} from "./contract.js";
import { PageStateAbilityInputSchema } from "./contract.js";
import { dispatchInvalidPageStateInput, dispatchPageStateFailure } from "./runtime/page-state-dispatch-failure.js";
import { executePageState } from "./runtime/page-state-executor.js";
import type { PageStateRuntimeContext } from "./runtime/page-state-runtime-context.js";

type CallInput = Omit<PageStateAbilityInput, "childCapabilityId">;

async function executePageStateChildCapability(context: PageStateRuntimeContext, childCapabilityId: PageStateChildCapabilityId, callInput: CallInput) {
  const parsedInput = PageStateAbilityInputSchema.safeParse({ childCapabilityId, ...callInput });
  if (!parsedInput.success) {
    return dispatchInvalidPageStateInput({
      rawInput: { childCapabilityId, ...callInput },
      issues: parsedInput.error.issues,
      clock: context.clock,
    });
  }

  const capability = context.registry.get(childCapabilityId);
  if (!capability) {
    return dispatchPageStateFailure({
      request: parsedInput.data,
      failureReason: "child_not_registered",
      stateSummary: `Page State child capability ${childCapabilityId} is not registered.`,
      status: "failed",
      decision: "fail",
      clock: context.clock,
    });
  }

  return executePageState({
    request: parsedInput.data,
    childCapability: capability,
    clock: context.clock,
    profilePort: context.profilePort,
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