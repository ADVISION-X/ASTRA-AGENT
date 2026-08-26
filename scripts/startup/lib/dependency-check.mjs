import { readFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  compareVersions,
  findUnsafeDependencyRanges,
  getDefaultNpmCommand,
  packageNameToPath,
  parseMinimumVersion,
  readPackageMetadata,
} from "./dependency-package-utils.mjs";
import { collectMetadataReasons, findMissingPackages } from "./dependency-state-analysis.mjs";

const execFileAsync = promisify(execFile);
export { getDefaultNpmCommand } from "./dependency-package-utils.mjs";

const MANDATORY_NATIVE_DEPENDENCIES = ["better-sqlite3"];
const MISSING_PACKAGE_PREFIX = "package_missing: ";
const NATIVE_PROBE_TIMEOUT_MS = 20_000;

function debugDependencyCheck(message) {
  if (process.env.GRASSEYE_AUDIT_DEBUG === "1") {
    process.stdout.write(`[startup:dependency-check] ${message}\n`);
  }
}

function isPackageMissingReason(reason) {
  return reason.startsWith(MISSING_PACKAGE_PREFIX);
}

function extractMissingPackageName(reason) {
  return reason.slice(MISSING_PACKAGE_PREFIX.length);
}

function collectMissingPackageNames(missingPackages) {
  return new Set(
    missingPackages
      .filter(isPackageMissingReason)
      .map(extractMissingPackageName),
  );
}

function classifyNativeAddonFailure(errorText) {
  if (/MODULE_NOT_FOUND|Cannot find module/u.test(errorText)) {
    return "package_missing";
  }
  return "native_runtime_unloadable";
}

function toNativeFailureReason(packageName, failure) {
  const normalized = failure.trim().length > 0 ? failure.trim() : "unknown native load failure";
  return `${packageName}: ${normalized}`;
}

function buildNativeProbeScript(packageName) {
  return `
import { createRequire } from "node:module";

const require = createRequire(process.cwd() + "/");
const result = { ok: false, reason: "" };
try {
  const Database = require("${packageName}");
  const db = new Database(":memory:");
  const row = db.prepare("SELECT 1 AS one").get();
  if (!row || row.one !== 1) {
    throw new Error("native addon query failed");
  }
  db.close();
  result.ok = true;
  result.reason = "ok";
} catch (error) {
  if (error instanceof Error) {
    result.reason = [error.name, error.message].join(": ");
  } else {
    result.reason = String(error);
  }
}

process.stdout.write(JSON.stringify(result));
if (!result.ok) {
  process.exit(1);
}
`;
}

async function runNativeAddonProbe(packageName, { nodePath = process.execPath, cwd = process.cwd() } = {}) {
  const script = buildNativeProbeScript(packageName);
  const output = await execFileAsync(nodePath, ["--input-type=module", "-e", script], {
    cwd,
    timeout: NATIVE_PROBE_TIMEOUT_MS,
    encoding: "utf8",
  });
  const payloadText = `${output.stdout}`.trim().split(/\r?\n/).filter(Boolean).at(-1);
  if (!payloadText) {
    const probeError = `${output.stderr}`.trim();
    throw new Error(probeError.length > 0 ? probeError : "Native addon probe produced no output.");
  }
  let payload;
  try {
    payload = JSON.parse(payloadText);
  } catch {
    throw new Error(`Native addon probe output parse failed: ${payloadText}`);
  }
  if (!payload || typeof payload !== "object") {
    throw new Error(`Native addon probe returned invalid payload: ${payloadText}`);
  }
  if (payload.ok === true) {
    return;
  }
  const reason = `${payload.reason ?? output.stderr}`.trim();
  throw new Error(reason.length > 0 ? reason : "Native addon probe reported not-ok.");
}

function toFailureLine(failure) {
  return failure.trim().length > 0 ? failure.trim() : "unknown";
}

async function collectNativeDependencyFailures({ rootDir, paths, missingPackageNames }) {
  if (MANDATORY_NATIVE_DEPENDENCIES.length === 0) {
    return [];
  }

  const failures = [];
  for (const packageName of MANDATORY_NATIVE_DEPENDENCIES) {
    const packagePath = packageNameToPath(paths.nodeModulesPath, packageName);
    if (missingPackageNames.has(packageName)) {
      failures.push({
        packageName,
        kind: "package_missing",
        reason: `missing package directory: ${packagePath}`,
      });
      continue;
    }
    try {
      await runNativeAddonProbe(packageName, { cwd: rootDir });
    } catch (error) {
      const reason = error instanceof Error ? toFailureLine(error.message) : String(error);
      failures.push({
        packageName,
        kind: classifyNativeAddonFailure(reason),
        reason,
      });
    }
  }
  return failures;
}

