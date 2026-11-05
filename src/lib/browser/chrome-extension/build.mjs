import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { ASTRA_DATA_DIRECTORY, ASTRA_BROWSER_EXTENSION_ID } from "../profile/browser-application-identity.ts";

const execFile = promisify(execFileCallback);
const workspaceRoot = resolve(process.cwd());
const sourceRoot = resolve(workspaceRoot, "src/lib/browser/chrome-extension");
const buildRoot = resolve(workspaceRoot, ASTRA_DATA_DIRECTORY, "browser-build");
const fixedOutputDirectory = resolve(buildRoot, "extension");
const releaseRecordPath = resolve(workspaceRoot, ASTRA_DATA_DIRECTORY, "browser-release/release-record.json");
const esbuildBinary = resolve(workspaceRoot, "node_modules/esbuild/bin/esbuild");

const sha256 = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const canonical = (value) => JSON.stringify(value);

const resolveOutputDirectory = () => fixedOutputDirectory;

const readJson = async (filePath) => JSON.parse(await readFile(filePath, "utf8"));

const sourceManifest = async () => {
  const manifestPath = resolve(sourceRoot, "manifest.json");
  const manifest = await readJson(manifestPath);
  assert.equal(manifest.manifest_version, 3, "Browser extension must remain MV3.");
  assert.equal(manifest.background?.service_worker, "service-worker.js", "Browser extension must expose only service-worker.js.");
  const publicKeyHash = createHash("sha256").update(Buffer.from(manifest.key, "base64")).digest("hex").slice(0, 32);
  const derivedId = [...publicKeyHash].map(value => String.fromCharCode(97 + Number.parseInt(value, 16))).join("");
  assert.equal(derivedId, ASTRA_BROWSER_EXTENSION_ID, "ASTRA manifest key must derive the fixed application extension ID.");
  return manifestPath;
};

const runEsbuild = async (inputPath, outputPath, metafilePath, defines = {}) => {
  const args = [
    inputPath,
    "--bundle",
    "--format=esm",
    "--platform=browser",
    "--target=chrome120",
    `--outfile=${outputPath}`,
    `--metafile=${metafilePath}`,
    "--log-level=warning",
    ...Object.entries(defines).map(([name, value]) => `--define:${name}=${JSON.stringify(value)}`),
  ];
  await execFile(esbuildBinary, args, { cwd: workspaceRoot });
  const { stdout } = await execFile(esbuildBinary, ["--version"], { cwd: workspaceRoot });
  return stdout.trim();
};

const inputEntries = async (metafile) => Promise.all(
  Object.keys(metafile.inputs)
    .map((input) => resolve(workspaceRoot, input))
    .sort((left, right) => left.localeCompare(right))
    .map(async (filePath) => ({
      path: relative(workspaceRoot, filePath),
      sha256: sha256(await readFile(filePath)),
    })),
);

const outputEntries = async (outputDirectory) => Promise.all(
  (await readdir(outputDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))
    .map(async (name) => ({ path: name, sha256: sha256(await readFile(resolve(outputDirectory, name))) })),
);

const prepareOutputDirectory = async (outputDirectory) => {
  const manifestPath = await sourceManifest();
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
  await copyFile(manifestPath, resolve(outputDirectory, "manifest.json"));
  await copyFile(resolve(sourceRoot, "pairing.html"), resolve(outputDirectory, "pairing.html"));
};

const bundleExtensionSources = async (outputDirectory, releaseBuildId) => {
  const serviceMetafilePath = resolve(outputDirectory, "service-worker-metafile.json");
  const popupMetafilePath = resolve(outputDirectory, "pairing-popup-metafile.json");
  const esbuildVersion = await runEsbuild(
    resolve(sourceRoot, "service-worker.ts"),
    resolve(outputDirectory, "service-worker.js"),
    serviceMetafilePath,
    { __GRASSEYE_RELEASE_BUILD_ID__: releaseBuildId },
  );
  const popupEsbuildVersion = await runEsbuild(
    resolve(sourceRoot, "pairing-popup.ts"),
    resolve(outputDirectory, "pairing-popup.js"),
    popupMetafilePath,
  );
  assert.equal(popupEsbuildVersion, esbuildVersion, "Extension build must use one esbuild version.");
  const [serviceMetafile, popupMetafile] = await Promise.all([
    readJson(serviceMetafilePath),
    readJson(popupMetafilePath),
  ]);
  await Promise.all([rm(serviceMetafilePath, { force: true }), rm(popupMetafilePath, { force: true })]);
  return { esbuildVersion, metafile: { inputs: { ...serviceMetafile.inputs, ...popupMetafile.inputs } } };
};

const writeExtensionBuildManifest = async (outputDirectory, esbuildVersion, metafile) => {
  const [inputs, files] = await Promise.all([inputEntries(metafile), outputEntries(outputDirectory)]);
  const extensionTreeHash = sha256(canonical(files));
  const buildManifest = { schemaVersion: "grasseye.browser.extension-build.v1", esbuildVersion, inputs, files, extensionTreeHash };
  await writeFile(resolve(outputDirectory, "extension-build-manifest.json"), `${JSON.stringify(buildManifest, null, 2)}\n`, { mode: 0o600 });
  return buildManifest;
};

const writeExtensionReleaseRecord = async (outputDirectory, extensionTreeHash, releaseBuildId) => {
  const manifestSource = await readFile(resolve(outputDirectory, "manifest.json"));
  const releaseRecord = {
    schemaVersion: "grasseye.browser.unpacked-release.v1",
    releaseBuildId,
    extensionId: ASTRA_BROWSER_EXTENSION_ID,
    version: JSON.parse(manifestSource.toString("utf8")).version,
    extensionDirectoryHashV1: extensionTreeHash,
    manifestHash: sha256(manifestSource),
    protocolHash: sha256(await readFile(resolve(workspaceRoot, "src/lib/browser/protocol/browser-protocol.schema.json"))),
    sitePolicyHash: sha256(await readFile(resolve(workspaceRoot, "src/lib/browser/exact-target/browser-site-policy-registry.ts"))),
    createdAt: new Date().toISOString(),
  };
  await mkdir(dirname(releaseRecordPath), { recursive: true, mode: 0o700 });
  await writeFile(releaseRecordPath, `${JSON.stringify(releaseRecord, null, 2)}\n`, { mode: 0o600 });
  return releaseRecord;
};

export const buildChromeExtension = async (argv = process.argv.slice(2)) => {
  const outputDirectory = resolveOutputDirectory(argv);
  const releaseBuildId = `build-${randomUUID()}`;
  await prepareOutputDirectory(outputDirectory);
  const { esbuildVersion, metafile } = await bundleExtensionSources(outputDirectory, releaseBuildId);
  const buildManifest = await writeExtensionBuildManifest(outputDirectory, esbuildVersion, metafile);
  const releaseRecord = await writeExtensionReleaseRecord(outputDirectory, buildManifest.extensionTreeHash, releaseBuildId);
  return Object.freeze({ outputDirectory, ...buildManifest, releaseRecordPath, releaseBuildId: releaseRecord.releaseBuildId });
};

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const result = await buildChromeExtension();
  process.stdout.write(`${JSON.stringify({ status: "BUILT", outputDirectory: result.outputDirectory, extensionTreeHash: result.extensionTreeHash })}\n`);
}
