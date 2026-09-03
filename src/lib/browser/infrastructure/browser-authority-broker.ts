import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, realpath, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import type { BrowserTargetLeaseManager, BrowserExactTargetAcquisition } from "../exact-target/browser-target-lease-manager.js";
import type { BrowserApprovedArtifactRef, BrowserTargetLease } from "../exact-target/browser-target-lease.js";
import type { BrowserFileArtifactGrantV1 } from "../exact-target/browser-file-artifact-grant.js";
import type { BrowserAuthorityIssuer } from "./browser-authority-issuer.js";
import type { BrowserControlledTarget, BrowserHash } from "../exact-target/browser-target-ref.js";

type BrowserExecutionBindingCore = Readonly<{
  ownerPluginId: string;
  pluginVersion: number;
  jobId: string;
  productStepId: string;
  callId: string;
  attemptId: string;
  deviceId: string;
  leaseVersion: number;
  localOrderId: string;
  contractManifestHash: BrowserHash;
  executionRef: string;
  jobRefHash: BrowserHash;
  executionRefHash: BrowserHash;
  writerLeaseEpoch: number;
  writerFenceHash: BrowserHash;
  candidateHash: BrowserHash;
  commandTtlMs: number;
}>;

export type BrowserConfirmedProviderReadbackAuthorization = Readonly<{
  schemaVersion: "browser-confirmed-provider-readback.v1";
  sourceAttemptId: string;
  sourceExactCallIdentityHash: BrowserHash;
  sourceActionOrdinal: number;
  sourceProductStepId: string;
  sourceCallId: string;
  sourceChildCapabilityId: "submit_exact_gpt_turn_once";
  sourceTargetRef: string;
  sourceDocumentRef: string;
  sourceTerminalAt: string;
  evidenceRef: string;
  evidenceHash: BrowserHash;
  canonicalConversationUrl: string;
  conversationIdentityHash: BrowserHash;
  promptHash: BrowserHash;
  turnMarker: string;
}>;

export type BrowserExecutionBinding = BrowserExecutionBindingCore & Readonly<
  | { kind: "local" | "production" }
  | {
    kind: "production-reconciliation";
    confirmedProviderReadback: BrowserConfirmedProviderReadbackAuthorization;
  }
>;

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
  registerArtifact(input: Readonly<{
    artifactRef: string;
    filePath: string;
    contentHash: BrowserHash;
    sizeBytes: number;
  }>): Promise<void>;
  resolveArtifact(artifactRef: string): Promise<Readonly<{ canonicalPath: string; contentHash: BrowserHash; sizeBytes: number }>>;
}>;

type RegisteredBrowserArtifact = Readonly<{
  canonicalPath: string;
  contentHash: BrowserHash;
  sizeBytes: number;
}>;

const MAX_REGISTERED_BROWSER_ARTIFACTS = 100;

export class BrowserArtifactRegistry implements BrowserArtifactResolver {
  private readonly artifacts = new Map<string, RegisteredBrowserArtifact>();

  public constructor(private readonly allowedRoot: string) {}

  public async registerArtifact(input: Readonly<{
    artifactRef: string;
    filePath: string;
    contentHash: BrowserHash;
    sizeBytes: number;
  }>): Promise<void> {
    const sourcePath = await realpath(input.filePath);
    const metadata = await stat(sourcePath);
    const bytes = await readFile(sourcePath);
    const actualHash = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
    if (!metadata.isFile()
      || metadata.size !== input.sizeBytes
      || actualHash !== input.contentHash) {
      throw new Error("BROWSER_FILE_GRANT_INVALID");
    }
    await mkdir(this.allowedRoot, { recursive: true, mode: 0o700 });
    const root = await realpath(this.allowedRoot);
    const artifactDirectory = path.join(root, input.contentHash.slice("sha256:".length));
    await mkdir(artifactDirectory, { recursive: true, mode: 0o700 });
    const stagedPath = path.join(artifactDirectory, path.basename(sourcePath));
    const temporaryPath = `${stagedPath}.${randomUUID()}.tmp`;
    try {
      await copyFile(sourcePath, temporaryPath);
      await rename(temporaryPath, stagedPath);
    } finally {
      await rm(temporaryPath, { force: true });
    }
    const canonicalPath = await realpath(stagedPath);
    const relativePath = path.relative(root, canonicalPath);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new Error("BROWSER_FILE_GRANT_INVALID");
    }
    if (this.artifacts.size >= MAX_REGISTERED_BROWSER_ARTIFACTS) {
      const oldest = this.artifacts.keys().next().value as string | undefined;
      if (oldest) this.artifacts.delete(oldest);
    }
    this.artifacts.set(input.artifactRef, {
      canonicalPath,
      contentHash: input.contentHash,
      sizeBytes: input.sizeBytes,
    });
  }

  public async resolveArtifact(artifactRef: string): Promise<RegisteredBrowserArtifact> {
    const artifact = this.artifacts.get(artifactRef);
    if (!artifact) throw new Error("BROWSER_FILE_GRANT_INVALID");
    return artifact;
  }
}

