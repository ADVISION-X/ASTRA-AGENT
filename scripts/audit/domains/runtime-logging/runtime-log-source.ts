import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import type { Project, SourceFile } from "ts-morph";

import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";

export const relPath = (sourceFile: SourceFile): string =>
  toRepoRelativePath(sourceFile.getFilePath());

export const countFilesInDir = (relativeDirectory: string): number => {
  const directory = join(pathFromRepoRoot("."), relativeDirectory);
  if (!existsSync(directory)) return 0;
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(ts|js|mjs|json)$/.test(entry.name))
    .length;
};

export const getSfOrNull = (project: Project, relativePath: string): SourceFile | undefined =>
  project.getSourceFile(pathFromRepoRoot(relativePath))
  ?? project.addSourceFileAtPathIfExists(pathFromRepoRoot(relativePath))
  ?? undefined;

export const isSourceInDirs = (sourceFile: SourceFile, dirs: readonly string[]): boolean => {
  const path = relPath(sourceFile);
  return dirs.some((dir) => path === dir || path.startsWith(`${dir}/`));
};
