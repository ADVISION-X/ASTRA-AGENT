import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { readBrowserActivationReceipt } from "../../src/lib/browser/release/browser-activation-receipt.js";
import {
  GRASSEYE_BROWSER_EXTENSION_ID,
  GRASSEYE_BROWSER_MINIMUM_ACCEPTED_RELEASE_SEQUENCE,
  GRASSEYE_BROWSER_PROTOCOL_VERSION,
  GRASSEYE_BROWSER_RELEASE_IDENTITY,
  GRASSEYE_BROWSER_RELEASE_SEQUENCE,
} from "../../src/lib/browser/release/browser-release-identity.js";
import { extensionTreeIdentity } from "../../src/lib/browser/release/extension-tree-sha256.mjs";
import { loadBrowserRuntimeEnv, resolveBrowserRuntimeMode } from "../../src/lib/browser/release/browser-runtime-env.mjs";
import type { VerifiedBrowserArtifactSet } from "../../src/lib/browser/release/verify-browser-artifact.mjs";

const sha = (character: string): string => `sha256:${character.repeat(64)}`;

const withActivationReceipt = async (receiptPath: string, run: () => void): Promise<void> => {
  const previous = process.env.GRASSEYE_BROWSER_ACTIVATION_RECEIPT;
  process.env.GRASSEYE_BROWSER_ACTIVATION_RECEIPT = receiptPath;
  try {
    run();
  } finally {
    if (previous === undefined) delete process.env.GRASSEYE_BROWSER_ACTIVATION_RECEIPT;
    else process.env.GRASSEYE_BROWSER_ACTIVATION_RECEIPT = previous;
  }
};

const root = await mkdtemp(path.join(os.tmpdir(), "grasseye-artifact-contract-"));
try {
  const extension = path.join(root, "extension");
  await mkdir(path.join(extension, "nested"), { recursive: true });
  await writeFile(path.join(extension, "manifest.json"), "{\"manifest_version\":3}\n");
  await writeFile(path.join(extension, "nested", "worker.js"), "export const version = 3;\n");
  await writeFile(path.join(extension, "nested", "汉字.js"), "export const unicode = true;\n");
  const firstTree = await extensionTreeIdentity(extension);
  await writeFile(path.join(extension, "nested", "worker.js"), "export const version = 4;\n");
  const changedTree = await extensionTreeIdentity(extension);
  assert.notEqual(firstTree.sha256, changedTree.sha256, "Extension byte changes must change tree identity");
  await rename(path.join(extension, "nested", "worker.js"), path.join(extension, "nested", "worker-renamed.js"));
  const renamedTree = await extensionTreeIdentity(extension);
  assert.notEqual(changedTree.sha256, renamedTree.sha256, "Extension path changes must change tree identity");

  await writeFile(path.join(root, ".env"), "GRASSEYE_BROWSER_RUNTIME_MODE=production\n");
  await writeFile(path.join(root, ".env.local"), "GRASSEYE_BROWSER_RUNTIME_MODE=test\n");
  const loaded: NodeJS.ProcessEnv = {};
  loadBrowserRuntimeEnv(root, loaded);
  assert.equal(resolveBrowserRuntimeMode(loaded), "test");
  const shell: NodeJS.ProcessEnv = { GRASSEYE_BROWSER_RUNTIME_MODE: "production" };
  loadBrowserRuntimeEnv(root, shell);
  assert.equal(resolveBrowserRuntimeMode(shell), "production");
  assert.equal(resolveBrowserRuntimeMode({}), "production");

  const artifactSet = {
    manifest: {
      schemaVersion: "grasseye-browser-artifact-set-v2",
      releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
      releaseSequence: GRASSEYE_BROWSER_RELEASE_SEQUENCE,
      minimumAcceptedReleaseSequence: GRASSEYE_BROWSER_MINIMUM_ACCEPTED_RELEASE_SEQUENCE,
      protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
      extensionId: GRASSEYE_BROWSER_EXTENSION_ID,
      artifactMode: "test",
      platformArch: `${process.platform}-${process.arch}`,
      sourceCommitSha: "candidate-sha",
      builderIdentity: "test-builder",
      host: { path: "bin/grasseye-browser-host", sha256: sha("a") },
      browserctl: { path: "bin/grasseye-browserctl", sha256: sha("b") },
      extension: { path: "extension", manifestSha256: sha("c"), treeSha256: renamedTree.sha256 },
    },
    manifestPath: path.join(root, "browser-artifact-set.json"),
    signaturePath: path.join(root, "browser-artifact-set.sig"),
    artifactSetSha256: sha("d"),
    hostPath: path.join(root, "bin", "grasseye-browser-host"),
    browserctlPath: path.join(root, "bin", "grasseye-browserctl"),
    extensionPath: extension,
  } as const satisfies VerifiedBrowserArtifactSet;
  const receiptPath = path.join(root, "active-activation.json");
  const receipt = {
    schemaVersion: "grasseye-browser-activation-v2",
    releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
    releaseSequence: GRASSEYE_BROWSER_RELEASE_SEQUENCE,
    minimumAcceptedReleaseSequence: GRASSEYE_BROWSER_MINIMUM_ACCEPTED_RELEASE_SEQUENCE,
    protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
    extensionId: GRASSEYE_BROWSER_EXTENSION_ID,
    extensionTreeSha256: renamedTree.sha256,
    artifactSetSha256: artifactSet.artifactSetSha256,
    profileEnrollmentId: sha("e"),
    profileRef: "chrome-default",
    userDataDir: "/tmp/chrome-user-data",
    profileDirectory: "Default",
    chromeExecutablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    hostPath: "/tmp/host",
    hostSha256: artifactSet.manifest.host.sha256,
    controllerSocketPath: "/tmp/controller.sock",
    activatedAtUnixMs: Date.now(),
  };
  await writeFile(receiptPath, `${JSON.stringify(receipt)}\n`, { mode: 0o600 });
  await chmod(receiptPath, 0o600);
  await withActivationReceipt(receiptPath, () => {
    assert.equal(readBrowserActivationReceipt({ artifactSet }).artifactSetSha256, artifactSet.artifactSetSha256);
  });
  await writeFile(receiptPath, `${JSON.stringify({ ...receipt, extensionTreeSha256: sha("f") })}\n`, { mode: 0o600 });
  await chmod(receiptPath, 0o600);
  await withActivationReceipt(receiptPath, () => {
    assert.throws(() => readBrowserActivationReceipt({ artifactSet }), /BROWSER_ACTIVATION_RECEIPT_ARTIFACT_MISMATCH/u);
  });
} finally {
  await rm(root, { recursive: true, force: true });
}

process.stdout.write("local-browser-artifact-contract PASS\n");
