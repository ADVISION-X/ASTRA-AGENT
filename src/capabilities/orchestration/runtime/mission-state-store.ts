import type { MissionState } from "../contract.js";
import { MissionStateSchema } from "../schema.js";
import type { OrchestrationStatePort } from "../ports/orchestration-state-port.js";

export function createIdleMissionState(): MissionState {
  return MissionStateSchema.parse({
    status: "idle",
    payloadRefs: {},
  });
}

export function createInMemoryOrchestrationStatePort(): OrchestrationStatePort {
  const states = new Map<string, MissionState>();
  let lastMissionId: string | null = null;

  return {
    async getMissionState(missionId) {
      if (!missionId) {
        return lastMissionId ? (states.get(lastMissionId) ?? createIdleMissionState()) : createIdleMissionState();
      }
      return states.get(missionId) ?? createIdleMissionState();
    },
    async putMissionState(state) {
      const parsed = MissionStateSchema.parse(state);
      if (parsed.missionId) {
        states.set(parsed.missionId, parsed);
        lastMissionId = parsed.missionId;
      }
    },
  };
}