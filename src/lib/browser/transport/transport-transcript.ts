import { createHash } from "node:crypto";

export const sha256BrowserTranscript = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

export const browserHostChallengeTranscript = (input: {
  controllerIncarnationHash: string;
  controllerNonce: string;
  supervisorEpoch: number;
  connectionGeneration: number;
}): string => [
  "browser-host-challenge-v1",
  input.controllerIncarnationHash,
  input.controllerNonce,
  input.supervisorEpoch,
  input.connectionGeneration,
].join(":");

export const browserHostAttestationTranscript = (input: {
  challengeTranscriptHash: string;
  hostBinaryHash: string;
  hostProcessEpoch: number;
  chromeProcessIncarnationHash: string;
  profileEnrollmentHash: string;
  artifactSetHash: string;
}): string => [
  "browser-host-attestation-v1",
  input.challengeTranscriptHash,
  input.hostBinaryHash,
  input.hostProcessEpoch,
  input.chromeProcessIncarnationHash,
  input.profileEnrollmentHash,
  input.artifactSetHash,
].join(":" );

export const browserExtensionAuthTranscript = (input: {
  protocolVersion: string;
  releaseIdentity: string;
  controllerIncarnationHash: string;
  connectionGeneration: number;
  nativePortEpoch: number;
  challengeId: string;
  controllerNonce: string;
  extensionNonce: string;
  controllerPublicKey: string;
  extensionPublicKey: string;
  extensionInstanceId: string;
  extensionArtifactDigest: string;
  activationTupleHash: string;
  capabilitySetHash: string;
  permissionPolicyHash: string;
  originPolicyHash: string;
}): string => Object.entries(input)
  .map(([key, value]) => `${key}=${String(value)}`)
  .join("\n");

export const browserAuthorityGrantTranscript = (input: {
  authorityRef: string;
  authorityEpoch: number;
  certificateHash: string;
  connectionGeneration: number;
  nativePortEpoch: number;
  challengeId: string;
  livenessLeaseEpoch: number;
}): string => Object.entries(input)
  .map(([key, value]) => `${key}=${String(value)}`)
  .join("\n");

export const browserHeartbeatTranscript = (input: {
  authorityRef: string;
  authorityEpoch: number;
  livenessLeaseEpoch: number;
  connectionGeneration: number;
  nativePortEpoch: number;
  heartbeatSequence: number;
  monotonicMs: number;
}): string => Object.entries(input)
  .map(([key, value]) => `${key}=${String(value)}`)
  .join("\n");
