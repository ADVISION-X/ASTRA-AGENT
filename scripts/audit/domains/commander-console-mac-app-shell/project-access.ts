import type { Project, SourceFile } from "ts-morph";

import { toRepoRelativePath } from "../../core/paths.js";
import { createAuditProject, getSourceFileOrThrow } from "../_shared/ast-helpers.js";

import { PATHS } from "./config.js";

export function createCommanderConsoleMacShellProject(): Project {
  return createAuditProject();
}

export function getMacShellSourceFile(project: Project, repoRelativePath: string): SourceFile {
  return getSourceFileOrThrow(project, repoRelativePath);
}

export function getExportedNames(sourceFile: SourceFile): Set<string> {
  return new Set(sourceFile.getExportedDeclarations().keys());
}

export function getUiFeatureSourceFiles(project: Project): SourceFile[] {
  return project.getSourceFiles().filter((sourceFile) => toRepoRelativePath(sourceFile.getFilePath()).startsWith(`${PATHS.ROOT}/`));
}