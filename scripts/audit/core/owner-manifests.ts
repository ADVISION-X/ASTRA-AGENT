import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { domainsHome } from "./path-roots.js";
import { pathFromRepoRoot, toRepoRelativePath } from "./paths.js";
import type { OwnerManifest } from "./schema.js";

const walkManifestPaths = (dirPath: string, acc: string[] = []): string[] => {
  if (!existsSync(dirPath)) return acc;
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const nextPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkManifestPaths(nextPath, acc);
      continue;
    }
    if (entry.isFile() && entry.name === "manifest.json") {
      acc.push(nextPath);
    }
  }
  return acc;
};

export const listOwnerManifestPaths = (): string[] =>
  walkManifestPaths(domainsHome).sort((left, right) => left.localeCompare(right));

export const loadOwnerManifest = (manifestPath: string): OwnerManifest =>
  JSON.parse(readFileSync(manifestPath, "utf8")) as OwnerManifest;

export const loadOwnerManifests = (): OwnerManifest[] =>
  listOwnerManifestPaths().map((manifestPath) => loadOwnerManifest(manifestPath));

export const buildOwnerRunnerCommand = (
  manifest: OwnerManifest,
): readonly [string, ...string[]] => [
  "node",
  "--import",
  "tsx",
  manifest.runner,
  ...(manifest.runnerArgs ?? []),
];

export const sortOwnerManifests = (manifests: OwnerManifest[]): OwnerManifest[] =>
  [...manifests].sort((left, right) => {
    const leftPriority = left.runnerPriority ?? 100;
    const rightPriority = right.runnerPriority ?? 100;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    return left.capabilityDomain.localeCompare(right.capabilityDomain);
  });

export const manifestPathForDomain = (capabilityDomain: string): string =>
  pathFromRepoRoot(`scripts/audit/domains/${capabilityDomain}/manifest.json`);

export const toManifestRelativePath = (manifestPath: string): string =>
  toRepoRelativePath(manifestPath);