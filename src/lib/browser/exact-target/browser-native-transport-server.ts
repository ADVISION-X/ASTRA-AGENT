import { randomBytes, randomUUID } from "node:crypto";
import { chmodSync, mkdirSync, rmSync, statSync } from "node:fs";
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

export type BrowserTransportLifecycleEvent = {
  readonly stage:
    | "listener_ready"
    | "socket_connected"
    | "extension_hello"
    | "authenticated"
    | "disconnected";
  readonly generation: number;
  readonly reason?: string;
};

export class BrowserNativeTransportServer {
  private readonly pending = new Map<string, PendingCommand>();
  private authenticated = false;
  private connection: net.Socket | null = null;
  private connectionNonce: string | null = null;
  private nextSequence = 1;
  private server: net.Server | null = null;
  private socketIdentity: string | null = null;
  private startupFailure: Error | null = null;
  private startupPromise: Promise<void> | null = null;
  private lifecycleGeneration = 0;

  constructor(
    readonly socketPath: string,
    private readonly onLifecycle?: (event: BrowserTransportLifecycleEvent) => void,
  ) {}

  async start(): Promise<void> {
    if (this.server) return;
    if (this.startupFailure) throw this.startupFailure;
    if (this.startupPromise) return this.startupPromise;
    this.startupPromise = this.startInternal();
    return this.startupPromise;
  }

  private async startInternal(): Promise<void> {
    mkdirSync(path.dirname(this.socketPath), { recursive: true, mode: 0o700 });
    const server = net.createServer((socket) => this.accept(socket));
    this.server = server;
    try {
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const onError = (error: Error): void => {
          if (!settled) {
            settled = true;
            reject(error);
            return;
          }
          this.startupFailure = error;
          this.failPending("TRANSPORT_DISCONNECTED", "controller transport listener failed");
          this.connection?.destroy(error);
        };
        server.once("error", onError);
        server.listen(this.socketPath, () => {
          settled = true;
          resolve();
        });
      });
      chmodSync(this.socketPath, 0o600);
      this.socketIdentity = this.readSocketIdentity();
      this.emitLifecycle({ stage: "listener_ready", generation: this.lifecycleGeneration });
    } catch (error) {
      this.server = null;
      const cause = error instanceof Error ? error : new Error(String(error));
      const errorCode = (error as NodeJS.ErrnoException).code;
      this.startupFailure = errorCode === "EADDRINUSE"
        ? new Error("BROWSER_CONTROLLER_ALREADY_OWNED: controller-native.sock is already owned by another BrowserController")
        : cause;
      server.close(() => undefined);
      throw this.startupFailure;
    }
  }

  isReady(): boolean {
    return this.authenticated && this.connection !== null && !this.connection.destroyed;
  }

  async waitUntilReady(timeoutMs = 10_000): Promise<void> {
    if (this.startupFailure) {
      throw new BrowserTerminalError(
        "TRANSPORT_DISCONNECTED",
        `browser controller transport startup failed: ${this.startupFailure.message}`,
      );
    }
    const deadline = Date.now() + timeoutMs;
    while (!this.isReady()) {
      const startupFailure = this.startupFailure as Error | null;
      if (startupFailure) {
        throw new BrowserTerminalError(
          "TRANSPORT_DISCONNECTED",
          `browser controller transport startup failed: ${startupFailure.message}`,
        );
      }
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
    if (this.socketIdentity !== null && this.readSocketIdentity() === this.socketIdentity) {
      rmSync(this.socketPath, { force: true });
    }
    this.socketIdentity = null;
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
    this.lifecycleGeneration += 1;
    const generation = this.lifecycleGeneration;
    this.emitLifecycle({ stage: "socket_connected", generation });
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
          this.onMessage(JSON.parse(line) as unknown, socket);
        } catch {
          socket.destroy(new Error("Native host sent malformed JSON"));
          return;
        }
      }
    });
    socket.on("close", () => {
      if (this.connection !== socket) return;
      this.connection = null;
      this.authenticated = false;
      this.connectionNonce = null;
      this.failPending("TRANSPORT_DISCONNECTED", "Native host disconnected");
      this.emitLifecycle({
        stage: "disconnected",
        generation,
        reason: "Native host disconnected",
      });
    });
    socket.on("error", () => undefined);
  }

  private onMessage(value: unknown, socket: net.Socket): void {
    if (this.connection !== socket) return;
    if (!isBrowserWireMessage(value)) {
      socket.destroy(new Error("invalid browser protocol message"));
      return;
    }
    if (value.type === "extension_hello") {
      this.emitLifecycle({ stage: "extension_hello", generation: this.lifecycleGeneration });
      return this.handleExtensionHello();
    }
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
    this.emitLifecycle({ stage: "authenticated", generation: this.lifecycleGeneration });
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

  private emitLifecycle(event: BrowserTransportLifecycleEvent): void {
    this.onLifecycle?.(event);
  }

  private readSocketIdentity(): string | null {
    try {
      const stat = statSync(this.socketPath);
      return `${stat.dev}:${stat.ino}`;
    } catch {
      return null;
    }
  }
}
