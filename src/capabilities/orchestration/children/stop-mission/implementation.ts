import type { OrchestrationChildCapability } from "../../internal.js";
import type { StopMissionChildInput, StopMissionChildOutput } from "../../contract.js";
import { stopMissionCommand } from "../../runtime/orchestration-executor.js";

export function createStopMissionCapability(): OrchestrationChildCapability<StopMissionChildInput, StopMissionChildOutput> {
  return {
    abilityGroupId: "orchestration",
    childCapabilityId: "stop-mission",
    execute(input, context) {
      return stopMissionCommand({ command: input, context });
    },
  };
}
