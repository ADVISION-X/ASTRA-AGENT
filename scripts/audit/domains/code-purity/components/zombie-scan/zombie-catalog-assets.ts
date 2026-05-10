import { readJsonFile } from "../../../../core/filesystem.js";
import { pathFromRepoRoot } from "../../../../core/paths.js";
import { getNodeLine } from "../../../../core/ts-morph.js";
import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { getZombieProtectedSeamForPath } from "../../../../../../src/audit-support/code-purity/protected-seams.js";
import type { ZombieCandidate, ZombieGraph } from "./zombie-scan-types.js";

const PROMPT_CONTRACT_ROOT = "src/capabilities/ai/prompt-contracts/builtins/";
const MAP_PACKAGE_ROOT = "src/map-plugins/builtins/";

const getStringLiteralValue = (expression: Node | undefined): string | undefined => {
  if (!expression) {
    return undefined;
  }
  if (Node.isStringLiteral(expression) || Node.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.getLiteralText();
  }
  if (Node.isIdentifier(expression)) {
    const declaration = expression.getDefinitions()[0]?.getDeclarationNode();
    if (declaration && Node.isVariableDeclaration(declaration)) {
      return getStringLiteralValue(declaration.getInitializer());
    }
  }
  return undefined;
};

const collectArrayValuesByVariableName = (sourceFile: SourceFile, variableName: string): Array<{ value: string; line: number }> => {
  const declaration = sourceFile.getVariableDeclaration(variableName);
  const initializer = declaration?.getInitializer();
  if (!declaration || !initializer || !Node.isArrayLiteralExpression(initializer)) {
    return [];
  }

  return initializer.getElements().flatMap((element) => {
    const value = getStringLiteralValue(element);
    return value ? [{ value, line: getNodeLine(element) }] : [];
  });
};

const collectPropertyStringValues = (sourceFile: SourceFile, propertyName: string): Array<{ value: string; line: number }> =>
  sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment).flatMap((property) => {
    if (property.getName() !== propertyName) {
      return [];
    }

    const initializer = property.getInitializer();
    if (!initializer) {
      return [];
    }
    if (Node.isArrayLiteralExpression(initializer)) {
      return initializer.getElements().flatMap((element) => {
        const value = getStringLiteralValue(element);
        return value ? [{ value, line: getNodeLine(element) }] : [];
      });
    }

    const value = getStringLiteralValue(initializer);
    return value ? [{ value, line: getNodeLine(initializer) }] : [];
  });

const mergeCandidate = (candidates: Map<string, ZombieCandidate>, candidate: ZombieCandidate): void => {
  const key = `${candidate.kind}:${candidate.symbolName}:${candidate.file}`;
  if (!candidates.has(key)) {
    candidates.set(key, candidate);
  }
};

const isPromptContractFile = (relativePath: string): boolean => relativePath.startsWith(PROMPT_CONTRACT_ROOT) && relativePath.endsWith(".prompt-contract.json");

const isMapPackageFile = (relativePath: string): boolean => relativePath.startsWith(MAP_PACKAGE_ROOT) && relativePath.endsWith(".meta.map-package.json");

const collectPromptContractCandidates = async (graph: ZombieGraph, candidates: Map<string, ZombieCandidate>): Promise<void> => {
  for (const relativePath of graph.jsonPaths) {
    if (!isPromptContractFile(relativePath) || getZombieProtectedSeamForPath(relativePath)) {
      continue;
    }

    const raw = await readJsonFile(pathFromRepoRoot(relativePath));
    const promptContractId = typeof raw === "object" && raw && typeof (raw as { promptContractId?: unknown }).promptContractId === "string"
      ? (raw as { promptContractId: string }).promptContractId
      : null;
    if (!promptContractId) {
      continue;
    }

    mergeCandidate(candidates, {
      kind: "unused-prompt-contract",
      symbolName: promptContractId,
      file: relativePath,
      line: 1,
      value: promptContractId,
      excludedFiles: [relativePath, "src/capabilities/ai/prompt-contracts/registry.ts"],
      excludedPathPrefixes: [],
      protectedSeam: null,
      recommendedAction: `Remove ${promptContractId} or route it from a lawful AI prompt binding.`,
    });
  }
};

const collectMapPackageCandidates = async (graph: ZombieGraph, candidates: Map<string, ZombieCandidate>): Promise<void> => {
  for (const relativePath of graph.jsonPaths) {
    if (!isMapPackageFile(relativePath)) {
      continue;
    }

    const raw = await readJsonFile(pathFromRepoRoot(relativePath));
    const packageId = typeof raw === "object" && raw && typeof (raw as { manifest?: { packageId?: unknown } }).manifest?.packageId === "string"
      ? (raw as { manifest: { packageId: string } }).manifest.packageId
      : null;
    if (!packageId) {
      continue;
    }

    const packageFileName = relativePath.split("/").pop() ?? relativePath;
    mergeCandidate(candidates, {
      kind: "unused-map-package",
      symbolName: packageId,
      file: relativePath,
      line: 1,
      value: packageFileName,
      excludedFiles: [relativePath],
      excludedPathPrefixes: [],
      protectedSeam: null,
      recommendedAction: `Delete ${packageId} or add it to the builtin map loader and active registry.`,
    });
  }
};

const collectActionCodeCandidates = (graph: ZombieGraph, candidates: Map<string, ZombieCandidate>): void => {
  const actionCodeFile = graph.sourceFilesByPath.get("src/muscle-memory/action-code.ts");
  const catalogFile = graph.sourceFilesByPath.get("src/muscle-memory/catalog.ts");
  const seedFile = graph.sourceFilesByPath.get("src/muscle-memory/catalog/catalog-seed.ts");

  const values = new Map<string, ZombieCandidate>();
  const append = (entries: Array<{ value: string; line: number }>, file: string): void => {
    for (const entry of entries) {
      if (values.has(entry.value)) {
        continue;
      }
      values.set(entry.value, {
        kind: "unused-muscle-memory-action-code",
        symbolName: entry.value,
        file,
        line: entry.line,
        value: entry.value,
        excludedFiles: ["src/muscle-memory/action-code.ts", "src/muscle-memory/catalog.ts", "src/muscle-memory/catalog/catalog-seed.ts"],
        excludedPathPrefixes: [],
        protectedSeam: null,
        recommendedAction: `Delete ${entry.value} or route it through a lawful muscle-memory recipe or runtime consumer.`,
      });
    }
  };

  if (actionCodeFile) {
    append(collectArrayValuesByVariableName(actionCodeFile, "MUSCLE_MEMORY_ACTION_CODES"), "src/muscle-memory/action-code.ts");
  }
  if (catalogFile) {
    append(collectPropertyStringValues(catalogFile, "actionCode"), "src/muscle-memory/catalog.ts");
  }
  if (seedFile) {
    append(collectPropertyStringValues(seedFile, "actionCode"), "src/muscle-memory/catalog/catalog-seed.ts");
  }

  for (const candidate of values.values()) {
    mergeCandidate(candidates, candidate);
  }
};

export const collectAssetFamilyCandidates = async (graph: ZombieGraph, candidates: Map<string, ZombieCandidate>): Promise<void> => {
  await collectPromptContractCandidates(graph, candidates);
  await collectMapPackageCandidates(graph, candidates);
  collectActionCodeCandidates(graph, candidates);
};
