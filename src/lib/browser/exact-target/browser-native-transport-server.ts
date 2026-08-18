import { randomBytes, randomUUID } from "node:crypto";
import { chmodSync, mkdirSync, rmSync, statSync } from "node:fs";
import net from "node:net";
import path from "node:path";

import {
  BrowserAuthorityAbsentError,
  BrowserAuthorityIssuer,
} from "../authority/browser-authority-issuer.js";
import type {
  AuthenticatedBrowserAuthority,
  BrowserAuthoritySnapshot,
} from "../authority/browser-authority-certificate.js";
import {
  GRASSEYE_BROWSER_CONTROLLER_HOST_MAX_MESSAGE_BYTES,
  GRASSEYE_BROWSER_HOST_TO_EXTENSION_MAX_BYTES,
  GRASSEYE_BROWSER_PROTOCOL_VERSION,
  GRASSEYE_BROWSER_RELEASE_IDENTITY,
  isBrowserWireMessage,
  type BrowserWireCommand,
  type BrowserWireCommandPayload,
  type BrowserWireMessage,
  type BrowserWireMutationClass,
  type BrowserWireResponsePayload,
} from "./browser-native-transport-protocol.js";
import {
  BrowserTerminalError,
  type BrowserMutationClass,
} from "./browser-command-contract.js";
import { issueBrowserCommandPermit } from "../transport/command-permit.js";
import {
  browserTranscriptProof,
  createBrowserControllerEphemeralKey,
  decryptBrowserFrame,
  encryptBrowserFrame,
  verifyBrowserTranscriptProof,
  type BrowserControllerEphemeralKey,
} from "../transport/browser-session-crypto.js";

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

type ChallengeState = Readonly<{
  challengeId: string;
  nonce: string;
  ephemeral: BrowserControllerEphemeralKey;
  nativePortEpoch: number;
  extensionInstanceId: string;
}>;

type ConnectionState = {
  readonly socket: net.Socket;
  readonly generation: number;
  buffer: string;
  challenge: ChallengeState | null;
  frameKey: Buffer | null;
  nativePortEpoch: number | null;
  extensionInstanceId: string | null;
  nextSequence: number;
  authorityIssued: boolean;
};

export type BrowserTransportLifecycleEvent = {
  readonly stage:
    | "listener_ready"
    | "socket_connected"
    | "extension_hello"
    | "challenge_sent"
    | "authenticated_authority_issued"
    | "authority_revoked"
    | "disconnected";
  readonly generation: number;
  readonly reason?: string;
};

const wireMutationClass = (value: BrowserMutationClass): BrowserWireMutationClass => value;

const authTranscript = (input: Readonly<{
  controllerSessionId: string;
  connectionGeneration: number;
  nativePortEpoch: number;
  challengeId: string;
  nonce: string;
  controllerPublicKey: string;
  extensionInstanceId: string;
  extensionPublicKey: string;
}>): string => [
  "auth-v2",
  GRASSEYE_BROWSER_PROTOCOL_VERSION,
  GRASSEYE_BROWSER_RELEASE_IDENTITY,
  input.controllerSessionId,
  input.connectionGeneration,
  input.nativePortEpoch,
  input.challengeId,
  input.nonce,
  input.controllerPublicKey,
  input.extensionInstanceId,
  input.extensionPublicKey,
].join(":");

const grantTranscript = (input: Readonly<{
  authorityId: string;
  authorityCertificateHash: string;
  connectionGeneration: number;
  nativePortEpoch: number;
  challengeId: string;
}>): string => [
  "grant-v2",
  input.authorityId,
  input.authorityCertificateHash,
  input.connectionGeneration,
  input.nativePortEpoch,
  input.challengeId,
].join(":");

const heartbeatTranscript = (input: Readonly<{
  authorityId: string;
  connectionGeneration: number;
  nativePortEpoch: number;
  monotonicMs: number;
}>): string => [
  "heartbeat-v2",
  input.authorityId,
  input.connectionGeneration,
  input.nativePortEpoch,
  input.monotonicMs,
].join(":");

