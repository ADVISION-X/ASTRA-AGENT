export type BrowserMutationClass =
  | "observation"
  | "idempotent_mutation"
  | "non_idempotent_mutation";

export type BrowserTerminalErrorCode =
  | "TARGET_NOT_FOUND"
  | "TARGET_AMBIGUOUS"
  | "TARGET_FOREIGN_SESSION"
  | "TARGET_ORIGIN_MISMATCH"
  | "DOCUMENT_STALE"
  | "TARGET_CLOSED"
  | "TRANSPORT_DISCONNECTED"
  | "EXTENSION_VERSION_MISMATCH"
  | "DEVTOOLS_ATTACHMENT_CONFLICT"
  | "COMMAND_TIMEOUT"
  | "OUTCOME_UNKNOWN"
  | "FOCUS_LEASE_DENIED"
  | "OPERATOR_INTERRUPTED";

export class BrowserTerminalError extends Error {
  constructor(
    readonly code: BrowserTerminalErrorCode,
    message: string,
    readonly mutationClass: BrowserMutationClass = "observation",
  ) {
    super(`${code}:${message}`);
    this.name = "BrowserTerminalError";
  }
}
