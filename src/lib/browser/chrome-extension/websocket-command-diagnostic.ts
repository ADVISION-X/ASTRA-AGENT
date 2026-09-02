import { browserCommandErrorCode as errorCode } from "./websocket-actor-crypto.js";

export type ExtensionCommandStage =
  | "payload"
  | "command-shape"
  | "command-admission"
  | "target-resolution"
  | "registered-command";

export const extensionCommandDiagnostic = (input: Readonly<{
  error: unknown;
  failedFrameSequence: number;
  commandStage: ExtensionCommandStage;
  commandKind: string | null;
  commandIntentKind: string | null;
  capabilityId: string | null;
}>): Record<string, unknown> => ({
  reasonCode: errorCode(input.error),
  failedFrameKind: "COMMAND",
  failedFrameSequence: input.failedFrameSequence,
  diagnosticSource: "extension-runtime",
  runtimeEventType: "command-handler",
  errorName: input.error instanceof Error
    && /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/u.test(input.error.name)
    ? input.error.name
    : input.error instanceof Error ? "InvalidErrorName" : "NonErrorThrown",
  commandStage: input.commandStage,
  ...(input.commandKind ? { commandKind: input.commandKind } : {}),
  ...(input.commandIntentKind ? { commandIntentKind: input.commandIntentKind } : {}),
  ...(input.capabilityId ? { capabilityId: input.capabilityId } : {}),
  encodedByteLength: 0,
});
