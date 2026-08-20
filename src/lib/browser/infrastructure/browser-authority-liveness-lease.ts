import { createHash } from "node:crypto";
import type { BrowserHash } from "../exact-target/browser-target-ref.js";
import type { BrowserAuthorityCertificateV1 } from "./browser-authority-certificate.js";

export type BrowserAuthorityLivenessLeaseV1 = Readonly<{
  authorityRef: string;
  authorityEpoch: number;
  leaseEpoch: number;
  expiresAt: string;
  sequence: number;
}>;

export const hashExecutionBinding = (value: unknown): BrowserHash =>
  `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;

export const createLivenessLease = (certificate: BrowserAuthorityCertificateV1, leaseEpoch: number, expiresAt: string): BrowserAuthorityLivenessLeaseV1 => ({
  authorityRef: certificate.authorityRef,
  authorityEpoch: certificate.authorityEpoch,
  leaseEpoch,
  expiresAt,
  sequence: 0,
});
