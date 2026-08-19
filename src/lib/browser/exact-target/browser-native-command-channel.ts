import { randomUUID } from "node:crypto";

import type { AuthenticatedBrowserAuthority } from "../authority/browser-authority-certificate.js";
import { issueBrowserCommandPermit } from "../transport/command-permit.js";
import { decryptBrowserFrame, encryptBrowserFrame } from "../transport/browser-session-crypto.js";
import {
  GRASSEYE_BROWSER_HOST_TO_EXTENSION_MAX_BYTES,
  GRASSEYE_BROWSER_PROTOCOL_VERSION,
  GRASSEYE_BROWSER_RELEASE_IDENTITY,
  type BrowserWireCommand,
  type BrowserWireCommandPayload,
  type BrowserWireMessage,
  type BrowserWireMutationClass,
  type BrowserWireResponsePayload,
} from "./browser-native-transport-protocol.js";
import { BrowserTerminalError, type BrowserMutationClass } from "./browser-command-contract.js";
import type { BrowserNativeConnectionState } from "./browser-native-transport-server.js";

interface PendingCommand {
  readonly sequence: number;
  readonly mutationClass: BrowserMutationClass;
  readonly permitHash: string;
  readonly authorityId: string;
  readonly connectionGeneration: number;
  readonly nativePortEpoch: number;
  readonly reject: (error: Error) => void;
  readonly resolve: (value: unknown) => void;
  readonly timeout: NodeJS.Timeout;
}

export interface BrowserNativeCommandInput {
  readonly command: BrowserWireCommand;
  readonly expectedLoaderId?: string;
  readonly mutationClass: BrowserMutationClass;
  readonly timeoutMs?: number;
  readonly abortSignal?: AbortSignal;
}

interface PreparedCommand {
  readonly commandId: string;
  readonly sequence: number;
  readonly frame: BrowserWireMessage;
  readonly permitHash: string;
  readonly authorityId: string;
  readonly connectionGeneration: number;
  readonly nativePortEpoch: number;
}

const wireMutationClass = (value: BrowserMutationClass): BrowserWireMutationClass => value;

const prepareCommand = (input: {
  authority: AuthenticatedBrowserAuthority;
  connection: BrowserNativeConnectionState;
  commandInput: BrowserNativeCommandInput;
  timeoutMs: number;
}): PreparedCommand => {
  const commandId = randomUUID();
  const sequence = input.connection.nextSequence++;
  const permit = issueBrowserCommandPermit({
    authority: input.authority,
    commandId,
    sequence,
    deadlineAt: Date.now() + input.timeoutMs,
  });
  const payload: BrowserWireCommandPayload = {
    commandId,
    mutationClass: wireMutationClass(input.commandInput.mutationClass),
    ...(input.commandInput.expectedLoaderId
      ? { expectedLoaderId: input.commandInput.expectedLoaderId }
      : {}),
    command: input.commandInput.command,
  };
  const encrypted = encryptBrowserFrame(
    input.connection.frameKey!,
    {
      authorityId: permit.authorityId,
      connectionGeneration: permit.connectionGeneration,
      nativePortEpoch: permit.nativePortEpoch,
      sequence: permit.sequence,
    },
    payload,
  );
  return {
    commandId,
    sequence,
    permitHash: permit.permitHash,
    authorityId: permit.authorityId,
    connectionGeneration: permit.connectionGeneration,
    nativePortEpoch: permit.nativePortEpoch,
    frame: {
      protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
      releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
      type: "command_frame",
      permit,
      ...encrypted,
    },
  };
};

const responseErrorCode = (
  response: BrowserWireResponsePayload,
  mutationClass: BrowserMutationClass,
): ConstructorParameters<typeof BrowserTerminalError>[0] => {
  const known = response.errorCode === "DOCUMENT_STALE"
    || response.errorCode === "TARGET_NOT_FOUND"
    || response.errorCode === "TARGET_AMBIGUOUS"
    || response.errorCode === "DEVTOOLS_ATTACHMENT_CONFLICT"
    || response.errorCode === "COMMAND_TIMEOUT"
    || response.errorCode === "TARGET_ORIGIN_MISMATCH";
  if (known) return response.errorCode;
  return mutationClass === "non_idempotent_mutation"
    ? "OUTCOME_UNKNOWN"
    : "TRANSPORT_DISCONNECTED";
};

export class BrowserNativeCommandChannel {
  private readonly pending = new Map<string, PendingCommand>();

  constructor(private readonly transport: {
    currentConnection(): BrowserNativeConnectionState | null;
    requireAuthority(): AuthenticatedBrowserAuthority;
    isCurrent(binding: { authorityId: string; connectionGeneration: number; nativePortEpoch: number }): boolean;
    requireConnection(authority: AuthenticatedBrowserAuthority): BrowserNativeConnectionState;
    send(connection: BrowserNativeConnectionState, message: BrowserWireMessage): void;
    terminate(connection: BrowserNativeConnectionState, reason: string): void;
  }) {}

  async command<T>(input: BrowserNativeCommandInput): Promise<{ commandId: string; result: T }> {
    const timeoutMs = input.timeoutMs ?? 10_000;
    const authority = this.transport.requireAuthority();
    const connection = this.transport.requireConnection(authority);
    const prepared = prepareCommand({ authority, connection, commandInput: input, timeoutMs });
    const frameBytes = Buffer.byteLength(JSON.stringify(prepared.frame), "utf8");
    if (frameBytes > GRASSEYE_BROWSER_HOST_TO_EXTENSION_MAX_BYTES) {
      throw new BrowserTerminalError(
        "TRANSPORT_DISCONNECTED",
        "browser command frame exceeds Host-to-Extension control budget",
      );
    }
    const { response, abort } = this.registerPending(prepared, input.mutationClass, timeoutMs);
    if (input.abortSignal?.aborted) abort();
    else input.abortSignal?.addEventListener("abort", abort, { once: true });
    try {
      this.sendPrepared(connection, prepared, input.mutationClass);
      return { commandId: prepared.commandId, result: await response as T };
    } finally {
      input.abortSignal?.removeEventListener("abort", abort);
    }
  }

