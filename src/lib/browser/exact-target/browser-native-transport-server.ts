import { chmodSync, mkdirSync, rmSync, statSync } from "node:fs";
import net from "node:net";
import path from "node:path";

import { BrowserAuthorityAbsentError } from "../authority/browser-authority-issuer.js";
import type {
  AuthenticatedBrowserAuthority,
  BrowserAuthoritySnapshot,
} from "../authority/browser-authority-certificate.js";
import {
  GRASSEYE_BROWSER_CONTROLLER_HOST_MAX_MESSAGE_BYTES,
  GRASSEYE_BROWSER_PROTOCOL_VERSION,
  GRASSEYE_BROWSER_RELEASE_IDENTITY,
  isBrowserWireMessage,
  type BrowserWireMessage,
} from "./browser-native-transport-protocol.js";
import { BrowserTerminalError } from "./browser-command-contract.js";
import { BrowserNativeAuthentication } from "./browser-native-authentication.js";
import {
  BrowserNativeCommandChannel,
  type BrowserNativeCommandInput,
} from "./browser-native-command-channel.js";
import { type BrowserControllerEphemeralKey } from "../transport/browser-session-crypto.js";

type ChallengeState = Readonly<{
  challengeId: string;
  nonce: string;
  ephemeral: BrowserControllerEphemeralKey;
  nativePortEpoch: number;
  extensionInstanceId: string;
}>;

export type BrowserNativeConnectionState = {
  readonly socket: net.Socket;
  readonly generation: number;
  buffer: string;
  challenge: ChallengeState | null;
  frameKey: Buffer | null;
  nativePortEpoch: number | null;
  extensionInstanceId: string | null;
  nextSequence: number;
  pendingAuthority: AuthenticatedBrowserAuthority | null;
  authorityCommitted: boolean;
};

export type BrowserTransportLifecycleEvent = {
  readonly stage:
    | "listener_ready"
    | "socket_connected"
    | "extension_hello"
    | "challenge_sent"
    | "authority_grant_sent"
    | "authenticated_authority_issued"
    | "authority_revoked"
    | "disconnected";
  readonly generation: number;
  readonly reason?: string;
};

const clearStaleSocketIfUnowned = async (socketPath: string): Promise<void> => {
  try {
    statSync(socketPath);
  } catch {
    return;
  }
  await new Promise<void>((resolve) => {
    const probe = net.createConnection(socketPath);
    let settled = false;
    const finish = (removeStaleSocket: boolean): void => {
      if (settled) return;
      settled = true;
      probe.destroy();
      if (removeStaleSocket) rmSync(socketPath, { force: true });
      resolve();
    };
    probe.once("connect", () => finish(false));
    probe.once("error", (error: NodeJS.ErrnoException) => {
      finish(error.code === "ECONNREFUSED" || error.code === "ENOENT");
    });
    probe.setTimeout(250, () => finish(false));
  });
};

export class BrowserNativeTransportServer {
  private readonly commandChannel: BrowserNativeCommandChannel;
  private readonly authentication: BrowserNativeAuthentication;
  private connection: BrowserNativeConnectionState | null = null;
  private server: net.Server | null = null;
  private socketIdentity: string | null = null;
  private startupFailure: Error | null = null;
  private startupPromise: Promise<void> | null = null;
  private lifecycleGeneration = 0;
  private watchdog: NodeJS.Timeout | null = null;

  constructor(
    readonly controllerSessionId: string,
    readonly socketPath: string,
    readonly profileEnrollmentId: string,
    private readonly onLifecycle?: (
      event: BrowserTransportLifecycleEvent,
    ) => void,
  ) {
    this.authentication = new BrowserNativeAuthentication({
      controllerSessionId,
      profileEnrollmentId,
      send: (connection, message) => this.sendTo(connection, message),
      terminate: (connection, reason) =>
        this.revokeAndDestroy(connection, reason),
      emit: (stage, generation, reason) =>
        this.emitLifecycle({
          stage,
          generation,
          ...(reason ? { reason } : {}),
        }),
    });
    this.commandChannel = new BrowserNativeCommandChannel({
      currentConnection: () => this.connection,
      requireAuthority: () => this.requireAuthority(),
      isCurrent: (binding) => this.authentication.isCurrent(binding),
      requireConnection: (authority) =>
        this.requireConnectionForAuthority(authority),
      send: (connection, message) => this.sendTo(connection, message),
      terminate: (connection, reason) =>
        this.revokeAndDestroy(connection, reason),
    });
  }

