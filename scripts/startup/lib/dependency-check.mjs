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

function debugDependencyCheck(message) {
  if (process.env.GRASSEYE_AUDIT_DEBUG === "1") {
    process.stdout.write(`[startup:dependency-check] ${message}\n`);
  }
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

async function collectDependencyReasons(packageMetadata, paths) {
  const { reasons, nodeModulesExists } = await collectMetadataReasons(paths);
  const missingPackages = await findMissingPackages(packageMetadata, paths.nodeModulesPath, nodeModulesExists);

  if (missingPackages.length > 0) {
    reasons.push(`node_modules is missing package entries: ${missingPackages.join(", ")}.`);
  }

  return reasons;
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
    updateRequested,
    unsafeUpdateRanges,
    safeToUpdate: unsafeUpdateRanges.length === 0,
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
  const reasons = await collectDependencyReasons(packageMetadata, paths);
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
  });
}

export async function installDependencies({ rootDir, npmCommand = getDefaultNpmCommand(), updateRequested = false }) {
  const args = updateRequested ? ["update"] : ["install"];

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
