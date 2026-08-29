import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BrowserArtifactRegistry } from "../../src/lib/browser/infrastructure/browser-authority-broker.js";
import { BrowserOwnerLock } from "../../src/lib/browser/infrastructure/browser-owner-lock.js";

const prepareArtifactFixture = async () => {
  const fixture = await mkdtemp(join(tmpdir(), "browser-artifact-registry-"));
  const allowedRoot = join(fixture, "upload-staging");
  const stagedFile = join(fixture, "incoming", "proof.txt");
  const outsideFile = join(fixture, "outside.txt");
  await mkdir(join(fixture, "incoming"), { recursive: true });
  await writeFile(stagedFile, "approved-browser-artifact", "utf8");
  await writeFile(outsideFile, "outside-browser-artifact", "utf8");
  const approvedBytes = await readFile(stagedFile);
  const approvedHash = `sha256:${createHash("sha256").update(approvedBytes).digest("hex")}` as const;
  return { fixture, allowedRoot, stagedFile, outsideFile, approvedBytes, approvedHash };
};

const verifyArtifactRegistry = async (): Promise<void> => {
  const prepared = await prepareArtifactFixture();
  const { fixture, allowedRoot, stagedFile, outsideFile, approvedBytes, approvedHash } = prepared;
  const registry = new BrowserArtifactRegistry(allowedRoot);
  try {
    await registry.registerArtifact({
      artifactRef: "approved", filePath: stagedFile,
      contentHash: approvedHash, sizeBytes: approvedBytes.byteLength,
    });
    const resolved = await registry.resolveArtifact("approved");
    assert.equal(
      resolved.canonicalPath,
      await realpath(join(allowedRoot, approvedHash.slice("sha256:".length), "proof.txt")),
    );
    assert.notEqual(resolved.canonicalPath, await realpath(stagedFile));
    assert.deepEqual(await readFile(resolved.canonicalPath), approvedBytes);
    await assert.rejects(registry.registerArtifact({
      artifactRef: "outside", filePath: outsideFile,
      contentHash: `sha256:${"0".repeat(64)}`, sizeBytes: 24,
    }), /BROWSER_FILE_GRANT_INVALID/u);
    await assert.rejects(registry.registerArtifact({
      artifactRef: "tampered-hash", filePath: stagedFile,
      contentHash: `sha256:${"0".repeat(64)}`, sizeBytes: approvedBytes.byteLength,
    }), /BROWSER_FILE_GRANT_INVALID/u);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
};

const verifyStaleOwnerLockRecovery = async (): Promise<void> => {
  const fixture = await mkdtemp(join(tmpdir(), "browser-owner-lock-"));
  const lockPath = join(fixture, "browser", "owner.lock");
  await mkdir(join(fixture, "browser"), { recursive: true });
  await writeFile(lockPath, "2147483647\n", { encoding: "utf8", mode: 0o600 });
  const recoveredLock = new BrowserOwnerLock(lockPath);
  try {
    await recoveredLock.acquire();
    await assert.rejects(new BrowserOwnerLock(lockPath).acquire(), /BROWSER_DUAL_ACTIVE_WORKER/u);
  } finally {
    await recoveredLock.release();
    await rm(fixture, { recursive: true, force: true });
  }
};

export const verifyBrowserArtifactAndLockContracts = async (): Promise<void> => {
  await verifyArtifactRegistry();
  await verifyStaleOwnerLockRecovery();
};
