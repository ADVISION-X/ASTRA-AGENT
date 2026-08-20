import { createHash } from "node:crypto";

import type { BrowserHash } from "../exact-target/browser-target-ref.js";

/**
 * Process-memory authority only. A target lease must identify the exact
 * artifact, policy, profile, Chrome process and Native Port that created it.
 */
export type BrowserAuthorityCertificateV1 = Readonly<{
  schemaVersion: "browser-authority-certificate-v1";
  authorityRef: string;
  authorityEpoch: number;
  executionBindingHash: BrowserHash;
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
  authTranscriptHash: BrowserHash;
  keyEpoch: number;
  livenessLeaseEpoch: number;
  issuedAt: string;
  issuedAtMonotonicNs: string;
  expiresAt: string;
  issuerMac: BrowserHash;
}>;

export const assertCertificateLive = (certificate: BrowserAuthorityCertificateV1, now = Date.now()): void => {
  if (Date.parse(certificate.expiresAt) <= now) throw new Error("BROWSER_LIVENESS_EXPIRED");
};

export const hashBrowserAuthorityCertificate = (certificate: BrowserAuthorityCertificateV1): BrowserHash =>
  `sha256:${createHash("sha256").update(JSON.stringify(certificate)).digest("hex")}`;
