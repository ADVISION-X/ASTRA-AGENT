import type { CommanderConsoleStatus } from "../shared/commander-result.js";

export type CommanderDispatchFailure = {
  status: Exclude<CommanderConsoleStatus, "success">;
  failureReason: string | null;
  reviewRequiredReason: string | null;
  dataQualityFlags: string[];
};

export function createCommanderFailedDispatch(reason: string, dataQualityFlags: string[] = []): CommanderDispatchFailure {
  return {
    status: "failed",
    failureReason: reason,
    reviewRequiredReason: null,
    dataQualityFlags,
  };
}

export function createCommanderReviewRequiredDispatch(reason: string, dataQualityFlags: string[] = []): CommanderDispatchFailure {
  return {
    status: "review_required",
    failureReason: null,
    reviewRequiredReason: reason,
    dataQualityFlags,
  };
}

export function describeCommanderUnhandledError(error: unknown): CommanderDispatchFailure {
  const reason = error instanceof Error ? error.message : "unknown commander-console execution failure";
  return createCommanderFailedDispatch(reason, ["execution_error"]);
}