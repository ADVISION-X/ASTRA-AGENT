import type {
  CommanderConsoleAbilityGroup,
  CommanderMissionStatusView,
} from "../../capabilities/commander-console/index.js";
import type { OrchestrationAbilityGroup } from "../../capabilities/orchestration/index.js";
import type { WorkbenchCommanderMissionDashboardView } from "./workbench-commander-snapshot-types.js";

type SnapshotInput = {
  commanderConsole: CommanderConsoleAbilityGroup;
  getOrchestration: () => OrchestrationAbilityGroup;
  capabilityGroupIds: string[];
};

const readMissionView = async (input: SnapshotInput): Promise<CommanderMissionStatusView | null> => {
  try {
    const missionState = await input.getOrchestration().getMissionState();
    return {
      missionId: missionState.missionId ?? null,
      status: (missionState.status ?? "idle") as CommanderMissionStatusView["status"],
      currentPlatform: missionState.requestedPlatform ?? null,
      userRequirementSummary: missionState.humanGoal ?? null,
      startedAt: missionState.startedAt ?? null,
      updatedAt: missionState.updatedAt ?? new Date().toISOString(),
      lastStopReason: missionState.stopReason ?? null,
      reviewRequiredReason: missionState.reviewRequiredReason ?? null,
      matchedEvidenceCount: 0,
      lastActionFailureCount: 0,
    };
  } catch {
    return null;
  }
};

const runtimeSummary = (
  missionView: CommanderMissionStatusView | null,
): WorkbenchCommanderMissionDashboardView["runtime"] => ({
  runtimeStatus: (missionView?.status ?? "idle") as WorkbenchCommanderMissionDashboardView["runtime"]["runtimeStatus"],
  reviewReason: missionView?.reviewRequiredReason ?? null,
  lastAiFailureReason: null,
  currentStep: null,
  totalSeenCount: 0,
  evidencePacketCount: 0,
  browseRecordCount: 0,
  candidateCount: 0,
});

const emptyDashboardShell = (
  input: SnapshotInput,
  missionView: CommanderMissionStatusView | null,
): WorkbenchCommanderMissionDashboardView => ({
  mission: missionView,
  runtime: runtimeSummary(missionView),
  browser: { loginState: "unknown" },
  health: [],
  capabilityRoster: input.capabilityGroupIds.map((groupId) => ({ groupId, status: "active" as const })),
  candidates: [],
  reviewQueue: [],
  evidencePackets: [],
  browseRecord: [],
  failedRecords: [],
  runtimeProof: null,
  auditSummary: { totals: null, lastGeneratedAt: null },
});

export async function getCommanderConsoleSnapshot(input: SnapshotInput): Promise<WorkbenchCommanderMissionDashboardView> {
  return emptyDashboardShell(input, await readMissionView(input));
}