export type BrowserOperatorTargetClaim = Readonly<{
  authorityEpoch: number;
  targetRef: string;
  documentRef: string;
  navigationEpoch: number;
  claimOrigin: "https://chatgpt.com";
}>;

type GrantedPathEntry = Readonly<{
  path: string;
  expiresAt: string;
  contentHash: BrowserHash;
  maxBytes: number;
}>;

const controlledTargetForClaim = (
  claim: BrowserOperatorTargetClaim,
  binding: BrowserExecutionBinding,
): BrowserControlledTarget => ({
  target: {
    targetRef: claim.targetRef,
    authorityEpoch: claim.authorityEpoch,
    executionBindingHash: binding.executionRefHash,
  },
  document: {
    documentRef: claim.documentRef,
    targetRef: claim.targetRef,
    navigationEpoch: claim.navigationEpoch,
  },
  claimOrigin: claim.claimOrigin,
});

const resolveGrantedPaths = async (
  grantedPaths: ReadonlyMap<string, GrantedPathEntry>,
  grants: readonly BrowserFileArtifactGrantV1[],
): Promise<readonly string[]> => grants.map((grant) => {
  const registered = grantedPaths.get(grant.grantRef);
  if (!registered
    || registered.expiresAt !== grant.expiresAt
    || registered.contentHash !== grant.contentHash
    || registered.maxBytes !== grant.maxBytes
    || Date.parse(registered.expiresAt) <= Date.now()) {
    throw new Error("BROWSER_FILE_GRANT_INVALID");
  }
  return registered.path;
});

