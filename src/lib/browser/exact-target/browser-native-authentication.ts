import { randomBytes, randomUUID } from "node:crypto";

import type {
  AuthenticatedBrowserAuthority,
  BrowserAuthoritySnapshot,
} from "../authority/browser-authority-certificate.js";
import {
  BrowserAuthorityAbsentError,
  BrowserAuthorityIssuer,
} from "../authority/browser-authority-issuer.js";
import {
  browserTranscriptProof,
  createBrowserControllerEphemeralKey,
  verifyBrowserTranscriptProof,
} from "../transport/browser-session-crypto.js";
import {
  GRASSEYE_BROWSER_PROTOCOL_VERSION,
  GRASSEYE_BROWSER_RELEASE_IDENTITY,
  type BrowserWireMessage,
} from "./browser-native-transport-protocol.js";
import { BrowserTerminalError } from "./browser-command-contract.js";
import type { BrowserNativeConnectionState } from "./browser-native-transport-server.js";

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
  "auth-v2", GRASSEYE_BROWSER_PROTOCOL_VERSION, GRASSEYE_BROWSER_RELEASE_IDENTITY,
  input.controllerSessionId, input.connectionGeneration, input.nativePortEpoch,
  input.challengeId, input.nonce, input.controllerPublicKey,
  input.extensionInstanceId, input.extensionPublicKey,
].join(":");

const grantTranscript = (input: Readonly<{
  authorityId: string;
  authorityCertificateHash: string;
  connectionGeneration: number;
  nativePortEpoch: number;
  challengeId: string;
}>): string => [
  "grant-v2", input.authorityId, input.authorityCertificateHash,
  input.connectionGeneration, input.nativePortEpoch, input.challengeId,
].join(":");

const grantAckTranscript = (input: Readonly<{
  authorityId: string;
  authorityCertificateHash: string;
  connectionGeneration: number;
  nativePortEpoch: number;
  challengeId: string;
}>): string => [
  "grant-ack-v2", input.authorityId, input.authorityCertificateHash,
  input.connectionGeneration, input.nativePortEpoch, input.challengeId,
].join(":");

const heartbeatTranscript = (input: Readonly<{
  authorityId: string;
  connectionGeneration: number;
  nativePortEpoch: number;
  monotonicMs: number;
}>): string => [
  "heartbeat-v2", input.authorityId, input.connectionGeneration,
  input.nativePortEpoch, input.monotonicMs,
].join(":");

type AuthenticationMessage = Extract<BrowserWireMessage, {
  type: "extension_hello" | "extension_authenticated" | "authority_grant_ack" | "heartbeat";
}>;

export class BrowserNativeAuthentication {
  private readonly issuer = new BrowserAuthorityIssuer();
  private readonly waiters = new Set<{
    resolve: (authority: AuthenticatedBrowserAuthority) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }>();

  constructor(private readonly owner: {
    controllerSessionId: string;
    profileEnrollmentId: string;
    send(connection: BrowserNativeConnectionState, message: BrowserWireMessage): void;
    terminate(connection: BrowserNativeConnectionState, reason: string): void;
    emit(stage: "extension_hello" | "challenge_sent" | "authority_grant_sent"
      | "authenticated_authority_issued" | "authority_revoked", generation: number, reason?: string): void;
  }) {}

  waitForAuthority(timeoutMs: number): Promise<AuthenticatedBrowserAuthority> {
    try {
      return Promise.resolve(this.issuer.requireCurrent());
    } catch (error) {
      if (!(error instanceof BrowserAuthorityAbsentError)) return Promise.reject(error);
    }
    return new Promise<AuthenticatedBrowserAuthority>((resolve, reject) => {
      const waiter = { resolve, reject, timer: setTimeout(() => undefined, timeoutMs) };
      clearTimeout(waiter.timer);
      waiter.timer = setTimeout(() => {
        this.waiters.delete(waiter);
        reject(new BrowserTerminalError(
          "TRANSPORT_DISCONNECTED",
          "authenticated browser authority was not established before the startup deadline",
        ));
      }, timeoutMs);
      this.waiters.add(waiter);
    });
  }

  snapshot(): BrowserAuthoritySnapshot {
    return this.issuer.snapshot();
  }

  requireCurrent(): AuthenticatedBrowserAuthority {
    return this.issuer.requireCurrent();
  }

