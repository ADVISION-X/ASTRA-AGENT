import type { OrchestrationChildCapability, FinalizeMissionChildInput, FinalizeMissionChildOutput } from "../../contract.js";
import { buildMissionStateUpdate } from "../../runtime/orchestration-result-builder.js";

export function createFinalizeMissionCapability(): OrchestrationChildCapability<FinalizeMissionChildInput, FinalizeMissionChildOutput> {
  return {
    abilityGroupId: "orchestration",
    childCapabilityId: "finalize-mission",
    async execute(input, context) {
      const state = await context.statePort.getMissionState(input.missionId);
      const now = context.clock.now().isoTimestamp;
      const nextState = buildMissionStateUpdate({
        ...state,
        status: input.status,
        endedAt: now,
        updatedAt: now,
      });
      await context.statePort.putMissionState(nextState);
      return nextState;
    },
  };
}
