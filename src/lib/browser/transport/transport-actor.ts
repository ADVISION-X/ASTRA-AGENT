import { randomUUID } from "node:crypto";
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
import { TransportAuthenticator } from "./transport-authenticator.js";
import { type ReplyChannelToken } from "./reply-channel-token.js";
import {
  reduceBrowserTransportEvent,
  type BrowserTransportReducerState,
} from "./transport-reducer.js";
import {
  createTransportActorRuntime,
  monotonicEpochMs,
  type TransportActorRuntime,
  type TransportHostCandidate,
} from "./transport-actor-runtime.js";
import {
  startTransportActorLifecycle,
  stopTransportActorLifecycle,
} from "./transport-actor-lifecycle.js";
import {
  isArtifactChunk,
  receiveTransportActorData,
} from "./transport-actor-inbound.js";
import { commitTransportAuthority } from "./transport-actor-authority.js";
import type {
  BrowserTransportEvent,
  BrowserTransportFence,
} from "./transport-event.js";

export class TransportActor {
  readonly artifacts: BrowserArtifactStreamReceiver;
  readonly commands: BrowserCommandActor;
  readonly authenticator: TransportAuthenticator;
  private readonly runtime: TransportActorRuntime =
    createTransportActorRuntime();

  constructor(
    private readonly input: {
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
    },
  ) {
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
      onAuthorityCommitted: (authority) =>
        commitTransportAuthority(
          {
            runtime: this.runtime,
            candidate: () => this.runtime.candidate,
            terminate: (reason) => this.terminate(reason),
            resetCommandSequence: () => this.commands.resetSequence(),
            fence: (candidate, nativePortEpoch) =>
              this.fence(candidate, nativePortEpoch),
            applyEvent: (event) => this.applyEvent(event),
            onAuthoritySlotChanged: () => input.onAuthoritySlotChanged(),
          },
          authority,
        ),
      onAuthorityRevoked: () => input.onAuthoritySlotChanged(),
    });
    this.commands = new BrowserCommandActor(
      input.dataDir,
      {
        requireAuthority: () => this.requireAuthority(),
        requireFrameKey: (authority) => this.requireFrameKey(authority),
        currentReplyChannel: (authority) => this.currentReplyChannel(authority),
        isCurrent: (binding) => this.isCurrent(binding),
        send: (message) => this.send(message),
        terminate: (reason) => this.terminate(reason),
      },
      this.artifacts,
    );
  }

  controlState(): BrowserTransportReducerState["controlState"] {
    return this.runtime.state.controlState;
  }

  authoritySlot() {
    return this.authenticator.issuer.slot();
  }

  requireAuthority(): AuthenticatedBrowserAuthority {
    return this.authenticator.requireCurrent();
  }

  async start(): Promise<void> {
    await startTransportActorLifecycle({
      dataDir: this.input.dataDir,
      socketPath: this.input.socketPath,
      ownerLockHelperPath: this.input.ownerLockHelperPath,
      supervisorEpoch: this.input.supervisorEpoch,
      processEpoch: this.input.chromeProcess.processEpoch,
      runtime: this.runtime,
      applyEvent: (event) => this.applyEvent(event),
      accept: (socket) => this.accept(socket),
    });
    this.runtime.watchdog = setInterval(() => this.watchAuthority(), 250);
  }

  async stop(): Promise<void> {
    this.applyEvent({ type: "STOP" });
    this.revokeFirst("browser infrastructure stopping");
    this.commands.failPending("browser infrastructure stopping");
    this.runtime.candidate?.channel?.close("browser infrastructure stopping");
    this.runtime.candidate?.raw.socket.destroy();
    this.runtime.candidate = null;
    this.runtime.replyChannel = null;
    if (this.runtime.watchdog) clearInterval(this.runtime.watchdog);
    this.runtime.watchdog = null;
    await stopTransportActorLifecycle({
      runtime: this.runtime,
      socketPath: this.input.socketPath,
    });
    await this.artifacts.discardAll();
  }

  requireFrameKey(authority: AuthenticatedBrowserAuthority): Buffer {
    const context = this.runtime.candidate?.context;
    if (
      !context?.frameKey ||
      !context.authorityCommitted ||
      authority.certificate.connectionGeneration !==
        context.connectionGeneration ||
      authority.certificate.nativePortEpoch !== context.nativePortEpoch
    ) {
      throw new Error("BROWSER_AUTHORITY_REVOKED");
    }
    return context.frameKey;
  }

  currentReplyChannel(
    authority: AuthenticatedBrowserAuthority,
  ): ReplyChannelToken {
    if (
      !this.runtime.replyChannel ||
      !this.isCurrent({
        authorityRef: authority.certificate.authorityRef,
        authorityEpoch: authority.certificate.authorityEpoch,
        replyChannelToken: this.runtime.replyChannel.value,
      })
    )
      throw new Error("BROWSER_AUTHORITY_REVOKED");
    return this.runtime.replyChannel;
  }

  isCurrent(input: {
    authorityRef: string;
    authorityEpoch: number;
    replyChannelToken: string;
  }): boolean {
    const current = this.authenticator.issuer.slot();
    const channel = this.runtime.candidate?.channel;
    return (
      current.kind === "PRESENT" &&
      current.authority.certificate.authorityRef === input.authorityRef &&
      current.authority.certificate.authorityEpoch === input.authorityEpoch &&
      this.runtime.replyChannel?.value === input.replyChannelToken &&
      Boolean(channel?.isOpen())
    );
  }

  send(message: BrowserWireMessage): void {
    const channel = this.runtime.candidate?.channel;
    if (!channel?.isOpen())
      throw new Error("BROWSER_INFRASTRUCTURE_UNAVAILABLE");
    if (
      Buffer.byteLength(JSON.stringify(message), "utf8") >
      GRASSEYE_BROWSER_CONTROLLER_HOST_CONTROL_MAX_BYTES
    ) {
      throw new Error(
        "BROWSER_BACKPRESSURE:controller-host control frame >256KiB",
      );
    }
    channel.send(message);
  }

  terminate(reason: string): void {
    this.revokeFirst(reason);
    this.commands.failPending(reason);
    this.runtime.replyChannel = null;
    const candidate = this.runtime.candidate;
    if (!candidate) return;
    if (candidate.context) {
      candidate.context.pendingAuthority = null;
      candidate.context.authorityCommitted = false;
    }
    candidate.channel?.close(reason);
    candidate.raw.socket.destroy(new Error(reason));
  }

  private accept(socket: net.Socket): void {
    void this.enqueue(async () => {
      if (!this.input.acceptingConnections()) {
        socket.destroy(
          new Error(
            "BROWSER_INFRASTRUCTURE_UNAVAILABLE:connection admission closed",
          ),
        );
        return;
      }
      if (
        this.runtime.candidate &&
        !this.runtime.candidate.raw.socket.destroyed
      ) {
        socket.destroy(
          new Error(
            "BROWSER_CONTROLLER_ALREADY_OWNED:host connection already active",
          ),
        );
        return;
      }
      this.revokeFirst("new Host generation admitted");
      this.commands.failPending("new Host generation admitted");
      const generation = ++this.runtime.generation;
      const sourceChannelToken = `source:${randomUUID()}`;
      const raw = new RawControllerHostChannel(socket, {
        controllerIncarnationHash: this.input.controllerIncarnationHash,
        supervisorEpoch: this.input.supervisorEpoch,
        connectionGeneration: generation,
      });
      const candidate: TransportHostCandidate = {
        raw,
        channel: null,
        context: null,
        buffer: "",
        generation,
        sourceChannelToken,
      };
      this.runtime.candidate = candidate;
      socket.setEncoding("utf8");
      socket.on("data", (chunk) =>
        receiveTransportActorData(
          {
            terminate: (reason) => this.terminate(reason),
            enqueue: (operation) => this.enqueue(operation),
            handleIncoming: (activeCandidate, value) =>
              this.handleIncoming(activeCandidate, value),
          },
          candidate,
          typeof chunk === "string" ? chunk : chunk.toString("utf8"),
        ),
      );
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

  private async handleIncoming(
    candidate: TransportHostCandidate,
    value: unknown,
  ): Promise<void> {
    if (this.runtime.candidate !== candidate) return;
    if (!candidate.channel) {
      this.authenticateHost(candidate, value);
      return;
    }

    if (isArtifactChunk(value)) {
      this.acceptArtifactChunk(value);
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
      await this.handleResponseFrame(candidate.context.frameKey, value);
      return;
    }
    this.terminate(`BROWSER_AUTH_TRANSCRIPT_INVALID:unexpected ${value.type}`);
  }

  private authenticateHost(
    candidate: TransportHostCandidate,
    value: unknown,
  ): void {
    if (!isBrowserHostAttestation(value)) {
      this.terminate(
        "BROWSER_HOST_IDENTITY_INVALID:attestation required first",
      );
      return;
    }
    let identity;
    try {
      identity = candidate.raw.authenticate(value, {
        hostBinaryHash: this.input.expectedHostBinaryHash,
        chromeProcessIncarnationHash:
          this.input.chromeProcess.chromeProcessIncarnationHash,
        profileEnrollmentHash: this.input.profileEnrollmentHash,
        artifactSetHash: this.input.release.artifactSetHash,
      });
    } catch (error) {
      this.terminate(
        error instanceof Error
          ? error.message
          : "BROWSER_HOST_IDENTITY_INVALID",
      );
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
  }

  private acceptArtifactChunk(value: BrowserArtifactChunk): void {
    const current = this.authenticator.issuer.slot();
    if (
      current.kind !== "PRESENT" ||
      value.authorityRef !== current.authority.certificate.authorityRef ||
      value.authorityEpoch !== current.authority.certificate.authorityEpoch
    ) {
      this.terminate("BROWSER_ARTIFACT_CHUNK_BINDING_INVALID");
      return;
    }
    this.artifacts.accept(value);
  }

  private async handleResponseFrame(
    key: Buffer | null,
    value: Extract<BrowserWireMessage, { type: "response_frame" }>,
  ): Promise<void> {
    if (!key) {
      this.terminate("BROWSER_AUTHORITY_REVOKED:no frame key");
      return;
    }
    await this.commands.handleResponse(value, key);
  }

  private onClose(candidate: TransportHostCandidate): void {
    void this.enqueue(async () => {
      if (this.runtime.candidate !== candidate) return;
      const fence = this.fence(
        candidate,
        candidate.context?.nativePortEpoch ?? 0,
      );
      this.revokeFirst("Native Host disconnected");
      this.commands.failPending("Native Host disconnected");
      this.runtime.replyChannel = null;
      this.runtime.candidate = null;
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
      const candidate = this.runtime.candidate;
      if (!candidate?.context?.authorityCommitted) return;
      try {
        this.authenticator.requireCurrent();
      } catch {
        const fence = this.fence(candidate, candidate.context.nativePortEpoch);
        this.revokeFirst("BROWSER_AUTHORITY_LIVENESS_EXPIRED");
        this.commands.failPending("BROWSER_AUTHORITY_LIVENESS_EXPIRED");
        this.runtime.replyChannel = null;
        this.applyEvent({ type: "LIVENESS_EXPIRED", fence });
        this.input.onAuthoritySlotChanged();
        candidate.channel?.close("BROWSER_AUTHORITY_LIVENESS_EXPIRED");
        return;
      }
      const now = monotonicEpochMs();
      if (now - this.runtime.lastHeartbeatProbeAt >= 1_000) {
        this.runtime.lastHeartbeatProbeAt = now;
        try {
          this.authenticator.sendHeartbeatProbe(candidate.context);
        } catch {
          const fence = this.fence(
            candidate,
            candidate.context.nativePortEpoch,
          );
          this.revokeFirst("BROWSER_AUTHORITY_LIVENESS_EXPIRED");
          this.commands.failPending("BROWSER_AUTHORITY_LIVENESS_EXPIRED");
          this.runtime.replyChannel = null;
          this.applyEvent({ type: "LIVENESS_EXPIRED", fence });
          this.input.onAuthoritySlotChanged();
          candidate.channel?.close("BROWSER_AUTHORITY_LIVENESS_EXPIRED");
        }
      }
    });
  }

  private revokeFirst(reason: string): void {
    this.authenticator.revoke(reason);
    if (this.runtime.candidate?.context) {
      this.runtime.candidate.context.pendingAuthority = null;
      this.runtime.candidate.context.authorityCommitted = false;
    }
  }

  private fence(
    candidate: TransportHostCandidate,
    nativePortEpoch: number,
  ): BrowserTransportFence {
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
    this.runtime.state = reduceBrowserTransportEvent(this.runtime.state, event);
  }

  private enqueue(operation: () => void | Promise<void>): Promise<void> {
    this.runtime.mailbox = this.runtime.mailbox.then(operation, operation);
    return this.runtime.mailbox;
  }
}