  isCurrent(binding: {
    authorityId: string;
    connectionGeneration: number;
    nativePortEpoch: number;
  }): boolean {
    return this.issuer.isCurrent(binding);
  }

  revoke(reason: string): void {
    const before = this.issuer.snapshot();
    this.issuer.revoke(reason);
    if (before.state === "AUTHENTICATED_AUTHORITY_PRESENT") {
      this.owner.emit("authority_revoked", before.connectionGeneration, reason);
    }
  }

  rejectWaiters(error: Error): void {
    for (const waiter of this.waiters) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
    this.waiters.clear();
  }

  handle(value: BrowserWireMessage, connection: BrowserNativeConnectionState): boolean {
    if (!this.isAuthenticationMessage(value)) return false;
    if (value.type === "extension_hello") this.handleHello(value, connection);
    else if (value.type === "extension_authenticated") this.handleAuthentication(value, connection);
    else if (value.type === "authority_grant_ack") this.handleGrantAck(value, connection);
    else this.handleHeartbeat(value, connection);
    return true;
  }

  private isAuthenticationMessage(value: BrowserWireMessage): value is AuthenticationMessage {
    return value.type === "extension_hello"
      || value.type === "extension_authenticated"
      || value.type === "authority_grant_ack"
      || value.type === "heartbeat";
  }

  private handleHello(
    value: Extract<BrowserWireMessage, { type: "extension_hello" }>,
    connection: BrowserNativeConnectionState,
  ): void {
    if (connection.challenge || connection.pendingAuthority || connection.authorityCommitted) {
      this.owner.terminate(connection, "extension hello repeated within one connection generation");
      return;
    }
    connection.nativePortEpoch = value.nativePortEpoch;
    connection.extensionInstanceId = value.extensionInstanceId;
    connection.challenge = Object.freeze({
      challengeId: randomUUID(),
      nonce: randomBytes(32).toString("base64"),
      ephemeral: createBrowserControllerEphemeralKey(),
      nativePortEpoch: value.nativePortEpoch,
      extensionInstanceId: value.extensionInstanceId,
    });
    const challenge = connection.challenge;
    this.owner.emit("extension_hello", connection.generation);
    this.owner.send(connection, {
      protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
      releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
      type: "controller_challenge",
      controllerSessionId: this.owner.controllerSessionId,
      connectionGeneration: connection.generation,
      nativePortEpoch: challenge.nativePortEpoch,
      challengeId: challenge.challengeId,
      nonce: challenge.nonce,
      controllerPublicKey: challenge.ephemeral.publicKeyBase64,
    });
    this.owner.emit("challenge_sent", connection.generation);
  }

  private handleAuthentication(
    value: Extract<BrowserWireMessage, { type: "extension_authenticated" }>,
    connection: BrowserNativeConnectionState,
  ): void {
    const challenge = connection.challenge;
    if (!challenge || connection.pendingAuthority || connection.authorityCommitted || connection.frameKey) {
      this.owner.terminate(connection, "extension authentication arrived outside the one-time challenge window");
      return;
    }
    const identityMatches = value.challengeId === challenge.challengeId
      && value.nonce === challenge.nonce
      && value.nativePortEpoch === challenge.nativePortEpoch
      && value.extensionInstanceId === challenge.extensionInstanceId;
    if (!identityMatches) {
      this.owner.terminate(connection, "extension authentication transcript mismatch");
      return;
    }
    const frameKey = this.deriveAuthenticatedFrameKey(value, connection);
    if (!frameKey) return;
    connection.frameKey = frameKey;
    this.issueAuthorityGrant(connection, frameKey);
  }

  private deriveAuthenticatedFrameKey(
    value: Extract<BrowserWireMessage, { type: "extension_authenticated" }>,
    connection: BrowserNativeConnectionState,
  ): Buffer | null {
    const challenge = connection.challenge!;
    let frameKey: Buffer;
    try {
      frameKey = challenge.ephemeral.computeSharedSecret(value.extensionPublicKey, challenge.nonce);
    } catch {
      this.owner.terminate(connection, "extension public key was invalid");
      return null;
    }
    const transcript = authTranscript({
      controllerSessionId: this.owner.controllerSessionId,
      connectionGeneration: connection.generation,
      nativePortEpoch: challenge.nativePortEpoch,
      challengeId: challenge.challengeId,
      nonce: challenge.nonce,
      controllerPublicKey: challenge.ephemeral.publicKeyBase64,
      extensionInstanceId: challenge.extensionInstanceId,
      extensionPublicKey: value.extensionPublicKey,
    });
    if (verifyBrowserTranscriptProof(frameKey, transcript, value.transcriptProof)) return frameKey;
    this.owner.terminate(connection, "extension authentication proof mismatch");
    return null;
  }

