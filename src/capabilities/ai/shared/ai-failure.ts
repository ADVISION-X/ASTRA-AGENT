type GovernedLocalAiRuntimeError = Error & {
  code: "service_unreachable" | "model_missing" | "engine_missing" | "missing_evidence" | "invalid_output" | "disabled_by_policy";
  detail?: string;
};

function isGovernedLocalAiRuntimeError(error: unknown): error is GovernedLocalAiRuntimeError {
  return error instanceof Error
    && typeof error.name === "string"
    && error.name === "LocalAiRuntimeError"
    && "code" in error
    && typeof error.code === "string";
}

export function describeLocalAiFailure(error: unknown): {
  decision: "local_ai_unavailable" | "invalid_ai_output";
  localAiStatus: string;
  eventType: string;
  reason: string;
} {
  if (!isGovernedLocalAiRuntimeError(error)) {
    return {
      decision: "invalid_ai_output",
      localAiStatus: "invalid_ai_output",
      eventType: "local_ai_task_failed",
      reason: error instanceof Error ? error.message : String(error),
    };
  }

  if (error.code === "invalid_output") {
    return {
      decision: "invalid_ai_output",
      localAiStatus: "invalid_ai_output",
      eventType: "local_ai_task_failed",
      reason: error.message,
    };
  }

  return {
    decision: "local_ai_unavailable",
    localAiStatus: error.code === "disabled_by_policy" ? "disabled_by_policy" : "local_ai_unavailable",
    eventType: "local_ai_runtime_unavailable",
    reason: error.message,
  };
}