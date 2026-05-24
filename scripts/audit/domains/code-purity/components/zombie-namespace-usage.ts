import { Node } from "ts-morph";

import type { ZombieModuleGraph } from "./zombie-module-graph.js";
import {
  isLawfulDynamicNamespaceConsumer,
  type ZombieExemptionManifest,
} from "./zombie-exemption-manifest.js";

export type ZombieNamespacePropertyUsage = {
  consumerFilePath: string;
  line: number;
  propertyName: string;
  targetFilePath: string;
};

export type ZombieNamespaceDynamicUsage = {
  consumerFilePath: string;
  line: number;
  sourceText: string;
  targetFilePath: string;
};

export type ZombieNamespaceUsageReport = {
  dynamicUsages: ZombieNamespaceDynamicUsage[];
  propertyUsages: ZombieNamespacePropertyUsage[];
};

const findNamespaceImportNode = (
  moduleGraph: ZombieModuleGraph,
  sourcePath: string,
  localName: string,
  targetPath: string,
) => {
  const sourceFile = moduleGraph.filesByPath.get(sourcePath)?.sourceFile;
  if (!sourceFile) {
    return undefined;
  }

  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    const namespaceImport = importDeclaration.getNamespaceImport();
    if (!namespaceImport || namespaceImport.getText() !== localName) {
      continue;
    }
    const targetFile = importDeclaration.getModuleSpecifierSourceFile();
    if (targetFile && moduleGraph.filesByPath.has(targetPath) && moduleGraph.filesByPath.get(targetPath)?.sourceFile === targetFile) {
      return namespaceImport;
    }
  }

  return undefined;
};

export const scanZombieNamespaceUsage = (input: {
  manifest: ZombieExemptionManifest;
  moduleGraph: ZombieModuleGraph;
  reachableFiles: ReadonlySet<string>;
}): ZombieNamespaceUsageReport => {
  const propertyUsages: ZombieNamespacePropertyUsage[] = [];
  const dynamicUsages: ZombieNamespaceDynamicUsage[] = [];

  for (const edge of input.moduleGraph.importEdges) {
    if (!edge.namespaceLocalName || !input.reachableFiles.has(edge.sourcePath)) {
      continue;
    }
    const namespaceImportNode = findNamespaceImportNode(
      input.moduleGraph,
      edge.sourcePath,
      edge.namespaceLocalName,
      edge.targetPath,
    );
    if (!namespaceImportNode) {
      continue;
    }
    for (const referenceNode of namespaceImportNode.findReferencesAsNodes()) {
      if (referenceNode === namespaceImportNode) {
        continue;
      }
      const parent = referenceNode.getParent();
      if (parent && Node.isPropertyAccessExpression(parent) && parent.getExpression() === referenceNode) {
        propertyUsages.push({
          consumerFilePath: edge.sourcePath,
          line: referenceNode.getStartLineNumber(),
          propertyName: parent.getName(),
          targetFilePath: edge.targetPath,
        });
        continue;
      }
      if (parent && Node.isElementAccessExpression(parent) && parent.getExpression() === referenceNode) {
        const argument = parent.getArgumentExpression();
        if (argument && (Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument))) {
          propertyUsages.push({
            consumerFilePath: edge.sourcePath,
            line: referenceNode.getStartLineNumber(),
            propertyName: argument.getLiteralValue(),
            targetFilePath: edge.targetPath,
          });
          continue;
        }
      }
      if (isLawfulDynamicNamespaceConsumer(input.manifest, edge.sourcePath, edge.targetPath)) {
        continue;
      }
      dynamicUsages.push({
        consumerFilePath: edge.sourcePath,
        line: referenceNode.getStartLineNumber(),
        sourceText: referenceNode.getParent()?.getText() ?? referenceNode.getText(),
        targetFilePath: edge.targetPath,
      });
    }
  }

  return {
    dynamicUsages,
    propertyUsages,
  };
};