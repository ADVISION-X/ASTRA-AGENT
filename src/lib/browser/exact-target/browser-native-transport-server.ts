import { randomBytes, randomUUID } from "node:crypto";
import { chmodSync, mkdirSync, rmSync } from "node:fs";
import net from "node:net";
import path from "node:path";

import {
  GRASSEYE_BROWSER_MAX_MESSAGE_BYTES,
  GRASSEYE_BROWSER_PROTOCOL_VERSION,
  isBrowserWireMessage,
  type BrowserWireCommand,
  type BrowserWireMessage,
  type BrowserWireMutationClass,
} from "./browser-native-transport-protocol.js";
import {
  BrowserTerminalError,
  type BrowserMutationClass,
} from "./browser-command-contract.js";

interface PendingCommand {
  readonly sequence: number;
  readonly mutationClass: BrowserMutationClass;
  readonly reject: (error: Error) => void;
  readonly resolve: (value: unknown) => void;
  readonly timeout: NodeJS.Timeout;
}

type BrowserResponseMessage = Extract<BrowserWireMessage, { type: "response" }>;

const wireMutationClass = (value: BrowserMutationClass): BrowserWireMutationClass => value;

export class BrowserNativeTransportServer {
  private readonly pending = new Map<string, PendingCommand>();
  private authenticated = false;
  private connection: net.Socket | null = null;
  private connectionNonce: string | null = null;
  private nextSequence = 1;
  private server: net.Server | null = null;

  constructor(readonly socketPath: string) {}

  async start(): Promise<void> {
    if (this.server) return;
    mkdirSync(path.dirname(this.socketPath), { recursive: true, mode: 0o700 });
    rmSync(this.socketPath, { force: true });
    this.server = net.createServer((socket) => this.accept(socket));
    await new Promise<void>((resolve, reject) => {
      this.server!.once("error", reject);
      this.server!.listen(this.socketPath, () => resolve());
    });
    chmodSync(this.socketPath, 0o600);
  }

  isReady(): boolean {
    return this.authenticated && this.connection !== null && !this.connection.destroyed;
  }

  async waitUntilReady(timeoutMs = 10_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!this.isReady()) {
      if (Date.now() >= deadline) {
        throw new BrowserTerminalError(
          "TRANSPORT_DISCONNECTED",
          "fixed-id GrassEye extension is not connected to the Native host",
        );
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
    }
  }

