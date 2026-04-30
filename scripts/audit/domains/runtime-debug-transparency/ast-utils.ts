import type { Project, SourceFile } from "ts-morph";

import { createAuditProject, getSourceFileOrThrow } from "../_shared/ast-helpers.js";

export const AUDIT_ROOT = "scripts/audit/domains/runtime-debug-transparency";
export const INSPECTOR_PATH = `${AUDIT_ROOT}/inspector.ts`;

export function createRuntimeDebugTransparencyProject(): Project {
  return createAuditProject();
}

export function getSource(project: Project, repoRelativePath: string): SourceFile {
  return getSourceFileOrThrow(project, repoRelativePath);
}