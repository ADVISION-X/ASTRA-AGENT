import type { Project, SourceFile } from "ts-morph";

import { createAuditProject, getSourceFileOrThrow } from "../_shared/ast-helpers.js";
import { toRepoRelativePath } from "../../core/paths.js";
import { ROOT } from "./constants.js";

export function createPageStateAuditProject(): Project {
  return createAuditProject();
}

export function getSource(project: Project, repoRelativePath: string): SourceFile {
  return getSourceFileOrThrow(project, repoRelativePath);
}

export function getPageStateSources(project: Project): SourceFile[] {
  return project.getSourceFiles().filter((sourceFile) => toRepoRelativePath(sourceFile.getFilePath()).startsWith(`${ROOT}/`));
}