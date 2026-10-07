export type ExtensionCommandStage =
  | "payload"
  | "command-shape"
  | "command-admission"
  | "target-resolution"
  | "registered-command";

export const extensionCommandDiagnostic = (input: Readonly<{
  reasonCode: string;
  failedFrameSequence: number;
  commandStage: ExtensionCommandStage;
  commandKind: string | null;
  capabilityId: string | null;
}>): Record<string, unknown> => ({
  reasonCode: input.reasonCode,
  failedFrameKind: "COMMAND",
  failedFrameSequence: input.failedFrameSequence,
  diagnosticSource: "extension-runtime",
  runtimeEventType: "command-handler",
  commandStage: input.commandStage,
  ...(input.commandKind ? { commandKind: input.commandKind } : {}),
  ...(input.capabilityId ? { capabilityId: input.capabilityId } : {}),
  encodedByteLength: 0,
});
