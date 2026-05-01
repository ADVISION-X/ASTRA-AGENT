export type LocalAiRuntimeErrorCode =
  | "service_unreachable"
  | "model_missing"
  | "engine_missing"
  | "missing_evidence"
  | "invalid_output"
  | "disabled_by_policy";