import { randomBytes, randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

import type { BrowserChromeProcessAttestation } from "../profile/browser-profile-process-attestation.js";
import type { BrowserManagedPolicyReadbackV1 } from "../profile/managed-policy-readback.js";
import type { VerifiedBrowserReleaseBinding } from "../release/browser-release-contract.js";
import {
  GRASSEYE_BROWSER_CAPABILITY_SET_HASH,
  GRASSEYE_BROWSER_CONTROLLER_HOST_CONTROL_MAX_BYTES,
  GRASSEYE_BROWSER_EXTENSION_ID,
  GRASSEYE_BROWSER_EXTENSION_VERSION,
  GRASSEYE_BROWSER_LIVENESS_POLICY_HASH,
  GRASSEYE_BROWSER_ORIGIN_POLICY_HASH,
  GRASSEYE_BROWSER_PERMISSION_POLICY_HASH,
  GRASSEYE_BROWSER_PROTOCOL_REVISION,
  GRASSEYE_BROWSER_PROTOCOL_VERSION,
  GRASSEYE_BROWSER_RELEASE_IDENTITY,
  type BrowserWireMessage,
} from "../protocol/generated/browser-protocol.js";
import { BrowserAuthorityIssuer } from "../infrastructure/browser-authority-issuer.js";
import type { AuthenticatedBrowserAuthority } from "../infrastructure/browser-authority-certificate.js";
import {
  browserTranscriptProof,
  createBrowserControllerEphemeralKey,
  verifyBrowserTranscriptProof,
  type BrowserControllerEphemeralKey,
} from "./transport-frame-crypto.js";
import {
  browserAuthorityGrantTranscript,
  browserHeartbeatTranscript,
  sha256BrowserTranscript,
} from "./transport-transcript.js";
import {
  capabilityProbeTranscript,
  extensionAuthenticationTranscript,
} from "./transport-authenticator-transcripts.js";
import type { AuthenticatedControllerHostIdentity } from "./raw-controller-host-channel.js";

const monotonicEpochMs = (): number =>
  performance.timeOrigin + performance.now();
export type ChallengeState = Readonly<{
  challengeId: string;
  controllerNonce: string;
  extensionNonce: string | null;
  ephemeral: BrowserControllerEphemeralKey;
  hello: Extract<BrowserWireMessage, { type: "extension_hello" }>;
  probeId: string | null;
  authTranscriptHash: `sha256:${string}` | null;
}>;

export type BrowserAuthenticatedTransportContext = {
  readonly connectionGeneration: number;
  readonly hostIdentity: AuthenticatedControllerHostIdentity;
  nativePortEpoch: number;
  frameKey: Buffer | null;
  challenge: ChallengeState | null;
  pendingAuthority: AuthenticatedBrowserAuthority | null;
  authorityCommitted: boolean;
  heartbeatSequence: number;
  send(message: BrowserWireMessage): void;
  terminate(reason: string): void;
};

export class TransportAuthenticator {
  readonly issuer = new BrowserAuthorityIssuer();

  constructor(
    private readonly input: {
      controllerIncarnationHash: `sha256:${string}`;
      profileEnrollmentHash: `sha256:${string}`;
      chromeProcess: BrowserChromeProcessAttestation;
      managedPolicy: BrowserManagedPolicyReadbackV1;
      release: VerifiedBrowserReleaseBinding;
      onAuthorityCommitted(authority: AuthenticatedBrowserAuthority): void;
      onAuthorityRevoked(reason: string): void;
    },
  ) {}

  handle(
    message: BrowserWireMessage,
    connection: BrowserAuthenticatedTransportContext,
  ): boolean {
    switch (message.type) {
      case "extension_hello":
        this.handleHello(message, connection);
        return true;
      case "extension_authenticated":
        this.handleExtensionAuthenticated(message, connection);
        return true;
      case "capability_probe_ack":
        this.handleCapabilityProbeAck(message, connection);
        return true;
      case "authority_grant_ack":
        this.handleGrantAck(message, connection);
        return true;
      case "heartbeat":
        this.handleHeartbeat(message, connection);
        return true;
      default:
        return false;
    }
  }

  sendHeartbeatProbe(connection: BrowserAuthenticatedTransportContext): void {
    const frameKey = connection.frameKey;
    if (!frameKey || !connection.authorityCommitted) return;
    const certificate = this.issuer.requireCurrent().certificate;
    const heartbeatSequence = connection.heartbeatSequence + 1;
    const probe = {
      authorityRef: certificate.authorityRef,
      authorityEpoch: certificate.authorityEpoch,
      livenessLeaseEpoch: certificate.livenessLeaseEpoch,
      connectionGeneration: certificate.connectionGeneration,
      nativePortEpoch: certificate.nativePortEpoch,
      heartbeatSequence,
      monotonicMs: monotonicEpochMs(),
    };
    connection.send({
      protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
      releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
      type: "heartbeat_probe",
      ...probe,
      proof: browserTranscriptProof(
        frameKey,
        browserHeartbeatTranscript(probe),
      ),
    });
  }

  revoke(reason: string): void {
    const hadAuthority = this.issuer.slot().kind === "PRESENT";
    this.issuer.revoke(reason);
    if (hadAuthority) this.input.onAuthorityRevoked(reason);
  }

  requireCurrent(): AuthenticatedBrowserAuthority {
    return this.issuer.requireCurrent();
  }

  private handleHello(
    message: Extract<BrowserWireMessage, { type: "extension_hello" }>,
    connection: BrowserAuthenticatedTransportContext,
  ): void {
    if (
      connection.challenge ||
      connection.pendingAuthority ||
      connection.authorityCommitted
    ) {
      connection.terminate(
        "BROWSER_AUTH_TRANSCRIPT_INVALID:duplicate extension hello",
      );
      return;
    }
    const tuple = this.input.release.activationTuple;
    if (
      message.extensionId !== GRASSEYE_BROWSER_EXTENSION_ID ||
      message.extensionVersion !== GRASSEYE_BROWSER_EXTENSION_VERSION ||
      message.extensionArtifactDigest !== tuple.extensionArtifactDigest ||
      !message.supportedActivationTupleIds.includes(tuple.tupleId) ||
      message.capabilitySetHash !== tuple.capabilitySetHash ||
      message.permissionPolicyHash !== tuple.permissionPolicyHash ||
      message.originPolicyHash !== GRASSEYE_BROWSER_ORIGIN_POLICY_HASH ||
      this.input.managedPolicy.permissionPolicyHash !==
        message.permissionPolicyHash ||
      this.input.managedPolicy.originPolicyHash !== message.originPolicyHash
    ) {
      connection.terminate("BROWSER_EXTENSION_ARTIFACT_MISMATCH");
      return;
    }
    connection.nativePortEpoch = message.nativePortEpoch;
    const ephemeral = createBrowserControllerEphemeralKey();
    const challenge: ChallengeState = Object.freeze({
      challengeId: randomUUID(),
      controllerNonce: randomBytes(32).toString("base64"),
      extensionNonce: null,
      ephemeral,
      hello: message,
      probeId: null,
      authTranscriptHash: null,
    });
    connection.challenge = challenge;
    connection.send({
      protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
      releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
      type: "controller_challenge",
      controllerIncarnationHash: this.input.controllerIncarnationHash,
      connectionGeneration: connection.connectionGeneration,
      nativePortEpoch: message.nativePortEpoch,
      challengeId: challenge.challengeId,
      controllerNonce: challenge.controllerNonce,
      controllerPublicKey: ephemeral.publicKeyBase64,
      activationTupleId: tuple.tupleId,
      activationTupleHash: this.input.release.activationTupleHash,
      transcriptPrefixHash: sha256BrowserTranscript(JSON.stringify(message)),
    });
  }

  private handleExtensionAuthenticated(
    message: Extract<BrowserWireMessage, { type: "extension_authenticated" }>,
    connection: BrowserAuthenticatedTransportContext,
  ): void {
    const challenge = this.extensionChallengeOrTerminate(message, connection);
    if (!challenge) return;
    const frameKey = this.deriveExtensionFrameKey(message, challenge, connection);
    if (!frameKey) return;
    const transcript = extensionAuthenticationTranscript({
      message,
      challenge,
      connection,
      protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
      releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
      controllerIncarnationHash: this.input.controllerIncarnationHash,
      activationTupleHash: this.input.release.activationTupleHash,
    });
    if (
      !verifyBrowserTranscriptProof(
        frameKey,
        transcript,
        message.transcriptProof,
      )
    ) {
      connection.terminate(
        "BROWSER_AUTH_TRANSCRIPT_INVALID:extension proof mismatch",
      );
      return;
    }
    connection.frameKey = frameKey;
    const probeId = randomUUID();
    connection.challenge = Object.freeze({
      ...challenge,
      extensionNonce: message.extensionNonce,
      probeId,
      authTranscriptHash: sha256BrowserTranscript(transcript),
    });
    const probeInput = {
      probeId,
      nativePortEpoch: connection.nativePortEpoch,
      activationTupleHash: this.input.release.activationTupleHash,
      capabilitySetHash: GRASSEYE_BROWSER_CAPABILITY_SET_HASH,
      permissionPolicyHash: GRASSEYE_BROWSER_PERMISSION_POLICY_HASH,
      originPolicyHash: GRASSEYE_BROWSER_ORIGIN_POLICY_HASH,
      maxControlFrameBytes: GRASSEYE_BROWSER_CONTROLLER_HOST_CONTROL_MAX_BYTES,
    };
    connection.send({
      protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
      releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
      type: "capability_probe",
      ...probeInput,
      proof: browserTranscriptProof(
        frameKey,
        capabilityProbeTranscript(probeInput),
      ),
    });
  }

  private extensionChallengeOrTerminate(
    message: Extract<BrowserWireMessage, { type: "extension_authenticated" }>,
    connection: BrowserAuthenticatedTransportContext,
  ): ChallengeState | null {
    const challenge = connection.challenge;
    if (
      !challenge ||
      connection.frameKey ||
      connection.pendingAuthority ||
      connection.authorityCommitted
    ) {
      connection.terminate(
        "BROWSER_AUTH_TRANSCRIPT_INVALID:authentication outside challenge window",
      );
      return null;
    }
    if (
      message.challengeId !== challenge.challengeId ||
      message.nativePortEpoch !== connection.nativePortEpoch ||
      message.extensionInstanceId !== challenge.hello.extensionInstanceId
    ) {
      connection.terminate(
        "BROWSER_AUTH_TRANSCRIPT_INVALID:extension binding mismatch",
      );
      return null;
    }
    return challenge;
  }

  private deriveExtensionFrameKey(
    message: Extract<BrowserWireMessage, { type: "extension_authenticated" }>,
    challenge: ChallengeState,
    connection: BrowserAuthenticatedTransportContext,
  ): Buffer | null {
    try {
      return challenge.ephemeral.computeSharedSecret(
        message.extensionPublicKey,
        challenge.controllerNonce,
      );
    } catch {
      connection.terminate(
        "BROWSER_AUTH_TRANSCRIPT_INVALID:extension public key",
      );
      return null;
    }
  }

  private handleCapabilityProbeAck(
    message: Extract<BrowserWireMessage, { type: "capability_probe_ack" }>,
    connection: BrowserAuthenticatedTransportContext,
  ): void {
    const challenge = connection.challenge;
    const frameKey = connection.frameKey;
    if (
      !challenge?.probeId ||
      !challenge.authTranscriptHash ||
      !frameKey ||
      connection.pendingAuthority
    ) {
      connection.terminate("BROWSER_CAPABILITY_PROBE_FAILED:unexpected ack");
      return;
    }
    const probeInput = {
      probeId: message.probeId,
      nativePortEpoch: message.nativePortEpoch,
      activationTupleHash: this.input.release.activationTupleHash,
      capabilitySetHash: message.capabilitySetHash,
      permissionPolicyHash: message.permissionPolicyHash,
      originPolicyHash: message.originPolicyHash,
      maxControlFrameBytes: message.maxControlFrameBytes,
      debuggerAvailable: message.debuggerAvailable,
    };
    if (
      message.probeId !== challenge.probeId ||
      message.nativePortEpoch !== connection.nativePortEpoch ||
      message.capabilitySetHash !==
        this.input.release.activationTuple.capabilitySetHash ||
      message.permissionPolicyHash !==
        this.input.release.activationTuple.permissionPolicyHash ||
      message.originPolicyHash !== GRASSEYE_BROWSER_ORIGIN_POLICY_HASH ||
      message.debuggerAvailable !== true ||
      message.maxControlFrameBytes !==
        GRASSEYE_BROWSER_CONTROLLER_HOST_CONTROL_MAX_BYTES ||
      !verifyBrowserTranscriptProof(
        frameKey,
        capabilityProbeTranscript(probeInput),
        message.proof,
      )
    ) {
      connection.terminate("BROWSER_CAPABILITY_PROBE_FAILED");
      return;
    }
    this.issueAuthorityGrant(connection, challenge, frameKey);
  }

  private issueAuthorityGrant(
    connection: BrowserAuthenticatedTransportContext,
    challenge: ChallengeState,
    frameKey: Buffer,
  ): void {
    const tuple = this.input.release.activationTuple;
    const candidate = this.issuer.prepare({
      authorityEpoch: 1,
      artifactSetHash: this.input.release.artifactSetHash,
      activationTupleHash: this.input.release.activationTupleHash,
      releaseSecurityPolicyHash: this.input.release.releaseSecurityPolicyHash,
      profileEnrollmentHash: this.input.profileEnrollmentHash,
      chromeProcessIncarnationHash:
        this.input.chromeProcess.chromeProcessIncarnationHash,
      controllerIncarnationHash: this.input.controllerIncarnationHash,
      connectionGeneration: connection.connectionGeneration,
      hostProcessEpoch: connection.hostIdentity.hostProcessEpoch,
      nativePortEpoch: connection.nativePortEpoch,
      extensionId: GRASSEYE_BROWSER_EXTENSION_ID,
      extensionVersion: GRASSEYE_BROWSER_EXTENSION_VERSION,
      protocolRevision: GRASSEYE_BROWSER_PROTOCOL_REVISION,
      capabilitySetHash: tuple.capabilitySetHash,
      permissionPolicyHash: tuple.permissionPolicyHash,
      originPolicyHash: GRASSEYE_BROWSER_ORIGIN_POLICY_HASH,
      authorityLivenessPolicyHash: GRASSEYE_BROWSER_LIVENESS_POLICY_HASH,
      commandAdmissionBudgetHash: tuple.commandAdmissionBudgetHash,
      artifactStreamBudgetHash: tuple.artifactStreamBudgetHash,
      authTranscriptHash: challenge.authTranscriptHash!,
      keyEpoch: connection.nativePortEpoch,
    });
    connection.pendingAuthority = candidate;
    const certificate = candidate.certificate;
    const transcript = browserAuthorityGrantTranscript({
      authorityRef: certificate.authorityRef,
      authorityEpoch: certificate.authorityEpoch,
      certificateHash: certificate.certificateHash,
      connectionGeneration: certificate.connectionGeneration,
      nativePortEpoch: certificate.nativePortEpoch,
      challengeId: challenge.challengeId,
      livenessLeaseEpoch: certificate.livenessLeaseEpoch,
    });
    connection.send({
      protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
      releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
      type: "authority_grant",
      authorityRef: certificate.authorityRef,
      authorityEpoch: certificate.authorityEpoch,
      authorityCertificateHash: certificate.certificateHash,
      connectionGeneration: certificate.connectionGeneration,
      nativePortEpoch: certificate.nativePortEpoch,
      challengeId: challenge.challengeId,
      livenessLeaseEpoch: certificate.livenessLeaseEpoch,
      grantProof: browserTranscriptProof(frameKey, transcript),
    });
  }

  private handleGrantAck(
    message: Extract<BrowserWireMessage, { type: "authority_grant_ack" }>,
    connection: BrowserAuthenticatedTransportContext,
  ): void {
    const challenge = connection.challenge;
    const candidate = connection.pendingAuthority;
    const frameKey = connection.frameKey;
    if (
      !challenge ||
      !candidate ||
      !frameKey ||
      connection.authorityCommitted
    ) {
      connection.terminate(
        "BROWSER_AUTH_TRANSCRIPT_INVALID:grant ack outside pending window",
      );
      return;
    }
    const certificate = candidate.certificate;
    const transcript = browserAuthorityGrantTranscript({
      authorityRef: certificate.authorityRef,
      authorityEpoch: certificate.authorityEpoch,
      certificateHash: certificate.certificateHash,
      connectionGeneration: certificate.connectionGeneration,
      nativePortEpoch: certificate.nativePortEpoch,
      challengeId: challenge.challengeId,
      livenessLeaseEpoch: certificate.livenessLeaseEpoch,
    });
    if (
      message.authorityRef !== certificate.authorityRef ||
      message.authorityEpoch !== certificate.authorityEpoch ||
      message.authorityCertificateHash !== certificate.certificateHash ||
      message.connectionGeneration !== certificate.connectionGeneration ||
      message.nativePortEpoch !== certificate.nativePortEpoch ||
      message.challengeId !== challenge.challengeId ||
      message.livenessLeaseEpoch !== certificate.livenessLeaseEpoch ||
      !verifyBrowserTranscriptProof(frameKey, transcript, message.ackProof)
    ) {
      connection.terminate(
        "BROWSER_AUTH_TRANSCRIPT_INVALID:grant ack mismatch",
      );
      return;
    }
    const authority = this.issuer.commit(candidate);
    connection.pendingAuthority = null;
    connection.authorityCommitted = true;
    connection.heartbeatSequence = 0;
    this.input.onAuthorityCommitted(authority);
  }

  private handleHeartbeat(
    message: Extract<BrowserWireMessage, { type: "heartbeat" }>,
    connection: BrowserAuthenticatedTransportContext,
  ): void {
    const frameKey = connection.frameKey;
    if (!frameKey || !connection.authorityCommitted) {
      connection.terminate(
        "BROWSER_AUTHORITY_LIVENESS_EXPIRED:heartbeat without authority",
      );
      return;
    }
    const current = this.issuer.requireCurrent().certificate;
    const transcript = browserHeartbeatTranscript(message);
    if (
      message.authorityRef !== current.authorityRef ||
      message.authorityEpoch !== current.authorityEpoch ||
      message.livenessLeaseEpoch !== current.livenessLeaseEpoch ||
      message.connectionGeneration !== current.connectionGeneration ||
      message.nativePortEpoch !== current.nativePortEpoch ||
      message.heartbeatSequence !== connection.heartbeatSequence + 1 ||
      !verifyBrowserTranscriptProof(frameKey, transcript, message.proof)
    ) {
      connection.terminate(
        "BROWSER_AUTHORITY_LIVENESS_EXPIRED:heartbeat invalid",
      );
      return;
    }
    connection.heartbeatSequence = message.heartbeatSequence;
    this.issuer.heartbeat({
      authorityRef: message.authorityRef,
      authorityEpoch: message.authorityEpoch,
      leaseEpoch: message.livenessLeaseEpoch,
      heartbeatSequence: message.heartbeatSequence,
    });
  }
}
