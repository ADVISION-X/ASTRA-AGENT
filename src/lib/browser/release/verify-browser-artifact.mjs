import { createHash, verify } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const RELEASE_IDENTITY = "grasseye-browser-runtime-2026-08-18-v2";
const RELEASE_SEQUENCE = 2;
const MINIMUM_ACCEPTED_RELEASE_SEQUENCE = 2;
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

export const verifyBrowserArtifactSet = async (artifactRoot) => {
  const root = path.resolve(artifactRoot);
  const manifestPath = path.join(root, "browser-artifact-set.json");
  const signaturePath = path.join(root, "browser-artifact-set.sig");
  const publicKeyPem = process.env.GRASSEYE_BROWSER_RELEASE_PUBLIC_KEY_PEM?.trim();
  if (!publicKeyPem) throw new Error("BROWSER_RELEASE_PUBLIC_KEY_REQUIRED");
  if (!existsSync(manifestPath) || !existsSync(signaturePath)) {
    throw new Error("BROWSER_ARTIFACT_SIGNATURE_FILES_REQUIRED");
  }
  const manifestBytes = await readFile(manifestPath);
  const signatureBytes = await readFile(signaturePath);
  if (!verify(null, manifestBytes, publicKeyPem, signatureBytes)) {
    throw new Error("BROWSER_ARTIFACT_SIGNATURE_INVALID");
  }
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  const platformArch = `${process.platform}-${process.arch}`;
  if (
    manifest.schemaVersion !== "grasseye-browser-artifact-set-v1"
    || manifest.releaseIdentity !== RELEASE_IDENTITY
    || manifest.releaseSequence !== RELEASE_SEQUENCE
    || manifest.releaseSequence < MINIMUM_ACCEPTED_RELEASE_SEQUENCE
    || manifest.minimumAcceptedReleaseSequence !== MINIMUM_ACCEPTED_RELEASE_SEQUENCE
    || manifest.protocolVersion !== PROTOCOL_VERSION
    || manifest.extensionId !== EXTENSION_ID
    || manifest.platformArch !== platformArch
    || typeof manifest.sourceCommitSha !== "string"
    || manifest.sourceCommitSha === "UNBOUND"
    || typeof manifest.builderIdentity !== "string"
    || manifest.builderIdentity === "UNBOUND"
  ) {
    throw new Error("BROWSER_ARTIFACT_RELEASE_TUPLE_INVALID");
  }

  const hostPath = path.resolve(root, manifest.host.path);
  const browserctlPath = path.resolve(root, manifest.browserctl.path);
  const extensionManifestPath = path.resolve(root, manifest.extension.path, "manifest.json");
  for (const candidate of [hostPath, browserctlPath, extensionManifestPath]) {
    if (!candidate.startsWith(`${root}${path.sep}`) || !existsSync(candidate)) {
      throw new Error(`BROWSER_ARTIFACT_PATH_INVALID:${candidate}`);
    }
  }
  if (await sha256(hostPath) !== manifest.host.sha256) throw new Error("BROWSER_HOST_ARTIFACT_HASH_MISMATCH");
  if (await sha256(browserctlPath) !== manifest.browserctl.sha256) throw new Error("BROWSERCTL_ARTIFACT_HASH_MISMATCH");
  if (await sha256(extensionManifestPath) !== manifest.extension.manifestSha256) throw new Error("BROWSER_EXTENSION_ARTIFACT_HASH_MISMATCH");

  if (process.platform === "darwin") {
    runRequired("/usr/bin/codesign", ["--verify", "--deep", "--strict", "--verbose=2", hostPath]);
    runRequired("/usr/bin/codesign", ["--verify", "--deep", "--strict", "--verbose=2", browserctlPath]);
    runRequired("/usr/sbin/spctl", ["--assess", "--type", "execute", "--verbose=2", hostPath]);
    runRequired("/usr/sbin/spctl", ["--assess", "--type", "execute", "--verbose=2", browserctlPath]);
  }

  return Object.freeze({
    manifest,
    manifestPath,
    signaturePath,
    hostPath,
    browserctlPath,
    extensionPath: path.resolve(root, manifest.extension.path),
  });
};
