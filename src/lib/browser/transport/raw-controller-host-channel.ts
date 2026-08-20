import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type net from "node:net";

import { readBrowserInstallIdentitySecret } from "../infrastructure/browser-install-identity.js";
import {
  browserHostAttestationTranscript,
  browserHostChallengeTranscript,
  sha256BrowserTranscript,
} from "./transport-transcript.js";

export type BrowserHostChallenge = Readonly<{
  type: "controller_host_challenge";
  controllerIncarnationHash: `sha256:${string}`;
  controllerNonce: string;
  supervisorEpoch: number;
  connectionGeneration: number;
}>;

export type BrowserHostAttestation = Readonly<{
  type: "host_attestation";
  challengeTranscriptHash: `sha256:${string}`;
  hostBinaryHash: `sha256:${string}`;
  hostProcessEpoch: number;
  chromeProcessIncarnationHash: `sha256:${string}`;
  profileEnrollmentHash: `sha256:${string}`;
  artifactSetHash: `sha256:${string}`;
  mac: string;
}>;

export type AuthenticatedControllerHostIdentity = Readonly<{
  hostBinaryHash: `sha256:${string}`;
  hostProcessEpoch: number;
  chromeProcessIncarnationHash: `sha256:${string}`;
  profileEnrollmentHash: `sha256:${string}`;
  artifactSetHash: `sha256:${string}`;
}>;

const hmac = (key: Buffer, value: string): string =>
  createHmac("sha256", key).update(value).digest("base64");

const verifyMac = (key: Buffer, value: string, actualBase64: string): boolean => {
  const expected = Buffer.from(hmac(key, value), "base64");
  const actual = Buffer.from(actualBase64, "base64");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

export class RawControllerHostChannel {
  readonly challenge: BrowserHostChallenge;

  constructor(
    readonly socket: net.Socket,
    input: {
      controllerIncarnationHash: `sha256:${string}`;
      supervisorEpoch: number;
      connectionGeneration: number;
    },
  ) {
    this.challenge = Object.freeze({
      type: "controller_host_challenge" as const,
      controllerIncarnationHash: input.controllerIncarnationHash,
      controllerNonce: randomBytes(32).toString("base64url"),
      supervisorEpoch: input.supervisorEpoch,
      connectionGeneration: input.connectionGeneration,
    });
  }

  challengeTranscriptHash(): `sha256:${string}` {
    return sha256BrowserTranscript(browserHostChallengeTranscript(this.challenge));
  }

  sendChallenge(): void {
    this.socket.write(`${JSON.stringify(this.challenge)}\n`);
  }

  authenticate(
    attestation: BrowserHostAttestation,
    expected: {
      hostBinaryHash: `sha256:${string}`;
      chromeProcessIncarnationHash: `sha256:${string}`;
      profileEnrollmentHash: `sha256:${string}`;
      artifactSetHash: `sha256:${string}`;
    },
  ): AuthenticatedControllerHostIdentity {
    if (
      attestation.challengeTranscriptHash !== this.challengeTranscriptHash()
      || attestation.hostBinaryHash !== expected.hostBinaryHash
      || attestation.chromeProcessIncarnationHash !== expected.chromeProcessIncarnationHash
      || attestation.profileEnrollmentHash !== expected.profileEnrollmentHash
      || attestation.artifactSetHash !== expected.artifactSetHash
      || !Number.isSafeInteger(attestation.hostProcessEpoch)
      || attestation.hostProcessEpoch <= 0
    ) {
      throw new Error("BROWSER_HOST_IDENTITY_INVALID");
    }
    const transcript = browserHostAttestationTranscript({
      challengeTranscriptHash: attestation.challengeTranscriptHash,
      hostBinaryHash: attestation.hostBinaryHash,
      hostProcessEpoch: attestation.hostProcessEpoch,
      chromeProcessIncarnationHash: attestation.chromeProcessIncarnationHash,
      profileEnrollmentHash: attestation.profileEnrollmentHash,
      artifactSetHash: attestation.artifactSetHash,
    });
    const secret = readBrowserInstallIdentitySecret();
    try {
      if (!verifyMac(secret, transcript, attestation.mac)) {
        throw new Error("BROWSER_HOST_IDENTITY_INVALID");
      }
    } finally {
      secret.fill(0);
    }
    return Object.freeze({
      hostBinaryHash: attestation.hostBinaryHash,
      hostProcessEpoch: attestation.hostProcessEpoch,
      chromeProcessIncarnationHash: attestation.chromeProcessIncarnationHash,
      profileEnrollmentHash: attestation.profileEnrollmentHash,
      artifactSetHash: attestation.artifactSetHash,
    });
  }
}

export const isBrowserHostAttestation = (value: unknown): value is BrowserHostAttestation => {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<BrowserHostAttestation>;
  return item.type === "host_attestation"
    && typeof item.challengeTranscriptHash === "string"
    && typeof item.hostBinaryHash === "string"
    && Number.isSafeInteger(item.hostProcessEpoch)
    && typeof item.chromeProcessIncarnationHash === "string"
    && typeof item.profileEnrollmentHash === "string"
    && typeof item.artifactSetHash === "string"
    && typeof item.mac === "string";
};
