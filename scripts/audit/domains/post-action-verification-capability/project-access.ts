import type { Project, SourceFile } from "ts-morph";

import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { createAuditProject, getSourceFileOrThrow } from "../_shared/ast-helpers.js";

import { CANONICAL_FILES, PATHS } from "./config.js";

export function createPostActionAuditProject(): Project {
  return createAuditProject();
}

export function getSource(project: Project, repoRelativePath: string): SourceFile {
  return getSourceFileOrThrow(project, repoRelativePath);
}

export async function missingCanonicalFiles(): Promise<string[]> {
  const missing: string[] = [];
  for (const filePath of CANONICAL_FILES) {
    if (!(await fileExists(pathFromRepoRoot(filePath)))) {
      missing.push(filePath);
    }
  }
  return missing;
}

export function getOwnedSources(project: Project): SourceFile[] {
  return project.getSourceFiles().filter((sourceFile) => toRepoRelativePath(sourceFile.getFilePath()).startsWith(`${PATHS.ROOT}/`));
}

export function getRepoPath(sourceFile: SourceFile): string {
  return toRepoRelativePath(sourceFile.getFilePath());
}