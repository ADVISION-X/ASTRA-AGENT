import type { LocalAiRuntimeErrorCode } from "./local-ai-runtime-error-code.js";

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

export type { LocalAiRuntimeErrorCode };