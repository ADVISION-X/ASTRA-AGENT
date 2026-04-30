import type { OrchestrationChildCapability } from "../../internal.js";
import type { StartMissionChildInput, StartMissionChildOutput } from "../../contract.js";
import { executeMissionCommand } from "../../runtime/orchestration-executor.js";

export function createStartMissionCapability(): OrchestrationChildCapability<StartMissionChildInput, StartMissionChildOutput> {
  return {
    abilityGroupId: "orchestration",
    childCapabilityId: "start-mission",
    async execute(input, context) {
      const result = await executeMissionCommand({ command: input, caller: "commander-console", context });
      return result.stateSnapshot;
    },
  };
}
