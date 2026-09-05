import { createHash, randomUUID } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import { basename } from "node:path";
import type { BrowserTargetLeaseManager, BrowserExactTargetAcquisition } from "../exact-target/browser-target-lease-manager.js";
import type { BrowserApprovedArtifactRef, BrowserTargetLease } from "../exact-target/browser-target-lease.js";
import type { BrowserFileArtifactGrantV1 } from "../exact-target/browser-file-artifact-grant.js";
import type { BrowserAuthorityIssuer } from "./browser-authority-issuer.js";
import type { BrowserControlledTarget, BrowserHash } from "../exact-target/browser-target-ref.js";
import { hashBrowserAuthorityCertificate } from "./browser-authority-certificate.js";

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

type BrowserConfirmedProviderReadbackSource = Readonly<{
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
  promptHash: BrowserHash;
  turnMarker: string;
}>;

export type BrowserConfirmedProviderFailureReadbackAuthorization =
  BrowserConfirmedProviderReadbackSource & Readonly<{
    schemaVersion: "browser-confirmed-provider-failure-readback.v1";
  }>;

export type BrowserConfirmedProviderReadbackAuthorization =
  BrowserConfirmedProviderReadbackSource & Readonly<{
  schemaVersion: "browser-confirmed-provider-readback.v1";
  canonicalConversationUrl: string;
  conversationIdentityHash: BrowserHash;
}>;

export type BrowserExecutionBinding = BrowserExecutionBindingCore & Readonly<
  | { kind: "local" | "production" }
  | {
    kind: "production-confirmed-failure-readback";
    confirmedProviderFailureReadback: BrowserConfirmedProviderFailureReadbackAuthorization;
  }
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
  issueFileArtifactGrant(input: Readonly<{
    artifactRef: string;
    providerDisplayName: string;
    expectedSha256: BrowserHash;
    maxBytes: number;
  }>): Promise<BrowserFileArtifactGrantV1>;
  release(): Promise<void>;
}>;

export type BrowserExecutionArtifactBinding = Readonly<{
  ownerPluginId: string;
  pluginVersion: number;
  jobId: string;
  attemptId: string;
  deviceId: string;
  leaseVersion: number;
  writerFenceHash: BrowserHash;
}>;

export type BrowserExecutionArtifact = Readonly<{
  artifactRef: string;
  localPath: string;
  contentHash: BrowserHash;
  sizeBytes: number;
  materializeProviderPath(providerDisplayName: string): Promise<string>;
  releaseProviderPaths(): Promise<void>;
}>;

export type BrowserExecutionArtifactLease = Readonly<{
  release(): Promise<void>;
}>;

type BoundBrowserArtifact = Readonly<{
  canonicalPath: string;
  contentHash: BrowserHash;
  sizeBytes: number;
  materializeProviderPath(providerDisplayName: string): Promise<string>;
  releaseProviderPaths(): Promise<void>;
}>;

type BrowserArtifactScope = ReadonlyMap<string, BoundBrowserArtifact>;

type ArtifactBindingInput = Readonly<{
  binding: BrowserExecutionArtifactBinding;
  artifacts: readonly BrowserExecutionArtifact[];
}>;

type FileArtifactGrantIssuerInput = Readonly<{
  assertLive: () => void;
  artifactFor: (artifactRef: string) => BoundBrowserArtifact | undefined;
  authorityEpoch: number;
  executionBindingHash: BrowserHash;
  grantedPaths: Map<string, GrantedPathEntry>;
}>;

const MAX_BOUND_BROWSER_EXECUTIONS = 10;
const MAX_EXECUTION_ARTIFACTS = 64;

const createFileArtifactGrantIssuer = (context: FileArtifactGrantIssuerInput) => async ({
  artifactRef, providerDisplayName, expectedSha256, maxBytes,
}: Readonly<{
  artifactRef: string; providerDisplayName: string; expectedSha256: BrowserHash; maxBytes: number;
}>): Promise<BrowserFileArtifactGrantV1> => {
  context.assertLive();
  assertProviderDisplayName(providerDisplayName);
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error("BROWSER_FILE_GRANT_INVALID");
  const boundArtifact = context.artifactFor(artifactRef);
  if (!boundArtifact) throw new Error("BROWSER_FILE_GRANT_INVALID");
  const source = await resolveBoundArtifact(boundArtifact);
  if (source.contentHash !== expectedSha256 || source.sizeBytes !== maxBytes) {
    throw new Error("BROWSER_FILE_GRANT_INVALID");
  }
  const providerPath = await source.materializeProviderPath(providerDisplayName);
  const artifact = await resolveBoundArtifact({
    canonicalPath: await realpath(providerPath),
    contentHash: source.contentHash,
    sizeBytes: source.sizeBytes,
    materializeProviderPath: source.materializeProviderPath,
    releaseProviderPaths: source.releaseProviderPaths,
  });
  if (basename(artifact.canonicalPath) !== providerDisplayName) {
    throw new Error("BROWSER_FILE_GRANT_INVALID");
  }
  const grant = {
    schemaVersion: "browser-file-artifact-grant-v1",
    grantRef: `grant-${randomUUID()}`,
    authorityEpoch: context.authorityEpoch,
    executionBindingHash: context.executionBindingHash,
    artifactRef,
    contentHash: expectedSha256,
    maxBytes,
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
  } as const;
  context.grantedPaths.set(grant.grantRef, {
    artifactRef,
    providerDisplayName,
    path: artifact.canonicalPath,
    expiresAt: grant.expiresAt,
    contentHash: grant.contentHash,
    maxBytes: grant.maxBytes,
  });
  return grant;
};

