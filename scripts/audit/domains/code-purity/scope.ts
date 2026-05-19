import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import type { SourceFile } from "ts-morph";

import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { ALLOWED_ARCHIVE_PATH_PATTERNS } from "./forbidden-surfaces.js";
import type { ActiveCodeFile } from "./types.js";

const CODE_FILE_PATTERN = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const ACTIVE_ROOTS = ["src", "scripts"];

const isArchivePath = (relativePath: string): boolean =>
  ALLOWED_ARCHIVE_PATH_PATTERNS.some((pattern) => relativePath.includes(pattern));

const shouldSkipPath = (relativePath: string): boolean =>
  relativePath.endsWith(".d.ts")
  || isArchivePath(relativePath)
  || relativePath.includes("/generated/")
  || relativePath.includes("/node_modules/");

const walkCodeFiles = (absolutePath: string, acc: string[] = []): string[] => {
  if (!existsSync(absolutePath)) return acc;
  for (const entry of readdirSync(absolutePath, { withFileTypes: true })) {
    const nextPath = join(absolutePath, entry.name);
    if (entry.isDirectory()) {
      walkCodeFiles(nextPath, acc);
      continue;
    }
    if (entry.isFile() && CODE_FILE_PATTERN.test(entry.name)) acc.push(nextPath);
  }
  return acc;
};

const countLines = (absolutePath: string): number =>
  readFileSync(absolutePath, "utf-8").split(/\r?\n/).length;

export const collectActiveCodeFiles = (): ActiveCodeFile[] =>
  ACTIVE_ROOTS
    .flatMap((root) => walkCodeFiles(pathFromRepoRoot(root)))
    .map((absolutePath) => ({ absolutePath, relativePath: toRepoRelativePath(absolutePath) }))
    .filter((file) => !shouldSkipPath(file.relativePath))
    .map((file) => ({ ...file, lineCount: countLines(file.absolutePath) }))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));

export const toRelativeSourcePath = (sourceFile: SourceFile): string =>
  toRepoRelativePath(sourceFile.getFilePath());

export const filterActiveSourceFiles = (sourceFiles: SourceFile[]): SourceFile[] =>
  sourceFiles.filter((sourceFile) => {
    const relativePath = toRelativeSourcePath(sourceFile);
    return ACTIVE_ROOTS.some((root) => relativePath.startsWith(`${root}/`))
      && CODE_FILE_PATTERN.test(relativePath)
      && !shouldSkipPath(relativePath);
  });
