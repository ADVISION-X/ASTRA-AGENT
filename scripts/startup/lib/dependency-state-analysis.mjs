import { access, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";

import { packageNameToPath } from "./dependency-package-utils.mjs";

async function pathExists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function appendReason(reasons, condition, message) {
  if (condition) {
    reasons.push(message);
  }
}

export async function collectMetadataReasons(paths) {
  const packageStat = await stat(paths.packageJsonPath);
  const packageLockExists = await pathExists(paths.packageLockPath);
  const nodeModulesExists = await pathExists(paths.nodeModulesPath);
  const nodeModulesLockExists = await pathExists(paths.nodeModulesLockPath);
  const lockStat = packageLockExists ? await stat(paths.packageLockPath) : undefined;
  const nodeModulesLockStat = nodeModulesLockExists ? await stat(paths.nodeModulesLockPath) : undefined;
  const reasons = [];

  appendReason(reasons, !packageLockExists, "package-lock.json is missing.");
  appendReason(reasons, !nodeModulesExists, "node_modules directory is missing.");
  appendReason(reasons, Boolean(lockStat) && packageStat.mtimeMs > lockStat.mtimeMs, "package.json is newer than package-lock.json.");
  appendReason(reasons, nodeModulesExists && !nodeModulesLockExists, "node_modules is missing npm install metadata.");
  appendReason(reasons, Boolean(nodeModulesLockStat) && packageStat.mtimeMs > nodeModulesLockStat.mtimeMs, "package.json is newer than node_modules install metadata.");
  appendReason(
    reasons,
    Boolean(lockStat) && Boolean(nodeModulesLockStat) && lockStat.mtimeMs > nodeModulesLockStat.mtimeMs,
    "package-lock.json is newer than node_modules install metadata.",
  );

  return { reasons, nodeModulesExists };
}

export async function findMissingPackages(packageMetadata, nodeModulesPath, nodeModulesExists) {
  if (!nodeModulesExists) {
    return [];
  }

  const requiredPackages = [
    ...Object.keys(packageMetadata.dependencies ?? {}),
    ...Object.keys(packageMetadata.devDependencies ?? {}),
  ];

  const missingPackages = [];
  for (const packageName of requiredPackages) {
    if (!(await pathExists(packageNameToPath(nodeModulesPath, packageName)))) {
      missingPackages.push(packageName);
    }
  }

  return missingPackages;
}