  async command<T>(input: {
    readonly command: BrowserWireCommand;
    readonly expectedLoaderId?: string;
    readonly mutationClass: BrowserMutationClass;
    readonly timeoutMs?: number;
    readonly abortSignal?: AbortSignal;
  }): Promise<{ commandId: string; result: T }> {
    const timeoutMs = input.timeoutMs ?? 10_000;
    await this.waitUntilReady(Math.min(timeoutMs, 10_000));
    const commandId = randomUUID();
    const sequence = this.nextSequence;
    this.nextSequence += 1;
    const response = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(commandId);
        reject(new BrowserTerminalError(
          input.mutationClass === "non_idempotent_mutation" ? "OUTCOME_UNKNOWN" : "COMMAND_TIMEOUT",
          `command ${commandId} exceeded ${timeoutMs}ms`,
          input.mutationClass,
        ));
      }, timeoutMs);
      this.pending.set(commandId, {
        sequence,
        mutationClass: input.mutationClass,
        reject,
        resolve,
        timeout,
      });
    });
    const abort = (): void => {
      const pending = this.pending.get(commandId);
      if (!pending) return;
      clearTimeout(pending.timeout);
      this.pending.delete(commandId);
      pending.reject(new BrowserTerminalError(
        input.mutationClass === "non_idempotent_mutation" ? "OUTCOME_UNKNOWN" : "COMMAND_TIMEOUT",
        "browser command aborted by owning caller",
        input.mutationClass,
      ));
    };
    if (input.abortSignal?.aborted) abort();
    else input.abortSignal?.addEventListener("abort", abort, { once: true });
    try {
      try {
        this.send({
          protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
          type: "command",
          commandId,
          sequence,
          deadlineAt: Date.now() + timeoutMs,
          mutationClass: wireMutationClass(input.mutationClass),
          ...(input.expectedLoaderId ? { expectedLoaderId: input.expectedLoaderId } : {}),
          command: input.command,
        });
      } catch (error) {
        const pending = this.pending.get(commandId);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pending.delete(commandId);
          pending.reject(new BrowserTerminalError(
            input.mutationClass === "non_idempotent_mutation" ? "OUTCOME_UNKNOWN" : "TRANSPORT_DISCONNECTED",
            error instanceof Error ? error.message : String(error),
            input.mutationClass,
          ));
        }
      }
      return { commandId, result: await response as T };
    } finally {
      input.abortSignal?.removeEventListener("abort", abort);
    }
  }

  async close(): Promise<void> {
    this.failPending("TRANSPORT_DISCONNECTED", "controller transport closed");
    this.connection?.destroy();
    this.connection = null;
    this.authenticated = false;
    this.connectionNonce = null;
    this.nextSequence = 1;
    if (this.server) {
      await new Promise<void>((resolve) => this.server!.close(() => resolve()));
      this.server = null;
    }
    rmSync(this.socketPath, { force: true });
  }

  private accept(socket: net.Socket): void {
    if (this.connection && !this.connection.destroyed) {
      socket.destroy(new Error("only one Native host connection is allowed"));
      return;
    }
    this.connection = socket;
    this.authenticated = false;
    this.connectionNonce = randomBytes(32).toString("hex");
    this.nextSequence = 1;
    let buffer = "";
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      buffer += chunk;
      if (Buffer.byteLength(buffer, "utf8") > GRASSEYE_BROWSER_MAX_MESSAGE_BYTES) {
        socket.destroy(new Error("Native host message exceeds maximum size"));
        return;
      }
      for (;;) {
        const newline = buffer.indexOf("\n");
        if (newline < 0) break;
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        try {
          this.onMessage(JSON.parse(line) as unknown);
        } catch {
          socket.destroy(new Error("Native host sent malformed JSON"));
          return;
        }
      }
    });
    socket.on("close", () => {
      if (this.connection === socket) this.connection = null;
      this.authenticated = false;
      this.connectionNonce = null;
      this.failPending("TRANSPORT_DISCONNECTED", "Native host disconnected");
    });
    socket.on("error", () => undefined);
  }

  private onMessage(value: unknown): void {
    if (!isBrowserWireMessage(value)) {
      this.connection?.destroy(new Error("invalid browser protocol message"));
      return;
    }
    if (value.type === "extension_hello") return this.handleExtensionHello();
    if (value.type === "extension_authenticated") return this.handleExtensionAuthentication(value.nonce);
    if (value.type === "response" && this.authenticated) this.handleResponse(value);
  }

  private handleExtensionHello(): void {
    if (this.authenticated) {
      this.connection?.destroy(new Error("authenticated extension cannot restart the command sequence"));
      return;
    }
    if (!this.connectionNonce) {
      this.connection?.destroy(new Error("Native host connection has no challenge nonce"));
      return;
    }
    this.send({
      protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
      type: "controller_challenge",
      nonce: this.connectionNonce,
    });
  }

  private handleExtensionAuthentication(nonce: string): void {
    if (this.authenticated) {
      this.connection?.destroy(new Error("extension authenticated more than once"));
      return;
    }
    if (nonce !== this.connectionNonce) {
      this.connection?.destroy(new Error("Native extension nonce mismatch"));
      return;
    }
    this.authenticated = true;
  }

  private handleResponse(value: BrowserResponseMessage): void {
    const pending = this.pending.get(value.commandId);
    if (!pending) return;
    if (value.sequence !== pending.sequence) {
      return this.rejectSequenceMismatch(value, pending);
    }
    clearTimeout(pending.timeout);
    this.pending.delete(value.commandId);
    if (value.ok) {
      pending.resolve(value.result);
      return;
    }
    const code = value.errorCode === "DOCUMENT_STALE"
      || value.errorCode === "TARGET_NOT_FOUND"
      || value.errorCode === "TARGET_AMBIGUOUS"
      || value.errorCode === "DEVTOOLS_ATTACHMENT_CONFLICT"
      || value.errorCode === "COMMAND_TIMEOUT"
      ? value.errorCode
      : pending.mutationClass === "non_idempotent_mutation"
        ? "OUTCOME_UNKNOWN"
        : "TRANSPORT_DISCONNECTED";
    pending.reject(new BrowserTerminalError(
      code,
      value.errorMessage ?? "browser command failed",
      pending.mutationClass,
    ));
  }

  private rejectSequenceMismatch(value: BrowserResponseMessage, pending: PendingCommand): void {
    clearTimeout(pending.timeout);
    this.pending.delete(value.commandId);
    pending.reject(new BrowserTerminalError(
      pending.mutationClass === "non_idempotent_mutation" ? "OUTCOME_UNKNOWN" : "TRANSPORT_DISCONNECTED",
      `response sequence ${value.sequence} does not match command sequence ${pending.sequence}`,
      pending.mutationClass,
    ));
    this.connection?.destroy(new Error("browser response sequence mismatch"));
  }

  private send(message: BrowserWireMessage): void {
    if (!this.connection || this.connection.destroyed) {
      throw new BrowserTerminalError("TRANSPORT_DISCONNECTED", "Native host is not connected");
    }
    const payload = `${JSON.stringify(message)}\n`;
    if (Buffer.byteLength(payload, "utf8") > GRASSEYE_BROWSER_MAX_MESSAGE_BYTES) {
      throw new BrowserTerminalError("TRANSPORT_DISCONNECTED", "browser message exceeds maximum size");
    }
    this.connection.write(payload);
  }

  private failPending(code: "TRANSPORT_DISCONNECTED", reason: string): void {
    for (const [commandId, pending] of this.pending) {
      clearTimeout(pending.timeout);
      this.pending.delete(commandId);
      pending.reject(new BrowserTerminalError(
        pending.mutationClass === "non_idempotent_mutation" ? "OUTCOME_UNKNOWN" : code,
        reason,
        pending.mutationClass,
      ));
    }
  }
}
