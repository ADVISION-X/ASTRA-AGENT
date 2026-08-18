import {
  GRASSEYE_BROWSER_EXTENSION_ID,
  GRASSEYE_BROWSER_EXTENSION_VERSION,
  GRASSEYE_BROWSER_PROTOCOL_VERSION,
  GRASSEYE_BROWSER_RELEASE_IDENTITY,
  GRASSEYE_NATIVE_HOST_NAME,
  isBrowserWireMessage,
  type BrowserWireCommand,
  type BrowserWireCommandPayload,
  type BrowserWireMessage,
  type BrowserWireResponsePayload,
} from "./protocol.js";
import { executeCommand } from "./service-worker-command-execution.js";
import {
  createExtensionEphemeralSession,
  decryptExtensionFrame,
  encryptExtensionFrame,
  signExtensionTranscript,
  verifyControllerProof,
  type ExtensionEphemeralSession,
} from "./service-worker-session-crypto.js";

interface NativePort {
  postMessage(message: BrowserWireMessage): void;
  disconnect(): void;
  onMessage: { addListener(listener: (message: unknown) => void): void };
  onDisconnect: { addListener(listener: () => void): void };
}

declare const chrome: {
  runtime: {
    id: string;
    connectNative(name: string): NativePort;
    lastError?: { readonly message?: string };
  };
  alarms: {
    create(name: string, info: { periodInMinutes?: number; delayInMinutes?: number }): void;
  };
};

type RunCommand = (command: BrowserWireCommand, expectedLoaderId?: string) => Promise<unknown>;

type AuthorityBinding = Readonly<{
  authorityId: string;
  authorityCertificateHash: string;
  connectionGeneration: number;
  nativePortEpoch: number;
}>;

type PendingHandshake = Readonly<{
  challengeId: string;
  nonce: string;
  controllerSessionId: string;
  connectionGeneration: number;
  nativePortEpoch: number;
  controllerPublicKey: string;
  session: ExtensionEphemeralSession;
}>;

let runCommandHandler: RunCommand | null = null;
let disconnectHandler: (() => void) | null = null;
let activeActor: NativePortActor | null = null;
let nextPortEpoch = 0;
let reconnectAlarmScheduled = false;
let immediateReconnectAt = 0;

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

const grantTranscript = (binding: AuthorityBinding, challengeId: string): string => [
  "grant-v2",
  binding.authorityId,
  binding.authorityCertificateHash,
  binding.connectionGeneration,
  binding.nativePortEpoch,
  challengeId,
].join(":");

const grantAckTranscript = (binding: AuthorityBinding, challengeId: string): string => [
  "grant-ack-v2",
  binding.authorityId,
  binding.authorityCertificateHash,
  binding.connectionGeneration,
  binding.nativePortEpoch,
  challengeId,
].join(":");

const heartbeatTranscript = (binding: AuthorityBinding, monotonicMs: number): string => [
  "heartbeat-v2",
  binding.authorityId,
  binding.connectionGeneration,
  binding.nativePortEpoch,
  monotonicMs,
].join(":");

class NativePortActor {
  readonly extensionInstanceId = crypto.randomUUID();
  private handshake: PendingHandshake | null = null;
  private authority: AuthorityBinding | null = null;
  private closed = false;
  private challengeConsumed = false;
  private lastAcceptedSequence = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private readonly commandReceipts = new Map<string, Promise<BrowserWireResponsePayload>>();

  constructor(
    readonly port: NativePort,
    readonly nativePortEpoch: number,
  ) {}

  start(): void {
    this.port.onMessage.addListener((message) => {
      void this.handleMessage(message).catch(() => this.failClosed());
    });
    this.port.onDisconnect.addListener(() => this.handleDisconnect());
    this.port.postMessage({
      protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
      releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
      type: "extension_hello",
      extensionId: GRASSEYE_BROWSER_EXTENSION_ID,
      extensionVersion: GRASSEYE_BROWSER_EXTENSION_VERSION,
      extensionInstanceId: this.extensionInstanceId,
      nativePortEpoch: this.nativePortEpoch,
    });
  }

  private async handleMessage(message: unknown): Promise<void> {
    if (this.closed || activeActor !== this || !isBrowserWireMessage(message)) return;
    if (message.type === "controller_challenge") {
      await this.handleChallenge(message);
      return;
    }
    if (message.type === "authority_grant") {
      await this.handleAuthorityGrant(message);
      return;
    }
    if (message.type === "command_frame") {
      await this.handleCommandFrame(message);
    }
  }

