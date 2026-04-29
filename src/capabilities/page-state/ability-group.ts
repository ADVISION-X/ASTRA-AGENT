import type {
  PageStateAbilityGroup,
  PageStateAbilityInput,
  PageStateChildCapabilityId,
} from "./contract.js";
import { PageStateAbilityInputSchema } from "./contract.js";
import { createPageStateRegistry } from "./registry.js";
import { dispatchInvalidPageStateInput, dispatchPageStateFailure } from "./runtime/page-state-dispatch-failure.js";
import { executePageState } from "./runtime/page-state-executor.js";
import { createSystemPageStateClock } from "./runtime/page-state-clock.js";
import { createDefaultPageStateProfilePort } from "./runtime/platform-profile-gate.js";

type CallInput = Omit<PageStateAbilityInput, "childCapabilityId">;

export function createPageStateAbilityGroup(): PageStateAbilityGroup {
  const registry = createPageStateRegistry();
  const clock = createSystemPageStateClock();
  const profilePort = createDefaultPageStateProfilePort();

  const executeById = async (childCapabilityId: PageStateChildCapabilityId, callInput: CallInput) => {
    const parsedInput = PageStateAbilityInputSchema.safeParse({ childCapabilityId, ...callInput });
    if (!parsedInput.success) {
      return dispatchInvalidPageStateInput({ rawInput: { childCapabilityId, ...callInput }, clock });
    }

    const capability = registry.get(childCapabilityId);
    if (!capability) {
      return dispatchPageStateFailure({
        request: parsedInput.data,
        failureReason: "child_not_registered",
        stateSummary: `Page State child capability ${childCapabilityId} is not registered.`,
        status: "failed",
        decision: "fail",
        clock,
      });
    }

    return executePageState({
      request: parsedInput.data,
      childCapability: capability,
      clock,
      profilePort,
    });
  };

  return {
    listChildCapabilityIds() {
      return [...registry.keys()];
    },
    execute(input) {
      return executeById(input.childCapabilityId, input);
    },
  };
}