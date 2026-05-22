import type { Project, SourceFile } from "ts-morph";

import { toRepoPath } from "./paths.js";

const isActiveRepoPath = (repoPath: string): boolean => {
  if (!/\.(?:ts|tsx|js|jsx|mjs)$/u.test(repoPath)) {
    return false;
  }
  if (repoPath.startsWith("scripts/audit/generated/")) {
    return false;
  }
  return repoPath.startsWith("src/") || repoPath.startsWith("scripts/");
};

export const getRepoSourcePath = (sourceFile: SourceFile): string => toRepoPath(sourceFile.getFilePath());

export const listActiveSourceFiles = (project: Project): SourceFile[] =>
  project
    .getSourceFiles()
    .filter((sourceFile) => !sourceFile.isDeclarationFile() && isActiveRepoPath(getRepoSourcePath(sourceFile)))
    .sort((left, right) => getRepoSourcePath(left).localeCompare(getRepoSourcePath(right)));

export const listOwnerInspectorFiles = (project: Project): SourceFile[] =>
  listActiveSourceFiles(project).filter((sourceFile) =>
    /^scripts\/audit\/domains\/[^/]+\/inspector\.ts$/u.test(getRepoSourcePath(sourceFile)),
  );

export const lineCountOf = (sourceFile: SourceFile): number => sourceFile.getEndLineNumber();