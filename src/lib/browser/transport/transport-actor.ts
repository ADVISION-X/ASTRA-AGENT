import { createHash, randomUUID } from "node:crypto";
import { chmodSync, lstatSync, mkdirSync, rmSync } from "node:fs";
import net from "node:net";
import path from "node:path";

import type { BrowserChromeProcessAttestation } from "../profile/browser-profile-process-attestation.js";
import type { BrowserManagedPolicyReadbackV1 } from "../profile/managed-policy-readback.js";
import type { VerifiedBrowserReleaseBinding } from "../release/browser-release-contract.js";
import {
  GRASSEYE_BROWSER_ARTIFACT_CHUNK_MAX_BYTES,
  GRASSEYE_BROWSER_CONTROLLER_HOST_CONTROL_MAX_BYTES,
  isBrowserWireMessage,
  type BrowserWireMessage,
} from "../protocol/generated/browser-protocol.js";
import type { AuthenticatedBrowserAuthority } from "../infrastructure/browser-authority-certificate.js";
import { BrowserOwnerLock } from "../infrastructure/browser-owner-lock.js";
import {
  BrowserArtifactStreamReceiver,
  type BrowserArtifactChunk,
} from "../exact-target/browser-artifact-stream.js";
import { BrowserCommandActor } from "../exact-target/browser-command-actor.js";
import {
  RawControllerHostChannel,
  isBrowserHostAttestation,
} from "./raw-controller-host-channel.js";
import { AuthenticatedControllerHostChannel } from "./authenticated-controller-host-channel.js";
import {
  TransportAuthenticator,
  type BrowserAuthenticatedTransportContext,
} from "./transport-authenticator.js";
import {
  issueReplyChannelToken,
  type ReplyChannelToken,
} from "./reply-channel-token.js";
import {
  initialBrowserTransportReducerState,
  reduceBrowserTransportEvent,
  type BrowserTransportReducerState,
} from "./transport-reducer.js";
import type { BrowserTransportEvent, BrowserTransportFence } from "./transport-event.js";

const monotonicEpochMs = (): number => performance.timeOrigin + performance.now();
const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const isArtifactChunk = (value: unknown): value is BrowserArtifactChunk => {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<BrowserArtifactChunk>;
  return item.type === "artifact_chunk"
    && typeof item.artifactRef === "string"
    && typeof item.commandId === "string"
    && typeof item.authorityRef === "string"
    && Number.isSafeInteger(item.authorityEpoch)
    && Number.isSafeInteger(item.sequence)
    && typeof item.contentHash === "string"
    && Number.isSafeInteger(item.chunkIndex)
    && Number.isSafeInteger(item.chunkCount)
    && Number.isSafeInteger(item.byteLength)
    && typeof item.dataBase64 === "string";
};

type HostCandidate = {
  raw: RawControllerHostChannel;
  channel: AuthenticatedControllerHostChannel | null;
  context: BrowserAuthenticatedTransportContext | null;
  buffer: string;
  generation: number;
  sourceChannelToken: string;
};

export class TransportActor {
  readonly artifacts: BrowserArtifactStreamReceiver;
  readonly commands: BrowserCommandActor;
  readonly authenticator: TransportAuthenticator;
  private state: BrowserTransportReducerState = initialBrowserTransportReducerState();
  private ownerLock: BrowserOwnerLock | null = null;
  private server: net.Server | null = null;
  private candidate: HostCandidate | null = null;
  private mailbox: Promise<void> = Promise.resolve();
  private generation = 0;
  private replyChannel: ReplyChannelToken | null = null;
  private watchdog: NodeJS.Timeout | null = null;
  private lastHeartbeatProbeAt = 0;