const artifactBindingKey = (binding: BrowserExecutionArtifactBinding): string => JSON.stringify([
  binding.ownerPluginId,
  binding.pluginVersion,
  binding.jobId,
  binding.attemptId,
  binding.deviceId,
  binding.leaseVersion,
  binding.writerFenceHash,
]);

const executionArtifactBinding = (binding: BrowserExecutionBinding): BrowserExecutionArtifactBinding => ({
  ownerPluginId: binding.ownerPluginId,
  pluginVersion: binding.pluginVersion,
  jobId: binding.jobId,
  attemptId: binding.attemptId,
  deviceId: binding.deviceId,
  leaseVersion: binding.leaseVersion,
  writerFenceHash: binding.writerFenceHash,
});

const assertArtifactBindingInput = (input: ArtifactBindingInput): void => {
  if (!input.binding.ownerPluginId || !Number.isInteger(input.binding.pluginVersion)
    || input.binding.pluginVersion < 1 || !input.binding.jobId || !input.binding.attemptId
    || !input.binding.deviceId || !Number.isInteger(input.binding.leaseVersion)
    || input.binding.leaseVersion < 1 || !/^sha256:[a-f0-9]{64}$/u.test(input.binding.writerFenceHash)
    || input.artifacts.length > MAX_EXECUTION_ARTIFACTS) {
    throw new Error("BROWSER_FILE_GRANT_INVALID");
  }
};

const resolveBoundArtifact = async (artifact: BoundBrowserArtifact): Promise<BoundBrowserArtifact> => {
  const canonicalPath = await realpath(artifact.canonicalPath);
  const metadata = await stat(canonicalPath);
  const bytes = await readFile(canonicalPath);
  const actualHash = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  if (canonicalPath !== artifact.canonicalPath || !metadata.isFile()
    || metadata.size !== artifact.sizeBytes || actualHash !== artifact.contentHash) {
    throw new Error("BROWSER_FILE_GRANT_INVALID");
  }
  return artifact;
};

const assertProviderDisplayName = (value: string): void => {
  if (!value || value !== value.normalize("NFC") || value === "." || value === ".."
    || value.includes("/") || value.includes("\\") || basename(value) !== value
    || Buffer.byteLength(value, "utf8") > 255) {
    throw new Error("BROWSER_FILE_GRANT_INVALID");
  }
};

export type BrowserOperatorTargetClaim = Readonly<{
  authorityEpoch: number;
  targetRef: string;
  documentRef: string;
  navigationEpoch: number;
  claimOrigin: "https://chatgpt.com";
}>;

type GrantedPathEntry = Readonly<{
  artifactRef: string;
  providerDisplayName: string;
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
  resolveCurrentArtifact: (artifactRef: string) => Promise<BoundBrowserArtifact>,
): Promise<readonly string[]> => Promise.all(grants.map(async (grant) => {
  const registered = grantedPaths.get(grant.grantRef);
  if (!registered
    || registered.expiresAt !== grant.expiresAt
    || registered.contentHash !== grant.contentHash
    || registered.maxBytes !== grant.maxBytes
    || Date.parse(registered.expiresAt) <= Date.now()) {
    throw new Error("BROWSER_FILE_GRANT_INVALID");
  }
  const source = await resolveCurrentArtifact(registered.artifactRef);
  if (source.contentHash !== registered.contentHash || source.sizeBytes !== registered.maxBytes) {
    throw new Error("BROWSER_FILE_GRANT_INVALID");
  }
  const artifact = await resolveBoundArtifact({
    canonicalPath: registered.path,
    contentHash: registered.contentHash,
    sizeBytes: registered.maxBytes,
    materializeProviderPath: source.materializeProviderPath,
    releaseProviderPaths: source.releaseProviderPaths,
  });
  if (basename(artifact.canonicalPath) !== registered.providerDisplayName) {
    throw new Error("BROWSER_FILE_GRANT_INVALID");
  }
  return artifact.canonicalPath;
}));