  async start(): Promise<void> {
    if (this.server) return;
    if (this.startupFailure) throw this.startupFailure;
    if (this.startupPromise) return this.startupPromise;
    this.startupPromise = this.startInternal();
    return this.startupPromise;
  }

  async waitForAuthority(
    timeoutMs = 10_000,
  ): Promise<AuthenticatedBrowserAuthority> {
    await this.start();
    return this.authentication.waitForAuthority(timeoutMs);
  }

  authoritySnapshot(): BrowserAuthoritySnapshot {
    return this.authentication.snapshot();
  }

  requireAuthority(): AuthenticatedBrowserAuthority {
    return this.authentication.requireCurrent();
  }

  command<T>(
    input: BrowserNativeCommandInput,
  ): Promise<{ commandId: string; result: T }> {
    return this.commandChannel.command<T>(input);
  }

  async close(): Promise<void> {
    this.authentication.revoke("controller transport closed");
    this.commandChannel.failPending("controller transport closed");
    this.connection?.socket.destroy();
    this.connection = null;
    if (this.watchdog) clearInterval(this.watchdog);
    this.watchdog = null;
    if (this.server) {
      await new Promise<void>((resolve) => this.server!.close(() => resolve()));
      this.server = null;
    }
    if (
      this.socketIdentity !== null &&
      this.readSocketIdentity() === this.socketIdentity
    ) {
      rmSync(this.socketPath, { force: true });
    }
    this.socketIdentity = null;
    this.authentication.rejectWaiters(
      new BrowserAuthorityAbsentError("browser transport closed"),
    );
  }

