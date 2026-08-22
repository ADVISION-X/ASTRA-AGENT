import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const extensionDirectory = resolve(process.cwd(), ".grasseye-local", "browser-build", "extension");
const releaseRecordPath = resolve(process.cwd(), ".grasseye-local", "browser-release", "release-record.json");
const manifestPath = resolve(extensionDirectory, "manifest.json");
const protocolPath = resolve(process.cwd(), "src/lib/browser/protocol/browser-protocol.schema.json");
const sitePolicyPath = resolve(process.cwd(), "src/lib/browser/exact-target/browser-site-policy-registry.ts");
const extensionId = "emkmbecadncngofidjgocmifhbonifgm";
const hashPattern = /^sha256:[a-f0-9]{64}$/u;
const requiredIdentityFields = Object.freeze([
  "extensionDirectoryHashV1",
  "manifestHash",
  "protocolHash",
  "sitePolicyHash",
]);
const requiredPermissions = Object.freeze(["activeTab", "debugger"]);
const requiredHostPermissions = Object.freeze(["http://127.0.0.1/*"]);

const sha256 = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
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
  && Array.isArray(manifest.permissions)
  && manifest.permissions.length === requiredPermissions.length
  && requiredPermissions.every((permission) => manifest.permissions.includes(permission))
  && Array.isArray(manifest.host_permissions)
  && manifest.host_permissions.length === requiredHostPermissions.length
  && requiredHostPermissions.every((host) => manifest.host_permissions.includes(host))
  && sha256(manifestSource) === record.manifestHash;

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
    const [recordSource, manifestSource, protocolSource, sitePolicySource] = await Promise.all([
      readFile(releaseRecordPath, "utf8"),
      readFile(manifestPath),
      readFile(protocolPath),
      readFile(sitePolicyPath),
    ]);
    const record = JSON.parse(recordSource);
    if (!isReleaseRecord(record)) return repairRequired("BROWSER_UNPACKED_RELEASE_IDENTITY_INVALID");
    const manifest = JSON.parse(manifestSource.toString("utf8"));
    const extensionDirectoryHashV1 = await hashExtensionDirectoryV1(extensionDirectory);
    if (!isExactManifest(manifest, record, manifestSource)
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