  private async handleChallenge(message: Extract<BrowserWireMessage, { type: "controller_challenge" }>): Promise<void> {
    if (this.challengeConsumed || this.authority || this.handshake) {
      throw new Error("BROWSER_DUPLICATE_CHALLENGE");
    }
    if (message.nativePortEpoch !== this.nativePortEpoch) {
      throw new Error("BROWSER_PORT_EPOCH_MISMATCH");
    }
    this.challengeConsumed = true;
    const session = await createExtensionEphemeralSession({
      controllerPublicKeyBase64: message.controllerPublicKey,
      nonceBase64: message.nonce,
    });
    const handshake: PendingHandshake = Object.freeze({
      challengeId: message.challengeId,
      nonce: message.nonce,
      controllerSessionId: message.controllerSessionId,
      connectionGeneration: message.connectionGeneration,
      nativePortEpoch: message.nativePortEpoch,
      controllerPublicKey: message.controllerPublicKey,
      session,
    });
    this.handshake = handshake;
    const transcript = authTranscript({
      ...handshake,
      extensionInstanceId: this.extensionInstanceId,
      extensionPublicKey: session.publicKeyBase64,
    });
    const transcriptProof = await signExtensionTranscript(session.hmacKey, transcript);
    if (this.closed || activeActor !== this) return;
    this.port.postMessage({
      protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
      releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
      type: "extension_authenticated",
      extensionInstanceId: this.extensionInstanceId,
      nativePortEpoch: this.nativePortEpoch,
      challengeId: handshake.challengeId,
      nonce: handshake.nonce,
      extensionPublicKey: session.publicKeyBase64,
      transcriptProof,
    });
  }

  private async handleAuthorityGrant(message: Extract<BrowserWireMessage, { type: "authority_grant" }>): Promise<void> {
    const handshake = this.handshake;
    if (!handshake || this.authority) throw new Error("BROWSER_AUTHORITY_GRANT_WITHOUT_HANDSHAKE");
    if (
      message.challengeId !== handshake.challengeId
      || message.connectionGeneration !== handshake.connectionGeneration
      || message.nativePortEpoch !== this.nativePortEpoch
    ) {
      throw new Error("BROWSER_AUTHORITY_GRANT_GENERATION_MISMATCH");
    }
    const binding: AuthorityBinding = Object.freeze({
      authorityId: message.authorityId,
      authorityCertificateHash: message.authorityCertificateHash,
      connectionGeneration: message.connectionGeneration,
      nativePortEpoch: message.nativePortEpoch,
    });
    const valid = await verifyControllerProof(
      handshake.session.hmacKey,
      grantTranscript(binding, handshake.challengeId),
      message.grantProof,
    );
    if (!valid) throw new Error("BROWSER_AUTHORITY_GRANT_PROOF_INVALID");
    const ackProof = await signExtensionTranscript(
      handshake.session.hmacKey,
      grantAckTranscript(binding, handshake.challengeId),
    );
    if (this.closed || activeActor !== this) return;
    this.port.postMessage({
      protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
      releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
      type: "authority_grant_ack",
      authorityId: binding.authorityId,
      authorityCertificateHash: binding.authorityCertificateHash,
      connectionGeneration: binding.connectionGeneration,
      nativePortEpoch: binding.nativePortEpoch,
      challengeId: handshake.challengeId,
      ackProof,
    });
    this.authority = binding;
    this.lastAcceptedSequence = 0;
    this.startHeartbeat();
  }

  private async handleCommandFrame(message: Extract<BrowserWireMessage, { type: "command_frame" }>): Promise<void> {
    const authority = this.authority;
    const handshake = this.handshake;
    if (!authority || !handshake || !runCommandHandler) throw new Error("BROWSER_AUTHORITY_ABSENT");
    const permit = message.permit;
    if (
      permit.authorityId !== authority.authorityId
      || permit.authorityCertificateHash !== authority.authorityCertificateHash
      || permit.connectionGeneration !== authority.connectionGeneration
      || permit.nativePortEpoch !== authority.nativePortEpoch
    ) {
      throw new Error("BROWSER_COMMAND_AUTHORITY_MISMATCH");
    }
    if (permit.deadlineAt <= Date.now()) throw new Error("BROWSER_COMMAND_DEADLINE_EXPIRED");
    if (permit.sequence !== this.lastAcceptedSequence + 1) {
      throw new Error("BROWSER_COMMAND_SEQUENCE_INVALID");
    }
    const payload = await decryptExtensionFrame<BrowserWireCommandPayload>(
      handshake.session.frameKey,
      {
        authorityId: authority.authorityId,
        connectionGeneration: authority.connectionGeneration,
        nativePortEpoch: authority.nativePortEpoch,
        sequence: permit.sequence,
      },
      message,
    );
    if (payload.commandId !== permit.commandId) throw new Error("BROWSER_COMMAND_ID_MISMATCH");
    if (this.commandReceipts.has(payload.commandId)) throw new Error("BROWSER_COMMAND_ID_REPLAY");
    this.lastAcceptedSequence = permit.sequence;
    const completion = executeCommand(
      { payload, deadlineAt: permit.deadlineAt },
      async (command, expectedLoaderId) => runCommandHandler!(command, expectedLoaderId),
    );
    this.commandReceipts.set(payload.commandId, completion);
    const response = await completion;
    if (this.closed || activeActor !== this || this.authority?.authorityId !== authority.authorityId) return;
    await this.sendResponse(permit, response);
    this.trimReceipts();
  }

