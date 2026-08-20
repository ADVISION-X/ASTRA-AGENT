import { createHash, randomUUID } from "node:crypto";
import {
  copyFile,
  mkdir,
  open,
  readFile,
  realpath,
  rm,
  stat,
} from "node:fs/promises";
import path from "node:path";
import type { BrowserExecutionBinding } from "../browser-authority-api.js";
export type BrowserFileArtifactGrantV1 = Readonly<{
  schemaVersion: "browser-file-artifact-grant.v1";
  grantRef: string;
  artifactRef: string;
  fileName: string;
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
type InternalGrant = Readonly<{
  grant: BrowserFileArtifactGrantV1;
  stagedArtifactPath: string;
}>;
const hash = (v: Buffer | string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(v).digest("hex")}`;
const now = (): number => performance.timeOrigin + performance.now();
export class BrowserFileArtifactGrantManager {
  private readonly grants = new Map<string, InternalGrant>();
  constructor(
    private readonly input: {
      rootDir: string;
      approvedRoots: readonly string[];
      ttlMs?: number;
    },
  ) {}
  async issue(input: {
    artifactRef: string;
    sourcePath: string;
    authorityEpoch: number;
    executionBinding: BrowserExecutionBinding;
    expectedSha256?: `sha256:${string}`;
    maxBytes?: number;
  }): Promise<BrowserFileArtifactGrantV1> {
    const source = await realpath(input.sourcePath);
    const roots = await Promise.all(
      this.input.approvedRoots.map((r) => realpath(r)),
    );
    const approved = roots.find(
      (r) => source === r || source.startsWith(`${r}${path.sep}`),
    );
    if (!approved)
      throw new Error(
        "BROWSER_FILE_ARTIFACT_GRANT_INVALID:source outside approved roots",
      );
    const before = await stat(source, { bigint: true });
    if (!before.isFile())
      throw new Error("BROWSER_FILE_ARTIFACT_GRANT_INVALID:not regular file");
    if (before.size > BigInt(input.maxBytes ?? 512 * 1024 * 1024))
      throw new Error("BROWSER_BACKPRESSURE:file exceeds artifact budget");
    const bytes = await readFile(source);
    const contentHash = hash(bytes);
    if (input.expectedSha256 && input.expectedSha256 !== contentHash)
      throw new Error(
        "BROWSER_FILE_ARTIFACT_GRANT_INVALID:content hash mismatch",
      );
    const after = await stat(source, { bigint: true });
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs
    )
      throw new Error(
        "BROWSER_FILE_ARTIFACT_GRANT_INVALID:source changed during grant",
      );
    const grantRef = `browser-file-grant:${randomUUID()}`;
    const stagedDir = path.join(this.input.rootDir, contentHash.slice(7));
    await mkdir(stagedDir, { recursive: true, mode: 0o700 });
    const stagedArtifactPath = path.join(stagedDir, "artifact.bin");
    await copyFile(source, stagedArtifactPath);
    if (hash(await readFile(stagedArtifactPath)) !== contentHash)
      throw new Error(
        "BROWSER_FILE_ARTIFACT_GRANT_INVALID:staging readback mismatch",
      );
    const grant = Object.freeze({
      schemaVersion: "browser-file-artifact-grant.v1" as const,
      grantRef,
      artifactRef: input.artifactRef,
      fileName: path.basename(source),
      authorityEpoch: input.authorityEpoch,
      executionFenceHash: input.executionBinding.writerFenceHash,
      approvedRootHash: hash(approved),
      canonicalRealpathHash: hash(source),
      deviceIdHash: hash(String(after.dev)),
      inodeHash: hash(String(after.ino)),
      byteLength: Number(after.size),
      contentHash,
      expiresAtMonotonicMs: now() + (this.input.ttlMs ?? 120_000),
    });
    this.grants.set(grantRef, Object.freeze({ grant, stagedArtifactPath }));
    return grant;
  }
  async resolveBytesForSend(input: {
    grant: BrowserFileArtifactGrantV1;
    authorityEpoch: number;
    executionFenceHash: `sha256:${string}`;
  }): Promise<{ grant: BrowserFileArtifactGrantV1; bytes: Buffer }> {
    const current = this.grants.get(input.grant.grantRef);
    if (!current || current.grant !== input.grant)
      throw new Error("BROWSER_FILE_ARTIFACT_GRANT_INVALID:unknown grant");
    const grant = current.grant;
    if (
      grant.authorityEpoch !== input.authorityEpoch ||
      grant.executionFenceHash !== input.executionFenceHash ||
      now() >= grant.expiresAtMonotonicMs
    )
      throw new Error("BROWSER_FILE_ARTIFACT_GRANT_INVALID:stale grant");
    const handle = await open(current.stagedArtifactPath, "r");
    try {
      const before = await handle.stat({ bigint: true });
      const bytes = await handle.readFile();
      const after = await handle.stat({ bigint: true });
      if (
        before.dev !== after.dev ||
        before.ino !== after.ino ||
        before.size !== after.size ||
        before.mtimeNs !== after.mtimeNs ||
        Number(after.size) !== grant.byteLength ||
        hash(bytes) !== grant.contentHash
      )
        throw new Error(
          "BROWSER_FILE_ARTIFACT_GRANT_INVALID:send readback mismatch",
        );
      return { grant, bytes };
    } finally {
      await handle.close();
    }
  }
  async destroy(grantRef: string): Promise<void> {
    const current = this.grants.get(grantRef);
    this.grants.delete(grantRef);
    if (current)
      await rm(path.dirname(current.stagedArtifactPath), {
        recursive: true,
        force: true,
      });
  }
  async destroyAll(): Promise<void> {
    this.grants.clear();
    await rm(this.input.rootDir, { recursive: true, force: true });
  }
}
