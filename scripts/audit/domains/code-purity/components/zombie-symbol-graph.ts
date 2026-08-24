import { Node, SyntaxKind, type Node as MorphNode } from "ts-morph";

import { astIdentifierName } from "../../../shared/ast-node-identity.js";
import { collectResolvedModuleBindings } from "../../../shared/source-module-targets.js";
import { toRepoPath } from "../../../shared/paths.js";
import type { GovernedFile } from "./code-purity-governed-files.js";
import {
  classifyZombieDeclaration,
  getZombieDeclarationNameNode,
} from "./zombie-type-runtime-classifier.js";
import {
  classifyZombieReferenceUsage,
  type ZombieSymbolReference,
} from "./zombie-symbol-usage.js";

export type ZombieExportSymbol = {
  declaration: MorphNode;
  declarationKind: string;
  declaringFile: string;
  exportName: string;
  exportingFile: string;
  isRuntimeValue: boolean;
  isTypeOnly: boolean;
  localDeclarationName: string | null;
  nameNode: MorphNode | undefined;
  sourceColumn: number;
  sourceLine: number;
  supportsTypeUsage: boolean;
  symbolId: string;
};

export type ZombieSymbolResolutionFailure = {
  error: string;
  exportName: string;
  exportingFile: string;
  localDeclarationName: string | null;
};

export type ZombieSymbolGraph = {
  exportsByFile: Map<string, ZombieExportSymbol[]>;
  referencesBySymbol: Map<string, ZombieSymbolReference[]>;
  resolutionFailures: ZombieSymbolResolutionFailure[];
};

const buildZombieSymbolId = (input: {
  declaringFile: string;
  exportName: string;
  exportingFile: string;
  sourceLine: number;
}): string => `${input.exportingFile}:${input.exportName}:${input.declaringFile}:${input.sourceLine}`;

const dedupeZombieReferences = (references: readonly ZombieSymbolReference[]): ZombieSymbolReference[] => {
  const keys = new Set<string>();
  const deduped: ZombieSymbolReference[] = [];
  for (const reference of references) {
    const key = `${reference.referencingFile}:${reference.line}:${reference.usageKind}:${reference.sourceText}`;
    if (keys.has(key)) {
      continue;
    }
    keys.add(key);
    deduped.push(reference);
  }
  return deduped;
};

const createZombieExportSymbol = (
  exportingFile: string,
  exportName: string,
  declaration: MorphNode,
): ZombieExportSymbol => {
  const classification = classifyZombieDeclaration(declaration);
  const nameNode = getZombieDeclarationNameNode(declaration);
  const location = declaration.getSourceFile().getLineAndColumnAtPos(declaration.getStart());
  return {
    declaration,
    declarationKind: classification.declarationKind,
    declaringFile: toRepoPath(declaration.getSourceFile().getFilePath()),
    exportName,
    exportingFile,
    isRuntimeValue: classification.isRuntimeValue,
    isTypeOnly: classification.isTypeOnly,
    localDeclarationName: classification.localDeclarationName,
    nameNode,
    sourceColumn: location.column,
    sourceLine: location.line,
    supportsTypeUsage: classification.supportsTypeUsage,
    symbolId: buildZombieSymbolId({
      declaringFile: toRepoPath(declaration.getSourceFile().getFilePath()),
      exportName,
      exportingFile,
      sourceLine: location.line,
    }),
  };
};

const collectZombieReferenceNodes = (nameNode: MorphNode | undefined): MorphNode[] => {
  if (!nameNode || !Node.isIdentifier(nameNode)) {
    return [];
  }
  return nameNode.findReferencesAsNodes().filter((referenceNode) => referenceNode !== nameNode);
};

const collectCrossFileImportReferences = (
  governedFiles: readonly GovernedFile[],
): Map<string, ZombieSymbolReference[]> => {
  const referencesByTarget = new Map<string, ZombieSymbolReference[]>();
  for (const governedFile of governedFiles) {
    const bindings = collectResolvedModuleBindings(governedFile.sourceFile)
      .filter((binding) => binding.edgeKind === "import"
        && binding.importedSymbolName !== null
        && binding.localSymbolName !== null);
    for (const binding of bindings) {
    const importedName = binding.localSymbolName;
    if (!importedName || !binding.importedSymbolName) continue;
    const importedNodes = governedFile.sourceFile
      .getDescendantsOfKind(SyntaxKind.Identifier)
      .filter((node) => astIdentifierName(node) === importedName);
    const bindingNode = importedNodes.find((node) => node.getStartLineNumber() === binding.line);
    const importedSymbol = bindingNode?.getSymbol();
    const references = importedSymbol
      ? importedNodes.filter((node) => node.getSymbol() === importedSymbol)
      : [];
      const key = `${binding.targetPath}:${binding.importedSymbolName}`;
      const existing = referencesByTarget.get(key) ?? [];
      existing.push(...references.map((referenceNode) => ({
        line: referenceNode.getStartLineNumber(),
        referencingFile: governedFile.repoPath,
        sourceText: astIdentifierName(referenceNode) ?? "unresolved-identifier",
        usageKind: classifyZombieReferenceUsage(referenceNode),
      })));
      referencesByTarget.set(key, existing);
    }
  }
  return referencesByTarget;
};

export const buildZombieSymbolGraph = (governedFiles: readonly GovernedFile[]): ZombieSymbolGraph => {
  const exportsByFile = new Map<string, ZombieExportSymbol[]>();
  const referencesBySymbol = new Map<string, ZombieSymbolReference[]>();
  const resolutionFailures: ZombieSymbolResolutionFailure[] = [];
  const crossFileImportReferences = collectCrossFileImportReferences(governedFiles);

  for (const governedFile of governedFiles) {
    const fileExports: ZombieExportSymbol[] = [];
    for (const [exportName, declarations] of governedFile.sourceFile.getExportedDeclarations()) {
      for (const declaration of declarations) {
        const exportSymbol = createZombieExportSymbol(governedFile.repoPath, exportName, declaration);
        fileExports.push(exportSymbol);
        try {
          const references = [
            ...collectZombieReferenceNodes(exportSymbol.nameNode).map((referenceNode) => ({
            line: referenceNode.getStartLineNumber(),
            referencingFile: toRepoPath(referenceNode.getSourceFile().getFilePath()),
            sourceText: astIdentifierName(referenceNode) ?? "unresolved-identifier",
            usageKind: classifyZombieReferenceUsage(referenceNode),
            })),
            ...(crossFileImportReferences.get(
              `${exportSymbol.declaringFile}:${exportSymbol.exportName}`,
            ) ?? []),
          ];
          referencesBySymbol.set(exportSymbol.symbolId, dedupeZombieReferences(references));
        } catch (error) {
          referencesBySymbol.set(exportSymbol.symbolId, []);
          resolutionFailures.push({
            error: error instanceof Error ? error.message : String(error),
            exportName,
            exportingFile: governedFile.repoPath,
            localDeclarationName: exportSymbol.localDeclarationName,
          });
        }
      }
    }
    exportsByFile.set(governedFile.repoPath, fileExports);
  }

  return {
    exportsByFile,
    referencesBySymbol,
    resolutionFailures,
  };
};
