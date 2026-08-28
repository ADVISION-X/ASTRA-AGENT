import {
  executionFailure,
  typedExecutionFailure,
  type MutationOutcome,
  type TypedExecutionFailure,
} from "../typed-failure.js";

const reviewRequired = new Set([
  "BROWSER_MUTATION_UNSETTLED",
  "BROWSER_COMMAND_RECEIPT_MISSING",
  "BROWSER_POSTCONDITION_FAILED",
  "BROWSER_TARGET_INVALID",
  "BROWSER_DOCUMENT_INVALID",
  "BROWSER_FILE_GRANT_INVALID",
  "BROWSER_WORKER_FENCE_INVALID",
]);

const recoveryPending = new Set([
  "BROWSER_BACKPRESSURE",
  "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE",
  "BROWSER_LIVENESS_EXPIRED",
  "BROWSER_WAIT_ABORTED",
  "V6_DEADLINE_BUDGET_EXHAUSTED",
]);

export const browserExecutionFailure = (
  error: unknown,
  mutationOutcome?: MutationOutcome,
): TypedExecutionFailure => {
  const existing = typedExecutionFailure(error);
  if (existing) return existing;
  const code = error instanceof Error && error.message ? error.message : "BROWSER_FAILURE_UNCLASSIFIED";
  const status = reviewRequired.has(code) ? "review_required"
    : recoveryPending.has(code) ? "recovery_pending" : "failed";
  return executionFailure(status, code, {
    mutationOutcome: mutationOutcome ?? (code === "BROWSER_COMMAND_RECEIPT_MISSING" ? "dispatched" : "no"),
    cause: error,
  });
};
