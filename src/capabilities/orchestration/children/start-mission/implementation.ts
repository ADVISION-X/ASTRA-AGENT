import type { OrchestrationChildCapability } from "../../internal.js";
import type { StartMissionChildInput, StartMissionChildOutput } from "../../contract.js";
import { executeMissionCommand } from "../../runtime/orchestration-executor.js";

export function createStartMissionCapability(): OrchestrationChildCapability<StartMissionChildInput, StartMissionChildOutput> {
  return {
    abilityGroupId: "orchestration",
    childCapabilityId: "start-mission",
    execute(input, context) {
      return executeMissionCommand({ command: input, caller: "commander-console", context });
    },
  };
}
