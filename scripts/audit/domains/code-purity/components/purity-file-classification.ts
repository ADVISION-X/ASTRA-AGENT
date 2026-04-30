import path from "node:path";

import { type ImportDeclaration, type SourceFile } from "ts-morph";

import { FILE_LIMITS } from "./purity-constants.js";
import { toRelativeSourcePath } from "../../../core/ts-morph.js";

const GENERIC_BUCKET_BASENAMES = new Set([
  "utils.ts",
  "utils.js",
  "utils.mjs",
  "helpers.ts",
  "helpers.js",
  "helpers.mjs",
  "service.ts",
  "service.js",
  "service.mjs",
  "manager.ts",
  "manager.js",
  "manager.mjs",
  "common.ts",
  "common.js",
  "common.mjs",
  "workbench.ts",
]);

const FAKE_PATH_NAMES = new Set(["mock", "mocks", "fake", "fixture", "fixtures", "demo", "placeholder"]);
const STRUCTURAL_CANDIDATE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

export interface PurityFileCategory {
  kind: keyof typeof FILE_LIMITS;
  label: string;
  hardLimit: number;
}

const splitRelativePath = (relativePath: string): string[] =>
  relativePath.split("/").filter((segment) => segment.length > 0);

const baseNameWithoutExtension = (relativePath: string): string =>
  path.parse(path.basename(relativePath)).name;

const getModuleOwner = (parts: string[]): string | undefined => {
  if (parts[0] === "src" && parts[1] === "capabilities" && parts[2]) {
    return parts[2];
  }
  if (parts[0] === "src" && parts[1] === "map-plugins") {
    return "map-plugin-package";
  }
  if (parts[0] === "scripts" && parts[1] === "audit" && parts[2] === "domains" && parts[3]) {
    return parts[3];
  }
  if (parts[0] === "src" && parts[1] === "features" && parts[2]) {
    return parts[2];
  }
  if (parts[0] === "src" && parts[1] === "app") {
    return "commander-console";
  }
  if (parts[0] === "scripts" && parts[1] === "startup") {
    return "startup-entrypoint";
  }
  if (parts[0] === "src" && parts[1] === "lib" && parts[2]) {
    const libOwners: Record<string, string> = {
      browser: "open",
      "local-ai": "ai",
      "local-runtime": "commander-console",
      storage: "forensics-persistence",
    };
    return libOwners[parts[2]] ?? parts[2];
  }
  if (parts[0] === "src" && parts[1] === "types") {
    return "types";
  }
  return undefined;
};

const hasFakePathToken = (segment: string): boolean => {
  const normalized = path.parse(segment).name.toLowerCase();
  return FAKE_PATH_NAMES.has(normalized);
};

export const classifyOwnerBoundary = (relativePath: string): string => {
  const parts = splitRelativePath(relativePath);
  return getModuleOwner(parts) ?? "unknown";
};

export const classifyPurityFileCategory = (relativePath: string): PurityFileCategory => {
  if (relativePath.startsWith("src/types/") || relativePath.endsWith("schema.ts") || relativePath.endsWith("schema.tsx")) {
    return { kind: "schemaType", label: "schema/type", hardLimit: FILE_LIMITS.schemaType };
  }

  if (relativePath.startsWith("src/app/")) {
    return { kind: "appHandler", label: "app/api handler", hardLimit: FILE_LIMITS.appHandler };
  }

  if (relativePath.startsWith("scripts/audit/domains/") && path.basename(relativePath) === "inspector.ts") {
    return { kind: "auditInspector", label: "audit inspector", hardLimit: FILE_LIMITS.auditInspector };
  }

  if (relativePath.startsWith("scripts/audit/")) {
    return { kind: "auditPhase", label: "audit phase", hardLimit: FILE_LIMITS.auditPhase };
  }

  if (relativePath.includes("orchestration") && (relativePath.includes("executor") || relativePath.includes("runtime"))) {
    return { kind: "orchestrationCoordinator", label: "orchestration coordinator", hardLimit: FILE_LIMITS.orchestrationCoordinator };
  }

  if (relativePath.includes("/runtime/") || relativePath.includes("executor") || relativePath.includes("adapter") || relativePath.includes("controller")) {
    return { kind: "runtime", label: "runtime/implementation", hardLimit: FILE_LIMITS.runtime };
  }

  return { kind: "ordinary", label: "ordinary implementation", hardLimit: FILE_LIMITS.ordinary };
};

