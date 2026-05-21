import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { lawModulesDir } from "../shared/paths.js";

const walkMarkdown = (root: string): string[] => {
  if (!existsSync(root)) {
    return [];
  }
  const rootStat = statSync(root);
  if (rootStat.isFile()) {
    return root.endsWith(".md") ? [root] : [];
  }
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const childPath = resolve(root, entry.name);
    return entry.isDirectory() ? walkMarkdown(childPath) : childPath.endsWith(".md") ? [childPath] : [];
  });
};

export const discoverLawFiles = (): string[] => walkMarkdown(lawModulesDir).sort();