import { Node, type ImportDeclaration, type SourceFile, type TypeChecker } from "ts-morph";

import { createFinding, createPhase, toRepoRelativePath, type Finding, type InspectorPhase } from "./inspection-core.js";
import { visualTargetInspectionConstants as config } from "./inspection-constants.js";

export { canUseDateInFile, getCommentEscapeMarkers, getDynamicImportEscapes, getIllegalDateNodes, getRequireEscapes, getUnknownCastEscapes } from "./inspection-escape-helpers.js";
export { getVisualTargetSourceFiles, getZodShapePropertyNames, hasCoordinateSpaceExclusion, hasWildcardExport } from "./inspection-source-helpers.js";

export type AttackOutcome = { findings: Finding[]; phase: InspectorPhase };

export const toLine = (node: Node | undefined): number => node?.getStartLineNumber() ?? 1;

export const toRootRelative = (sourceFile: SourceFile): string => toRepoRelativePath(sourceFile.getFilePath());

export const createViolation = (input: {
  lawId: string;
  file: string;
  line?: number;
  severity?: "error" | "fatal";
  message: string;
  detail?: string | undefined;
  hint?: string | undefined;
}): Finding => {
  return createFinding({
    lawId: input.lawId,
    file: input.file,
    line: input.line ?? 1,
    severity: input.severity ?? "error",
    message: input.message,
    ...(input.detail === undefined ? {} : { detail: input.detail }),
    ...(input.hint === undefined ? {} : { hint: input.hint }),
  });
};

export const createAttackPhase = (name: string, findings: Finding[], passSummary: string, failSummary: string): InspectorPhase => {
  const passed = findings.length === 0;
  return createPhase(name, passed ? "PASS" : "CODE VIOLATION", passed, passed ? passSummary : failSummary);
};

export const extractImportResolutionDetail = (typeChecker: TypeChecker, declaration: ImportDeclaration): string | undefined => {
  const targetNode = declaration.getDefaultImport() ?? declaration.getNamespaceImport() ?? declaration.getNamedImports()[0]?.getNameNode();
  if (!targetNode) {
    return undefined;
  }

  const symbol = typeChecker.getSymbolAtLocation(targetNode);
  if (!symbol) {
    return undefined;
  }

  const aliasedSymbol = symbol.getAliasedSymbol();
  const referenceNodes = Node.isIdentifier(targetNode) ? targetNode.findReferencesAsNodes() : [];
  const referencePaths = [...new Set<string>(referenceNodes.map((node) => toRootRelative(node.getSourceFile())))].sort((left, right) => left.localeCompare(right));
  return `symbol=${symbol.getName()} aliased=${aliasedSymbol?.getName() ?? "none"} refs=${referencePaths.join(", ")}`;
};