import { createHash, randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import {
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

const DEFAULT_MAX_BYTES = 128 * 1024 * 1024;
const DEFAULT_TTL_MS = 15 * 60 * 1_000;
const monotonicEpochMs = (): number => performance.timeOrigin + performance.now();

const hash = (value: Buffer | string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const isInsideRoot = (candidate: string, root: string): boolean => {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

export type BrowserFileArtifactGrantV1 = Readonly<{
  schemaVersion: "browser-file-artifact-grant.v1";
  grantRef: string;
  artifactRef: string;
  authorityEpoch: number;
  executionFenceHash: `sha256:${string}`;
  approvedRootHash: `sha256:${string}`;
  canonicalRealpathHash: `sha256:${string}`;
  deviceIdHash: `sha256:${string}`;
  inodeHash: `sha256:${string}`;
  byteLength: number;
  contentHash: `sha256:${string}`;
  expiresAtMonotonicMs: number;
}>;

export type ResolvedBrowserFileArtifactGrant = Readonly<{
  grant: BrowserFileArtifactGrantV1;
  stagedArtifactPath: string;
}>;

export class BrowserFileArtifactGrantManager {
  private readonly grants = new Map<string, ResolvedBrowserFileArtifactGrant>();
  private readonly stagingDir: string;

  constructor(
    dataDir: string,
    private readonly approvedRoots: readonly string[],
  ) {
    this.stagingDir = path.join(dataDir, "browser-runtime", "artifacts");
  }

  async issue(input: {
    artifactRef: string;
    sourcePath: string;
    authorityEpoch: number;
    executionFenceHash: `sha256:${string}`;
    expectedSha256?: `sha256:${string}`;
    maxBytes?: number;
    ttlMs?: number;
  }): Promise<BrowserFileArtifactGrantV1> {
    if (!input.artifactRef.trim()) throw new Error("BROWSER_FILE_ARTIFACT_REF_REQUIRED");
    if (this.approvedRoots.length === 0) throw new Error("BROWSER_FILE_APPROVED_ROOT_REQUIRED");
    const rawStat = await lstat(input.sourcePath);
    if (rawStat.isSymbolicLink()) throw new Error("BROWSER_FILE_SYMLINK_FORBIDDEN");
    const canonicalPath = await realpath(input.sourcePath);
    const roots = await Promise.all(this.approvedRoots.map((root) => realpath(root)));
    const approvedRoot = roots.find((root) => isInsideRoot(canonicalPath, root));
    if (!approvedRoot) throw new Error("BROWSER_FILE_OUTSIDE_APPROVED_ROOT");

    const handle = await open(canonicalPath, "r");
    let bytes: Buffer;
    let before: Awaited<ReturnType<typeof handle.stat>>;
    let after: Awaited<ReturnType<typeof handle.stat>>;
    try {
      before = await handle.stat();
      if (!before.isFile()) throw new Error("BROWSER_FILE_NOT_REGULAR");
      const maxBytes = input.maxBytes ?? DEFAULT_MAX_BYTES;
      if (before.size > maxBytes) throw new Error("BROWSER_FILE_TOO_LARGE");
      bytes = await readFile(handle);
      after = await handle.stat();
    } finally {
      await handle.close();
    }
    if (
      before.dev !== after.dev
      || before.ino !== after.ino
      || before.size !== after.size
      || before.mtimeMs !== after.mtimeMs
      || bytes.byteLength !== after.size
    ) {
      throw new Error("BROWSER_FILE_CHANGED_DURING_GRANT");
    }
    const contentHash = hash(bytes);
    if (input.expectedSha256 && input.expectedSha256 !== contentHash) {
      throw new Error("BROWSER_FILE_EXPECTED_HASH_MISMATCH");
    }

    await mkdir(this.stagingDir, { recursive: true, mode: 0o700 });
    const contentName = contentHash.slice("sha256:".length);
    const stagedArtifactPath = path.join(this.stagingDir, `${contentName}.artifact`);
    const temp = path.join(this.stagingDir, `.${contentName}.${randomUUID()}.tmp`);
    await writeFile(temp, bytes, { mode: 0o600, flag: "wx" });
    try {
      const stagedBytes = await readFile(temp);
      if (hash(stagedBytes) !== contentHash) {
        throw new Error("BROWSER_FILE_STAGING_HASH_MISMATCH");
      }
      try {
        await rename(temp, stagedArtifactPath);
      } catch (error) {
        const existing = await stat(stagedArtifactPath).catch(() => null);
        if (!existing?.isFile()) throw error;
        await unlink(temp).catch(() => undefined);
      }
    } catch (error) {
      await unlink(temp).catch(() => undefined);
      throw error;
    }

    const grant: BrowserFileArtifactGrantV1 = Object.freeze({
      schemaVersion: "browser-file-artifact-grant.v1" as const,
      grantRef: `browser-file-grant:${randomUUID()}`,
      artifactRef: input.artifactRef,
      authorityEpoch: input.authorityEpoch,
      executionFenceHash: input.executionFenceHash,
      approvedRootHash: hash(approvedRoot),
      canonicalRealpathHash: hash(canonicalPath),
      deviceIdHash: hash(String(after.dev)),
      inodeHash: hash(String(after.ino)),
      byteLength: after.size,
      contentHash,
      expiresAtMonotonicMs: monotonicEpochMs() + (input.ttlMs ?? DEFAULT_TTL_MS),
    });
    this.grants.set(grant.grantRef, Object.freeze({ grant, stagedArtifactPath }));
    return grant;
  }

  async resolveForSend(input: {
    grant: BrowserFileArtifactGrantV1;
    authorityEpoch: number;
    executionFenceHash: `sha256:${string}`;
  }): Promise<ResolvedBrowserFileArtifactGrant> {
    const current = this.grants.get(input.grant.grantRef);
    if (!current || current.grant.contentHash !== input.grant.contentHash) {
      throw new Error("BROWSER_FILE_ARTIFACT_GRANT_INVALID");
    }
    if (
      current.grant.authorityEpoch !== input.authorityEpoch
      || current.grant.executionFenceHash !== input.executionFenceHash
      || monotonicEpochMs() >= current.grant.expiresAtMonotonicMs
    ) {
      this.grants.delete(input.grant.grantRef);
      throw new Error("BROWSER_FILE_ARTIFACT_GRANT_STALE");
    }
    const bytes = await readFile(current.stagedArtifactPath);
    const stagedStat = await stat(current.stagedArtifactPath);
    if (
      !stagedStat.isFile()
      || stagedStat.size !== current.grant.byteLength
      || hash(bytes) !== current.grant.contentHash
    ) {
      this.grants.delete(input.grant.grantRef);
      throw new Error("BROWSER_FILE_ARTIFACT_GRANT_READBACK_FAILED");
    }
    return current;
  }

  revokeAuthority(authorityEpoch: number): void {
    for (const [ref, value] of this.grants) {
      if (value.grant.authorityEpoch === authorityEpoch) this.grants.delete(ref);
    }
  }

  clear(): void {
    this.grants.clear();
  }
}
