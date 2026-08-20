import type {
  BrowserWireCommand,
  BrowserWireCommandPayload,
  BrowserWireMutationClass,
  BrowserWireResponsePayload,
} from "../protocol/generated/browser-protocol.js";

const errorCode = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  const prefix = message.split(":", 1)[0] ?? "BROWSER_COMMAND_FAILED";
  return /^[A-Z][A-Z0-9_]+$/u.test(prefix) ? prefix : "BROWSER_COMMAND_FAILED";
};

export async function executeCommand(
  input: Readonly<{
    payload: BrowserWireCommandPayload;
    deadlineMonotonicMs: number;
  }>,
  run: (
    command: BrowserWireCommand,
    expectedLoaderId?: string,
  ) => Promise<unknown>,
): Promise<BrowserWireResponsePayload> {
  const message = input.payload;
  if (performance.timeOrigin + performance.now() > input.deadlineMonotonicMs) {
    return {
      commandId: message.commandId,
      ok: false,
      errorCode: "COMMAND_TIMEOUT",
      errorMessage: "command deadline elapsed before execution",
    };
  }
  try {
    return {
      commandId: message.commandId,
      ok: true,
      result: await run(message.command, message.expectedLoaderId),
    };
  } catch (error) {
    return {
      commandId: message.commandId,
      ok: false,
      errorCode: errorCode(error),
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}
