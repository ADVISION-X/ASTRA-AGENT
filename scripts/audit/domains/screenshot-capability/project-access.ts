import { SyntaxKind, type Project, type SourceFile } from "ts-morph";

import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { createAuditProject, getSourceFileOrThrow } from "../_shared/ast-helpers.js";

import { CANONICAL_FILES, CHILDREN, PATHS } from "./config.js";

export function createScreenshotAuditProject(): Project {
  const project = createAuditProject();
  project.addSourceFilesAtPaths(pathFromRepoRoot(`${PATHS.ROOT}/**/*.ts`));
  project.addSourceFileAtPath(pathFromRepoRoot(PATHS.WORKBENCH_DISPATCH_INPUT));
  project.addSourceFileAtPath(pathFromRepoRoot(PATHS.BROWSER_CONTROLLER_CONTRACT));
  project.addSourceFileAtPath(pathFromRepoRoot(PATHS.CURRENT_CHROME_CONTROLLER));
  project.addSourceFileAtPath(pathFromRepoRoot(PATHS.CURRENT_CHROME_SCREENSHOT));
  return project;
}

export function getSource(project: Project, repoRelativePath: string): SourceFile {
  return getSourceFileOrThrow(project, repoRelativePath);
}

export function getRepoPath(sourceFile: SourceFile): string {
  return toRepoRelativePath(sourceFile.getFilePath());
}

export async function missingCanonicalFiles(): Promise<string[]> {
  const missing: string[] = [];
  for (const filePath of CANONICAL_FILES) {
    if (!(await fileExists(pathFromRepoRoot(filePath)))) {
      missing.push(filePath);
    }
  }
  for (const childId of CHILDREN) {
    for (const suffix of ["contract.ts", "schema.ts", "implementation.ts"]) {
      const filePath = `${PATHS.ROOT}/children/${childId}/${suffix}`;
      if (!(await fileExists(pathFromRepoRoot(filePath)))) {
        missing.push(filePath);
      }
    }
  }
  return missing;
}

export function getScreenshotSources(project: Project): SourceFile[] {
  return project.getSourceFiles().filter((sourceFile) => getRepoPath(sourceFile).startsWith(`${PATHS.ROOT}/`));
}

export function getRegistryChildIds(registrySource: SourceFile): string[] {
  return registrySource
    .getVariableDeclarationOrThrow("REGISTRY_ENTRIES")
    .getDescendantsOfKind(SyntaxKind.StringLiteral)
    .map((literal) => literal.getLiteralText())
    .filter((value, index, values) => CHILDREN.includes(value as typeof CHILDREN[number]) && values.indexOf(value) === index);
}