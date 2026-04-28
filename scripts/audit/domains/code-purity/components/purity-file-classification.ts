import path from "node:path";

import { type ImportDeclaration, type SourceFile } from "ts-morph";

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
]);

const FAKE_PATH_NAMES = new Set([
  "mock",
  "mocks",
  "fake",
  "fixture",
  "fixtures",
  "demo",
  "placeholder",
]);

const OWNER_PREFIXES: Array<{ prefix: string; owner: string }> = [
  { prefix: "src/app/", owner: "route" },
  { prefix: "src/features/comments/", owner: "comments" },
  { prefix: "src/features/local-data/", owner: "local-data" },
  { prefix: "src/features/platform-action/", owner: "platform-action" },
  { prefix: "src/features/product-signal/", owner: "product-signal" },
  { prefix: "src/features/vision/", owner: "vision" },
  { prefix: "src/lib/browser/", owner: "browser" },
  { prefix: "src/lib/local-ai/", owner: "local-ai" },
  { prefix: "src/lib/local-app-shell/", owner: "local-app-shell" },
  { prefix: "src/lib/local-runtime/", owner: "local-runtime" },
  { prefix: "src/lib/storage/", owner: "storage" },
  { prefix: "src/lib/localization/", owner: "localization" },
  { prefix: "src/types/", owner: "types" },
  { prefix: "scripts/startup/", owner: "startup" },
  { prefix: "scripts/audit/", owner: "audit" },
  { prefix: "scripts/acceptance/", owner: "acceptance" },
  { prefix: "scripts/verify/", owner: "verify" },
];

const STRUCTURAL_CANDIDATE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

const splitRelativePath = (relativePath: string): string[] =>
  relativePath.split("/").filter((segment) => segment.length > 0);

const baseNameWithoutExtension = (relativePath: string): string =>
  path.parse(path.basename(relativePath)).name;

const hasFakePathToken = (segment: string): boolean => {
  const normalized = path.parse(segment).name.toLowerCase();
  return FAKE_PATH_NAMES.has(normalized);
};

export const classifyOwnerBoundary = (relativePath: string): string => {
  for (const candidate of OWNER_PREFIXES) {
    if (relativePath.startsWith(candidate.prefix)) {
      return candidate.owner;
    }
  }

  return "unknown";
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

const getImportDeclarationSourcePaths = (importDeclaration: ImportDeclaration): string[] => {
  const paths = new Set<string>();
  const moduleSpecifierSourceFile = importDeclaration.getModuleSpecifierSourceFile();
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
  getImportedSourcePaths(sourceFile).some((importedPath) => isProductionFakePath(importedPath));

export const getStructuralBaseName = (relativePath: string): string =>
  baseNameWithoutExtension(relativePath);