export class BrowserAuthorityBroker {
  private operatorTargetClaim: BrowserOperatorTargetClaim | null = null;
  public constructor(
    private readonly issuer: BrowserAuthorityIssuer,
    private readonly assertTransportLive: () => void,
    private readonly targetLeaseManagerFor: (
      binding: BrowserExecutionBinding,
      resolveGrantPaths: (grants: readonly BrowserFileArtifactGrantV1[]) => Promise<readonly string[]>,
      resolveCurrentTarget: () => BrowserControlledTarget | null,
      issueApprovedArtifactGrants: (
        artifacts: readonly BrowserApprovedArtifactRef[],
      ) => Promise<readonly BrowserFileArtifactGrantV1[]>,
    ) => Pick<BrowserTargetLeaseManager, "acquire">,
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

  public currentOperatorTargetStatus(): "claimed" | "absent" {
    const slot = this.issuer.current();
    return slot.kind !== "ABSENT"
      && this.operatorTargetClaim?.authorityEpoch === slot.authority.authorityEpoch
      ? "claimed" : "absent";
  }

  /** The extension is the only source of an operator's exact target claim. */
  public registerOperatorTargetClaim(claim: BrowserOperatorTargetClaim): void {
    const slot = this.issuer.current();
    if (slot.kind === "ABSENT" || claim.authorityEpoch !== slot.authority.authorityEpoch) {
      throw new Error("BROWSER_TARGET_INVALID");
    }
    const current = this.operatorTargetClaim;
    if (current?.authorityEpoch === claim.authorityEpoch
      && (current.targetRef !== claim.targetRef
        || claim.navigationEpoch !== current.navigationEpoch + 1)) {
      throw new Error("BROWSER_TARGET_INVALID");
    }
    this.operatorTargetClaim = claim;
  }

  public revokeOperatorTargetClaim(targetRef?: string): void {
    if (targetRef === undefined || this.operatorTargetClaim?.targetRef === targetRef) {
      this.operatorTargetClaim = null;
    }
  }

  public async acquireOperatorClaimedTargetLease(
    binding: BrowserExecutionBinding,
    ownerId: string,
  ): Promise<BrowserTargetLease> {
    const claim = this.operatorTargetClaim;
    const slot = this.issuer.current();
    if (!claim || slot.kind === "ABSENT" || claim.authorityEpoch !== slot.authority.authorityEpoch) {
      throw new Error("BROWSER_TARGET_INVALID");
    }
    const target = controlledTargetForClaim(claim, binding);
    const authorityLease = await this.acquireForExecution(binding);
    const targetLease = authorityLease.acquireTargetLease({ target, ownerId });
    return {
      ...targetLease,
      park: async (input) => {
        await targetLease.park(input);
        await authorityLease.release();
      },
      close: async (input) => {
        await targetLease.close(input);
        await authorityLease.release();
      },
    };
  }

  public async acquireForExecution(binding: BrowserExecutionBinding): Promise<AuthenticatedBrowserAuthorityLease> {
    const slot = this.issuer.current();
    if (slot.kind === "ABSENT") throw new Error(slot.reasonCode);
    this.assertTransportLive();
    const grantedPaths = new Map<string, GrantedPathEntry>();
    let released = false;
    const assertLive = (): void => {
      if (released) throw new Error("BROWSER_LIVENESS_EXPIRED");
      const current = this.issuer.current();
      if (
        current.kind === "ABSENT"
        || current.authority.authorityRef !== slot.authority.authorityRef
        || current.authority.authorityEpoch !== slot.authority.authorityEpoch
      ) throw new Error("BROWSER_LIVENESS_EXPIRED");
      this.assertTransportLive();
    };
    const issueFileArtifactGrant = async ({ artifactRef, expectedSha256, maxBytes }: Readonly<{
      artifactRef: string; expectedSha256: BrowserHash; maxBytes: number;
    }>): Promise<BrowserFileArtifactGrantV1> => {
      assertLive();
      if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error("BROWSER_FILE_GRANT_INVALID");
      const artifact = await this.artifactResolver.resolveArtifact(artifactRef);
      if (artifact.contentHash !== expectedSha256 || artifact.sizeBytes !== maxBytes) {
        throw new Error("BROWSER_FILE_GRANT_INVALID");
      }
      const grant = {
        schemaVersion: "browser-file-artifact-grant-v1",
        grantRef: `grant-${randomUUID()}`,
        authorityEpoch: slot.authority.authorityEpoch,
        executionBindingHash: binding.executionRefHash,
        artifactRef,
        contentHash: expectedSha256,
        maxBytes,
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
      } as const;
      grantedPaths.set(grant.grantRef, {
        path: artifact.canonicalPath,
        expiresAt: grant.expiresAt,
        contentHash: grant.contentHash,
        maxBytes: grant.maxBytes,
      });
      return grant;
    };
    const manager = this.targetLeaseManagerFor(
      binding,
      (grants) => resolveGrantedPaths(grantedPaths, grants),
      () => {
        const currentClaim = this.operatorTargetClaim;
        if (!currentClaim || currentClaim.authorityEpoch !== slot.authority.authorityEpoch) return null;
        return controlledTargetForClaim(currentClaim, binding);
      },
      (artifacts) => Promise.all(artifacts.map((artifact) => issueFileArtifactGrant({
        artifactRef: artifact.artifactRef,
        expectedSha256: artifact.expectedSha256,
        maxBytes: artifact.bytes,
      }))),
    );
    return {
      leaseRef: `authority-lease-${randomUUID()}`,
      executionBinding: binding,
      acquireTargetLease: (input) => {
        assertLive();
        return manager.acquire(input);
      },
      issueFileArtifactGrant,
      release: async () => { released = true; },
    };
  }
}
