import {
  executionFailure,
  typedExecutionFailure,
  type BrowserEffectFailureFacts,
  type MutationOutcome,
  type TypedExecutionFailure,
} from "../typed-failure.js";

export const browserExecutionFailure = (
  error: unknown,
  mutationOutcome?: MutationOutcome,
  browserEffect?: BrowserEffectFailureFacts | null,
): TypedExecutionFailure => {
  const existing = typedExecutionFailure(error);
  if (existing && (!browserEffect || existing.browserEffect)) return existing;
  if (existing) return executionFailure(existing.status, existing.code, {
    mutationOutcome: existing.mutationOutcome,
    evidenceRef: existing.evidenceRef,
    evidenceHash: existing.evidenceHash,
    httpStatus: existing.httpStatus,
    browserEffect: browserEffect ?? null,
    cause: existing.cause,
  });
  const code = error instanceof Error && error.message ? error.message : "BROWSER_FAILURE_UNCLASSIFIED";
  return executionFailure("failed", code, {
    mutationOutcome: mutationOutcome ?? (code === "BROWSER_COMMAND_RECEIPT_MISSING" ? "dispatched" : "no"),
    browserEffect: browserEffect ?? null,
    cause: error,
  });
};
