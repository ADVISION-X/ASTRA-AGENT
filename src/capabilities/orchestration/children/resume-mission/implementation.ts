import type { OrchestrationChildCapability, ResumeMissionChildInput, ResumeMissionChildOutput } from "../../contract.js";
import { resumeMissionCommand } from "../../runtime/orchestration-executor.js";

export function createResumeMissionCapability(): OrchestrationChildCapability<ResumeMissionChildInput, ResumeMissionChildOutput> {
  return {
    abilityGroupId: "orchestration",
    childCapabilityId: "resume-mission",
    async execute(input, context) {
      const result = await resumeMissionCommand({ command: input, caller: "commander-console", context });
      return result.missionState;
    },
  };
}