  private async sendResponse(
    permit: Extract<BrowserWireMessage, { type: "command_frame" }>["permit"],
    response: BrowserWireResponsePayload,
  ): Promise<void> {
    const authority = this.authority;
    const handshake = this.handshake;
    if (!authority || !handshake) return;
    const encrypted = await encryptExtensionFrame(
      handshake.session.frameKey,
      {
        authorityId: authority.authorityId,
        connectionGeneration: authority.connectionGeneration,
        nativePortEpoch: authority.nativePortEpoch,
        sequence: permit.sequence,
      },
      response,
    );
    if (this.closed || activeActor !== this) return;
    this.port.postMessage({
      protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
      releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
      type: "response_frame",
      permitHash: permit.permitHash,
      authorityId: authority.authorityId,
      connectionGeneration: authority.connectionGeneration,
      nativePortEpoch: authority.nativePortEpoch,
      sequence: permit.sequence,
      ...encrypted,
    });
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      void this.sendHeartbeat().catch(() => this.failClosed());
    }, 1_000);
    void this.sendHeartbeat().catch(() => this.failClosed());
  }

  private async sendHeartbeat(): Promise<void> {
    const authority = this.authority;
    const handshake = this.handshake;
    if (!authority || !handshake || this.closed || activeActor !== this) return;
    const monotonicMs = Math.floor(performance.now());
    const proof = await signExtensionTranscript(
      handshake.session.hmacKey,
      heartbeatTranscript(authority, monotonicMs),
    );
    if (this.closed || activeActor !== this) return;
    this.port.postMessage({
      protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
      releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
      type: "heartbeat",
      authorityId: authority.authorityId,
      connectionGeneration: authority.connectionGeneration,
      nativePortEpoch: authority.nativePortEpoch,
      monotonicMs,
      proof,
    });
  }

  private trimReceipts(): void {
    if (this.commandReceipts.size <= 512) return;
    const first = this.commandReceipts.keys().next();
    if (!first.done) this.commandReceipts.delete(first.value);
  }

  private handleDisconnect(): void {
    const disconnectReason = chrome.runtime.lastError?.message;
    void disconnectReason;
    if (activeActor !== this) return;
    activeActor = null;
    this.closeLocalState();
    disconnectHandler?.();
    scheduleReconnect();
  }

  private failClosed(): void {
    if (this.closed) return;
    if (activeActor === this) activeActor = null;
    this.closeLocalState();
    try { this.port.disconnect(); } catch { /* already disconnected */ }
    disconnectHandler?.();
    scheduleReconnect();
  }

  private closeLocalState(): void {
    this.closed = true;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    this.authority = null;
    this.handshake = null;
    this.commandReceipts.clear();
  }
}

const scheduleReconnect = (): void => {
  const now = Date.now();
  if (runCommandHandler && !activeActor && now >= immediateReconnectAt) {
    immediateReconnectAt = now + 1_000;
    connectNativeTransport();
  }
  if (runCommandHandler && !activeActor && !reconnectAlarmScheduled) {
    reconnectAlarmScheduled = true;
    chrome.alarms.create("grasseye-native-reconnect", { delayInMinutes: 0.5 });
  }
};

export const connectNativeTransport = (): void => {
  if (activeActor || !runCommandHandler) return;
  if (chrome.runtime.id !== GRASSEYE_BROWSER_EXTENSION_ID) {
    throw new Error("BROWSER_EXTENSION_ID_MISMATCH");
  }
  const port = chrome.runtime.connectNative(GRASSEYE_NATIVE_HOST_NAME);
  const actor = new NativePortActor(port, ++nextPortEpoch);
  activeActor = actor;
  actor.start();
};

export const configureNativeTransport = (input: {
  runCommand: RunCommand;
  onDisconnect: () => void;
}): void => {
  runCommandHandler = input.runCommand;
  disconnectHandler = input.onDisconnect;
};

export const handleNativeReconnectAlarm = (): void => {
  reconnectAlarmScheduled = false;
  connectNativeTransport();
};
