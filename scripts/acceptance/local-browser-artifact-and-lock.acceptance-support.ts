import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  BrowserAuthorityBroker,
  type BrowserExecutionBinding,
} from "../../src/lib/browser/infrastructure/browser-authority-broker.js";
import { BrowserAuthorityIssuer } from "../../src/lib/browser/infrastructure/browser-authority-issuer.js";
import { hashBrowserAuthorityCertificate } from "../../src/lib/browser/infrastructure/browser-authority-certificate.js";
import type { BrowserFileArtifactGrantV1 } from "../../src/lib/browser/exact-target/browser-file-artifact-grant.js";
import { BrowserOwnerLock } from "../../src/lib/browser/infrastructure/browser-owner-lock.js";

const prepareArtifactFixture = async () => {
  const fixture = await mkdtemp(join(tmpdir(), "browser-artifact-registry-"));
  const stagedFile = join(fixture, "incoming", "proof.txt");
  await mkdir(join(fixture, "incoming"), { recursive: true });
  await writeFile(stagedFile, "approved-browser-artifact", "utf8");
  const approvedBytes = await readFile(stagedFile);
  const approvedHash = `sha256:${createHash("sha256").update(approvedBytes).digest("hex")}` as const;
  return { fixture, stagedFile, approvedBytes, approvedHash };
};

const verifyExecutionScopedArtifactBinding = async (): Promise<void> => {
  const prepared = await prepareArtifactFixture();
  const { fixture, stagedFile, approvedBytes, approvedHash } = prepared;
  const issuer = new BrowserAuthorityIssuer();
  Reflect.set(issuer, "slot", {
    kind: "PRESENT",
    authority: { authorityEpoch: 1, authorityRef: "authority:artifact-binding" },
  });
  const grantResolverCapture: {
    current?: (grants: readonly BrowserFileArtifactGrantV1[]) => Promise<readonly string[]>;
  } = {};
  const broker = new BrowserAuthorityBroker(
    issuer,
    () => undefined,
    (_binding, resolver) => {
      grantResolverCapture.current = resolver;
      return Object.freeze({
        acquire: () => { throw new Error("target lease acquisition is outside this artifact acceptance"); },
      });
    },
  );
  const status = broker.currentStatus();
  assert.equal(status.kind, "AVAILABLE");
  if (status.kind !== "AVAILABLE") throw new Error("BROWSER_AUTHENTICATION_INCOMPLETE");
  assert.equal(status.authorityRefHash,
    `sha256:${createHash("sha256").update("authority:artifact-binding").digest("hex")}`);
  const currentAuthority = issuer.current();
  if (currentAuthority.kind === "ABSENT") throw new Error("BROWSER_AUTHENTICATION_INCOMPLETE");
  assert.equal(status.certificateHash, hashBrowserAuthorityCertificate(currentAuthority.authority));
  const binding: BrowserExecutionBinding = {
    kind: "production", ownerPluginId: "artifact-proof", pluginVersion: 1, jobId: "artifact-job",
    productStepId: "artifact-step", callId: "artifact-call", attemptId: "artifact-attempt",
    deviceId: "artifact-device", leaseVersion: 1, localOrderId: "artifact-order",
    contractManifestHash: approvedHash, executionRef: "artifact-execution", jobRefHash: approvedHash,
    executionRefHash: approvedHash, writerLeaseEpoch: 1, writerFenceHash: approvedHash,
    candidateHash: approvedHash, commandTtlMs: 5_000,
  };
  try {
    const bindingLease = await broker.bindExecutionArtifacts({
      binding,
      artifacts: [{
        artifactRef: "approved", localPath: stagedFile,
        contentHash: approvedHash, sizeBytes: approvedBytes.byteLength,
      }],
    });
    const authorityLease = await broker.acquireForExecution(binding);
    const grant = await authorityLease.issueFileArtifactGrant({
      artifactRef: "approved", expectedSha256: approvedHash, maxBytes: approvedBytes.byteLength,
    });
    const resolver = grantResolverCapture.current;
    if (!resolver) throw new Error("BROWSER_FILE_GRANT_INVALID");
    assert.deepEqual(await resolver([grant]), [await realpath(stagedFile)],
      "Browser must resolve the Runtime-owned task file without copying it into a private registry");
    await writeFile(stagedFile, "tampered-browser-artifact", "utf8");
    await assert.rejects(resolver([grant]), /BROWSER_FILE_GRANT_INVALID/u,
      "file-input path resolution must revalidate bytes after grant issue and immediately before dispatch");
    await assert.rejects(authorityLease.issueFileArtifactGrant({
      artifactRef: "approved", expectedSha256: approvedHash, maxBytes: approvedBytes.byteLength,
    }), /BROWSER_FILE_GRANT_INVALID/u, "grant issue must revalidate the current task file bytes");
    await writeFile(stagedFile, approvedBytes);
    bindingLease.release();
    await assert.rejects(authorityLease.issueFileArtifactGrant({
      artifactRef: "approved", expectedSha256: approvedHash, maxBytes: approvedBytes.byteLength,
    }), /BROWSER_FILE_GRANT_INVALID/u, "execution settlement must invalidate its artifact binding");
    await authorityLease.release();
    const restartedBroker = new BrowserAuthorityBroker(
      issuer, () => undefined,
      () => Object.freeze({ acquire: () => { throw new Error("not acquired"); } }),
    );
    const restartedLease = await restartedBroker.acquireForExecution(binding);
    await assert.rejects(restartedLease.issueFileArtifactGrant({
      artifactRef: "approved", expectedSha256: approvedHash, maxBytes: approvedBytes.byteLength,
    }), /BROWSER_FILE_GRANT_INVALID/u, "Browser restart must not retain task-local artifact paths");
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
  await verifyExecutionScopedArtifactBinding();
  await verifyStaleOwnerLockRecovery();
};
