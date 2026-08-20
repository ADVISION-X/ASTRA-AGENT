import {
  GRASSEYE_BROWSER_CAPABILITY_SET_HASH,
  GRASSEYE_BROWSER_CONTROLLER_HOST_CONTROL_MAX_BYTES,
  GRASSEYE_BROWSER_EXTENSION_ID,
  GRASSEYE_BROWSER_EXTENSION_VERSION,
  GRASSEYE_BROWSER_ORIGIN_POLICY_HASH,
  GRASSEYE_BROWSER_PERMISSION_POLICY_HASH,
  GRASSEYE_BROWSER_PROTOCOL_VERSION,
  GRASSEYE_BROWSER_RELEASE_IDENTITY,
  isBrowserWireMessage,
  type BrowserWireMessage,
} from "../protocol/generated/browser-protocol.js";
import {
  executeCommand,
  type BrowserWireCommandPayload,
  type BrowserWireResponsePayload,
} from "./service-worker-command-execution.js";
import { clearStagedBrowserArtifacts } from "./service-worker-interaction-commands.js";
import {
  authorityGrantTranscript,
  capabilityProbeTranscript,
  extensionAuthTranscript,
  heartbeatTranscript,
  randomNonce,
  type AuthorityBinding,
  type ExtensionArtifactIdentity,
  type NativePort,
  type PendingHandshake,
  type RunCommand,
} from "./service-worker-native-transport-auth.js";
import {
  createExtensionEphemeralSession,
  decryptExtensionFrame,
  encryptExtensionFrame,
  signExtensionTranscript,
  verifyControllerProof,
} from "./service-worker-session-crypto.js";

export type NativePortActorOptions = Readonly<{
  port: NativePort;
  nativePortEpoch: number;
  artifactIdentity: ExtensionArtifactIdentity;
  runCommand: RunCommand;
  isCurrent: () => boolean;
  disconnectReason: () => string | undefined;
  onClosed: (reason?: string) => void;
}>;

export class NativePortActor {
  readonly extensionInstanceId = crypto.randomUUID();
  private handshake: PendingHandshake | null = null;
  private authority: AuthorityBinding | null = null;
  private closed = false;
  private challengeConsumed = false;
  private lastAcceptedSequence = 0;
  private lastHeartbeatSequence = 0;
  private readonly commandReceipts = new Map<
    string,
    Promise<BrowserWireResponsePayload>
  >();

  constructor(private readonly options: NativePortActorOptions) {}

  start(): void {
    this.options.port.onMessage.addListener((message) => {
      void this.handleMessage(message).catch(() => this.failClosed());
    });
    this.options.port.onDisconnect.addListener(() => this.handleDisconnect());
    this.options.port.postMessage({
      protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
      releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
      type: "extension_hello",
      extensionId: GRASSEYE_BROWSER_EXTENSION_ID,
      extensionVersion: GRASSEYE_BROWSER_EXTENSION_VERSION,
      extensionInstanceId: this.extensionInstanceId,
      extensionArtifactDigest: this.options.artifactIdentity.extensionArtifactDigest,
      nativePortEpoch: this.options.nativePortEpoch,
      supportedActivationTupleIds: [
        ...this.options.artifactIdentity.supportedActivationTupleIds,
      ],
      capabilitySetHash: GRASSEYE_BROWSER_CAPABILITY_SET_HASH,
      permissionPolicyHash: GRASSEYE_BROWSER_PERMISSION_POLICY_HASH,
      originPolicyHash: GRASSEYE_BROWSER_ORIGIN_POLICY_HASH,
    });
  }

  private async handleMessage(message: unknown): Promise<void> {
    if (
      this.closed ||
      !this.options.isCurrent() ||
      !isBrowserWireMessage(message)
    )
      return;
    switch (message.type) {
      case "controller_challenge":
        await this.handleChallenge(message);
        return;
      case "capability_probe":
        await this.handleCapabilityProbe(message);
        return;
      case "authority_grant":
        await this.handleAuthorityGrant(message);
        return;
      case "heartbeat_probe":
        await this.handleHeartbeatProbe(message);
        return;
      case "command_frame":
        await this.handleCommandFrame(message);
    }
  }

