import type { OrchestrationChildCapability } from "../../internal.js";
import type { ExecuteRuntimeStepChildInput, ExecuteRuntimeStepChildOutput } from "../../contract.js";
import { buildFailureExecuteResult } from "../../runtime/orchestration-execute-result.js";

export function createExecuteRuntimeStepCapability(): OrchestrationChildCapability<ExecuteRuntimeStepChildInput, ExecuteRuntimeStepChildOutput> {
  return {
    abilityGroupId: "orchestration",
    childCapabilityId: "execute-runtime-step",
    execute(input, context) {
      const now = context.clock.now().isoTimestamp;
      return Promise.resolve(buildFailureExecuteResult({
        missionId: input.missionId,
        requestedPlatform: null,
        humanGoal: null,
        childCapabilityId: "execute-runtime-step",
        caller: "orchestration",
        startedAt: now,
        endedAt: now,
        failureReason: "execute-runtime-step is an internal orchestration loop operation and cannot be invoked through the public execute boundary.",
        internalOperationKind: "execute-runtime-step",
        dataQualityFlags: ["internal_child_public_call"],
      }));
    },
  };
}