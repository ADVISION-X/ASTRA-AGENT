import { LocalAiRuntimeError } from "./local-ai-runtime-error.js";

export function isLocalAiRuntimeError(error: unknown): error is LocalAiRuntimeError {
  return error instanceof LocalAiRuntimeError;
}