export class BrowserNativeTransportServer {
  private readonly pending = new Map<string, PendingCommand>();
  private readonly authorityIssuer = new BrowserAuthorityIssuer();
  private readonly authorityWaiters = new Set<{
    resolve: (authority: AuthenticatedBrowserAuthority) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }>();
  private connection: ConnectionState | null = null;
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
    private readonly onLifecycle?: (event: BrowserTransportLifecycleEvent) => void,
  ) {}

  async start(): Promise<void> {
    if (this.server) return;
    if (this.startupFailure) throw this.startupFailure;
    if (this.startupPromise) return this.startupPromise;
    this.startupPromise = this.startInternal();
    return this.startupPromise;
  }

  async waitForAuthority(timeoutMs = 10_000): Promise<AuthenticatedBrowserAuthority> {
    await this.start();
    try {
      return this.authorityIssuer.requireCurrent();
    } catch (error) {
      if (!(error instanceof BrowserAuthorityAbsentError)) throw error;
    }
    return new Promise<AuthenticatedBrowserAuthority>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.authorityWaiters.delete(waiter);
        reject(new BrowserTerminalError(
          "TRANSPORT_DISCONNECTED",
          "authenticated browser authority was not established before the startup deadline",
        ));
      }, timeoutMs);
      const waiter = { resolve, reject, timer };
      this.authorityWaiters.add(waiter);
    });
  }

  authoritySnapshot(): BrowserAuthoritySnapshot {
    return this.authorityIssuer.snapshot();
  }

  requireAuthority(): AuthenticatedBrowserAuthority {
    return this.authorityIssuer.requireCurrent();
  }

  async command<T>(input: {
    readonly command: BrowserWireCommand;
    readonly expectedLoaderId?: string;
    readonly mutationClass: BrowserMutationClass;
    readonly timeoutMs?: number;
    readonly abortSignal?: AbortSignal;
  }): Promise<{ commandId: string; result: T }> {
    const timeoutMs = input.timeoutMs ?? 10_000;
    const authority = this.requireAuthority();
    const connection = this.requireConnectionForAuthority(authority);
    const commandId = randomUUID();
    const sequence = connection.nextSequence++;
    const deadlineAt = Date.now() + timeoutMs;
    const permit = issueBrowserCommandPermit({ authority, commandId, sequence, deadlineAt });
    const payload: BrowserWireCommandPayload = {
      commandId,
      mutationClass: wireMutationClass(input.mutationClass),
      ...(input.expectedLoaderId ? { expectedLoaderId: input.expectedLoaderId } : {}),
      command: input.command,
    };
    const encrypted = encryptBrowserFrame(
      connection.frameKey!,
      {
        authorityId: permit.authorityId,
        connectionGeneration: permit.connectionGeneration,
        nativePortEpoch: permit.nativePortEpoch,
        sequence: permit.sequence,
      },
      payload,
    );
    const frame: BrowserWireMessage = {
      protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
      releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
      type: "command_frame",
      permit,
      ...encrypted,
    };
    const frameBytes = Buffer.byteLength(JSON.stringify(frame), "utf8");
    if (frameBytes > GRASSEYE_BROWSER_HOST_TO_EXTENSION_MAX_BYTES) {
      throw new BrowserTerminalError("TRANSPORT_DISCONNECTED", "browser command frame exceeds Host-to-Extension control budget");
    }

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
        permitHash: permit.permitHash,
        authorityId: permit.authorityId,
        connectionGeneration: permit.connectionGeneration,
        nativePortEpoch: permit.nativePortEpoch,
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
        this.sendTo(connection, frame);
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
    this.revokeAuthority("controller transport closed");
    this.failPending("TRANSPORT_DISCONNECTED", "controller transport closed");
    this.connection?.socket.destroy();
    this.connection = null;
    if (this.watchdog) clearInterval(this.watchdog);
    this.watchdog = null;
    if (this.server) {
      await new Promise<void>((resolve) => this.server!.close(() => resolve()));
      this.server = null;
    }
    if (this.socketIdentity !== null && this.readSocketIdentity() === this.socketIdentity) {
      rmSync(this.socketPath, { force: true });
    }
    this.socketIdentity = null;
    this.rejectAuthorityWaiters(new BrowserAuthorityAbsentError("browser transport closed"));
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
          this.revokeAuthority("controller transport listener failed");
          this.failPending("TRANSPORT_DISCONNECTED", "controller transport listener failed");
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
      this.emitLifecycle({ stage: "listener_ready", generation: this.lifecycleGeneration });
      this.watchdog = setInterval(() => this.watchAuthorityLiveness(), 250);
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

  private accept(socket: net.Socket): void {
    if (this.connection && !this.connection.socket.destroyed) {
      socket.destroy(new Error("only one Native host connection is allowed"));
      return;
    }
    this.revokeAuthority("new transport connection admitted");
    const connection: ConnectionState = {
      socket,
      generation: ++this.lifecycleGeneration,
      buffer: "",
      challenge: null,
      frameKey: null,
      nativePortEpoch: null,
      extensionInstanceId: null,
      nextSequence: 1,
      authorityIssued: false,
    };
    this.connection = connection;
    this.emitLifecycle({ stage: "socket_connected", generation: connection.generation });
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => this.onData(connection, chunk));
    socket.on("close", () => this.onClose(connection));
    socket.on("error", () => undefined);
  }

  private onData(connection: ConnectionState, chunk: string): void {
    if (this.connection !== connection) return;
    connection.buffer += chunk;
    if (Buffer.byteLength(connection.buffer, "utf8") > GRASSEYE_BROWSER_CONTROLLER_HOST_MAX_MESSAGE_BYTES) {
      this.revokeAndDestroy(connection, "Native host message exceeds controller-host budget");
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
        this.revokeAndDestroy(connection, "Native host sent malformed JSON");
        return;
      }
    }
  }

  private onMessage(value: unknown, connection: ConnectionState): void {
    if (this.connection !== connection) return;
    if (!isBrowserWireMessage(value)) {
      this.revokeAndDestroy(connection, "invalid browser protocol message");
      return;
    }
    if (value.type === "extension_hello") {
      this.handleExtensionHello(value, connection);
      return;
    }
    if (value.type === "extension_authenticated") {
      this.handleExtensionAuthentication(value, connection);
      return;
    }
    if (value.type === "heartbeat") {
      this.handleHeartbeat(value, connection);
      return;
    }
    if (value.type === "response_frame") {
      this.handleResponseFrame(value, connection);
    }
  }

  private handleExtensionHello(
    value: Extract<BrowserWireMessage, { type: "extension_hello" }>,
    connection: ConnectionState,
  ): void {
    if (connection.challenge || connection.authorityIssued) {
      this.revokeAndDestroy(connection, "extension hello repeated within one connection generation");
      return;
    }
    connection.nativePortEpoch = value.nativePortEpoch;
    connection.extensionInstanceId = value.extensionInstanceId;
    const challenge: ChallengeState = Object.freeze({
      challengeId: randomUUID(),
      nonce: randomBytes(32).toString("base64"),
      ephemeral: createBrowserControllerEphemeralKey(),
      nativePortEpoch: value.nativePortEpoch,
      extensionInstanceId: value.extensionInstanceId,
    });
    connection.challenge = challenge;
    this.emitLifecycle({ stage: "extension_hello", generation: connection.generation });
    this.sendTo(connection, {
      protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
      releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
      type: "controller_challenge",
      controllerSessionId: this.controllerSessionId,
      connectionGeneration: connection.generation,
      nativePortEpoch: challenge.nativePortEpoch,
      challengeId: challenge.challengeId,
      nonce: challenge.nonce,
      controllerPublicKey: challenge.ephemeral.publicKeyBase64,
    });
    this.emitLifecycle({ stage: "challenge_sent", generation: connection.generation });
  }

  private handleExtensionAuthentication(
    value: Extract<BrowserWireMessage, { type: "extension_authenticated" }>,
    connection: ConnectionState,
  ): void {
    const challenge = connection.challenge;
    if (!challenge || connection.authorityIssued || connection.frameKey) {
      this.revokeAndDestroy(connection, "extension authentication arrived outside the one-time challenge window");
      return;
    }
    if (
      value.challengeId !== challenge.challengeId
      || value.nonce !== challenge.nonce
      || value.nativePortEpoch !== challenge.nativePortEpoch
      || value.extensionInstanceId !== challenge.extensionInstanceId
    ) {
      this.revokeAndDestroy(connection, "extension authentication transcript mismatch");
      return;
    }
    let frameKey: Buffer;
    try {
      frameKey = challenge.ephemeral.computeSharedSecret(value.extensionPublicKey, challenge.nonce);
    } catch {
      this.revokeAndDestroy(connection, "extension public key was invalid");
      return;
    }
    const transcript = authTranscript({
      controllerSessionId: this.controllerSessionId,
      connectionGeneration: connection.generation,
      nativePortEpoch: challenge.nativePortEpoch,
      challengeId: challenge.challengeId,
      nonce: challenge.nonce,
      controllerPublicKey: challenge.ephemeral.publicKeyBase64,
      extensionInstanceId: challenge.extensionInstanceId,
      extensionPublicKey: value.extensionPublicKey,
    });
    if (!verifyBrowserTranscriptProof(frameKey, transcript, value.transcriptProof)) {
      this.revokeAndDestroy(connection, "extension authentication proof mismatch");
      return;
    }
    connection.frameKey = frameKey;
    const authority = this.authorityIssuer.issue({
      controllerSessionId: this.controllerSessionId,
      connectionGeneration: connection.generation,
      nativePortEpoch: challenge.nativePortEpoch,
      extensionInstanceId: challenge.extensionInstanceId,
      releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
      profileEnrollmentId: this.profileEnrollmentId,
      protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
    });
    connection.authorityIssued = true;
    const certificate = authority.certificate;
    const grantProof = browserTranscriptProof(frameKey, grantTranscript({
      authorityId: certificate.authorityId,
      authorityCertificateHash: certificate.certificateHash,
      connectionGeneration: certificate.connectionGeneration,
      nativePortEpoch: certificate.nativePortEpoch,
      challengeId: challenge.challengeId,
    }));
    this.sendTo(connection, {
      protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
      releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
      type: "authority_grant",
      authorityId: certificate.authorityId,
      authorityCertificateHash: certificate.certificateHash,
      connectionGeneration: certificate.connectionGeneration,
      nativePortEpoch: certificate.nativePortEpoch,
      grantProof,
    });
    this.emitLifecycle({ stage: "authenticated_authority_issued", generation: connection.generation });
    this.resolveAuthorityWaiters(authority);
  }

  private handleHeartbeat(
    value: Extract<BrowserWireMessage, { type: "heartbeat" }>,
    connection: ConnectionState,
  ): void {
    const frameKey = connection.frameKey;
    if (!frameKey || !connection.authorityIssued) {
      this.revokeAndDestroy(connection, "heartbeat arrived without an authenticated authority");
      return;
    }
    if (!this.authorityIssuer.isCurrent(value)) {
      this.revokeAndDestroy(connection, "stale heartbeat cannot renew browser authority");
      return;
    }
    const proofValid = verifyBrowserTranscriptProof(frameKey, heartbeatTranscript(value), value.proof);
    if (!proofValid) {
      this.revokeAndDestroy(connection, "heartbeat proof mismatch");
      return;
    }
    try {
      this.authorityIssuer.heartbeat(value);
    } catch {
      this.revokeAndDestroy(connection, "heartbeat failed authority liveness validation");
    }
  }

  private handleResponseFrame(
    value: Extract<BrowserWireMessage, { type: "response_frame" }>,
    connection: ConnectionState,
  ): void {
    if (this.connection !== connection || !connection.frameKey) return;
    if (!this.authorityIssuer.isCurrent(value)) return;
    const pending = [...this.pending.entries()].find(([, item]) => item.permitHash === value.permitHash);
    if (!pending) return;
    const [commandId, command] = pending;
    if (
      command.sequence !== value.sequence
      || command.authorityId !== value.authorityId
      || command.connectionGeneration !== value.connectionGeneration
      || command.nativePortEpoch !== value.nativePortEpoch
    ) {
      this.rejectPendingAndDestroy(commandId, command, connection, "browser response authority binding mismatch");
      return;
    }
    let response: BrowserWireResponsePayload;
    try {
      response = decryptBrowserFrame<BrowserWireResponsePayload>(
        connection.frameKey,
        {
          authorityId: value.authorityId,
          connectionGeneration: value.connectionGeneration,
          nativePortEpoch: value.nativePortEpoch,
          sequence: value.sequence,
        },
        value,
      );
    } catch {
      this.rejectPendingAndDestroy(commandId, command, connection, "browser response frame authentication failed");
      return;
    }
    if (response.commandId !== commandId) {
      this.rejectPendingAndDestroy(commandId, command, connection, "browser response command id mismatch");
      return;
    }
    clearTimeout(command.timeout);
    this.pending.delete(commandId);
    if (response.ok) {
      command.resolve(response.result);
      return;
    }
    const code = response.errorCode === "DOCUMENT_STALE"
      || response.errorCode === "TARGET_NOT_FOUND"
      || response.errorCode === "TARGET_AMBIGUOUS"
      || response.errorCode === "DEVTOOLS_ATTACHMENT_CONFLICT"
      || response.errorCode === "COMMAND_TIMEOUT"
      || response.errorCode === "TARGET_ORIGIN_MISMATCH"
      ? response.errorCode
      : command.mutationClass === "non_idempotent_mutation"
        ? "OUTCOME_UNKNOWN"
        : "TRANSPORT_DISCONNECTED";
    command.reject(new BrowserTerminalError(
      code,
      response.errorMessage ?? "browser command failed",
      command.mutationClass,
    ));
  }

  private onClose(connection: ConnectionState): void {
    if (this.connection !== connection) return;
    this.revokeAuthority("Native host disconnected");
    this.failPending("TRANSPORT_DISCONNECTED", "Native host disconnected");
    this.connection = null;
    this.emitLifecycle({
      stage: "disconnected",
      generation: connection.generation,
      reason: "Native host disconnected",
    });
  }

  private watchAuthorityLiveness(): void {
    const connection = this.connection;
    if (!connection?.authorityIssued) return;
    try {
      this.authorityIssuer.requireCurrent();
    } catch {
      this.revokeAndDestroy(connection, "browser authority liveness lease expired");
    }
  }

  private requireConnectionForAuthority(authority: AuthenticatedBrowserAuthority): ConnectionState {
    const connection = this.connection;
    const certificate = authority.certificate;
    if (
      !connection
      || connection.socket.destroyed
      || !connection.frameKey
      || !connection.authorityIssued
      || connection.generation !== certificate.connectionGeneration
      || connection.nativePortEpoch !== certificate.nativePortEpoch
    ) {
      this.revokeAuthority("browser authority no longer owns the current connection");
      throw new BrowserAuthorityAbsentError("browser authority is not bound to the current transport connection");
    }
    return connection;
  }

  private sendTo(connection: ConnectionState, message: BrowserWireMessage): void {
    if (this.connection !== connection || connection.socket.destroyed) {
      throw new BrowserTerminalError("TRANSPORT_DISCONNECTED", "Native host connection is no longer current");
    }
    const payload = `${JSON.stringify(message)}\n`;
    if (Buffer.byteLength(payload, "utf8") > GRASSEYE_BROWSER_CONTROLLER_HOST_MAX_MESSAGE_BYTES) {
      throw new BrowserTerminalError("TRANSPORT_DISCONNECTED", "browser controller-host message exceeds maximum size");
    }
    connection.socket.write(payload);
  }

  private revokeAuthority(reason: string): void {
    const before = this.authorityIssuer.snapshot();
    this.authorityIssuer.revoke(reason);
    if (before.state === "AUTHENTICATED_AUTHORITY_PRESENT") {
      this.emitLifecycle({
        stage: "authority_revoked",
        generation: before.connectionGeneration,
        reason,
      });
    }
  }

  private revokeAndDestroy(connection: ConnectionState, reason: string): void {
    if (this.connection !== connection) return;
    this.revokeAuthority(reason);
    this.failPending("TRANSPORT_DISCONNECTED", reason);
    connection.socket.destroy(new Error(reason));
  }

  private rejectPendingAndDestroy(
    commandId: string,
    pending: PendingCommand,
    connection: ConnectionState,
    reason: string,
  ): void {
    clearTimeout(pending.timeout);
    this.pending.delete(commandId);
    pending.reject(new BrowserTerminalError(
      pending.mutationClass === "non_idempotent_mutation" ? "OUTCOME_UNKNOWN" : "TRANSPORT_DISCONNECTED",
      reason,
      pending.mutationClass,
    ));
    this.revokeAndDestroy(connection, reason);
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

  private resolveAuthorityWaiters(authority: AuthenticatedBrowserAuthority): void {
    for (const waiter of this.authorityWaiters) {
      clearTimeout(waiter.timer);
      waiter.resolve(authority);
    }
    this.authorityWaiters.clear();
  }

  private rejectAuthorityWaiters(error: Error): void {
    for (const waiter of this.authorityWaiters) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
    this.authorityWaiters.clear();
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
