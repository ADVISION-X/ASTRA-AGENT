import { createHash } from "node:crypto";

import type { BrowserHash } from "../exact-target/browser-target-ref.js";

/**
 * Process-memory authority only. A target lease must identify the exact
 * fixed-directory unpacked extension, Workbench authority session and policy
 * that created it.
 */
export type BrowserAuthorityCertificateV1 = Readonly<{
  schemaVersion: "browser-authority-certificate-v1";
  authorityRef: string;
  authorityEpoch: number;
  channelSessionHash: BrowserHash;
  artifactSetHash: BrowserHash;
  releaseSecurityPolicyHash: BrowserHash;
  profileEnrollmentHash: BrowserHash;
  connectionGeneration: number;
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
  issuerMac: BrowserHash;
}>;

export const hashBrowserAuthorityCertificate = (certificate: BrowserAuthorityCertificateV1): BrowserHash =>
  `sha256:${createHash("sha256").update(JSON.stringify(certificate)).digest("hex")}`;
