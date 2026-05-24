import { Node, type Identifier, type ObjectLiteralExpression } from "ts-morph";

import type { GovernedFile } from "./code-purity-governed-files.js";
import type { ZombieModuleGraph } from "./zombie-module-graph.js";
import type { ZombieSymbolGraph } from "./zombie-symbol-graph.js";

export type ZombieObjectBagEntry = {
  localSymbolName: string | null;
  propertyName: string;
};

export type ZombieObjectBag = {
  bagId: string;
  entries: ZombieObjectBagEntry[];
  exportName: string;
  governedFile: GovernedFile;
  nameNode: Identifier;
};

const buildBagId = (governedFile: GovernedFile, exportName: string, line: number): string =>
  `${governedFile.repoPath}:${exportName}:${line}`;

const collectObjectLiteralEntries = (initializer: ObjectLiteralExpression): ZombieObjectBagEntry[] =>
  initializer.getProperties().flatMap((property) => {
    if (Node.isShorthandPropertyAssignment(property)) {
      return [{
        localSymbolName: property.getName(),
        propertyName: property.getName(),
      }];
    }
    if (!Node.isPropertyAssignment(property)) {
      return [];
    }
    const valueNode = property.getInitializer();
    return [{
      localSymbolName: valueNode && Node.isIdentifier(valueNode) ? valueNode.getText() : null,
      propertyName: property.getName(),
    }];
  });

export const collectZombieObjectBags = (input: {
  liveExportSymbolIds: ReadonlySet<string>;
  moduleGraph: ZombieModuleGraph;
  symbolGraph: ZombieSymbolGraph;
}): ZombieObjectBag[] => {
  const bags: ZombieObjectBag[] = [];
  for (const [filePath, governedFile] of input.moduleGraph.filesByPath.entries()) {
    const symbolExports = governedFile.sourceFile.getExportedDeclarations();
    const liveExportSymbols = input.symbolGraph.exportsByFile.get(filePath) ?? [];
    for (const [exportName, declarations] of symbolExports) {
      const matchingDeclaration = declarations.find((declaration) => {
        if (!Node.isVariableDeclaration(declaration)) {
          return false;
        }
        const initializer = declaration.getInitializer();
        return initializer !== undefined && Node.isObjectLiteralExpression(initializer);
      });
      if (!matchingDeclaration || !Node.isVariableDeclaration(matchingDeclaration)) {
        continue;
      }
      const nameNode = matchingDeclaration.getNameNode();
      const matchingSymbol = liveExportSymbols.find(
        (exportSymbol) => exportSymbol.exportName === exportName && input.liveExportSymbolIds.has(exportSymbol.symbolId),
      );
      const initializer = matchingDeclaration.getInitializer();
      if (!governedFile || !matchingSymbol || !nameNode || !Node.isIdentifier(nameNode) || !initializer || !Node.isObjectLiteralExpression(initializer)) {
        continue;
      }
      bags.push({
        bagId: buildBagId(governedFile, exportName, matchingDeclaration.getStartLineNumber()),
        entries: collectObjectLiteralEntries(initializer),
        exportName,
        governedFile,
        nameNode,
      });
    }
  }
  return bags;
};