import { createHash, randomUUID } from "node:crypto";

export const BROWSER_AUTHORITY_CERTIFICATE_SCHEMA_VERSION =
  "browser-authority-certificate.v1" as const;

export type BrowserAuthorityCertificateV1 = Readonly<{
  schemaVersion: typeof BROWSER_AUTHORITY_CERTIFICATE_SCHEMA_VERSION;
  authorityRef: string;
  authorityEpoch: number;
  artifactSetHash: `sha256:${string}`;
  activationTupleHash: `sha256:${string}`;
  releaseSecurityPolicyHash: `sha256:${string}`;
  profileEnrollmentHash: `sha256:${string}`;
  chromeProcessIncarnationHash: `sha256:${string}`;
  controllerIncarnationHash: `sha256:${string}`;
  connectionGeneration: number;
  hostProcessEpoch: number;
  nativePortEpoch: number;
  extensionId: string;
  extensionVersion: string;
  protocolRevision: number;
  capabilitySetHash: `sha256:${string}`;
  permissionPolicyHash: `sha256:${string}`;
  originPolicyHash: `sha256:${string}`;
  authorityLivenessPolicyHash: `sha256:${string}`;
  commandAdmissionBudgetHash: `sha256:${string}`;
  artifactStreamBudgetHash: `sha256:${string}`;
  authTranscriptHash: `sha256:${string}`;
  keyEpoch: number;
  livenessLeaseEpoch: number;
  issuedAtMonotonicMs: number;
  maxAgeDeadlineMonotonicMs: number;
  certificateHash: `sha256:${string}`;
}>;

const sha256Canonical = (value: unknown): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;

export class AuthenticatedBrowserAuthority {
  readonly certificate: BrowserAuthorityCertificateV1;

  private constructor(certificate: BrowserAuthorityCertificateV1) {
    this.certificate = Object.freeze(certificate);
    Object.freeze(this);
  }

  static issueInternal(
    input: Omit<BrowserAuthorityCertificateV1, "schemaVersion" | "authorityRef" | "certificateHash">,
  ): AuthenticatedBrowserAuthority {
    const unsigned = Object.freeze({
      schemaVersion: BROWSER_AUTHORITY_CERTIFICATE_SCHEMA_VERSION,
      authorityRef: `browser-authority:${randomUUID()}`,
      ...input,
    });
    return new AuthenticatedBrowserAuthority({
      ...unsigned,
      certificateHash: sha256Canonical(unsigned),
    });
  }
}

export const hashBrowserAuthorityRef = (
  authority: AuthenticatedBrowserAuthority,
): `sha256:${string}` => sha256Canonical(authority.certificate.authorityRef);
