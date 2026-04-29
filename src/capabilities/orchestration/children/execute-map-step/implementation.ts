import type { OrchestrationChildCapability, ExecuteMapStepChildInput, ExecuteMapStepChildOutput } from "../../contract.js";
import { resumeMissionCommand } from "../../runtime/orchestration-executor.js";

export function createExecuteMapStepCapability(): OrchestrationChildCapability<ExecuteMapStepChildInput, ExecuteMapStepChildOutput> {
  return {
    abilityGroupId: "orchestration",
    childCapabilityId: "execute-map-step",
    execute(input, context) {
      return resumeMissionCommand({ command: { missionId: input.missionId }, caller: "orchestration", context });
    },
  };
}