  private async startInternal(): Promise<void> {
    mkdirSync(path.dirname(this.socketPath), { recursive: true, mode: 0o700 });
    await clearStaleSocketIfUnowned(this.socketPath);
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
          this.authentication.revoke("controller transport listener failed");
          this.commandChannel.failPending(
            "controller transport listener failed",
          );
          this.connection?.socket.destroy(error);
        };
        server.once("error", onError);
        server.listen(this.socketPath, () => {
          settled = true;
          resolve();
        });
      });
      chmodSync(this.socketPath, 0o600);
      this.socketIdentity = this.readSocketIdentity();
      this.emitLifecycle({
        stage: "listener_ready",
        generation: this.lifecycleGeneration,
      });
      this.watchdog = setInterval(() => this.watchAuthorityLiveness(), 250);
    } catch (error) {
      this.server = null;
      const cause = error instanceof Error ? error : new Error(String(error));
      const errorCode = (error as NodeJS.ErrnoException).code;
      this.startupFailure =
        errorCode === "EADDRINUSE"
          ? new Error(
              "BROWSER_CONTROLLER_ALREADY_OWNED: controller-native.sock is already owned by another BrowserController",
            )
          : cause;
      server.close(() => undefined);
      throw this.startupFailure;
    }
  }

  private accept(socket: net.Socket): void {
    if (this.connection && !this.connection.socket.destroyed) {
      socket.destroy(new Error("only one Native host connection is allowed"));
      return;
    }
    this.authentication.revoke("new transport connection admitted");
    const connection: BrowserNativeConnectionState = {
      socket,
      generation: ++this.lifecycleGeneration,
      buffer: "",
      challenge: null,
      frameKey: null,
      nativePortEpoch: null,
      extensionInstanceId: null,
      nextSequence: 1,
      pendingAuthority: null,
      authorityCommitted: false,
    };
    this.connection = connection;
    socket.setEncoding("utf8");
    socket.on("data", (chunk) =>
      this.onData(
        connection,
        typeof chunk === "string" ? chunk : chunk.toString("utf8"),
      ),
    );
    socket.on("close", () => this.onClose(connection));
    socket.on("error", () => undefined);
  }

  private onData(
    connection: BrowserNativeConnectionState,
    chunk: string,
  ): void {
    if (this.connection !== connection) return;
    connection.buffer += chunk;
    if (
      Buffer.byteLength(connection.buffer, "utf8") >
      GRASSEYE_BROWSER_CONTROLLER_HOST_MAX_MESSAGE_BYTES
    ) {
      this.revokeAndDestroy(
        connection,
        "Native host message exceeds controller-host budget",
      );
      return;
    }
    for (;;) {
      const newline = connection.buffer.indexOf("\n");
      if (newline < 0) break;
      const line = connection.buffer.slice(0, newline);
      connection.buffer = connection.buffer.slice(newline + 1);
      if (!line) continue;
      try {
        this.onMessage(JSON.parse(line) as unknown, connection);
      } catch {
        this.revokeAndDestroy(
          connection,
          "Native host sent malformed or invalid browser protocol data",
        );
        return;
      }
    }
  }

  private onMessage(
    value: unknown,
    connection: BrowserNativeConnectionState,
  ): void {
    if (this.connection !== connection) return;
    if (!isBrowserWireMessage(value)) {
      this.revokeAndDestroy(connection, "invalid browser protocol message");
      return;
    }
    if (value.type === "extension_hello" && !connection.challenge) {
      this.emitLifecycle({
        stage: "socket_connected",
        generation: connection.generation,
      });
    }
    if (this.authentication.handle(value, connection)) return;
    if (value.type === "response_frame") {
      this.commandChannel.handleResponse(value, connection);
    }
  }

  private onClose(connection: BrowserNativeConnectionState): void {
    if (this.connection !== connection) return;
    const admittedNativeHost =
      connection.challenge !== null ||
      connection.pendingAuthority !== null ||
      connection.authorityCommitted;
    this.connection = null;
    if (!admittedNativeHost) return;
    this.authentication.revoke("Native host disconnected");
    this.commandChannel.failPending("Native host disconnected");
    this.emitLifecycle({
      stage: "disconnected",
      generation: connection.generation,
      reason: "Native host disconnected",
    });
  }

  private watchAuthorityLiveness(): void {
    const connection = this.connection;
    if (!connection?.authorityCommitted) return;
    try {
      this.authentication.requireCurrent();
    } catch {
      this.revokeAndDestroy(
        connection,
        "browser authority liveness lease expired",
      );
    }
  }

  private requireConnectionForAuthority(
    authority: AuthenticatedBrowserAuthority,
  ): BrowserNativeConnectionState {
    const connection = this.connection;
    const certificate = authority.certificate;
    if (
      !connection ||
      connection.socket.destroyed ||
      !connection.frameKey ||
      !connection.authorityCommitted ||
      connection.generation !== certificate.connectionGeneration ||
      connection.nativePortEpoch !== certificate.nativePortEpoch
    ) {
      this.authentication.revoke(
        "browser authority no longer owns the current connection",
      );
      throw new BrowserAuthorityAbsentError(
        "browser authority is not bound to the current transport connection",
      );
    }
    return connection;
  }

  private sendTo(
    connection: BrowserNativeConnectionState,
    message: BrowserWireMessage,
  ): void {
    if (this.connection !== connection || connection.socket.destroyed) {
      throw new BrowserTerminalError(
        "TRANSPORT_DISCONNECTED",
        "Native host connection is no longer current",
      );
    }
    const payload = `${JSON.stringify(message)}\n`;
    if (
      Buffer.byteLength(payload, "utf8") >
      GRASSEYE_BROWSER_CONTROLLER_HOST_MAX_MESSAGE_BYTES
    ) {
      throw new BrowserTerminalError(
        "TRANSPORT_DISCONNECTED",
        "browser controller-host message exceeds maximum size",
      );
    }
    connection.socket.write(payload);
  }

  private revokeAndDestroy(
    connection: BrowserNativeConnectionState,
    reason: string,
  ): void {
    if (this.connection !== connection) return;
    this.authentication.revoke(reason);
    this.commandChannel.failPending(reason);
    connection.pendingAuthority = null;
    connection.socket.destroy(new Error(reason));
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
