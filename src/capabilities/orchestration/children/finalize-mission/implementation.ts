import type { OrchestrationChildCapability } from "../../internal.js";
import type { FinalizeMissionChildInput, FinalizeMissionChildOutput } from "../../contract.js";
import { buildMissionStateUpdate } from "../../runtime/orchestration-result-builder.js";

export function createFinalizeMissionCapability(): OrchestrationChildCapability<FinalizeMissionChildInput, FinalizeMissionChildOutput> {
  return {
    abilityGroupId: "orchestration",
    childCapabilityId: "finalize-mission",
    async execute(input, context) {
      const state = await context.statePort.getMissionState(input.missionId);
      if (!state) {
        throw new Error(`Mission ${input.missionId} not found for finalize-mission.`);
      }
      const now = context.clock.now().isoTimestamp;
      const nextState = buildMissionStateUpdate({
        ...state,
        status: input.status,
        endedAt: now,
        updatedAt: now,
        stateRevision: (state.stateRevision ?? 0) + 1,
      });
      await context.statePort.putMissionState(nextState);
      return nextState;
    },
  };
}