  private issueAuthorityGrant(connection: BrowserNativeConnectionState, frameKey: Buffer): void {
    const challenge = connection.challenge!;
    const candidate = this.issuer.prepare({
      controllerSessionId: this.owner.controllerSessionId,
      connectionGeneration: connection.generation,
      nativePortEpoch: challenge.nativePortEpoch,
      extensionInstanceId: challenge.extensionInstanceId,
      releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
      profileEnrollmentId: this.owner.profileEnrollmentId,
      protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
    });
    connection.pendingAuthority = candidate;
    const certificate = candidate.certificate;
    const grantProof = browserTranscriptProof(frameKey, grantTranscript({
      authorityId: certificate.authorityId,
      authorityCertificateHash: certificate.certificateHash,
      connectionGeneration: certificate.connectionGeneration,
      nativePortEpoch: certificate.nativePortEpoch,
      challengeId: challenge.challengeId,
    }));
    this.owner.send(connection, {
      protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
      releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
      type: "authority_grant",
      authorityId: certificate.authorityId,
      authorityCertificateHash: certificate.certificateHash,
      connectionGeneration: certificate.connectionGeneration,
      nativePortEpoch: certificate.nativePortEpoch,
      challengeId: challenge.challengeId,
      grantProof,
    });
    this.owner.emit("authority_grant_sent", connection.generation);
  }

  private handleGrantAck(
    value: Extract<BrowserWireMessage, { type: "authority_grant_ack" }>,
    connection: BrowserNativeConnectionState,
  ): void {
    const challenge = connection.challenge;
    const candidate = connection.pendingAuthority;
    const frameKey = connection.frameKey;
    if (!challenge || !candidate || !frameKey || connection.authorityCommitted) {
      this.owner.terminate(connection, "authority grant acknowledgement arrived outside the pending grant window");
      return;
    }
    const certificate = candidate.certificate;
    const bindingMatches = value.challengeId === challenge.challengeId
      && value.authorityId === certificate.authorityId
      && value.authorityCertificateHash === certificate.certificateHash
      && value.connectionGeneration === certificate.connectionGeneration
      && value.nativePortEpoch === certificate.nativePortEpoch;
    const proofValid = bindingMatches && verifyBrowserTranscriptProof(frameKey, grantAckTranscript({
      authorityId: certificate.authorityId,
      authorityCertificateHash: certificate.certificateHash,
      connectionGeneration: certificate.connectionGeneration,
      nativePortEpoch: certificate.nativePortEpoch,
      challengeId: challenge.challengeId,
    }), value.ackProof);
    if (!proofValid) {
      this.owner.terminate(connection, bindingMatches
        ? "authority grant acknowledgement proof mismatch"
        : "authority grant acknowledgement binding mismatch");
      return;
    }
    const authority = this.issuer.commit(candidate);
    connection.pendingAuthority = null;
    connection.authorityCommitted = true;
    this.owner.emit("authenticated_authority_issued", connection.generation);
    this.resolveWaiters(authority);
  }

  private handleHeartbeat(
    value: Extract<BrowserWireMessage, { type: "heartbeat" }>,
    connection: BrowserNativeConnectionState,
  ): void {
    const frameKey = connection.frameKey;
    if (!frameKey || !connection.authorityCommitted) {
      this.owner.terminate(connection, "heartbeat arrived without a committed authenticated authority");
      return;
    }
    if (!this.issuer.isCurrent(value)) {
      this.owner.terminate(connection, "stale heartbeat cannot renew browser authority");
      return;
    }
    if (!verifyBrowserTranscriptProof(frameKey, heartbeatTranscript(value), value.proof)) {
      this.owner.terminate(connection, "heartbeat proof mismatch");
      return;
    }
    try {
      this.issuer.heartbeat(value);
    } catch {
      this.owner.terminate(connection, "heartbeat failed authority liveness validation");
    }
  }

  private resolveWaiters(authority: AuthenticatedBrowserAuthority): void {
    for (const waiter of this.waiters) {
      clearTimeout(waiter.timer);
      waiter.resolve(authority);
    }
    this.waiters.clear();
  }
}
