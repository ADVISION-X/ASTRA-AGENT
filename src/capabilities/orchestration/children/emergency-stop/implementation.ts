import type { OrchestrationChildCapability, EmergencyStopChildInput, EmergencyStopChildOutput } from "../../contract.js";
import { emergencyStopMissionCommand } from "../../runtime/orchestration-executor.js";

export function createEmergencyStopCapability(): OrchestrationChildCapability<EmergencyStopChildInput, EmergencyStopChildOutput> {
  return {
    abilityGroupId: "orchestration",
    childCapabilityId: "emergency-stop",
    execute(input, context) {
      return emergencyStopMissionCommand({ command: input, context });
    },
  };
}
