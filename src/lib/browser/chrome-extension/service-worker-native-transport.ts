import {
  GRASSEYE_BROWSER_PROTOCOL_VERSION,
  GRASSEYE_NATIVE_HOST_NAME,
  isBrowserWireMessage,
  type BrowserWireCommand,
  type BrowserWireMessage,
} from "./protocol.js";
import { commandFingerprint, executeCommand } from "./service-worker-command-execution.js";

interface NativePort {
  postMessage(message: BrowserWireMessage): void;
  disconnect(): void;
  onMessage: { addListener(listener: (message: unknown) => void): void };
  onDisconnect: { addListener(listener: () => void): void };
}

declare const chrome: {
  runtime: {
    connectNative(name: string): NativePort;
    lastError?: { readonly message?: string };
  };
};

type RunCommand = (command: BrowserWireCommand, expectedLoaderId?: string) => Promise<unknown>;
interface CommandReceipt {
  readonly fingerprint: string;
  readonly sequence: number;
  readonly completion: Promise<Extract<BrowserWireMessage, { type: "response" }>>;
  response: Extract<BrowserWireMessage, { type: "response" }> | null;
}

let nativePort: NativePort | null = null;
let authenticatedNonce: string | null = null;
let lastAcceptedSequence = 0;
let runCommandHandler: RunCommand | null = null;
let disconnectHandler: (() => void) | null = null;
const commandReceipts = new Map<string, CommandReceipt>();

const resetSession = (): void => {
  authenticatedNonce = null;
  lastAcceptedSequence = 0;
  commandReceipts.clear();
};

const trimCommandReceipts = (): void => {
  if (commandReceipts.size <= 512) return;
  for (const [commandId, receipt] of commandReceipts) {
    if (receipt.response) commandReceipts.delete(commandId);
    if (commandReceipts.size <= 512) return;
  }
};

const rejectProtocolCommand = (
  message: Extract<BrowserWireMessage, { type: "command" }>,
  code: string,
  reason: string,
): void => {
  nativePort?.postMessage({
    protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
    type: "response",
    commandId: message.commandId,
    sequence: message.sequence,
    ok: false,
    errorCode: code,
    errorMessage: reason,
  });
};

const handleExistingReceipt = async (
  message: Extract<BrowserWireMessage, { type: "command" }>,
  receipt: CommandReceipt,
  fingerprint: string,
): Promise<void> => {
  if (receipt.sequence !== message.sequence || receipt.fingerprint !== fingerprint) {
    rejectProtocolCommand(message, "COMMAND_ID_CONFLICT", "command id was reused with different content");
    return;
  }
  nativePort?.postMessage(await receipt.completion);
};

const handleCommand = async (
  message: Extract<BrowserWireMessage, { type: "command" }>,
): Promise<void> => {
  if (!runCommandHandler) return;
  const fingerprint = commandFingerprint(message);
  const existing = commandReceipts.get(message.commandId);
  if (existing) return handleExistingReceipt(message, existing, fingerprint);
  if (!Number.isSafeInteger(message.sequence) || message.sequence !== lastAcceptedSequence + 1) {
    rejectProtocolCommand(
      message,
      message.sequence <= lastAcceptedSequence ? "COMMAND_SEQUENCE_REPLAY" : "COMMAND_SEQUENCE_OUT_OF_ORDER",
      `expected command sequence ${lastAcceptedSequence + 1}, received ${message.sequence}`,
    );
    return;
  }
  lastAcceptedSequence = message.sequence;
  const receipt: CommandReceipt = {
    fingerprint,
    sequence: message.sequence,
    completion: executeCommand(message, runCommandHandler),
    response: null,
  };
  commandReceipts.set(message.commandId, receipt);
  receipt.response = await receipt.completion;
  nativePort?.postMessage(receipt.response);
  trimCommandReceipts();
};

const handleMessage = async (
  message: unknown,
  sourcePort: NativePort,
): Promise<void> => {
  if (nativePort !== sourcePort || !isBrowserWireMessage(message)) return;
  if (message.type === "controller_challenge") {
    resetSession();
    authenticatedNonce = message.nonce;
    nativePort.postMessage({
      protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
      type: "extension_authenticated",
      nonce: message.nonce,
    });
    return;
  }
  if (message.type === "command" && authenticatedNonce) await handleCommand(message);
};

export const connectNativeTransport = (): void => {
  if (nativePort || !runCommandHandler) return;
  resetSession();
  const port = chrome.runtime.connectNative(GRASSEYE_NATIVE_HOST_NAME);
  nativePort = port;
  port.onMessage.addListener((message) => {
    void handleMessage(message, port);
  });
  port.onDisconnect.addListener(() => {
    if (nativePort === port) nativePort = null;
    resetSession();
    disconnectHandler?.();
  });
  port.postMessage({ protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION, type: "extension_hello" });
};

export const configureNativeTransport = (input: {
  runCommand: RunCommand;
  onDisconnect: () => void;
}): void => {
  runCommandHandler = input.runCommand;
  disconnectHandler = input.onDisconnect;
};
