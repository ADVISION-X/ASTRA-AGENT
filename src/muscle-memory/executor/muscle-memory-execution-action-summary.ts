import type { MuscleMemoryExecutionActionResult } from "./muscle-memory-execution.schema.js";
import type { ExecutionAction } from "./muscle-memory-executor.types.js";

const readStringInput = (action: ExecutionAction, key: string): string | null => {
  const value = action.input[key];
  return typeof value === "string" && value.length > 0 ? value : null;
};

const resolveGridCell = (action: ExecutionAction): string | null => {
  const directGridCell = readStringInput(action, "gridCell");
  if (directGridCell) {
    return directGridCell;
  }

  for (const [key, value] of Object.entries(action.input)) {
    if (key.endsWith("GridCell") && typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return null;
};

const buildDefaultSummary = (action: ExecutionAction, status: MuscleMemoryExecutionActionResult["status"]): string => {
  if (status === "success") {
    return `${action.sourceActionCode} executed.`;
  }
  if (status === "review_required") {
    return `${action.sourceActionCode} requested human review.`;
  }
  if (status === "failed") {
    return `${action.sourceActionCode} failed.`;
  }
  return `${action.sourceActionCode} is pending.`;
};

export function resolveExecutionActionSummaryFields(input: {
  action: ExecutionAction;
  status: MuscleMemoryExecutionActionResult["status"];
  completedAt?: string | null;
}): Pick<MuscleMemoryExecutionActionResult, "gridCell" | "targetName" | "summary" | "completedAt"> {
  return {
    gridCell: resolveGridCell(input.action),
    targetName: readStringInput(input.action, "targetName"),
    summary: buildDefaultSummary(input.action, input.status),
    completedAt: input.completedAt ?? null,
  };
}
