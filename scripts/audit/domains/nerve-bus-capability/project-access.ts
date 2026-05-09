import path from "node:path";

import type { ExportDeclaration, ImportDeclaration, Project, SourceFile } from "ts-morph";

import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { getZodEnumValues } from "../_shared/ast-schema-queries.js";
import { createAuditProject } from "../_shared/ast-helpers.js";

import { PATHS, REQUIRED_FILES } from "./config.js";

export function makeProject(): Project {
  const project = createAuditProject();
  project.addSourceFilesAtPaths(pathFromRepoRoot(`${PATHS.ROOT}/**/*.ts`));
  return project;
}

export function getSourceFile(project: Project, repoRelativePath: string): SourceFile | null {
  return project.addSourceFileAtPathIfExists(pathFromRepoRoot(repoRelativePath)) ?? null;
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

export function getNerveBusSourceFiles(project: Project): SourceFile[] {
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

export function getSchemaChannelIds(project: Project): string[] {
  const schemaSource = getSourceFile(project, PATHS.SCHEMA) ?? getSourceFile(project, `${PATHS.ROOT}/schema-foundation.schema.ts`);
  return schemaSource ? getZodEnumValues(schemaSource, "NerveBusChannelIdSchema") : [];
}

export function toRepoPath(sourceFile: SourceFile, project: Project): string {
  const filePath = sourceFile.getFilePath().replace(`${project.getCompilerOptions().rootDir ?? ""}/`, "");
  return filePath.includes("src/") ? filePath.slice(filePath.indexOf("src/")) : filePath;
}

function getDeclarationTargetPath(declaration: ImportDeclaration | ExportDeclaration): string | null {
  const targetSourceFile = declaration.getModuleSpecifierSourceFile();
  if (targetSourceFile) {
    return toRepoRelativePath(targetSourceFile.getFilePath());
  }
  const specifier = declaration.getModuleSpecifierValue();
  return specifier ? resolveRelativeRepoPath(toRepoRelativePath(declaration.getSourceFile().getFilePath()), specifier) : null;
}

function resolveRelativeRepoPath(fromRepoRelativePath: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) {
    return null;
  }
  return path.posix.normalize(path.posix.join(path.posix.dirname(fromRepoRelativePath), specifier.replaceAll("\\", "/")));
}