  constructor(private readonly input: {
    dataDir: string;
    socketPath: string;
    ownerLockHelperPath: string;
    supervisorEpoch: number;
    controllerIncarnationHash: `sha256:${string}`;
    profileEnrollmentHash: `sha256:${string}`;
    chromeProcess: BrowserChromeProcessAttestation;
    managedPolicy: BrowserManagedPolicyReadbackV1;
    release: VerifiedBrowserReleaseBinding;
    expectedHostBinaryHash: `sha256:${string}`;
    acceptingConnections(): boolean;
    onAuthoritySlotChanged(): void;
    onDisconnected(reason: string): void;
  }) {
    this.artifacts = new BrowserArtifactStreamReceiver(
      path.join(input.dataDir, "browser-runtime", "received-artifacts"),
      {
        maxArtifactStreams: 4,
        maxArtifactBytes: 512 * 1024 * 1024,
        maxChunkBytes: GRASSEYE_BROWSER_ARTIFACT_CHUNK_MAX_BYTES,
      },
    );
    this.authenticator = new TransportAuthenticator({
      controllerIncarnationHash: input.controllerIncarnationHash,
      profileEnrollmentHash: input.profileEnrollmentHash,
      chromeProcess: input.chromeProcess,
      managedPolicy: input.managedPolicy,
      release: input.release,
      onAuthorityCommitted: (authority) => this.onAuthorityCommitted(authority),
      onAuthorityRevoked: () => input.onAuthoritySlotChanged(),
    });
    this.commands = new BrowserCommandActor(input.dataDir, {
      requireAuthority: () => this.requireAuthority(),
      requireFrameKey: (authority) => this.requireFrameKey(authority),
      currentReplyChannel: (authority) => this.currentReplyChannel(authority),
      isCurrent: (binding) => this.isCurrent(binding),
      send: (message) => this.send(message),
      terminate: (reason) => this.terminate(reason),
    }, this.artifacts);
  }

  controlState(): BrowserTransportReducerState["controlState"] {
    return this.state.controlState;
  }

  authoritySlot() {
    return this.authenticator.issuer.slot();
  }

  requireAuthority(): AuthenticatedBrowserAuthority {
    return this.authenticator.requireCurrent();
  }

  async start(): Promise<void> {
    this.applyEvent({ type: "START", supervisorEpoch: this.input.supervisorEpoch });
    this.applyEvent({ type: "INSTALL_VERIFIED", supervisorEpoch: this.input.supervisorEpoch });
    this.applyEvent({
      type: "CHROME_STARTED",
      supervisorEpoch: this.input.supervisorEpoch,
      processEpoch: this.input.chromeProcess.processEpoch,
    });
    const lockPath = path.join(
      this.input.dataDir,
      "browser-runtime",
      "controller-owner.lock",
    );
    this.ownerLock = await BrowserOwnerLock.acquire({
      helperPath: this.input.ownerLockHelperPath,
      lockPath,
    });
    this.cleanupStaleSocketUnderOwnerLock();
    await this.bindServer();
    this.applyEvent({ type: "OWNER_BOUND", supervisorEpoch: this.input.supervisorEpoch });
    this.watchdog = setInterval(() => this.watchAuthority(), 250);
  }

  async stop(): Promise<void> {
    this.applyEvent({ type: "STOP" });
    this.revokeFirst("browser infrastructure stopping");
    this.commands.failPending("browser infrastructure stopping");
    this.candidate?.channel?.close("browser infrastructure stopping");
    this.candidate?.raw.socket.destroy();
    this.candidate = null;
    this.replyChannel = null;
    if (this.watchdog) clearInterval(this.watchdog);
    this.watchdog = null;
    if (this.server) {
      await new Promise<void>((resolve) => this.server!.close(() => resolve()));
    }
    this.server = null;
    if (this.ownerLock?.isAlive()) {
      try { rmSync(this.input.socketPath, { force: true }); } catch { /* owner proven */ }
    }
    await this.ownerLock?.release();
    this.ownerLock = null;
    await this.artifacts.discardAll();
  }

  requireFrameKey(authority: AuthenticatedBrowserAuthority): Buffer {
    const context = this.candidate?.context;
    if (
      !context?.frameKey
      || !context.authorityCommitted
      || authority.certificate.connectionGeneration !== context.connectionGeneration
      || authority.certificate.nativePortEpoch !== context.nativePortEpoch
    ) {
      throw new Error("BROWSER_AUTHORITY_REVOKED");
    }
    return context.frameKey;
  }

