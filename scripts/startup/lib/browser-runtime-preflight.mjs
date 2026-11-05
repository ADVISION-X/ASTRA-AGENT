import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { ASTRA_DATA_DIRECTORY, ASTRA_BROWSER_EXTENSION_ID } from "../../../src/lib/browser/profile/browser-application-identity.ts";

const extensionDirectory = resolve(process.cwd(), ASTRA_DATA_DIRECTORY, "browser-build", "extension");
const releaseRecordPath = resolve(process.cwd(), ASTRA_DATA_DIRECTORY, "browser-release", "release-record.json");
const manifestPath = resolve(extensionDirectory, "manifest.json");
const buildManifestPath = resolve(extensionDirectory, "extension-build-manifest.json");
const sourceManifestPath = resolve(process.cwd(), "src/lib/browser/chrome-extension/manifest.json");
const sourcePairingPagePath = resolve(process.cwd(), "src/lib/browser/chrome-extension/pairing.html");
const protocolPath = resolve(process.cwd(), "src/lib/browser/protocol/browser-protocol.schema.json");
const sitePolicyPath = resolve(process.cwd(), "src/lib/browser/exact-target/browser-site-policy-registry.ts");
const extensionId = ASTRA_BROWSER_EXTENSION_ID;
const hashPattern = /^sha256:[a-f0-9]{64}$/u;
const requiredIdentityFields = Object.freeze([
  "extensionDirectoryHashV1",
  "manifestHash",
  "protocolHash",
  "sitePolicyHash",
]);
const requiredPermissions = Object.freeze(["alarms", "debugger"]);
const requiredHostPermissions = Object.freeze(["http://127.0.0.1/*"]);

const sha256 = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const extensionIdFromKey = (key) => [...createHash("sha256").update(Buffer.from(key, "base64")).digest("hex").slice(0, 32)]
  .map(value => String.fromCharCode(97 + Number.parseInt(value, 16))).join("");
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

const isReleaseRecord = (value) => isRecord(value)
  && value.schemaVersion === "grasseye.browser.unpacked-release.v1"
  && typeof value.releaseBuildId === "string" && /^[a-z0-9][a-z0-9._-]{7,127}$/u.test(value.releaseBuildId)
  && value.extensionId === extensionId
  && typeof value.version === "string" && /^\d+\.\d+\.\d+$/u.test(value.version)
  && requiredIdentityFields.every((field) =>
    typeof value[field] === "string" && hashPattern.test(value[field]));

const hashExtensionDirectoryV1 = async (root, current = root) => {
  const entries = await readdir(current, { withFileTypes: true });
  const nested = await Promise.all(entries
    .filter((entry) => entry.name !== ".DS_Store" && entry.name !== "extension-build-manifest.json")
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(async (entry) => {
      const path = join(current, entry.name);
      if (entry.isDirectory()) return hashExtensionDirectoryV1(root, path);
      if (!entry.isFile()) throw new Error("BROWSER_UNPACKED_ARTIFACT_INVALID");
      return [{ path: relative(root, path), sha256: sha256(await readFile(path)) }];
    }));
  return sha256(JSON.stringify(nested.flat()));
};

const isExactManifest = (manifest, record, manifestSource) =>
  isRecord(manifest)
  && manifest.manifest_version === 3
  && manifest.version === record.version
  && typeof manifest.key === "string"
  && extensionIdFromKey(manifest.key) === extensionId
  && Array.isArray(manifest.permissions)
  && manifest.permissions.length === requiredPermissions.length
  && requiredPermissions.every((permission) => manifest.permissions.includes(permission))
  && Array.isArray(manifest.host_permissions)
  && manifest.host_permissions.length === requiredHostPermissions.length
  && requiredHostPermissions.every((host) => manifest.host_permissions.includes(host))
  && sha256(manifestSource) === record.manifestHash;

const hasCurrentBuildInputs = async (receipt) => {
  if (!isRecord(receipt)
    || receipt.schemaVersion !== "grasseye.browser.extension-build.v1"
    || !Array.isArray(receipt.inputs)
    || receipt.inputs.length === 0) return false;
  const root = resolve(process.cwd());
  return (await Promise.all(receipt.inputs.map(async (entry) => {
    if (!isRecord(entry) || typeof entry.path !== "string" || !hashPattern.test(entry.sha256)) return false;
    const inputPath = resolve(root, entry.path);
    if (inputPath !== root && !inputPath.startsWith(`${root}/`)) return false;
    try { return sha256(await readFile(inputPath)) === entry.sha256; } catch { return false; }
  }))).every(Boolean);
};

const repairRequired = (failureReason) => Object.freeze({
  status: "READY",
  authorityState: "BROWSER_AUTHORITY_ABSENT",
  releaseState: "REPAIR_REQUIRED",
  failureReason,
  actionableMessage: "Reload the fixed unpacked extension only after rebuilding and reconciling the release record; Browser work remains unavailable until the authenticated WebSocket actor later proves the Chrome/profile readback.",
});

export async function runBrowserRuntimePreflight() {
  try {
    await access(extensionDirectory);
    const [recordSource, manifestSource, buildManifestSource, sourceManifest, pairingPage, sourcePairingPage, protocolSource, sitePolicySource] = await Promise.all([
      readFile(releaseRecordPath, "utf8"),
      readFile(manifestPath),
      readFile(buildManifestPath, "utf8"),
      readFile(sourceManifestPath),
      readFile(resolve(extensionDirectory, "pairing.html")),
      readFile(sourcePairingPagePath),
      readFile(protocolPath),
      readFile(sitePolicyPath),
    ]);
    const record = JSON.parse(recordSource);
    if (!isReleaseRecord(record)) return repairRequired("BROWSER_UNPACKED_RELEASE_IDENTITY_INVALID");
    const manifest = JSON.parse(manifestSource.toString("utf8"));
    const buildManifest = JSON.parse(buildManifestSource);
    const extensionDirectoryHashV1 = await hashExtensionDirectoryV1(extensionDirectory);
    if (!isExactManifest(manifest, record, manifestSource)
      || !(await hasCurrentBuildInputs(buildManifest))
      || !manifestSource.equals(sourceManifest)
      || !pairingPage.equals(sourcePairingPage)
      || extensionDirectoryHashV1 !== record.extensionDirectoryHashV1
      || sha256(protocolSource) !== record.protocolHash
      || sha256(sitePolicySource) !== record.sitePolicyHash) {
      return repairRequired("BROWSER_UNPACKED_ARTIFACT_READBACK_MISMATCH");
    }
    return Object.freeze({
      status: "READY",
      authorityState: "BROWSER_AUTHORITY_ABSENT",
      releaseState: "UNPACKED_WEBSOCKET_AUTHORITY",
      releaseBuildId: record.releaseBuildId,
      extensionDirectoryHashV1,
      failureReason: "BROWSER_CHROME_PROFILE_READBACK_NOT_PRODUCTION_VERIFIED",
      actionableMessage: "The fixed unpacked artifact is readable. Browser Authority remains ABSENT until the operator-loaded extension completes authenticated Chrome/profile readback over its single WebSocket authority chain.",
    });
  } catch {
    return repairRequired("BROWSER_UNPACKED_ARTIFACT_READBACK_UNAVAILABLE");
  }
}
