import type { OrchestrationChildCapability } from "../../internal.js";
import type { PauseMissionChildInput, PauseMissionChildOutput } from "../../contract.js";
import { pauseMissionCommand } from "../../runtime/orchestration-executor.js";

export function createPauseMissionCapability(): OrchestrationChildCapability<PauseMissionChildInput, PauseMissionChildOutput> {
  return {
    abilityGroupId: "orchestration",
    childCapabilityId: "pause-mission",
    execute(input, context) {
      return pauseMissionCommand({ command: input, context });
    },
  };
}