export class BrowserAuthorityBroker {
  private operatorTargetClaim: BrowserOperatorTargetClaim | null = null;
  private readonly executionArtifacts = new Map<string, BrowserArtifactScope>();
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
  ) {}

  public currentStatus(): BrowserAuthorityStatus {
    const slot = this.issuer.current();
    if (slot.kind === "ABSENT") return { kind: "UNAVAILABLE", reasonCode: slot.reasonCode };
    return {
      kind: "AVAILABLE",
      authorityRefHash: `sha256:${createHash("sha256").update(slot.authority.authorityRef).digest("hex")}`,
      certificateHash: hashBrowserAuthorityCertificate(slot.authority),
      channelSessionHash: slot.authority.channelSessionHash,
    };
  }

  /** Runtime binds its task-local files; Browser keeps only an execution-scoped in-memory view. */
  public async bindExecutionArtifacts(input: Readonly<{
    binding: BrowserExecutionArtifactBinding;
    artifacts: readonly BrowserExecutionArtifact[];
  }>): Promise<BrowserExecutionArtifactLease> {
    assertArtifactBindingInput(input);
    const key = artifactBindingKey(input.binding);
    if (this.executionArtifacts.has(key) || this.executionArtifacts.size >= MAX_BOUND_BROWSER_EXECUTIONS) {
      throw new Error("BROWSER_BACKPRESSURE");
    }
    const artifacts = new Map<string, BoundBrowserArtifact>();
    for (const artifact of input.artifacts) {
      if (!artifact.artifactRef || artifacts.has(artifact.artifactRef)
        || !Number.isSafeInteger(artifact.sizeBytes) || artifact.sizeBytes < 0
        || !/^sha256:[a-f0-9]{64}$/u.test(artifact.contentHash)
        || typeof artifact.materializeProviderPath !== "function"
        || typeof artifact.releaseProviderPaths !== "function") {
        throw new Error("BROWSER_FILE_GRANT_INVALID");
      }
      const canonicalPath = await realpath(artifact.localPath);
      const bound = await resolveBoundArtifact({
        canonicalPath,
        contentHash: artifact.contentHash,
        sizeBytes: artifact.sizeBytes,
        materializeProviderPath: artifact.materializeProviderPath,
        releaseProviderPaths: artifact.releaseProviderPaths,
      });
      artifacts.set(artifact.artifactRef, bound);
    }
    const scope = artifacts as BrowserArtifactScope;
    this.executionArtifacts.set(key, scope);
    let released = false;
    return Object.freeze({
      release: async () => {
        if (released) return;
        released = true;
        if (this.executionArtifacts.get(key) === scope) this.executionArtifacts.delete(key);
        const cleanup = await Promise.allSettled(
          [...scope.values()].map((artifact) => artifact.releaseProviderPaths()),
        );
        const failures = cleanup.filter((result) => result.status === "rejected");
        if (failures.length > 0) throw new AggregateError(
          failures.map((result) => (result as PromiseRejectedResult).reason),
          "BROWSER_FILE_BINDING_RELEASE_FAILED",
          { cause: (failures[0] as PromiseRejectedResult).reason },
        );
      },
    });
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

  private controlledTargetForCurrentClaim(
    authorityEpoch: number,
    binding: BrowserExecutionBinding,
  ): BrowserControlledTarget | null {
    const claim = this.operatorTargetClaim;
    return claim && claim.authorityEpoch === authorityEpoch ? controlledTargetForClaim(claim, binding) : null;
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
    const artifactScopeKey = artifactBindingKey(executionArtifactBinding(binding));
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
    const issueFileArtifactGrant = createFileArtifactGrantIssuer({
      assertLive,
      artifactFor: (artifactRef) => this.executionArtifacts.get(artifactScopeKey)?.get(artifactRef),
      authorityEpoch: slot.authority.authorityEpoch,
      executionBindingHash: binding.executionRefHash,
      grantedPaths,
    });
    const manager = this.targetLeaseManagerFor(
      binding,
      (grants) => resolveGrantedPaths(grantedPaths, grants, async (artifactRef) => {
        const artifact = this.executionArtifacts.get(artifactScopeKey)?.get(artifactRef);
        if (!artifact) throw new Error("BROWSER_FILE_GRANT_INVALID");
        return resolveBoundArtifact(artifact);
      }),
      () => this.controlledTargetForCurrentClaim(slot.authority.authorityEpoch, binding),
      (artifacts) => Promise.all(artifacts.map((artifact) => issueFileArtifactGrant({
        artifactRef: artifact.artifactRef,
        providerDisplayName: artifact.providerDisplayName,
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
