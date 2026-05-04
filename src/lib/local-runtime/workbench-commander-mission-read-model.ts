import type { WorkbenchRuntime } from "./workbench-contract.js";

export type WorkbenchCommanderMissionSelectionState = {
  lastMissionId: string | null;
};

export const createMissionReadModel = (
  runtime: WorkbenchRuntime,
  missionSelectionState: WorkbenchCommanderMissionSelectionState,
) => ({
  readMission: async () => {
    let mission = await runtime.orchestrationAbilityGroup.getMissionState();
    if (mission.status === "idle" && missionSelectionState.lastMissionId) {
      mission = await runtime.orchestrationAbilityGroup.getMissionState(missionSelectionState.lastMissionId);
    }
    const status = mission.status === "pending" ? "idle" : mission.status;
    return {
      missionId: mission.missionId,
      humanGoal: mission.humanGoal ?? "",
      status,
      missionRunRef: mission.activeTaskRunId,
      currentRoundIndex: mission.currentRoundIndex,
      requestedPlatform: mission.requestedPlatform,
      selectedMapId: mission.mapId,
      lastHumanCommand: mission.lastHumanCommand === "submit-review-decision" ? null : mission.lastHumanCommand,
      reviewRequiredReason: mission.reviewRequiredReason ?? null,
      failureReason: mission.failureReason ?? null,
      startedAt: mission.startedAt ?? null,
      updatedAt: mission.updatedAt ?? null,
      endedAt: mission.endedAt ?? null,
    };
  },
});