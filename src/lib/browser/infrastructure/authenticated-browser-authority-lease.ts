import { randomUUID } from "node:crypto";
import path from "node:path";
import type {
  AuthenticatedBrowserAuthorityLease,
  BrowserExecutionBinding,
  BrowserTargetLease,
} from "../browser-authority-api.js";
import type { AuthenticatedBrowserAuthority } from "./browser-authority-certificate.js";
import type { TransportActor } from "../transport/transport-actor.js";
import {
  BrowserFileArtifactGrantManager,
  type BrowserFileArtifactGrantV1,
} from "../exact-target/browser-file-artifact-grant.js";
import { BrowserTargetLeaseManager } from "../exact-target/browser-target-lease-manager.js";
export class AuthenticatedBrowserAuthorityLeaseImpl implements AuthenticatedBrowserAuthorityLease {
  readonly leaseRef = `browser-authority-lease:${randomUUID()}`;
  readonly certificate: AuthenticatedBrowserAuthority["certificate"];
  private readonly targets: BrowserTargetLeaseManager;
  private readonly grants: BrowserFileArtifactGrantManager;
  private released = false;
  private readonly assertFence: () => void;
  constructor(
    readonly authority: AuthenticatedBrowserAuthority,
    readonly executionBinding: BrowserExecutionBinding,
    input: {
      dataDir: string;
      transport: TransportActor;
      approvedArtifactRoots: readonly string[];
      assertFenceCurrent(binding: BrowserExecutionBinding): void;
    },
  ) {
    this.certificate = authority.certificate;
    this.grants = new BrowserFileArtifactGrantManager({
      rootDir: path.join(
        input.dataDir,
        "browser-runtime",
        "input-artifacts",
        this.leaseRef.replaceAll(":", "_"),
      ),
      approvedRoots: input.approvedArtifactRoots,
    });
    this.targets = new BrowserTargetLeaseManager(
      authority,
      executionBinding,
      input.transport.commands,
      this.grants,
    );
    this.assertFence = () => {
      if (this.released) throw new Error("BROWSER_AUTHORITY_REVOKED");
      input.assertFenceCurrent(this.executionBinding);
      const slot = input.transport.authoritySlot();
      if (
        slot.kind !== "PRESENT" ||
        slot.authority.certificate.certificateHash !==
          this.certificate.certificateHash
      ) {
        this.invalidate();
        throw new Error("BROWSER_AUTHORITY_REVOKED");
      }
    };
  }
  acquireTargetLease(ownerId: string): BrowserTargetLease {
    this.assertFence();
    return this.targets.acquire(ownerId);
  }
  async issueFileArtifactGrant(input: {
    artifactRef: string;
    sourcePath: string;
    expectedSha256?: `sha256:${string}`;
    maxBytes?: number;
  }): Promise<BrowserFileArtifactGrantV1> {
    this.assertFence();
    return this.grants.issue({
      artifactRef: input.artifactRef,
      sourcePath: input.sourcePath,
      authorityEpoch: this.certificate.authorityEpoch,
      executionBinding: this.executionBinding,
      ...(input.expectedSha256 ? { expectedSha256: input.expectedSha256 } : {}),
      ...(input.maxBytes ? { maxBytes: input.maxBytes } : {}),
    });
  }
  async release(): Promise<void> {
    if (this.released) return;
    this.released = true;
    this.targets.invalidate();
    await this.grants.destroyAll();
  }
  invalidate(): void {
    if (this.released) return;
    this.released = true;
    this.targets.invalidate();
    void this.grants.destroyAll();
  }
}
