import {
  executionFailure,
  typedExecutionFailure,
  type MutationOutcome,
  type TypedExecutionFailure,
} from "../typed-failure.js";

export const browserExecutionFailure = (
  error: unknown,
  mutationOutcome?: MutationOutcome,
): TypedExecutionFailure => {
  const existing = typedExecutionFailure(error);
  if (existing) return existing;
  const code = error instanceof Error && error.message ? error.message : "BROWSER_FAILURE_UNCLASSIFIED";
  return executionFailure("failed", code, {
    mutationOutcome: mutationOutcome ?? (code === "BROWSER_COMMAND_RECEIPT_MISSING" ? "dispatched" : "no"),
    cause: error,
  });
};