  currentReplyChannel(authority: AuthenticatedBrowserAuthority): ReplyChannelToken {
    if (
      !this.replyChannel
      || !this.isCurrent({
        authorityRef: authority.certificate.authorityRef,
        authorityEpoch: authority.certificate.authorityEpoch,
        replyChannelToken: this.replyChannel.value,
      })
    ) throw new Error("BROWSER_AUTHORITY_REVOKED");
    return this.replyChannel;
  }

  isCurrent(input: {
    authorityRef: string;
    authorityEpoch: number;
    replyChannelToken: string;
  }): boolean {
    const current = this.authenticator.issuer.slot();
    const channel = this.candidate?.channel;
    return current.kind === "PRESENT"
      && current.authority.certificate.authorityRef === input.authorityRef
      && current.authority.certificate.authorityEpoch === input.authorityEpoch
      && this.replyChannel?.value === input.replyChannelToken
      && Boolean(channel?.isOpen());
  }

  send(message: BrowserWireMessage): void {
    const channel = this.candidate?.channel;
    if (!channel?.isOpen()) throw new Error("BROWSER_INFRASTRUCTURE_UNAVAILABLE");
    if (Buffer.byteLength(JSON.stringify(message), "utf8") > GRASSEYE_BROWSER_CONTROLLER_HOST_CONTROL_MAX_BYTES) {
      throw new Error("BROWSER_BACKPRESSURE:controller-host control frame >256KiB");
    }
    channel.send(message);
  }

  terminate(reason: string): void {
    this.revokeFirst(reason);
    this.commands.failPending(reason);
    this.replyChannel = null;
    const candidate = this.candidate;
    if (!candidate) return;
    if (candidate.context) {
      candidate.context.pendingAuthority = null;
      candidate.context.authorityCommitted = false;
    }
    candidate.channel?.close(reason);
    candidate.raw.socket.destroy(new Error(reason));
  }

