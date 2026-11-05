import { Node, SyntaxKind, type Identifier } from "ts-morph";

import { selectLawId } from "../../../shared/finding-utils.js";
import type { GovernedFile } from "./code-purity-governed-files.js";
import type { InventoryFindingCollector } from "./code-purity-finding-collector.js";

const bannedPathTokens = [
  "bridge",
  "compatibility",
  "legacy",
  "shadow",
  "fallback",
  "universal-agent",
  "planner",
  "next-action",
  "action-plan",
  "mission-loop",
  "nerve-bus",
  "commander-console",
] as const;

const pathHasBannedToken = (repoPath: string): boolean => {
  const normalized = repoPath.toLowerCase();
  return bannedPathTokens.some((token) => normalized.includes(token));
};

const pushSourceAtomicityFinding = (
  collector: InventoryFindingCollector,
  input: {
    checkId: string;
    governedFile: GovernedFile;
    evidenceMode: "static.ast" | "static.dependency" | "static.filesystem";
    lawId: string;
    reason: string;
    remediation: string;
    message: string;
  },
): void => {
  collector.push(
    {
      checkId: input.checkId,
      evidenceMode: input.evidenceMode,
      filePath: input.governedFile.repoPath,
      lawId: input.lawId,
      owner: input.governedFile.owner,
      reason: input.reason,
      remediation: input.remediation,
      role: input.governedFile.role,
      verificationCommand: "npm run quality:check -- READY",
    },
    input.message,
  );
};

const scanPathBudget = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  sourceAtomicityLawId: string,
  bridgeLawId: string,
): void => {
  if (pathHasBannedToken(governedFile.repoPath)) {
    pushSourceAtomicityFinding(collector, {
      checkId: "code-purity/banned-active-path",
      evidenceMode: "static.filesystem",
      governedFile,
      lawId: bridgeLawId,
      reason: "Path contains a banned bridge/legacy token.",
      remediation: "Delete the bridge/legacy surface or rename it into the single live owner path.",
      message: `${governedFile.repoPath} contains a banned bridge/legacy/planner path token.`,
    });
  }

  if (governedFile.lineCount > governedFile.budget.maxLines) {
    pushSourceAtomicityFinding(collector, {
      checkId: "code-purity/file-budget-red-line",
      evidenceMode: "static.filesystem",
      governedFile,
      lawId: sourceAtomicityLawId,
      reason: `${governedFile.budget.label} has ${governedFile.lineCount} lines and exceeds red line ${governedFile.budget.maxLines}.`,
      remediation: "Split or reduce the file by owner and runtime role until it falls under the red line.",
      message: `${governedFile.repoPath} has ${governedFile.lineCount} lines and exceeds the ${governedFile.budget.label} red line.`,
    });
  }
};

const scanImportExportBudgets = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  sourceAtomicityLawId: string,
): void => {
  scanImportBudgets(collector, governedFile, sourceAtomicityLawId);
  scanExportShape(collector, governedFile, sourceAtomicityLawId);
};

const scanImportBudgets = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  sourceAtomicityLawId: string,
): void => {
  for (const check of collectImportBudgetChecks(governedFile)) {
    pushSourceAtomicityFinding(collector, {
      checkId: check.checkId,
      evidenceMode: "static.dependency",
      governedFile,
      lawId: sourceAtomicityLawId,
      reason: check.reason,
      remediation: check.remediation,
      message: check.message,
    });
  }
};

