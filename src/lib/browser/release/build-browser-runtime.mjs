#!/usr/bin/env node
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign } from "node:crypto";
import { cp, chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../..");
const browserRoot = path.join(repoRoot, "src/lib/browser");
const nativeRoot = path.join(browserRoot, "native-messaging-host");
const extensionRoot = path.join(browserRoot, "chrome-extension");
const platformArch = `${process.platform}-${process.arch}`;
const artifactRoot = path.join(repoRoot, "artifacts", "browser-runtime", platformArch);
const binDir = path.join(artifactRoot, "bin");
const extensionDir = path.join(artifactRoot, "extension");

const RELEASE_IDENTITY = "grasseye-browser-runtime-2026-08-18-v2";
const RELEASE_SEQUENCE = 2;
const MINIMUM_ACCEPTED_RELEASE_SEQUENCE = 2;
const PROTOCOL_VERSION = "grasseye-browser-v2";
const EXTENSION_ID = "mepfnlhndaiihhfejbbhfehegpbdnipl";
const EXTENSION_VERSION = "2.0.0";
const runtimeMode = process.env.GRASSEYE_BROWSER_RUNTIME_MODE?.trim() || "production";
if (runtimeMode !== "production" && runtimeMode !== "test") {
  throw new Error(`BROWSER_RUNTIME_MODE_INVALID:${runtimeMode}`);
}

const run = (command, args, cwd) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed with status ${result.status ?? "signal"}`);
};

const sha256 = async (filePath) => {
  const bytes = await readFile(filePath);
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
};

const executableName = (name) => process.platform === "win32" ? `${name}.exe` : name;

const resolveTestCodesignIdentity = () => {
  const configured = process.env.GRASSEYE_BROWSER_TEST_CODESIGN_IDENTITY?.trim();
  if (configured) return configured;
  const result = spawnSync("security", ["find-identity", "-v", "-p", "codesigning"], { encoding: "utf8" });
  const match = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.match(/"(Apple Development:[^"]+)"/u);
  if (!match) throw new Error("BROWSER_TEST_APPLE_DEVELOPMENT_IDENTITY_REQUIRED");
  return match[1];
};

const signTestBinary = (filePath) => {
  run("codesign", ["--force", "--sign", resolveTestCodesignIdentity(), "--timestamp=none", filePath], repoRoot);
};

const writeTestArtifactSignature = async (manifestPath) => {
  const defaultKeyPath = path.join(homedir(), ".grasseye-local", "browser-runtime", "test-release-signing-key.pem");
  const privateKeyPath = path.resolve(process.env.GRASSEYE_BROWSER_TEST_RELEASE_PRIVATE_KEY_PATH?.trim() || defaultKeyPath);
  let privateKeyPem;
  try {
    privateKeyPem = await readFile(privateKeyPath, "utf8");
  } catch {
    const pair = generateKeyPairSync("ed25519");
    privateKeyPem = pair.privateKey.export({ type: "pkcs8", format: "pem" });
    await mkdir(path.dirname(privateKeyPath), { recursive: true });
    await writeFile(privateKeyPath, privateKeyPem, { mode: 0o600 });
    await chmod(privateKeyPath, 0o600);
  }
  const privateKey = createPrivateKey(privateKeyPem);
  const publicKeyPem = createPublicKey(privateKey).export({ type: "spki", format: "pem" });
  const manifestBytes = await readFile(manifestPath);
  await writeFile(path.join(artifactRoot, "browser-artifact-set.sig"), sign(null, manifestBytes, privateKey));
  await writeFile(path.join(artifactRoot, "browser-artifact-set.test-public-key.pem"), publicKeyPem, { mode: 0o644 });
};

await rm(artifactRoot, { recursive: true, force: true });
await mkdir(binDir, { recursive: true });
await mkdir(extensionDir, { recursive: true });

// Release build happens once in the controlled builder, never on the production machine.
run("cargo", ["build", "--release", "--workspace", "--manifest-path", path.join(nativeRoot, "Cargo.toml")], repoRoot);
run(process.execPath, [path.join(extensionRoot, "build.mjs")], repoRoot);

const cargoReleaseDir = path.join(nativeRoot, "target", "release");
const hostSource = path.join(cargoReleaseDir, executableName("grasseye-browser-host"));
const browserctlSource = path.join(cargoReleaseDir, executableName("grasseye-browserctl"));
const hostArtifact = path.join(binDir, executableName("grasseye-browser-host"));
const browserctlArtifact = path.join(binDir, executableName("grasseye-browserctl"));
await cp(hostSource, hostArtifact);
await cp(browserctlSource, browserctlArtifact);
await cp(path.join(extensionRoot, "dist"), extensionDir, { recursive: true });
if (runtimeMode === "test" && process.platform === "darwin") {
  signTestBinary(hostArtifact);
  signTestBinary(browserctlArtifact);
}

const extensionManifest = path.join(extensionDir, "manifest.json");
const artifactManifest = {
  schemaVersion: "grasseye-browser-artifact-set-v1",
  releaseIdentity: RELEASE_IDENTITY,
  releaseSequence: RELEASE_SEQUENCE,
  minimumAcceptedReleaseSequence: MINIMUM_ACCEPTED_RELEASE_SEQUENCE,
  protocolVersion: PROTOCOL_VERSION,
  extensionId: EXTENSION_ID,
  extensionVersion: EXTENSION_VERSION,
  artifactMode: runtimeMode,
  platformArch,
  sourceCommitSha: process.env.GITHUB_SHA ?? process.env.GRASSEYE_SOURCE_COMMIT_SHA ?? "UNBOUND",
  builderIdentity: process.env.GRASSEYE_BROWSER_BUILDER_IDENTITY ?? "UNBOUND",
  host: {
    path: path.relative(artifactRoot, hostArtifact),
    sha256: await sha256(hostArtifact),
  },
  browserctl: {
    path: path.relative(artifactRoot, browserctlArtifact),
    sha256: await sha256(browserctlArtifact),
  },
  extension: {
    path: path.relative(artifactRoot, extensionDir),
    manifestSha256: await sha256(extensionManifest),
  },
  productionReleaseRequirements: {
    sourceCommitBound: true,
    signedNativeBinaries: runtimeMode === "production",
    notarizedOnMacOS: runtimeMode === "production",
    fixedChromeWebStoreItem: true,
    verifiedCrxUploadWhenEnabled: true,
    sbom: true,
    provenance: true,
    sameArtifactProof: true,
  },
};

if (artifactManifest.sourceCommitSha === "UNBOUND" || artifactManifest.builderIdentity === "UNBOUND") {
  throw new Error("BROWSER_ARTIFACT_IDENTITY_UNBOUND: controlled production builder must bind source commit and builder identity");
}

const manifestPath = path.join(artifactRoot, "browser-artifact-set.json");
await writeFile(manifestPath, `${JSON.stringify(artifactManifest, null, 2)}\n`, { mode: 0o600 });
const manifestHash = await sha256(manifestPath);
await writeFile(
  path.join(artifactRoot, "browser-artifact-set.sha256"),
  `${manifestHash}  browser-artifact-set.json\n`,
  { mode: 0o600 },
);
if (runtimeMode === "test") await writeTestArtifactSignature(manifestPath);

process.stdout.write(`${JSON.stringify({
  status: "BUILT",
  artifactRoot,
  releaseIdentity: RELEASE_IDENTITY,
  releaseSequence: RELEASE_SEQUENCE,
  artifactManifestHash: manifestHash,
})}\n`);