  private async handleChallenge(
    message: Extract<BrowserWireMessage, { type: "controller_challenge" }>,
  ): Promise<void> {
    if (this.challengeConsumed || this.handshake || this.authority) {
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID:duplicate challenge");
    }
    if (message.nativePortEpoch !== this.options.nativePortEpoch) {
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID:port epoch mismatch");
    }
    this.challengeConsumed = true;
    const extensionNonce = randomNonce();
    const session = await createExtensionEphemeralSession({
      controllerPublicKeyBase64: message.controllerPublicKey,
      nonceBase64: message.controllerNonce,
    });
    this.handshake = Object.freeze({
      challengeId: message.challengeId,
      controllerNonce: message.controllerNonce,
      controllerIncarnationHash: message.controllerIncarnationHash,
      connectionGeneration: message.connectionGeneration,
      nativePortEpoch: message.nativePortEpoch,
      controllerPublicKey: message.controllerPublicKey,
      activationTupleHash: message.activationTupleHash,
      session,
    });
    const proof = await signExtensionTranscript(
      session.hmacKey,
      extensionAuthTranscript({
        controllerIncarnationHash: message.controllerIncarnationHash,
        connectionGeneration: message.connectionGeneration,
        nativePortEpoch: message.nativePortEpoch,
        challengeId: message.challengeId,
        controllerNonce: message.controllerNonce,
        extensionNonce,
        controllerPublicKey: message.controllerPublicKey,
        extensionPublicKey: session.publicKeyBase64,
        extensionInstanceId: this.extensionInstanceId,
        extensionArtifactDigest:
          this.options.artifactIdentity.extensionArtifactDigest,
        activationTupleHash: message.activationTupleHash,
        capabilitySetHash: GRASSEYE_BROWSER_CAPABILITY_SET_HASH,
        permissionPolicyHash: GRASSEYE_BROWSER_PERMISSION_POLICY_HASH,
        originPolicyHash: GRASSEYE_BROWSER_ORIGIN_POLICY_HASH,
      }),
    );
    if (this.closed || !this.options.isCurrent()) return;
    this.options.port.postMessage({
      protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
      releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
      type: "extension_authenticated",
      extensionInstanceId: this.extensionInstanceId,
      nativePortEpoch: message.nativePortEpoch,
      challengeId: message.challengeId,
      extensionNonce,
      extensionPublicKey: session.publicKeyBase64,
      transcriptProof: proof,
    });
  }

  private async handleCapabilityProbe(
    message: Extract<BrowserWireMessage, { type: "capability_probe" }>,
  ): Promise<void> {
    const handshake = this.requireHandshake();
    if (
      message.nativePortEpoch !== handshake.nativePortEpoch ||
      message.activationTupleHash !== handshake.activationTupleHash ||
      message.capabilitySetHash !== GRASSEYE_BROWSER_CAPABILITY_SET_HASH ||
      message.permissionPolicyHash !== GRASSEYE_BROWSER_PERMISSION_POLICY_HASH ||
      message.originPolicyHash !== GRASSEYE_BROWSER_ORIGIN_POLICY_HASH ||
      message.maxControlFrameBytes !==
        GRASSEYE_BROWSER_CONTROLLER_HOST_CONTROL_MAX_BYTES ||
      !(await verifyControllerProof(
        handshake.session.hmacKey,
        capabilityProbeTranscript({
          probeId: message.probeId,
          nativePortEpoch: message.nativePortEpoch,
          activationTupleHash: message.activationTupleHash,
          capabilitySetHash: message.capabilitySetHash,
          permissionPolicyHash: message.permissionPolicyHash,
          originPolicyHash: message.originPolicyHash,
          maxControlFrameBytes: message.maxControlFrameBytes,
        }),
        message.proof,
      ))
    ) {
      throw new Error("BROWSER_CAPABILITY_PROBE_FAILED");
    }
    const ack = {
      probeId: message.probeId,
      nativePortEpoch: message.nativePortEpoch,
      capabilitySetHash: GRASSEYE_BROWSER_CAPABILITY_SET_HASH,
      permissionPolicyHash: GRASSEYE_BROWSER_PERMISSION_POLICY_HASH,
      originPolicyHash: GRASSEYE_BROWSER_ORIGIN_POLICY_HASH,
      debuggerAvailable: true as const,
      maxControlFrameBytes: GRASSEYE_BROWSER_CONTROLLER_HOST_CONTROL_MAX_BYTES,
    };
    const proof = await signExtensionTranscript(
      handshake.session.hmacKey,
      capabilityProbeTranscript({
        activationTupleHash: handshake.activationTupleHash,
        ...ack,
      }),
    );
    if (this.closed || !this.options.isCurrent()) return;
    this.options.port.postMessage({
      protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
      releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
      type: "capability_probe_ack",
      ...ack,
      proof,
    });
  }

