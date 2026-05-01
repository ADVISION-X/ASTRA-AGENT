import type { OrchestrationChildCapability } from "../../internal.js";
import type { ExecuteMapStepChildInput, ExecuteMapStepChildOutput } from "../../contract.js";
import { buildFailureExecuteResult } from "../../runtime/orchestration-execute-result.js";

export function createExecuteMapStepCapability(): OrchestrationChildCapability<ExecuteMapStepChildInput, ExecuteMapStepChildOutput> {
  return {
    abilityGroupId: "orchestration",
    childCapabilityId: "execute-map-step",
    execute(input, context) {
      const now = context.clock.now().isoTimestamp;
      return Promise.resolve(buildFailureExecuteResult({
        missionId: input.missionId,
        mapId: null,
        requestedPlatform: null,
        humanGoal: null,
        childCapabilityId: "execute-map-step",
        caller: "orchestration",
        startedAt: now,
        endedAt: now,
        failureReason: "execute-map-step is an internal orchestration loop operation and cannot be invoked through the public execute boundary.",
        internalOperationKind: "execute-map-step",
        dataQualityFlags: ["internal_child_public_call"],
      }));
    },
  };
}
