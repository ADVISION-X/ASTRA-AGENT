import type { Project, SourceFile } from "ts-morph";

import { createAuditProject, getSourceFileOrThrow } from "../_shared/ast-helpers.js";
import { listFilesRecursive } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { ROOT } from "./constants.js";

export function createMapPluginAuditProject(): Project {
  return createAuditProject();
}

export function getSource(project: Project, repoRelativePath: string): SourceFile {
  return getSourceFileOrThrow(project, repoRelativePath);
}

export async function listMapPluginFiles(): Promise<string[]> {
  const files = await listFilesRecursive(pathFromRepoRoot(ROOT), { extensions: [".ts", ".json"] });
  return files.map((filePath) => toRepoRelativePath(filePath));
}