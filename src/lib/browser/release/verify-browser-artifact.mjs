import { createHash, verify } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { extensionTreeIdentity } from "./extension-tree-sha256.mjs";
import { resolveBrowserRuntimeMode } from "./browser-runtime-env.mjs";

const RELEASE_IDENTITY = "grasseye-browser-runtime-2026-08-18-v2";
const RELEASE_SEQUENCE = 3;
const MINIMUM_ACCEPTED_RELEASE_SEQUENCE = 3;
const PROTOCOL_VERSION = "grasseye-browser-v2";
const EXTENSION_ID = "mepfnlhndaiihhfejbbhfehegpbdnipl";
const sha256 = async (filePath) =>
  `sha256:${createHash("sha256").update(await readFile(filePath)).digest("hex")}`;

const runRequired = (command, args) => {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.error || result.status !== 0) {
    throw new Error(`BROWSER_ARTIFACT_PLATFORM_SIGNATURE_INVALID:${command}:${result.stderr || result.error?.message || result.status}`);
  }
};

export const resolveBrowserRuntimeArtifactRoot = (rootDir, platform = process.platform, architecture = process.arch) =>
  path.join(rootDir, "artifacts", "browser-runtime", `${platform}-${architecture}`);

const manifestReleaseTupleValid = (manifest, mode) => [
  manifest.schemaVersion === "grasseye-browser-artifact-set-v2",
  manifest.releaseIdentity === RELEASE_IDENTITY,
  manifest.releaseSequence === RELEASE_SEQUENCE,
  manifest.releaseSequence >= MINIMUM_ACCEPTED_RELEASE_SEQUENCE,
  manifest.minimumAcceptedReleaseSequence === MINIMUM_ACCEPTED_RELEASE_SEQUENCE,
  manifest.protocolVersion === PROTOCOL_VERSION,
  manifest.extensionId === EXTENSION_ID,
  manifest.artifactMode === mode,
  manifest.platformArch === `${process.platform}-${process.arch}`,
  typeof manifest.sourceCommitSha === "string",
  manifest.sourceCommitSha !== "UNBOUND",
  typeof manifest.builderIdentity === "string",
  manifest.builderIdentity !== "UNBOUND",
  typeof manifest.extension?.treeSha256 === "string",
].every(Boolean);

const verifyArtifactPaths = (root, manifest) => {
  const paths = {
    hostPath: path.resolve(root, manifest.host.path),
    browserctlPath: path.resolve(root, manifest.browserctl.path),
    extensionPath: path.resolve(root, manifest.extension.path),
  };
  const extensionManifestPath = path.resolve(paths.extensionPath, "manifest.json");
  for (const candidate of [...Object.values(paths), extensionManifestPath]) {
    if (!candidate.startsWith(`${root}${path.sep}`) || !existsSync(candidate)) {
      throw new Error(`BROWSER_ARTIFACT_PATH_INVALID:${candidate}`);
    }
  }
  return { ...paths, extensionManifestPath };
};

const verifyArtifactHashes = async (manifest, paths) => {
  if (await sha256(paths.hostPath) !== manifest.host.sha256) throw new Error("BROWSER_HOST_ARTIFACT_HASH_MISMATCH");
  if (await sha256(paths.browserctlPath) !== manifest.browserctl.sha256) throw new Error("BROWSERCTL_ARTIFACT_HASH_MISMATCH");
  if (await sha256(paths.extensionManifestPath) !== manifest.extension.manifestSha256) throw new Error("BROWSER_EXTENSION_ARTIFACT_HASH_MISMATCH");
  if ((await extensionTreeIdentity(paths.extensionPath)).sha256 !== manifest.extension.treeSha256) {
    throw new Error("BROWSER_EXTENSION_TREE_ARTIFACT_HASH_MISMATCH");
  }
};

const verifyPlatformSignatures = (mode, paths) => {
  if (process.platform !== "darwin") return;
  runRequired("/usr/bin/codesign", ["--verify", "--deep", "--strict", "--verbose=2", paths.hostPath]);
  runRequired("/usr/bin/codesign", ["--verify", "--deep", "--strict", "--verbose=2", paths.browserctlPath]);
  if (mode !== "production") return;
  runRequired("/usr/sbin/spctl", ["--assess", "--type", "execute", "--verbose=2", paths.hostPath]);
  runRequired("/usr/sbin/spctl", ["--assess", "--type", "execute", "--verbose=2", paths.browserctlPath]);
};

export const verifyBrowserArtifactSet = async (artifactRoot) => {
  const root = path.resolve(artifactRoot);
  const manifestPath = path.join(root, "browser-artifact-set.json");
  const signaturePath = path.join(root, "browser-artifact-set.sig");
  const mode = resolveBrowserRuntimeMode();
  const testPublicKeyPath = path.join(root, "browser-artifact-set.test-public-key.pem");
  const publicKeyPem = mode === "test"
    ? (existsSync(testPublicKeyPath) ? await readFile(testPublicKeyPath, "utf8") : "")
    : process.env.GRASSEYE_BROWSER_RELEASE_PUBLIC_KEY_PEM?.trim();
  if (!publicKeyPem) throw new Error(mode === "test" ? "BROWSER_TEST_RELEASE_PUBLIC_KEY_REQUIRED" : "BROWSER_RELEASE_PUBLIC_KEY_REQUIRED");
  if (!existsSync(manifestPath) || !existsSync(signaturePath)) {
    throw new Error(mode === "test" ? "BROWSER_TEST_ARTIFACT_SIGNATURE_FILES_REQUIRED" : "BROWSER_ARTIFACT_SIGNATURE_FILES_REQUIRED");
  }
  const manifestBytes = await readFile(manifestPath);
  const signatureBytes = await readFile(signaturePath);
  if (!verify(null, manifestBytes, publicKeyPem, signatureBytes)) {
    throw new Error("BROWSER_ARTIFACT_SIGNATURE_INVALID");
  }
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  if (!manifestReleaseTupleValid(manifest, mode)) {
    throw new Error("BROWSER_ARTIFACT_RELEASE_TUPLE_INVALID");
  }
  const paths = verifyArtifactPaths(root, manifest);
  await verifyArtifactHashes(manifest, paths);
  verifyPlatformSignatures(mode, paths);

  return Object.freeze({
    manifest,
    manifestPath,
    signaturePath,
    artifactSetSha256: await sha256(manifestPath),
    hostPath: paths.hostPath,
    browserctlPath: paths.browserctlPath,
    extensionPath: paths.extensionPath,
  });
};
