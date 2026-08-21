import { Node, type Statement } from "ts-morph";

import type { GovernedFile } from "./code-purity-governed-files.js";
import {
  buildZombieCallGraph,
  type ZombieDeclarationResolutionFailure,
  type ZombieTopLevelDeclaration,
} from "./zombie-call-graph.js";
import {
  isLawfulAuditInspectionFile,
  type ZombieExemptionManifest,
} from "./zombie-exemption-manifest.js";
import type { ZombieReachability } from "./zombie-module-graph.js";
import { isLawfulZombieExport } from "./zombie-surface-shared.js";
import type { ZombieSymbolGraph } from "./zombie-symbol-graph.js";
import {
  classifyZombieDeclaration,
  getZombieDeclarationNameNode,
} from "./zombie-type-runtime-classifier.js";

type ZombieDeclarationLiveGraphInput = {
  governedFiles: readonly GovernedFile[];
  liveExportSymbolIds: ReadonlySet<string>;
  manifest: ZombieExemptionManifest;
  reachability: ZombieReachability;
  symbolGraph: ZombieSymbolGraph;
};

export type ZombieDeclarationLiveGraph = {
  declarations: ZombieTopLevelDeclaration[];
  deadDeclarationIds: Set<string>;
  declarationById: Map<string, ZombieTopLevelDeclaration>;
  inboundDeclarationIdsByDeclaration: Map<string, Set<string>>;
  liveDeclarationIds: Set<string>;
  resolutionFailures: ZombieDeclarationResolutionFailure[];
};

const buildDeclarationNodeKey = (node: {
  getSourceFile(): { getFilePath(): string };
  getStart(): number;
  getEnd(): number;
}): string =>
  `${node.getSourceFile().getFilePath()}:${node.getStart()}:${node.getEnd()}`;

const buildDeclarationId = (governedFile: GovernedFile, name: string, declarationKind: string, startLine: number): string =>
  `${governedFile.repoPath}:${name}:${declarationKind}:${startLine}`;

const collectStatementDeclarations = (
  governedFile: GovernedFile,
  statement: Statement,
  exportedNodeKeys: ReadonlySet<string>,
): ZombieTopLevelDeclaration[] => {
  if (
    Node.isFunctionDeclaration(statement)
    || Node.isClassDeclaration(statement)
    || Node.isEnumDeclaration(statement)
    || Node.isInterfaceDeclaration(statement)
    || Node.isTypeAliasDeclaration(statement)
  ) {
    const classification = classifyZombieDeclaration(statement);
    const nameNode = getZombieDeclarationNameNode(statement);
    if (!nameNode) {
      return [];
    }
    return [{
      declaration: statement,
      declarationKind: classification.declarationKind,
      governedFile,
      id: buildDeclarationId(governedFile, nameNode.getText(), classification.declarationKind, statement.getStartLineNumber()),
      isExported: statement.isExported() || exportedNodeKeys.has(buildDeclarationNodeKey(statement)),
      isRuntimeValue: classification.isRuntimeValue,
      isTypeOnly: classification.isTypeOnly,
      name: nameNode.getText(),
      nameNode,
    }];
  }

  if (!Node.isVariableStatement(statement)) {
    return [];
  }
  return statement.getDeclarations().flatMap((declaration) => {
    const classification = classifyZombieDeclaration(declaration);
    const nameNode = getZombieDeclarationNameNode(declaration);
    if (!nameNode) {
      return [];
    }
    return [{
      declaration,
      declarationKind: classification.declarationKind,
      governedFile,
      id: buildDeclarationId(governedFile, nameNode.getText(), classification.declarationKind, declaration.getStartLineNumber()),
      isExported: statement.isExported() || exportedNodeKeys.has(buildDeclarationNodeKey(declaration)),
      isRuntimeValue: classification.isRuntimeValue,
      isTypeOnly: classification.isTypeOnly,
      name: nameNode.getText(),
      nameNode,
    }];
  });
};

const collectExportedNodeKeys = (symbolGraph: ZombieSymbolGraph): Set<string> => {
  const exportedNodeKeys = new Set<string>();
  for (const exportSymbols of symbolGraph.exportsByFile.values()) {
    for (const exportSymbol of exportSymbols) {
      exportedNodeKeys.add(buildDeclarationNodeKey(exportSymbol.declaration as Statement));
    }
  }
  return exportedNodeKeys;
};

