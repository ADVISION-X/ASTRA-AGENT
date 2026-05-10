import type { OrchestrationChildCapability } from "../../internal.js";
import type { EmergencyStopChildInput, EmergencyStopChildOutput } from "../../contract.js";
import { emergencyStopMissionCommand } from "../../runtime/orchestration-executor.js";

function executeEmergencyStopCommand(input: EmergencyStopChildInput, context: Parameters<typeof emergencyStopMissionCommand>[0]["context"]) {
  return emergencyStopMissionCommand({ command: input, context });
}

export function createEmergencyStopCapability(): OrchestrationChildCapability<EmergencyStopChildInput, EmergencyStopChildOutput> {
  return {
    abilityGroupId: "orchestration",
    childCapabilityId: "emergency-stop",
    execute(input, context) {
      return executeEmergencyStopCommand(input, context);
    },
  };
}