const collectImportBudgetChecks = (
  governedFile: GovernedFile,
): Array<{
  checkId: string;
  reason: string;
  remediation: string;
  message: string;
}> => {
  const importDeclarations = governedFile.sourceFile.getImportDeclarations();
  const uniqueImportSources = new Set(importDeclarations.map((declaration) => declaration.getModuleSpecifierValue()));
  const exhaustiveRegistry = isExhaustiveChildHandlerRegistry(governedFile);
  const declarationLimit = exhaustiveRegistry ? 30 : 28;
  const sourceLimit = exhaustiveRegistry ? 30 : 24;
  return [
    importDeclarations.length > declarationLimit
      ? {
          checkId: "code-purity/import-declaration-budget",
          reason: `Import declaration count ${importDeclarations.length} exceeds red line ${declarationLimit}.`,
          message: `${governedFile.repoPath} declares ${importDeclarations.length} imports and exceeds the red line ${declarationLimit}.`,
          remediation: "Split the file by owner or role and collapse broad import surfaces.",
        }
      : null,
    uniqueImportSources.size > sourceLimit
      ? {
          checkId: "code-purity/import-source-budget",
          reason: `Import source count ${uniqueImportSources.size} exceeds red line ${sourceLimit}.`,
          message: `${governedFile.repoPath} imports ${uniqueImportSources.size} unique sources and exceeds the red line ${sourceLimit}.`,
          remediation: "Split the file by runtime role and keep only the owner-local dependencies in each slice.",
        }
      : null,
  ].filter((check): check is NonNullable<typeof check> => check !== null);
};

const childHandlerImportPattern = /^\.\/children\/([^/]+)\/handler\.js$/;

const childHandlerEntries = (governedFile: GovernedFile): Map<string, string> | null => {
  const imports = governedFile.sourceFile.getImportDeclarations();
  const handlerImports = imports.filter((declaration) => childHandlerImportPattern.test(declaration.getModuleSpecifierValue()));
  if (handlerImports.length < 25 || handlerImports.length > 28 || imports.length > 30) return null;
  if (imports.some((declaration) => !childHandlerImportPattern.test(declaration.getModuleSpecifierValue()) && !declaration.isTypeOnly())) return null;
  const handlerEntries = new Map<string, string>();
  for (const declaration of handlerImports) {
    const match = childHandlerImportPattern.exec(declaration.getModuleSpecifierValue());
    const namedImports = declaration.getNamedImports();
    if (!match || namedImports.length !== 1 || declaration.isTypeOnly()) return null;
    handlerEntries.set(match[1]!, namedImports[0]!.getName());
  }
  return handlerEntries.size === handlerImports.length ? handlerEntries : null;
};

const exportedHandlerMap = (governedFile: GovernedFile): Map<string, string> | null => {
  const exportedStatements = governedFile.sourceFile.getVariableStatements().filter((statement) => statement.isExported());
  if (exportedStatements.length !== 1 || exportedStatements[0]!.getDeclarations().length !== 1) return null;
  const initializer = exportedStatements[0]!.getDeclarations()[0]!.getInitializer();
  const objectLiteral = initializer?.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)[0];
  if (!objectLiteral) return null;
  const mappedHandlers = new Map<string, string>();
  for (const property of objectLiteral.getProperties()) {
    if (!Node.isPropertyAssignment(property)) return null;
    mappedHandlers.set(property.getName(), property.getInitializer()?.getText() ?? "");
  }
  return mappedHandlers.size === objectLiteral.getProperties().length ? mappedHandlers : null;
};

const isExhaustiveChildHandlerRegistry = (governedFile: GovernedFile): boolean => {
  if (!governedFile.repoPath.endsWith("/handler-registry.ts")) return false;
  const handlerEntries = childHandlerEntries(governedFile);
  const mappedHandlers = exportedHandlerMap(governedFile);
  return handlerEntries !== null && mappedHandlers !== null && mappedHandlers.size === handlerEntries.size
    && [...handlerEntries].every(([childId, handler]) => mappedHandlers.get(childId) === handler);
};

const scanExportShape = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  sourceAtomicityLawId: string,
): void => {
  scanNamedExportBudget(collector, governedFile, sourceAtomicityLawId);
  scanExportSurfaceEscapes(collector, governedFile, sourceAtomicityLawId);
};

