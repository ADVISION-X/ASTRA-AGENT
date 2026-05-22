import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { repoRoot, type RuntimeSourceFile, readRepoFile, toRepoPath } from "./source-read.js";

const walk = (absoluteRoot: string): string[] => {
  if (!existsSync(absoluteRoot)) return [];
  const stat = statSync(absoluteRoot);
  if (stat.isFile()) return [absoluteRoot];
  return readdirSync(absoluteRoot, { withFileTypes: true }).flatMap((entry) => {
    const child = resolve(absoluteRoot, entry.name);
    return entry.isDirectory() ? walk(child) : [child];
  });
};

export const listRuntimeSourceFiles = (input: {
  roots: readonly string[];
  extensions?: readonly string[];
  exclude?: (repoPath: string) => boolean;
}): RuntimeSourceFile[] => {
  const extensions = input.extensions ?? [".ts", ".tsx"];
  return input.roots
    .flatMap((root) => walk(resolve(repoRoot, root)))
    .map(toRepoPath)
    .filter((repoPath) => extensions.some((extension) => repoPath.endsWith(extension)))
    .filter((repoPath) => !(input.exclude?.(repoPath) ?? false))
    .sort()
    .map(readRepoFile)
    .filter((file): file is RuntimeSourceFile => file !== null);
};
