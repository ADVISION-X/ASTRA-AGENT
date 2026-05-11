import type { MissionState } from "../contract.js";

const readBranchFieldString = (branchFieldValues: Record<string, string | number | boolean | null>, key: string): string | null => {
  const value = branchFieldValues[key];
  return typeof value === "string" && value.length > 0 ? value : null;
};

const hasLastActionSummary = (branchFieldValues: Record<string, string | number | boolean | null>) =>
  readBranchFieldString(branchFieldValues, "lastActionSourceActionCode") !== null;

const shouldIncrementSavedLeadCount = (sourceActionCode: string | null, status: string) =>
  sourceActionCode === "SAVE_LEAD" && status === "success";

const shouldIncrementSkippedCount = (_sourceActionCode: string | null, _status: string) =>
  false;

export function buildNextMissionRoundState(input: {
  state: MissionState;
  lastResult: {
    branchFieldValues: Record<string, string | number | boolean | null>;
  };
}): Pick<MissionState, "lastActionSummary" | "roundProgress"> {
  if (!hasLastActionSummary(input.lastResult.branchFieldValues)) {
    return {
      lastActionSummary: input.state.lastActionSummary,
      roundProgress: input.state.roundProgress,
    };
  }

  const lastActionStatus = readBranchFieldString(input.lastResult.branchFieldValues, "lastActionStatus") ?? "pending";
  const sourceActionCode = readBranchFieldString(input.lastResult.branchFieldValues, "lastActionSourceActionCode");
  const nextLastActionSummary = {
    sourceActionCode,
    status: lastActionStatus,
    gridCell: readBranchFieldString(input.lastResult.branchFieldValues, "lastActionGridCell"),
    targetName: readBranchFieldString(input.lastResult.branchFieldValues, "lastActionTargetName"),
    summary: readBranchFieldString(input.lastResult.branchFieldValues, "lastActionSummary"),
    actionInputRef: readBranchFieldString(input.lastResult.branchFieldValues, "lastActionActionInputRef"),
    outputRef: readBranchFieldString(input.lastResult.branchFieldValues, "lastActionOutputRef"),
    failureReason: readBranchFieldString(input.lastResult.branchFieldValues, "lastActionFailureReason"),
    completedAt: readBranchFieldString(input.lastResult.branchFieldValues, "lastActionCompletedAt"),
  } as MissionState["lastActionSummary"];

  return {
    lastActionSummary: nextLastActionSummary,
    roundProgress: {
      savedLeadCount: input.state.roundProgress.savedLeadCount + (shouldIncrementSavedLeadCount(sourceActionCode, lastActionStatus) ? 1 : 0),
      skippedCount: input.state.roundProgress.skippedCount + (shouldIncrementSkippedCount(sourceActionCode, lastActionStatus) ? 1 : 0),
      reviewRequiredCount: input.state.roundProgress.reviewRequiredCount + (lastActionStatus === "review_required" ? 1 : 0),
      failedActionCount: input.state.roundProgress.failedActionCount + (lastActionStatus === "failed" ? 1 : 0),
      consecutiveFailureCount: lastActionStatus === "success"
        ? 0
        : lastActionStatus === "pending"
          ? input.state.roundProgress.consecutiveFailureCount
          : input.state.roundProgress.consecutiveFailureCount + 1,
    },
  };
}
