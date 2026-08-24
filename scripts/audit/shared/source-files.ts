import type { Project, SourceFile } from "ts-morph";

import { hasSourceExtension } from "./no-regex.js";
import { toRepoPath } from "./paths.js";

const isActiveRepoPath = (repoPath: string): boolean => {
  if (!hasSourceExtension(repoPath)) {
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

export const lineCountOf = (sourceFile: SourceFile): number => sourceFile.getEndLineNumber();
