import type { BrowserAuthorityCertificateV1 } from "./browser-authority-certificate.js";

export type BrowserAuthorityLease = Readonly<{
  leaseRef: string;
  certificate: BrowserAuthorityCertificateV1;
  executionBindingHash: `sha256:${string}`;
}>;
