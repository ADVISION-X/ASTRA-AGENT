import path from "node:path";

import { type ExportDeclaration, type ImportDeclaration, type Project, type SourceFile } from "ts-morph";

import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { createAuditProject } from "../_shared/ast-helpers.js";
import { PATHS, REQUIRED_FILES } from "./config.js";

export function makeProject(): Project {
  return createAuditProject();
}

export function getSourceFile(project: Project, repoRelativePath: string): SourceFile | null {
  const absolutePath = pathFromRepoRoot(repoRelativePath);
  return project.getSourceFile(absolutePath) ?? project.addSourceFileAtPathIfExists(absolutePath) ?? null;
}

export async function missingRequiredFiles(): Promise<string[]> {
  const missing: string[] = [];
  for (const filePath of REQUIRED_FILES) {
    if (!(await fileExists(pathFromRepoRoot(filePath)))) {
      missing.push(filePath);
    }
  }
  return missing;
}

const resolveRelativeRepoPath = (fromRepoRelativePath: string, specifier: string): string | null => {
  if (!specifier.startsWith(".")) {
    return null;
  }

  return path.posix.normalize(path.posix.join(path.posix.dirname(fromRepoRelativePath), specifier.replaceAll("\\", "/")));
};

const getDeclarationTargetPath = (declaration: ImportDeclaration | ExportDeclaration): string | null => {
  const targetSourceFile = declaration.getModuleSpecifierSourceFile();
  if (targetSourceFile) {
    return toRepoRelativePath(targetSourceFile.getFilePath());
  }

  const specifier = declaration.getModuleSpecifierValue();
  if (!specifier) {
    return null;
  }

  return resolveRelativeRepoPath(toRepoRelativePath(declaration.getSourceFile().getFilePath()), specifier);
};

export function getMouseClickSourceFiles(project: Project): SourceFile[] {
  project.addSourceFilesAtPaths(pathFromRepoRoot(`${PATHS.ROOT}/**/*.ts`));
  return project.getSourceFiles().filter((sourceFile) => toRepoRelativePath(sourceFile.getFilePath()).startsWith(`${PATHS.ROOT}/`));
}

export function getExternalImportsWithPrefix(project: Project, targetPrefix: string): string[] {
  return project.getSourceFiles().flatMap((sourceFile) => {
    const importerPath = toRepoRelativePath(sourceFile.getFilePath());
    if (importerPath.startsWith(`${PATHS.ROOT}/`)) {
      return [];
    }

    return sourceFile.getImportDeclarations().flatMap((declaration) => {
      const importedPath = getDeclarationTargetPath(declaration);
      return importedPath && importedPath.startsWith(targetPrefix) ? [importerPath] : [];
    });
  });
}