import type { BrowserHash } from "../exact-target/browser-target-ref.js";

export type BrowserTransportHandshake = Readonly<{
  pageSessionHash: BrowserHash;
  extensionId: string;
  extensionVersion: string;
  sourceChannelToken: string;
  artifactSetHash: BrowserHash;
  releaseSecurityPolicyHash: BrowserHash;
  profileEnrollmentHash: BrowserHash;
  connectionGeneration: number;
  protocolRevision: number;
  capabilitySetHash: BrowserHash;
  permissionPolicyHash: BrowserHash;
  originPolicyHash: BrowserHash;
  livenessPolicyHash: BrowserHash;
  commandAdmissionBudgetHash: BrowserHash;
  artifactStreamBudgetHash: BrowserHash;
}>;

const assertHash = (value: string): asserts value is BrowserHash => {
  if (!/^sha256:[a-f0-9]{64}$/u.test(value)) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
};

/** Validates the page-session facts before authority may become PRESENT. */
export const assertAuthenticatedTransportHandshake = (handshake: BrowserTransportHandshake): void => {
  [
    handshake.pageSessionHash,
    handshake.artifactSetHash,
    handshake.releaseSecurityPolicyHash,
    handshake.profileEnrollmentHash,
    handshake.capabilitySetHash,
    handshake.permissionPolicyHash,
    handshake.originPolicyHash,
    handshake.livenessPolicyHash,
    handshake.commandAdmissionBudgetHash,
    handshake.artifactStreamBudgetHash,
  ].forEach(assertHash);
  if (
    handshake.connectionGeneration < 1
    || handshake.protocolRevision < 1
    || handshake.extensionId.length === 0
    || handshake.extensionVersion.length === 0
    || handshake.sourceChannelToken.length < 16
  ) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
};
