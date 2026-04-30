import path from "node:path";

import { fileExists, listImmediateDirectories, readJsonFile } from "./filesystem.js";
import { domainsHome } from "./path-roots.js";
import { toRepoRelativePath } from "./paths.js";
import type { ResolvedDomainManifest } from "./schema-manifests.js";

export const loadDomainManifests = async (): Promise<ResolvedDomainManifest[]> => {
  const domainDirs = (await listImmediateDirectories(domainsHome)).sort();
  const manifests: ResolvedDomainManifest[] = [];

  for (const domainDir of domainDirs) {
    const domainFolder = path.basename(domainDir);
    if (domainFolder.startsWith("_")) {
      continue;
    }

    const manifestPath = path.join(domainDir, "manifest.json");
    if (!(await fileExists(manifestPath))) {
      continue;
    }

    const manifest = await readJsonFile<Omit<ResolvedDomainManifest, "manifestPath" | "domainFolder">>(manifestPath);
    manifests.push({
      ...manifest,
      manifestPath: toRepoRelativePath(manifestPath),
      domainFolder,
    });
  }

  return manifests;
};