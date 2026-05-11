import type { MuscleMemoryExecutionResult } from "../../../muscle-memory/executor/muscle-memory-execution.schema.js";

export function buildMuscleMemoryBranchFieldValues(executionResult: MuscleMemoryExecutionResult) {
  const lastAction = executionResult.actionResults[executionResult.actionResults.length - 1] ?? null;
  return {
    muscleMemoryExecuted: true,
    actionExecutionCount: executionResult.actionResults.length,
    ...(lastAction
      ? {
        lastActionSourceActionCode: lastAction.sourceActionCode,
        lastActionStatus: lastAction.status,
        lastActionOutputRef: lastAction.outputRef,
        lastActionActionInputRef: lastAction.actionInputRef,
        lastActionGridCell: lastAction.gridCell,
        lastActionTargetName: lastAction.targetName,
        lastActionSummary: lastAction.summary,
        lastActionCompletedAt: lastAction.completedAt,
        lastActionFailureReason: lastAction.failureReason,
      }
      : {}),
  };
}
