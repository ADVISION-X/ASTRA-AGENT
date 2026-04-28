export type LocalAiRuntimeErrorCode =
  | "service_unreachable"
  | "model_missing"
  | "engine_missing"
  | "missing_evidence"
  | "invalid_output"
  | "disabled_by_policy";

export class LocalAiRuntimeError extends Error {
  constructor(
    readonly code: LocalAiRuntimeErrorCode,
    message: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "LocalAiRuntimeError";
  }
}

export function isLocalAiRuntimeError(error: unknown): error is LocalAiRuntimeError {
  return error instanceof LocalAiRuntimeError;
}