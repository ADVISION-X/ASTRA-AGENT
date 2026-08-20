import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const workspaceRoot = resolve(process.cwd());
const sourceRoot = resolve(workspaceRoot, "src/lib/browser/chrome-extension");
const buildRoot = resolve(workspaceRoot, ".grasseye-local/browser-build");
const esbuildBinary = resolve(workspaceRoot, "node_modules/esbuild/bin/esbuild");

const sha256 = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const canonical = (value) => JSON.stringify(value);

const resolveOutputDirectory = (argv) => {
  const outFlag = argv.indexOf("--out");
  const output = outFlag === -1
    ? resolve(buildRoot, "extension")
    : resolve(workspaceRoot, argv[outFlag + 1] ?? "");
  assert.notEqual(output, buildRoot, "Browser extension build output must be a dedicated child directory.");
  assert.ok(output.startsWith(`${buildRoot}${sep}`), "Browser extension build output must remain below .grasseye-local/browser-build.");
  return output;
};

const readJson = async (filePath) => JSON.parse(await readFile(filePath, "utf8"));

const sourceManifest = async () => {
  const manifestPath = resolve(sourceRoot, "manifest.json");
  const manifest = await readJson(manifestPath);
  assert.equal(manifest.manifest_version, 3, "Browser extension must remain MV3.");
  assert.equal(manifest.background?.service_worker, "service-worker.js", "Browser extension must expose only service-worker.js.");
  return manifestPath;
};

const runEsbuild = async (outputDirectory, metafilePath) => {
  const args = [
    resolve(sourceRoot, "service-worker.ts"),
    "--bundle",
    "--format=esm",
    "--platform=browser",
    "--target=chrome120",
    `--outfile=${resolve(outputDirectory, "service-worker.js")}`,
    `--metafile=${metafilePath}`,
    "--log-level=warning",
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

export const buildChromeExtension = async (argv = process.argv.slice(2)) => {
  const outputDirectory = resolveOutputDirectory(argv);
  const manifestPath = await sourceManifest();
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
  const metafilePath = resolve(outputDirectory, "esbuild-metafile.json");
  const esbuildVersion = await runEsbuild(outputDirectory, metafilePath);
  const metafile = await readJson(metafilePath);
  await rm(metafilePath, { force: true });
  await copyFile(manifestPath, resolve(outputDirectory, "manifest.json"));
  const inputs = await inputEntries(metafile);
  const files = await outputEntries(outputDirectory);
  const extensionTreeHash = sha256(canonical(files));
  const buildManifest = {
    schemaVersion: "grasseye.browser.extension-build.v1",
    esbuildVersion,
    inputs,
    files,
    extensionTreeHash,
  };
  await writeFile(resolve(outputDirectory, "extension-build-manifest.json"), `${JSON.stringify(buildManifest, null, 2)}\n`, { mode: 0o600 });
  return Object.freeze({ outputDirectory, ...buildManifest });
};

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const result = await buildChromeExtension();
  process.stdout.write(`${JSON.stringify({ status: "BUILT", outputDirectory: result.outputDirectory, extensionTreeHash: result.extensionTreeHash })}\n`);
}
