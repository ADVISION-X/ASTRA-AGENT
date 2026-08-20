import { createHash, timingSafeEqual } from "node:crypto";

import type { BrowserHash } from "../exact-target/browser-target-ref.js";

export type BrowserAuthTranscript = Readonly<{
  controllerNonce: string;
  hostNonce: string;
  extensionNonce: string;
  activationTupleHash: BrowserHash;
  profileHash: BrowserHash;
  processHash: BrowserHash;
}>;

export type BrowserTransportHandshake = Readonly<{
  transcript: BrowserAuthTranscript;
  artifactSetHash: BrowserHash;
  activationTupleHash: BrowserHash;
  releaseSecurityPolicyHash: BrowserHash;
  profileEnrollmentHash: BrowserHash;
  processIncarnationHash: BrowserHash;
  controllerIncarnationHash: BrowserHash;
  connectionGeneration: number;
  hostProcessEpoch: number;
  nativePortEpoch: number;
  extensionId: string;
  extensionVersion: string;
  protocolRevision: number;
  capabilitySetHash: BrowserHash;
  permissionPolicyHash: BrowserHash;
  originPolicyHash: BrowserHash;
  livenessPolicyHash: BrowserHash;
  commandAdmissionBudgetHash: BrowserHash;
  artifactStreamBudgetHash: BrowserHash;
  expiresAt: string;
}>;

export const hashAuthTranscript = (transcript: BrowserAuthTranscript): BrowserHash =>
  `sha256:${createHash("sha256").update(JSON.stringify(transcript)).digest("hex")}`;

export const verifyTranscriptHash = (transcript: BrowserAuthTranscript, expected: BrowserHash): boolean => {
  const actual = Buffer.from(hashAuthTranscript(transcript));
  const candidate = Buffer.from(expected);
  return actual.length === candidate.length && timingSafeEqual(actual, candidate);
};

const assertHash = (value: string): asserts value is BrowserHash => {
  if (!/^sha256:[a-f0-9]{64}$/u.test(value)) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
};

/** Validates the facts that must agree before authority may become PRESENT. */
export const assertAuthenticatedTransportHandshake = (
  handshake: BrowserTransportHandshake,
  transcriptHash: BrowserHash,
): void => {
  [
    handshake.artifactSetHash,
    handshake.activationTupleHash,
    handshake.releaseSecurityPolicyHash,
    handshake.profileEnrollmentHash,
    handshake.processIncarnationHash,
    handshake.controllerIncarnationHash,
    handshake.capabilitySetHash,
    handshake.permissionPolicyHash,
    handshake.originPolicyHash,
    handshake.livenessPolicyHash,
    handshake.commandAdmissionBudgetHash,
    handshake.artifactStreamBudgetHash,
    handshake.transcript.activationTupleHash,
    handshake.transcript.profileHash,
    handshake.transcript.processHash,
    transcriptHash,
  ].forEach(assertHash);
  if (
    !verifyTranscriptHash(handshake.transcript, transcriptHash)
    || handshake.transcript.activationTupleHash !== handshake.activationTupleHash
    || handshake.transcript.profileHash !== handshake.profileEnrollmentHash
    || handshake.transcript.processHash !== handshake.processIncarnationHash
    || handshake.connectionGeneration < 1
    || handshake.hostProcessEpoch < 1
    || handshake.nativePortEpoch < 1
    || handshake.protocolRevision < 1
    || handshake.extensionId.length === 0
    || handshake.extensionVersion.length === 0
    || Date.parse(handshake.expiresAt) <= Date.now()
  ) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
};