async function collectDependencyReasons(packageMetadata, paths) {
  const { reasons: metadataReasons, nodeModulesExists } = await collectMetadataReasons(paths);
  const missingPackages = await findMissingPackages(packageMetadata, paths.nodeModulesPath, nodeModulesExists);
  const missingPackageNames = collectMissingPackageNames(missingPackages);
  const nativeDependencyFailures = await collectNativeDependencyFailures({ rootDir: path.dirname(paths.packageJsonPath), paths, missingPackageNames });
  const nativeFailureReasons = nativeDependencyFailures.map((failure) =>
    `${failure.kind}: ${toNativeFailureReason(failure.packageName, failure.reason)}`,
  );
  return {
    reasons: [...metadataReasons, ...missingPackages, ...nativeFailureReasons],
    nativeDependencyFailures,
  };
}

async function runNpmCommand(commandName, { rootDir, npmCommand, args }) {
  await new Promise((resolve, reject) => {
    const child = execFile(npmCommand, args, { cwd: rootDir }, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(undefined);
    });

    child.stdout?.pipe(process.stdout);
    child.stderr?.pipe(process.stderr);
  });
}

function buildDependencyAssessment({
  rootDir,
  npmCommand,
  resolvedNpmVersion,
  nodeVersion,
  paths,
  reasons,
  updateRequested,
  unsafeUpdateRanges,
  nativeDependencyFailures,
}) {
  return {
    rootDir,
    npmCommand,
    npmVersion: resolvedNpmVersion,
    nodeVersion,
    packageJsonPath: paths.packageJsonPath,
    packageLockPath: paths.packageLockPath,
    nodeModulesPath: paths.nodeModulesPath,
    requiresInstall: reasons.length > 0,
    reasons,
    nativeDependencyFailures,
    updateRequested,
    unsafeUpdateRanges,
    safeToUpdate: unsafeUpdateRanges.length === 0,
  };
}

export async function getNpmVersion(npmCommand = getDefaultNpmCommand(), cwd = process.cwd()) {
  const { stdout } = await execFileAsync(npmCommand, ["--version"], { cwd });
  return stdout.trim();
}

async function pathExists(filePath) {
  try {
    await readFile(filePath);
    return true;
  } catch (error) {
    debugDependencyCheck(`pathExists unavailable for ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

function ensureSupportedNodeVersion(packageMetadata) {
  const nodeVersion = process.versions.node;
  const nodeVersionParts = nodeVersion.split(".").map((value) => Number(value));
  const minimumNodeVersion = parseMinimumVersion(packageMetadata.engines?.node ?? "");

  if (minimumNodeVersion && compareVersions(nodeVersionParts, minimumNodeVersion) < 0) {
    throw new Error(
      `Node ${nodeVersion} does not satisfy package engines requirement ${packageMetadata.engines.node}.`,
    );
  }

  return nodeVersion;
}

function buildDependencyPaths(rootDir) {
  const packageJsonPath = path.join(rootDir, "package.json");
  const packageLockPath = path.join(rootDir, "package-lock.json");
  const nodeModulesPath = path.join(rootDir, "node_modules");
  return {
    packageJsonPath,
    packageLockPath,
    nodeModulesPath,
    nodeModulesLockPath: path.join(nodeModulesPath, ".package-lock.json"),
  };
}

export async function assessDependencyState({
  rootDir,
  npmCommand = getDefaultNpmCommand(),
  npmVersion,
  updateRequested = false,
}) {
  const paths = buildDependencyPaths(rootDir);

  if (!(await pathExists(paths.packageJsonPath))) {
    throw new Error(`Missing package.json at ${paths.packageJsonPath}`);
  }

  const packageMetadata = await readPackageMetadata(rootDir);
  const nodeVersion = ensureSupportedNodeVersion(packageMetadata);
  const resolvedNpmVersion = npmVersion ?? (await getNpmVersion(npmCommand, rootDir));
  const { reasons, nativeDependencyFailures } = await collectDependencyReasons(packageMetadata, paths);
  const unsafeUpdateRanges = updateRequested ? findUnsafeDependencyRanges(packageMetadata) : [];

  return buildDependencyAssessment({
    rootDir,
    npmCommand,
    resolvedNpmVersion,
    nodeVersion,
    paths,
    reasons,
    updateRequested,
    unsafeUpdateRanges,
    nativeDependencyFailures,
  });
}

export async function installDependencies({ rootDir, npmCommand = getDefaultNpmCommand(), updateRequested = false }) {
  const args = updateRequested ? ["update"] : ["install"];
  await runNpmCommand("install", { rootDir, npmCommand, args });
}
