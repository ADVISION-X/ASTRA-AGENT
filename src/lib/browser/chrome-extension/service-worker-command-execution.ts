import {
  GRASSEYE_BROWSER_PROTOCOL_VERSION,
  type BrowserWireCommand,
  type BrowserWireMessage,
} from "./protocol.js";

type CommandMessage = Extract<BrowserWireMessage, { type: "command" }>;
type ResponseMessage = Extract<BrowserWireMessage, { type: "response" }>;

export const commandFingerprint = (message: CommandMessage): string => JSON.stringify({
  command: message.command,
  expectedLoaderId: message.expectedLoaderId ?? null,
  mutationClass: message.mutationClass,
});

const errorCode = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  const prefix = message.split(":", 1)[0] ?? "BROWSER_COMMAND_FAILED";
  return /^[A-Z][A-Z0-9_]+$/u.test(prefix) ? prefix : "BROWSER_COMMAND_FAILED";
};

export async function executeCommand(
  message: CommandMessage,
  run: (command: BrowserWireCommand, expectedLoaderId?: string) => Promise<unknown>,
): Promise<ResponseMessage> {
  if (Date.now() > message.deadlineAt) {
    return {
      protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
      type: "response",
      commandId: message.commandId,
      sequence: message.sequence,
      ok: false,
      errorCode: "COMMAND_TIMEOUT",
      errorMessage: "command deadline elapsed before execution",
    };
  }
  try {
    return {
      protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
      type: "response",
      commandId: message.commandId,
      sequence: message.sequence,
      ok: true,
      result: await run(message.command, message.expectedLoaderId),
    };
  } catch (error) {
    return {
      protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
      type: "response",
      commandId: message.commandId,
      sequence: message.sequence,
      ok: false,
      errorCode: errorCode(error),
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}
