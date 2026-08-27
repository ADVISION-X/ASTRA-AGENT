import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";

import { packageNameToPath } from "./dependency-package-utils.mjs";

async function pathExists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch (error) {
    return false;
  }
}

function appendReason(reasons, condition, message) {
  if (condition) {
    reasons.push(message);
  }
}

export async function collectMetadataReasons(paths) {
  const packageLockExists = await pathExists(paths.packageLockPath);
  const nodeModulesExists = await pathExists(paths.nodeModulesPath);
  const nodeModulesLockExists = await pathExists(paths.nodeModulesLockPath);
  const reasons = [];

  appendReason(reasons, !packageLockExists, "metadata_stale: package-lock.json is missing.");
  appendReason(reasons, !nodeModulesExists, "metadata_stale: node_modules directory is missing.");
  appendReason(reasons, nodeModulesExists && !nodeModulesLockExists, "metadata_stale: node_modules is missing npm install metadata.");

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
      missingPackages.push(`package_missing: ${packageName}`);
    }
  }

  return missingPackages;
}
