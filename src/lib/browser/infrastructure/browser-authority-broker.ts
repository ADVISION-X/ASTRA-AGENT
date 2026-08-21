import { randomUUID } from "node:crypto";
import type { BrowserTargetLeaseManager, BrowserExactTargetAcquisition } from "../exact-target/browser-target-lease-manager.js";
import type { BrowserTargetLease } from "../exact-target/browser-target-lease.js";
import type { BrowserFileArtifactGrantV1 } from "../exact-target/browser-file-artifact-grant.js";
import { assertCertificateLive } from "./browser-authority-certificate.js";
import type { BrowserAuthorityIssuer } from "./browser-authority-issuer.js";
import type { BrowserHash } from "../exact-target/browser-target-ref.js";
import { assertLivenessLeaseLive, createLivenessLease } from "./browser-authority-liveness-lease.js";

export type BrowserExecutionBinding = Readonly<{
  kind: "local" | "xuanxue";
  executionRef: string;
  jobRefHash: BrowserHash;
  executionRefHash: BrowserHash;
  writerLeaseEpoch: number;
  writerFenceHash: BrowserHash;
  candidateHash: BrowserHash;
}>;

export type BrowserAuthorityStatus =
  | Readonly<{ kind: "UNAVAILABLE"; reasonCode: string }>
  | Readonly<{ kind: "AVAILABLE"; authorityRefHash: BrowserHash; certificateHash: BrowserHash; channelSessionHash: BrowserHash }>;

export type AuthenticatedBrowserAuthorityLease = Readonly<{
  leaseRef: string;
  executionBinding: BrowserExecutionBinding;
  acquireTargetLease(input: BrowserExactTargetAcquisition): BrowserTargetLease;
  issueFileArtifactGrant(input: Readonly<{ artifactRef: string; expectedSha256: BrowserHash; maxBytes: number }>): Promise<BrowserFileArtifactGrantV1>;
  release(): Promise<void>;
}>;

export type BrowserArtifactResolver = Readonly<{
  resolveArtifact(artifactRef: string): Promise<Readonly<{ canonicalPath: string; contentHash: BrowserHash; sizeBytes: number }>>;
}>;

export class BrowserAuthorityBroker {
  public constructor(
    private readonly issuer: BrowserAuthorityIssuer,
    private readonly targetLeaseManagerFor: (binding: BrowserExecutionBinding) => BrowserTargetLeaseManager,
    private readonly artifactResolver: BrowserArtifactResolver,
  ) {}

  public currentStatus(): BrowserAuthorityStatus {
    const slot = this.issuer.current();
    if (slot.kind === "ABSENT") return { kind: "UNAVAILABLE", reasonCode: slot.reasonCode };
    return {
      kind: "AVAILABLE",
      authorityRefHash: `sha256:${slot.authority.authorityRef}`,
      certificateHash: `sha256:${slot.authority.authTranscriptHash.slice(7)}`,
      channelSessionHash: slot.authority.channelSessionHash,
    };
  }

  public async acquireForExecution(binding: BrowserExecutionBinding): Promise<AuthenticatedBrowserAuthorityLease> {
    const slot = this.issuer.current();
    if (slot.kind === "ABSENT") throw new Error(slot.reasonCode);
    assertCertificateLive(slot.authority);
    const manager = this.targetLeaseManagerFor(binding);
    const livenessLease = createLivenessLease(slot.authority);
    let released = false;
    const assertLive = (): void => {
      if (released) throw new Error("BROWSER_LIVENESS_EXPIRED");
      assertCertificateLive(slot.authority);
      assertLivenessLeaseLive(livenessLease);
    };
    return {
      leaseRef: `authority-lease-${randomUUID()}`,
      executionBinding: binding,
      acquireTargetLease: (input) => {
        assertLive();
        return manager.acquire(input);
      },
      issueFileArtifactGrant: async ({ artifactRef, expectedSha256, maxBytes }) => {
        assertLive();
        if (maxBytes < 1) throw new Error("BROWSER_FILE_GRANT_INVALID");
        const artifact = await this.artifactResolver.resolveArtifact(artifactRef);
        if (artifact.contentHash !== expectedSha256 || artifact.sizeBytes > maxBytes) throw new Error("BROWSER_FILE_GRANT_INVALID");
        return {
          schemaVersion: "browser-file-artifact-grant-v1",
          grantRef: `grant-${randomUUID()}`,
          authorityEpoch: slot.authority.authorityEpoch,
          executionBindingHash: binding.executionRefHash,
          artifactRef,
          contentHash: expectedSha256,
          maxBytes,
          expiresAt: new Date(Date.now() + 300_000).toISOString(),
        };
      },
      release: async () => { released = true; },
    };
  }
}
