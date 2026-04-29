import type { MissionState } from "../contract.js";

export interface OrchestrationStatePort {
  getMissionState(missionId: string | null): Promise<MissionState>;
  putMissionState(state: MissionState): Promise<void>;
}