const scanNamedExportBudget = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  sourceAtomicityLawId: string,
): void => {
  const namedExports = governedFile.sourceFile.getExportedDeclarations().size;
  if (namedExports > 24) {
    pushSourceAtomicityFinding(collector, {
      checkId: "code-purity/named-export-budget",
      evidenceMode: "static.dependency",
      governedFile,
      lawId: sourceAtomicityLawId,
      reason: `Named export count ${namedExports} exceeds red line 24.`,
      remediation: "Reduce the export surface or split the file into explicit owner-local contracts.",
      message: `${governedFile.repoPath} exports ${namedExports} symbols and exceeds the red line 24.`,
    });
  }
};

const scanExportSurfaceEscapes = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  sourceAtomicityLawId: string,
): void => {
  scanExportStar(collector, governedFile, sourceAtomicityLawId);
  scanDefaultExport(collector, governedFile, sourceAtomicityLawId);
  scanRequireCall(collector, governedFile, sourceAtomicityLawId);
};

const scanExportStar = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  sourceAtomicityLawId: string,
): void => {
  const exportStar = governedFile.sourceFile.getExportDeclarations().find((declaration) => declaration.getNamedExports().length === 0 && declaration.getModuleSpecifierValue() !== undefined);
  if (exportStar) {
    pushSourceAtomicityFinding(collector, {
      checkId: "code-purity/export-star",
      evidenceMode: "static.dependency",
      governedFile,
      lawId: sourceAtomicityLawId,
      reason: "export * hides the real ownership boundary.",
      remediation: "Replace export * with explicit public exports.",
      message: `${governedFile.repoPath} uses export * and hides ownership boundaries.`,
    });
  }
};

const scanDefaultExport = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  sourceAtomicityLawId: string,
): void => {
  if (governedFile.sourceFile.getDefaultExportSymbol()) {
    pushSourceAtomicityFinding(collector, {
      checkId: "code-purity/default-export",
      evidenceMode: "static.dependency",
      governedFile,
      lawId: sourceAtomicityLawId,
      reason: "default export is forbidden in active source unless a framework requires it.",
      remediation: "Switch the file to explicit named exports.",
      message: `${governedFile.repoPath} uses a default export in active source.`,
    });
  }
};

const isNodeRequireReference = (identifier: Identifier): boolean => {
  const symbol = identifier.getSymbol();
  const resolved = symbol?.isAlias() ? symbol.getAliasedSymbol() : symbol;
  if (resolved?.getName() !== "require") return false;
  return resolved.getDeclarations().some((declaration) =>
    Node.isVariableDeclaration(declaration)
    && declaration.getSourceFile().isDeclarationFile()
    && declaration.getSourceFile().getFilePath().endsWith("/node_modules/@types/node/module.d.ts"));
};

const scanRequireCall = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  sourceAtomicityLawId: string,
): void => {
  const requireReference = governedFile.sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)
    .find(isNodeRequireReference);
  if (requireReference) {
    pushSourceAtomicityFinding(collector, {
      checkId: "code-purity/require-call",
      evidenceMode: "static.dependency",
      governedFile,
      lawId: sourceAtomicityLawId,
      reason: "CommonJS require remains in active source.",
      remediation: "Replace require with explicit ESM import syntax.",
      message: `${governedFile.repoPath} uses require instead of ESM imports.`,
    });
  }
};

export const scanStructuralFilesystemShape = (
  governedFile: GovernedFile,
  lawIds: readonly string[],
  collector: InventoryFindingCollector,
): void => {
  const sourceAtomicityLawId = selectLawId(lawIds, "LAW-CODE-PURITY-001-V1");
  const bridgeLawId = selectLawId(lawIds, "LAW-CODE-PURITY-001-V1");
  scanPathBudget(collector, governedFile, sourceAtomicityLawId, bridgeLawId);
};

export const scanStructuralDependencyShape = (
  governedFile: GovernedFile,
  lawIds: readonly string[],
  collector: InventoryFindingCollector,
): void => {
  const sourceAtomicityLawId = selectLawId(lawIds, "LAW-CODE-PURITY-001-V1");
  scanImportExportBudgets(collector, governedFile, sourceAtomicityLawId);
};
