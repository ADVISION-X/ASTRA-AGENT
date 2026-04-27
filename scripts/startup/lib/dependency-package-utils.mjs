import { readFile } from "node:fs/promises";
import path from "node:path";

const CONTROLLED_RANGE_PATTERN = /^(?:\^|~)?\d+\.\d+\.\d+(?:[-+A-Za-z0-9.]+)?$/;

export function getDefaultNpmCommand(platform = process.platform) {
  return platform === "win32" ? "npm.cmd" : "npm";
}

export function parseMinimumVersion(range) {
  const match = range.match(/(\d+)\.(\d+)\.(\d+)|(\d+)/);
  if (!match) {
    return null;
  }

  if (match[4]) {
    return [Number(match[4]), 0, 0];
  }

  return [Number(match[1] ?? 0), Number(match[2] ?? 0), Number(match[3] ?? 0)];
}

export function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    const leftPart = left[index] ?? 0;
    const rightPart = right[index] ?? 0;
    if (leftPart > rightPart) {
      return 1;
    }
    if (leftPart < rightPart) {
      return -1;
    }
  }

  return 0;
}

export function findUnsafeDependencyRanges(packageMetadata) {
  const entries = [
    ...Object.entries(packageMetadata.dependencies ?? {}),
    ...Object.entries(packageMetadata.devDependencies ?? {}),
  ];

  return entries
    .filter(([, range]) => !CONTROLLED_RANGE_PATTERN.test(range))
    .map(([name, range]) => `${name}@${range}`);
}

export function packageNameToPath(nodeModulesPath, packageName) {
  if (!packageName.startsWith("@")) {
    return path.join(nodeModulesPath, packageName);
  }

  const [scope, scopedName] = packageName.split("/");
  return path.join(nodeModulesPath, scope ?? packageName, scopedName ?? "");
}

export async function readPackageMetadata(rootDir) {
  const packageJsonPath = path.join(rootDir, "package.json");
  const content = await readFile(packageJsonPath, "utf8");
  return JSON.parse(content);
}