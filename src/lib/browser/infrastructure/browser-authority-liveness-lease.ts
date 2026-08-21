import type { BrowserAuthorityCertificateV1 } from "./browser-authority-certificate.js";

/** A single execution-bound view of the certificate's authenticated lifetime. */
export type BrowserAuthorityLivenessLeaseV1 = Readonly<{
  authorityRef: string;
  authorityEpoch: number;
  leaseEpoch: number;
  expiresAt: string;
}>;

export const createLivenessLease = (
  certificate: BrowserAuthorityCertificateV1,
): BrowserAuthorityLivenessLeaseV1 => ({
  authorityRef: certificate.authorityRef,
  authorityEpoch: certificate.authorityEpoch,
  leaseEpoch: certificate.livenessLeaseEpoch,
  expiresAt: certificate.expiresAt,
});

export const assertLivenessLeaseLive = (
  lease: BrowserAuthorityLivenessLeaseV1,
  now = Date.now(),
): void => {
  if (Date.parse(lease.expiresAt) <= now) throw new Error("BROWSER_LIVENESS_EXPIRED");
};
