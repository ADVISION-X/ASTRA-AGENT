import { createHash, randomUUID } from "node:crypto";

export const BROWSER_AUTHORITY_SCHEMA_VERSION = "grasseye-browser-authority-v1" as const;

export type BrowserAuthorityCertificate = Readonly<{
  schemaVersion: typeof BROWSER_AUTHORITY_SCHEMA_VERSION;
  authorityId: string;
  controllerSessionId: string;
  connectionGeneration: number;
  nativePortEpoch: number;
  extensionInstanceId: string;
  releaseIdentity: string;
  profileEnrollmentId: string;
  protocolVersion: string;
  issuedAtMonotonicMs: number;
  hardExpiresAtMonotonicMs: number;
  certificateHash: string;
}>;

export class AuthenticatedBrowserAuthority {
  readonly certificate: BrowserAuthorityCertificate;

  private constructor(certificate: BrowserAuthorityCertificate) {
    this.certificate = Object.freeze(certificate);
    Object.freeze(this);
  }

  static issueInternal(input: Omit<BrowserAuthorityCertificate, "schemaVersion" | "authorityId" | "certificateHash">): AuthenticatedBrowserAuthority {
    const authorityId = randomUUID();
    const unsigned = {
      schemaVersion: BROWSER_AUTHORITY_SCHEMA_VERSION,
      authorityId,
      ...input,
    } as const;
    const certificateHash = `sha256:${createHash("sha256").update(JSON.stringify(unsigned)).digest("hex")}`;
    return new AuthenticatedBrowserAuthority({ ...unsigned, certificateHash });
  }
}

export type BrowserAuthoritySnapshot =
  | Readonly<{ state: "AUTHORITY_ABSENT"; reason: string; changedAtMonotonicMs: number }>
  | Readonly<{
      state: "AUTHENTICATED_AUTHORITY_PRESENT";
      authorityId: string;
      certificateHash: string;
      connectionGeneration: number;
      nativePortEpoch: number;
      releaseIdentity: string;
      profileEnrollmentId: string;
      hardExpiresAtMonotonicMs: number;
      changedAtMonotonicMs: number;
    }>;