export const isRouteLikeSourceFile = (relativePath: string): boolean =>
  relativePath.startsWith("src/app/");

export const isIndexSourceFile = (relativePath: string): boolean =>
  path.basename(relativePath) === "index.ts" || path.basename(relativePath) === "index.tsx";

export const isGenericBucketSourceFile = (relativePath: string): boolean =>
  GENERIC_BUCKET_BASENAMES.has(path.basename(relativePath));

export const isStructuralPurityCandidate = (relativePath: string): boolean => {
  const extension = path.extname(relativePath);
  if (!STRUCTURAL_CANDIDATE_EXTENSIONS.has(extension)) {
    return false;
  }

  return isRouteLikeSourceFile(relativePath)
    || isIndexSourceFile(relativePath)
    || isGenericBucketSourceFile(relativePath);
};

export const isProductionFakePath = (relativePath: string): boolean =>
  splitRelativePath(relativePath).some((segment) => hasFakePathToken(segment));

const resolveMissingModuleSpecifierSourceFile = (_error: unknown): SourceFile | undefined => undefined;

const getImportDeclarationSourcePaths = (importDeclaration: ImportDeclaration): string[] => {
  const paths = new Set<string>();
  let moduleSpecifierSourceFile: SourceFile | undefined;
  try {
    moduleSpecifierSourceFile = importDeclaration.getModuleSpecifierSourceFile() ?? undefined;
  } catch (error) {
    moduleSpecifierSourceFile = resolveMissingModuleSpecifierSourceFile(error);
  }
  if (moduleSpecifierSourceFile) {
    paths.add(toRelativeSourcePath(moduleSpecifierSourceFile));
  }

  const importNodes = [
    importDeclaration.getDefaultImport(),
    importDeclaration.getNamespaceImport(),
    ...importDeclaration.getNamedImports().map((namedImport) => namedImport.getNameNode()),
  ].filter((node): node is NonNullable<typeof node> => Boolean(node));

  for (const importNode of importNodes) {
    const symbol = importNode.getSymbol();
    const targetSymbol = symbol?.getAliasedSymbol() ?? symbol;
    if (!targetSymbol) {
      continue;
    }

    for (const declaration of targetSymbol.getDeclarations()) {
      paths.add(toRelativeSourcePath(declaration.getSourceFile()));
    }
  }

  return [...paths];
};

export const getImportedSourcePaths = (sourceFile: SourceFile): string[] => {
  const paths = new Set<string>();
  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    for (const importedPath of getImportDeclarationSourcePaths(importDeclaration)) {
      paths.add(importedPath);
    }
  }

  return [...paths].sort((left, right) => left.localeCompare(right));
};

export const getImportModuleSpecifiers = (sourceFile: SourceFile): string[] =>
  sourceFile.getImportDeclarations().map((declaration) => declaration.getModuleSpecifierValue());

export const getImportedOwnerBoundaries = (sourceFile: SourceFile, relativePath: string): string[] => {
  const localOwner = classifyOwnerBoundary(relativePath);
  const owners = new Set<string>();
  for (const importedPath of getImportedSourcePaths(sourceFile)) {
    const owner = classifyOwnerBoundary(importedPath);
    if (owner === "unknown" || owner === "types" || owner === localOwner) {
      continue;
    }
    owners.add(owner);
  }

  return [...owners].sort((left, right) => left.localeCompare(right));
};

export const hasProductionFakeImport = (sourceFile: SourceFile): boolean =>
  getImportedSourcePaths(sourceFile).some((importedPath) => isProductionFakePath(importedPath))
  || getImportModuleSpecifiers(sourceFile).some((specifier) => splitRelativePath(specifier).some((segment) => hasFakePathToken(segment)));

export const getStructuralBaseName = (relativePath: string): string =>
  baseNameWithoutExtension(relativePath);