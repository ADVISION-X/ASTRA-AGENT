import type { OrchestrationAbilityGroup } from "../../capabilities/orchestration/index.js";

type GetOrchestration = () => OrchestrationAbilityGroup;

export function createGetMissionStatus(_getOrchestration: GetOrchestration) {
  return () => ({
    missionId: null,
    status: "idle" as const,
    currentPlatform: null,
    userRequirementSummary: null,
    startedAt: null,
    updatedAt: new Date().toISOString(),
    lastStopReason: null,
    reviewRequiredReason: null,
    matchedEvidenceCount: 0,
    lastActionFailureCount: 0,
  });
}
