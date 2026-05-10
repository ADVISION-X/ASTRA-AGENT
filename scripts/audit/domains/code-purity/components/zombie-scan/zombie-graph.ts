import { readJsonFile } from "../../../../core/filesystem.js";
import { pathFromRepoRoot } from "../../../../core/paths.js";
import { Project, SyntaxKind, type SourceFile } from "ts-morph";

import { getImportedSourcePaths } from "../purity-import-analysis.js";
import type { ZombieGraph } from "./zombie-scan-types.js";

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs"] as const;
const JSON_EXTENSIONS = [".json", ".jsonc"] as const;

const isSourceCodePath = (relativePath: string): boolean => SOURCE_EXTENSIONS.some((extension) => relativePath.endsWith(extension));

const isJsonPath = (relativePath: string): boolean => JSON_EXTENSIONS.some((extension) => relativePath.endsWith(extension));

const createZombieProject = (repoRoot: string): Project => {
  void repoRoot;
  return new Project({
    tsConfigFilePath: pathFromRepoRoot("tsconfig.json"),
    skipAddingFilesFromTsConfig: true,
    compilerOptions: { allowJs: true },
  });
};

const collectStringValuesFromJson = (value: unknown, values: Set<string>): void => {
  if (typeof value === "string") {
    values.add(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStringValuesFromJson(item, values);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectStringValuesFromJson(item, values);
    }
  }
};

const collectSourceStringValues = (sourceFile: SourceFile, values: Set<string>): void => {
  for (const literal of [...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral), ...sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral)]) {
    values.add(literal.getLiteralText());
  }
};

const loadZombieSourceFiles = (project: Project, sourcePaths: string[]): Map<string, SourceFile> => {
  const sourceFilesByPath = new Map<string, SourceFile>();

  for (const relativePath of sourcePaths) {
    const sourceFile = project.addSourceFileAtPathIfExists(pathFromRepoRoot(relativePath));
    if (sourceFile) {
      sourceFilesByPath.set(relativePath, sourceFile);
    }
  }

  return sourceFilesByPath;
};

const collectInboundImportPaths = (sourceFilesByPath: Map<string, SourceFile>, sourcePathSet: Set<string>): Map<string, Set<string>> => {
  const inboundImportPaths = new Map<string, Set<string>>();

  for (const [relativePath, sourceFile] of sourceFilesByPath.entries()) {
    for (const importedPath of getImportedSourcePaths(sourceFile)) {
      if (!sourcePathSet.has(importedPath)) {
        continue;
      }
      if (!inboundImportPaths.has(importedPath)) {
        inboundImportPaths.set(importedPath, new Set<string>());
      }
      inboundImportPaths.get(importedPath)?.add(relativePath);
    }
  }

  return inboundImportPaths;
};

const collectStringUsageIndex = async (sourceFilesByPath: Map<string, SourceFile>, jsonPaths: string[]): Promise<Map<string, Set<string>>> => {
  const stringUsageIndex = new Map<string, Set<string>>();

  const registerValue = (value: string, relativePath: string): void => {
    if (!stringUsageIndex.has(value)) {
      stringUsageIndex.set(value, new Set<string>());
    }
    stringUsageIndex.get(value)?.add(relativePath);
  };

  for (const [relativePath, sourceFile] of sourceFilesByPath.entries()) {
    const values = new Set<string>();
    collectSourceStringValues(sourceFile, values);
    for (const value of values) {
      registerValue(value, relativePath);
    }
  }

  for (const relativePath of jsonPaths) {
    const values = new Set<string>();
    collectStringValuesFromJson(await readJsonFile(pathFromRepoRoot(relativePath)), values);
    for (const value of values) {
      registerValue(value, relativePath);
    }
  }

  return stringUsageIndex;
};

export const buildZombieGraph = async (repoRoot: string, relativePaths: string[]): Promise<ZombieGraph> => {
  const project = createZombieProject(repoRoot);
  const sourcePaths = relativePaths.filter(isSourceCodePath).sort((left, right) => left.localeCompare(right));
  const jsonPaths = relativePaths.filter(isJsonPath).sort((left, right) => left.localeCompare(right));
  const sourcePathSet = new Set(sourcePaths);
  const sourceFilesByPath = loadZombieSourceFiles(project, sourcePaths);
  const inboundImportPaths = collectInboundImportPaths(sourceFilesByPath, sourcePathSet);
  const stringUsageIndex = await collectStringUsageIndex(sourceFilesByPath, jsonPaths);

  return {
    project,
    sourceFilesByPath,
    sourcePaths,
    jsonPaths,
    inboundImportPaths,
    stringUsageIndex,
  };
};
