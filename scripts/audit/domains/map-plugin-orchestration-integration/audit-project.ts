import type { Project, SourceFile } from "ts-morph";

import { createAuditProject, getSourceFileOrThrow } from "../_shared/ast-helpers.js";

export function createIntegrationAuditProject(): Project {
  return createAuditProject();
}

export function getSource(project: Project, repoRelativePath: string): SourceFile {
  return getSourceFileOrThrow(project, repoRelativePath);
}