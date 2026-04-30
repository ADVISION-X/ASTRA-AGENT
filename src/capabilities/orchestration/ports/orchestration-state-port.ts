import type { MissionState } from "../contract.js";

export interface OrchestrationStatePort {
  getMissionState(missionId: string): Promise<MissionState | null>;
  getActiveMission(): Promise<MissionState | null>;
  putMissionState(state: MissionState): Promise<void>;
  cleanupExpiredMissions(nowMs: number): Promise<number>;
}