  private async handleAuthorityGrant(
    message: Extract<BrowserWireMessage, { type: "authority_grant" }>,
  ): Promise<void> {
    const handshake = this.requireHandshake();
    if (
      this.authority ||
      message.nativePortEpoch !== handshake.nativePortEpoch
    ) {
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID:grant binding");
    }
    const binding: AuthorityBinding = Object.freeze({
      authorityRef: message.authorityRef,
      authorityEpoch: message.authorityEpoch,
      authorityCertificateHash: message.authorityCertificateHash,
      connectionGeneration: message.connectionGeneration,
      nativePortEpoch: message.nativePortEpoch,
      livenessLeaseEpoch: message.livenessLeaseEpoch,
    });
    const transcript = authorityGrantTranscript({
      authorityRef: binding.authorityRef,
      authorityEpoch: binding.authorityEpoch,
      certificateHash: binding.authorityCertificateHash,
      connectionGeneration: binding.connectionGeneration,
      nativePortEpoch: binding.nativePortEpoch,
      challengeId: message.challengeId,
      livenessLeaseEpoch: binding.livenessLeaseEpoch,
    });
    if (
      message.challengeId !== handshake.challengeId ||
      !(await verifyControllerProof(
        handshake.session.hmacKey,
        transcript,
        message.grantProof,
      ))
    ) {
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID:grant proof");
    }
    const ackProof = await signExtensionTranscript(
      handshake.session.hmacKey,
      transcript,
    );
    if (this.closed || !this.options.isCurrent()) return;
    this.options.port.postMessage({
      protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
      releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
      type: "authority_grant_ack",
      authorityRef: binding.authorityRef,
      authorityEpoch: binding.authorityEpoch,
      authorityCertificateHash: binding.authorityCertificateHash,
      connectionGeneration: binding.connectionGeneration,
      nativePortEpoch: binding.nativePortEpoch,
      challengeId: message.challengeId,
      livenessLeaseEpoch: binding.livenessLeaseEpoch,
      ackProof,
    });
    this.authority = binding;
    this.lastAcceptedSequence = 0;
    this.lastHeartbeatSequence = 0;
  }

  private async handleHeartbeatProbe(
    message: Extract<BrowserWireMessage, { type: "heartbeat_probe" }>,
  ): Promise<void> {
    const authority = this.requireAuthority();
    const handshake = this.requireHandshake();
    if (
      message.authorityRef !== authority.authorityRef ||
      message.authorityEpoch !== authority.authorityEpoch ||
      message.livenessLeaseEpoch !== authority.livenessLeaseEpoch ||
      message.connectionGeneration !== authority.connectionGeneration ||
      message.nativePortEpoch !== authority.nativePortEpoch ||
      message.heartbeatSequence !== this.lastHeartbeatSequence + 1 ||
      !(await verifyControllerProof(
        handshake.session.hmacKey,
        heartbeatTranscript(message),
        message.proof,
      ))
    ) {
      throw new Error("BROWSER_AUTHORITY_LIVENESS_EXPIRED");
    }
    this.lastHeartbeatSequence = message.heartbeatSequence;
    const heartbeat = {
      authorityRef: authority.authorityRef,
      authorityEpoch: authority.authorityEpoch,
      livenessLeaseEpoch: authority.livenessLeaseEpoch,
      connectionGeneration: authority.connectionGeneration,
      nativePortEpoch: authority.nativePortEpoch,
      heartbeatSequence: message.heartbeatSequence,
      monotonicMs: performance.timeOrigin + performance.now(),
    };
    const proof = await signExtensionTranscript(
      handshake.session.hmacKey,
      heartbeatTranscript(heartbeat),
    );
    if (this.closed || !this.options.isCurrent()) return;
    this.options.port.postMessage({
      protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
      releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
      type: "heartbeat",
      ...heartbeat,
      proof,
    });
  }

