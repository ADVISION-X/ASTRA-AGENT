import type { WorkbenchRuntime } from "./workbench-contract.js";

export const createMissionReadModel = (runtime: WorkbenchRuntime) => ({
  readMission: async () => {
    const mission = await runtime.orchestrationAbilityGroup.getMissionState();
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