  handleResponse(
    value: Extract<BrowserWireMessage, { type: "response_frame" }>,
    connection: BrowserNativeConnectionState,
  ): void {
    if (this.transport.currentConnection() !== connection
      || !connection.frameKey || !connection.authorityCommitted) return;
    if (!this.transport.isCurrent(value)) return;
    const found = [...this.pending.entries()].find(([, item]) => item.permitHash === value.permitHash);
    if (!found) return;
    const [commandId, pending] = found;
    if (!this.responseBindingMatches(value, pending)) {
      this.rejectAndTerminate(commandId, pending, connection, "browser response authority binding mismatch");
      return;
    }
    const response = this.decryptResponse(value, connection, commandId, pending);
    if (!response) return;
    this.settleResponse(commandId, pending, response);
  }

  failPending(reason: string): void {
    for (const [commandId, pending] of this.pending) {
      clearTimeout(pending.timeout);
      this.pending.delete(commandId);
      pending.reject(new BrowserTerminalError(
        pending.mutationClass === "non_idempotent_mutation" ? "OUTCOME_UNKNOWN" : "TRANSPORT_DISCONNECTED",
        reason,
        pending.mutationClass,
      ));
    }
  }

  private registerPending(
    command: PreparedCommand,
    mutationClass: BrowserMutationClass,
    timeoutMs: number,
  ): { response: Promise<unknown>; abort: () => void } {
    const response = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(command.commandId);
        reject(new BrowserTerminalError(
          mutationClass === "non_idempotent_mutation" ? "OUTCOME_UNKNOWN" : "COMMAND_TIMEOUT",
          `command ${command.commandId} exceeded ${timeoutMs}ms`,
          mutationClass,
        ));
      }, timeoutMs);
      this.pending.set(command.commandId, { ...command, mutationClass, reject, resolve, timeout });
    });
    const abort = (): void => {
      const pending = this.pending.get(command.commandId);
      if (!pending) return;
      clearTimeout(pending.timeout);
      this.pending.delete(command.commandId);
      pending.reject(new BrowserTerminalError(
        mutationClass === "non_idempotent_mutation" ? "OUTCOME_UNKNOWN" : "COMMAND_TIMEOUT",
        "browser command aborted by owning caller",
        mutationClass,
      ));
    };
    return { response, abort };
  }

  private sendPrepared(
    connection: BrowserNativeConnectionState,
    command: PreparedCommand,
    mutationClass: BrowserMutationClass,
  ): void {
    try {
      this.transport.send(connection, command.frame);
    } catch (error) {
      const pending = this.pending.get(command.commandId);
      if (!pending) return;
      clearTimeout(pending.timeout);
      this.pending.delete(command.commandId);
      pending.reject(new BrowserTerminalError(
        mutationClass === "non_idempotent_mutation" ? "OUTCOME_UNKNOWN" : "TRANSPORT_DISCONNECTED",
        error instanceof Error ? error.message : String(error),
        mutationClass,
      ));
    }
  }

  private responseBindingMatches(
    value: Extract<BrowserWireMessage, { type: "response_frame" }>,
    pending: PendingCommand,
  ): boolean {
    return pending.sequence === value.sequence
      && pending.authorityId === value.authorityId
      && pending.connectionGeneration === value.connectionGeneration
      && pending.nativePortEpoch === value.nativePortEpoch;
  }

  private decryptResponse(
    value: Extract<BrowserWireMessage, { type: "response_frame" }>,
    connection: BrowserNativeConnectionState,
    commandId: string,
    pending: PendingCommand,
  ): BrowserWireResponsePayload | null {
    try {
      const response = decryptBrowserFrame<BrowserWireResponsePayload>(connection.frameKey!, {
        authorityId: value.authorityId,
        connectionGeneration: value.connectionGeneration,
        nativePortEpoch: value.nativePortEpoch,
        sequence: value.sequence,
      }, value);
      if (response.commandId === commandId) return response;
      this.rejectAndTerminate(commandId, pending, connection, "browser response command id mismatch");
    } catch {
      this.rejectAndTerminate(commandId, pending, connection, "browser response frame authentication failed");
    }
    return null;
  }

  private settleResponse(
    commandId: string,
    pending: PendingCommand,
    response: BrowserWireResponsePayload,
  ): void {
    clearTimeout(pending.timeout);
    this.pending.delete(commandId);
    if (response.ok) {
      pending.resolve(response.result);
      return;
    }
    pending.reject(new BrowserTerminalError(
      responseErrorCode(response, pending.mutationClass),
      response.errorMessage ?? "browser command failed",
      pending.mutationClass,
    ));
  }

  private rejectAndTerminate(
    commandId: string,
    pending: PendingCommand,
    connection: BrowserNativeConnectionState,
    reason: string,
  ): void {
    clearTimeout(pending.timeout);
    this.pending.delete(commandId);
    pending.reject(new BrowserTerminalError(
      pending.mutationClass === "non_idempotent_mutation" ? "OUTCOME_UNKNOWN" : "TRANSPORT_DISCONNECTED",
      reason,
      pending.mutationClass,
    ));
    this.transport.terminate(connection, reason);
  }
}