  private async handleCommandFrame(
    message: Extract<BrowserWireMessage, { type: "command_frame" }>,
  ): Promise<void> {
    const authority = this.requireAuthority();
    const handshake = this.requireHandshake();
    const permit = message.permit;
    if (
      permit.authorityRef !== authority.authorityRef ||
      permit.authorityEpoch !== authority.authorityEpoch ||
      permit.authorityCertificateHash !== authority.authorityCertificateHash ||
      permit.sequence !== this.lastAcceptedSequence + 1 ||
      performance.timeOrigin + performance.now() > permit.deadlineMonotonicMs
    ) {
      throw new Error("BROWSER_COMMAND_PERMIT_STALE");
    }
    const payload = await decryptExtensionFrame<BrowserWireCommandPayload>(
      handshake.session.frameKey,
      {
        authorityRef: permit.authorityRef,
        authorityEpoch: permit.authorityEpoch,
        replyChannelToken: permit.replyChannelToken,
        sequence: permit.sequence,
        permitHash: permit.permitHash,
      },
      message,
    );
    if (
      payload.commandId !== permit.commandId ||
      payload.mutationClass !== permit.mutationClass ||
      this.commandReceipts.has(payload.commandId)
    ) {
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID:command replay");
    }
    this.lastAcceptedSequence = permit.sequence;
    const completion = executeCommand(
      { payload, deadlineMonotonicMs: permit.deadlineMonotonicMs },
      (command, expectedLoaderId) =>
        this.options.runCommand(command, expectedLoaderId),
    );
    this.commandReceipts.set(payload.commandId, completion);
    const response = await completion;
    if (
      this.closed ||
      !this.options.isCurrent() ||
      this.authority !== authority
    )
      return;
    await this.sendResponse(permit, response);
    this.trimReceipts();
  }

  private async sendResponse(
    permit: Extract<BrowserWireMessage, { type: "command_frame" }>["permit"],
    response: BrowserWireResponsePayload,
  ): Promise<void> {
    const handshake = this.requireHandshake();
    const encrypted = await encryptExtensionFrame(
      handshake.session.frameKey,
      {
        authorityRef: permit.authorityRef,
        authorityEpoch: permit.authorityEpoch,
        replyChannelToken: permit.replyChannelToken,
        sequence: permit.sequence,
        permitHash: permit.permitHash,
      },
      response,
    );
    if (this.closed || !this.options.isCurrent()) return;
    this.options.port.postMessage({
      protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
      releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
      type: "response_frame",
      replyChannelToken: permit.replyChannelToken,
      permitHash: permit.permitHash,
      authorityRef: permit.authorityRef,
      authorityEpoch: permit.authorityEpoch,
      sequence: permit.sequence,
      ...encrypted,
    });
  }

  private requireHandshake(): PendingHandshake {
    if (!this.handshake) throw new Error("BROWSER_AUTHORITY_REVOKED");
    return this.handshake;
  }

  private requireAuthority(): AuthorityBinding {
    if (!this.authority) throw new Error("BROWSER_AUTHORITY_REVOKED");
    return this.authority;
  }

  private trimReceipts(): void {
    if (this.commandReceipts.size <= 512) return;
    const first = this.commandReceipts.keys().next();
    if (!first.done) this.commandReceipts.delete(first.value);
  }

  private handleDisconnect(): void {
    if (!this.options.isCurrent()) return;
    this.terminate(this.options.disconnectReason());
  }

  private failClosed(): void {
    if (this.closed) return;
    this.terminate();
    try {
      this.options.port.disconnect();
    } catch {
      // The native port is already gone; all state was cleared first.
    }
  }

  private terminate(reason?: string): void {
    if (this.closed) return;
    this.closed = true;
    clearStagedBrowserArtifacts();
    if (this.options.isCurrent()) this.options.onClosed(reason);
  }
}