  private async bindServer(): Promise<void> {
    mkdirSync(path.dirname(this.input.socketPath), { recursive: true, mode: 0o700 });
    const server = net.createServer((socket) => this.accept(socket));
    this.server = server;
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(this.input.socketPath, resolve);
    });
    chmodSync(this.input.socketPath, 0o600);
  }

  private cleanupStaleSocketUnderOwnerLock(): void {
    if (!this.ownerLock?.isAlive()) throw new Error("BROWSER_CONTROLLER_ALREADY_OWNED");
    try {
      const current = lstatSync(this.input.socketPath);
      if (!current.isSocket()) throw new Error("BROWSER_CONTROLLER_SOCKET_IDENTITY_INVALID");
      if ((current.mode & 0o077) !== 0) {
        throw new Error("BROWSER_CONTROLLER_SOCKET_PERMISSION_INVALID");
      }
      if (typeof process.geteuid === "function" && current.uid !== process.geteuid()) {
        throw new Error("BROWSER_CONTROLLER_SOCKET_OWNER_INVALID");
      }
      rmSync(this.input.socketPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  private accept(socket: net.Socket): void {
    void this.enqueue(async () => {
      if (!this.input.acceptingConnections()) {
        socket.destroy(new Error("BROWSER_INFRASTRUCTURE_UNAVAILABLE:connection admission closed"));
        return;
      }
      if (this.candidate && !this.candidate.raw.socket.destroyed) {
        socket.destroy(new Error("BROWSER_CONTROLLER_ALREADY_OWNED:host connection already active"));
        return;
      }
      this.revokeFirst("new Host generation admitted");
      this.commands.failPending("new Host generation admitted");
      const generation = ++this.generation;
      const sourceChannelToken = `source:${randomUUID()}`;
      const raw = new RawControllerHostChannel(socket, {
        controllerIncarnationHash: this.input.controllerIncarnationHash,
        supervisorEpoch: this.input.supervisorEpoch,
        connectionGeneration: generation,
      });
      const candidate: HostCandidate = {
        raw,
        channel: null,
        context: null,
        buffer: "",
        generation,
        sourceChannelToken,
      };
      this.candidate = candidate;
      socket.setEncoding("utf8");
      socket.on("data", (chunk) => this.onData(
        candidate,
        typeof chunk === "string" ? chunk : chunk.toString("utf8"),
      ));
      socket.on("close", () => this.onClose(candidate));
      socket.on("error", () => undefined);
      this.applyEvent({
        type: "HOST_CONNECTED",
        fence: {
          supervisorEpoch: this.input.supervisorEpoch,
          controllerIncarnationHash: this.input.controllerIncarnationHash,
          connectionGeneration: generation,
          hostProcessEpoch: 0,
          nativePortEpoch: 0,
          sourceChannelToken,
        },
      });
      raw.sendChallenge();
    });
  }

  private onData(candidate: HostCandidate, chunk: string): void {
    candidate.buffer += chunk;
    if (Buffer.byteLength(candidate.buffer, "utf8") > GRASSEYE_BROWSER_ARTIFACT_CHUNK_MAX_BYTES + 64 * 1024) {
      this.terminate("BROWSER_BACKPRESSURE:host frame buffer exceeded");
      return;
    }
    for (;;) {
      const newline = candidate.buffer.indexOf("\n");
      if (newline < 0) break;
      const line = candidate.buffer.slice(0, newline);
      candidate.buffer = candidate.buffer.slice(newline + 1);
      if (!line) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        this.terminate("BROWSER_AUTH_TRANSCRIPT_INVALID:invalid JSON");
        return;
      }
      void this.enqueue(() => this.handleIncoming(candidate, parsed));
    }
  }

  private async handleIncoming(candidate: HostCandidate, value: unknown): Promise<void> {
    if (this.candidate !== candidate) return;
    if (!candidate.channel) {
      if (!isBrowserHostAttestation(value)) {
        this.terminate("BROWSER_HOST_IDENTITY_INVALID:attestation required first");
        return;
      }
      let identity;
      try {
        identity = candidate.raw.authenticate(value, {
          hostBinaryHash: this.input.expectedHostBinaryHash,
          chromeProcessIncarnationHash: this.input.chromeProcess.chromeProcessIncarnationHash,
          profileEnrollmentHash: this.input.profileEnrollmentHash,
          artifactSetHash: this.input.release.artifactSetHash,
        });
      } catch (error) {
        this.terminate(error instanceof Error ? error.message : "BROWSER_HOST_IDENTITY_INVALID");
        return;
      }
      candidate.channel = new AuthenticatedControllerHostChannel(
        candidate.raw.socket,
        identity,
        candidate.sourceChannelToken,
      );
      candidate.context = {
        connectionGeneration: candidate.generation,
        hostIdentity: identity,
        nativePortEpoch: 0,
        frameKey: null,
        challenge: null,
        pendingAuthority: null,
        authorityCommitted: false,
        heartbeatSequence: 0,
        send: (message) => candidate.channel!.send(message),
        terminate: (reason) => this.terminate(reason),
      };
      this.applyEvent({
        type: "HOST_AUTHENTICATED",
        fence: this.fence(candidate, 0),
      });
      return;
    }

    if (isArtifactChunk(value)) {
      const current = this.authenticator.issuer.slot();
      if (
        current.kind !== "PRESENT"
        || value.authorityRef !== current.authority.certificate.authorityRef
        || value.authorityEpoch !== current.authority.certificate.authorityEpoch
      ) {
        this.terminate("BROWSER_ARTIFACT_CHUNK_BINDING_INVALID");
        return;
      }
      this.artifacts.accept(value);
      return;
    }

    if (!isBrowserWireMessage(value) || !candidate.context) {
      this.terminate("BROWSER_AUTH_TRANSCRIPT_INVALID:wire message invalid");
      return;
    }
    if (value.type === "extension_hello") {
      candidate.context.nativePortEpoch = value.nativePortEpoch;
    }
    const fence = this.fence(candidate, candidate.context.nativePortEpoch);
    this.applyEvent({ type: "WIRE_MESSAGE", fence, message: value });
    if (this.authenticator.handle(value, candidate.context)) return;
    if (value.type === "response_frame") {
      const key = candidate.context.frameKey;
      if (!key) {
        this.terminate("BROWSER_AUTHORITY_REVOKED:no frame key");
        return;
      }
      await this.commands.handleResponse(value, key);
      return;
    }
    this.terminate(`BROWSER_AUTH_TRANSCRIPT_INVALID:unexpected ${value.type}`);
  }

  private onAuthorityCommitted(authority: AuthenticatedBrowserAuthority): void {
    const candidate = this.candidate;
    if (!candidate?.context || !candidate.channel) {
      this.terminate("BROWSER_AUTHORITY_REVOKED:commit without channel");
      return;
    }
    this.commands.resetSequence();
    this.replyChannel = issueReplyChannelToken({
      connectionGeneration: candidate.generation,
      hostProcessEpoch: candidate.context.hostIdentity.hostProcessEpoch,
      nativePortEpoch: candidate.context.nativePortEpoch,
      sourceChannelIdentity: candidate.sourceChannelToken,
    });
    this.lastHeartbeatProbeAt = 0;
    this.applyEvent({
      type: "AUTH_PROOF_COMMITTED",
      fence: this.fence(candidate, candidate.context.nativePortEpoch),
      authorityRefHash: hash(authority.certificate.authorityRef),
      activationTupleHash: authority.certificate.activationTupleHash,
    });
    this.input.onAuthoritySlotChanged();
  }

  private onClose(candidate: HostCandidate): void {
    void this.enqueue(async () => {
      if (this.candidate !== candidate) return;
      const fence = this.fence(candidate, candidate.context?.nativePortEpoch ?? 0);
      this.revokeFirst("Native Host disconnected");
      this.commands.failPending("Native Host disconnected");
      this.replyChannel = null;
      this.candidate = null;
      this.applyEvent({
        type: "HOST_DISCONNECTED",
        fence,
        reason: "Native Host disconnected",
      });
      this.input.onDisconnected("Native Host disconnected");
    });
  }

  private watchAuthority(): void {
    void this.enqueue(async () => {
      const candidate = this.candidate;
      if (!candidate?.context?.authorityCommitted) return;
      try {
        this.authenticator.requireCurrent();
      } catch {
        const fence = this.fence(candidate, candidate.context.nativePortEpoch);
        this.revokeFirst("BROWSER_AUTHORITY_LIVENESS_EXPIRED");
        this.commands.failPending("BROWSER_AUTHORITY_LIVENESS_EXPIRED");
        this.replyChannel = null;
        this.applyEvent({ type: "LIVENESS_EXPIRED", fence });
        this.input.onAuthoritySlotChanged();
        candidate.channel?.close("BROWSER_AUTHORITY_LIVENESS_EXPIRED");
        return;
      }
      const now = monotonicEpochMs();
      if (now - this.lastHeartbeatProbeAt >= 1_000) {
        this.lastHeartbeatProbeAt = now;
        try {
          this.authenticator.sendHeartbeatProbe(candidate.context);
        } catch {
          const fence = this.fence(candidate, candidate.context.nativePortEpoch);
          this.revokeFirst("BROWSER_AUTHORITY_LIVENESS_EXPIRED");
          this.commands.failPending("BROWSER_AUTHORITY_LIVENESS_EXPIRED");
          this.replyChannel = null;
          this.applyEvent({ type: "LIVENESS_EXPIRED", fence });
          this.input.onAuthoritySlotChanged();
          candidate.channel?.close("BROWSER_AUTHORITY_LIVENESS_EXPIRED");
        }
      }
    });
  }

  private revokeFirst(reason: string): void {
    this.authenticator.revoke(reason);
    if (this.candidate?.context) {
      this.candidate.context.pendingAuthority = null;
      this.candidate.context.authorityCommitted = false;
    }
  }

  private fence(candidate: HostCandidate, nativePortEpoch: number): BrowserTransportFence {
    return {
      supervisorEpoch: this.input.supervisorEpoch,
      controllerIncarnationHash: this.input.controllerIncarnationHash,
      connectionGeneration: candidate.generation,
      hostProcessEpoch: candidate.context?.hostIdentity.hostProcessEpoch ?? 0,
      nativePortEpoch,
      sourceChannelToken: candidate.sourceChannelToken,
    };
  }

  private applyEvent(event: BrowserTransportEvent): void {
    this.state = reduceBrowserTransportEvent(this.state, event);
  }

  private enqueue(operation: () => void | Promise<void>): Promise<void> {
    this.mailbox = this.mailbox.then(operation, operation);
    return this.mailbox;
  }
}
