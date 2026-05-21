import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

import type { AuditConflict } from "../shared/generated-contracts.js";
import { auditManifestSchema, type ManifestSource } from "../shared/manifest-contracts.js";
import { auditRoot, toRepoPath } from "../shared/paths.js";

const walkManifestFiles = (root: string): string[] => {
  if (!existsSync(root)) {
    return [];
  }
  const rootStat = statSync(root);
  if (rootStat.isFile()) {
    return root.endsWith("manifest.json") ? [root] : [];
  }
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const childPath = resolve(root, entry.name);
    return entry.isDirectory()
      ? walkManifestFiles(childPath)
      : childPath.endsWith("manifest.json")
        ? [childPath]
        : [];
  });
};

export const loadManifests = (): { manifests: ManifestSource[]; conflicts: AuditConflict[] } => {
  const manifests: ManifestSource[] = [];
  const conflicts: AuditConflict[] = [];
  for (const absolutePath of walkManifestFiles(resolve(auditRoot, "domains")).sort()) {
    const manifestPath = toRepoPath(absolutePath);
    try {
      const parsedJson = JSON.parse(readFileSync(absolutePath, "utf8"));
      const parsedManifest = auditManifestSchema.safeParse(parsedJson);
      if (!parsedManifest.success) {
        conflicts.push({
          kind: "manifest-parse-error",
          filePath: manifestPath,
          message: parsedManifest.error.message,
        });
        continue;
      }
      manifests.push({
        ...parsedManifest.data,
        manifestPath,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown manifest parse error.";
      conflicts.push({
        kind: "manifest-parse-error",
        filePath: manifestPath,
        message,
      });
    }
  }
  return { manifests, conflicts };
};