const collectTopLevelDeclarations = (input: ZombieDeclarationLiveGraphInput): ZombieTopLevelDeclaration[] => {
  const exportedNodeKeys = collectExportedNodeKeys(input.symbolGraph);
  return input.governedFiles
    .filter((governedFile) => input.reachability.reachableFiles.has(governedFile.repoPath))
    .flatMap((governedFile) =>
      governedFile.sourceFile.getStatements().flatMap((statement) =>
        collectStatementDeclarations(governedFile, statement, exportedNodeKeys),
      ),
    );
};

const collectManifestRootDeclarationIds = (
  declarations: readonly ZombieTopLevelDeclaration[],
  manifest: ZombieExemptionManifest,
): Set<string> => {
  const rootIds = new Set<string>();
  const manifestRoots = new Set(
    manifest.externalEntryExports.map((entry) => `${entry.filePath}:${entry.exportName}`),
  );
  for (const declaration of declarations) {
    if (manifestRoots.has(`${declaration.governedFile.repoPath}:${declaration.name}`)) {
      rootIds.add(declaration.id);
    }
  }
  return rootIds;
};

const collectLawfulExportRootDeclarationIds = (
  declarations: readonly ZombieTopLevelDeclaration[],
  manifest: ZombieExemptionManifest,
): Set<string> => {
  const rootIds = new Set<string>();
  for (const declaration of declarations) {
    if (!declaration.isExported) {
      continue;
    }
    if (isLawfulZombieExport(declaration.governedFile, declaration.name, manifest)) {
      rootIds.add(declaration.id);
    }
  }
  return rootIds;
};

const collectAuditInspectionRootDeclarationIds = (
  declarations: readonly ZombieTopLevelDeclaration[],
  manifest: ZombieExemptionManifest,
): Set<string> => new Set(
  declarations
    .filter((declaration) => isLawfulAuditInspectionFile(manifest, declaration.governedFile.repoPath))
    .map((declaration) => declaration.id),
);

const collectLiveExportRootDeclarationIds = (
  declarationsByNodeKey: ReadonlyMap<string, ZombieTopLevelDeclaration>,
  input: ZombieDeclarationLiveGraphInput,
): Set<string> => {
  const rootIds = new Set<string>();
  for (const exportSymbols of input.symbolGraph.exportsByFile.values()) {
    for (const exportSymbol of exportSymbols) {
      if (!input.liveExportSymbolIds.has(exportSymbol.symbolId)) {
        continue;
      }
      const rootDeclaration = declarationsByNodeKey.get(buildDeclarationNodeKey(exportSymbol.declaration as Statement));
      if (rootDeclaration) {
        rootIds.add(rootDeclaration.id);
      }
    }
  }
  return rootIds;
};

export const buildZombieDeclarationLiveGraph = (
  input: ZombieDeclarationLiveGraphInput,
): ZombieDeclarationLiveGraph => {
  const declarations = collectTopLevelDeclarations(input);
  const declarationById = new Map(declarations.map((declaration) => [declaration.id, declaration]));
  const declarationsByNodeKey = new Map(
    declarations.map((declaration) => [buildDeclarationNodeKey(declaration.declaration as Statement), declaration]),
  );
  const callGraph = buildZombieCallGraph({
    declarations,
    reachableFiles: input.reachability.reachableFiles,
  });

  const liveDeclarationIds = new Set<string>([
    ...callGraph.rootDeclarationIdsFromTopLevelExecution,
    ...collectLiveExportRootDeclarationIds(declarationsByNodeKey, input),
    ...collectManifestRootDeclarationIds(declarations, input.manifest),
    ...collectLawfulExportRootDeclarationIds(declarations, input.manifest),
    ...collectAuditInspectionRootDeclarationIds(declarations, input.manifest),
  ]);

  const pendingDeclarationIds = [...liveDeclarationIds];
  while (pendingDeclarationIds.length > 0) {
    const currentId = pendingDeclarationIds.pop();
    if (!currentId) {
      continue;
    }
    for (const dependencyId of callGraph.referencedDeclarationIdsByDeclaration.get(currentId) ?? []) {
      if (liveDeclarationIds.has(dependencyId)) {
        continue;
      }
      liveDeclarationIds.add(dependencyId);
      pendingDeclarationIds.push(dependencyId);
    }
  }

  const deadDeclarationIds = new Set(
    declarations
      .filter((declaration) => !liveDeclarationIds.has(declaration.id))
      .map((declaration) => declaration.id),
  );

  return {
    declarations,
    deadDeclarationIds,
    declarationById,
    inboundDeclarationIdsByDeclaration: callGraph.inboundDeclarationIdsByDeclaration,
    liveDeclarationIds,
    resolutionFailures: callGraph.resolutionFailures,
  };
};
