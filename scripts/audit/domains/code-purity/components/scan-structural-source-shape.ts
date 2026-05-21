import { Node, SyntaxKind } from "ts-morph";

import { selectLawId } from "../../../shared/finding-utils.js";
import type { GovernedFile } from "./code-purity-governed-files.js";
import type { InventoryFindingCollector } from "./code-purity-finding-collector.js";
import { collectDirectiveComments, countCrossOwnerImports } from "./structural-metrics.js";

const bannedPathTokenPattern = /(bridge|compatibility|legacy|shadow|fallback|universal-agent|planner|next-action|action-plan|mission-loop|nerve-bus|commander-console)/u;

const pushSourceAtomicityFinding = (
  collector: InventoryFindingCollector,
  input: {
    checkId: string;
    governedFile: GovernedFile;
    lawId: string;
    reason: string;
    remediation: string;
    message: string;
  },
): void => {
  collector.push(
    {
      checkId: input.checkId,
      filePath: input.governedFile.repoPath,
      lawId: input.lawId,
      owner: input.governedFile.owner,
      reason: input.reason,
      remediation: input.remediation,
      role: input.governedFile.role,
      verificationCommand: "npm run ci:full",
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
  if (bannedPathTokenPattern.test(governedFile.repoPath)) {
    pushSourceAtomicityFinding(collector, {
      checkId: "code-purity/banned-active-path",
      governedFile,
      lawId: bridgeLawId,
      reason: "Path contains a banned bridge/legacy token.",
      remediation: "Delete the bridge/legacy surface or rename it into the single live owner path.",
      message: `${governedFile.repoPath} contains a banned bridge/legacy/planner path token.`,
    });
  }

  if (governedFile.lineCount > governedFile.budget.hardLimit) {
    const budgetState = governedFile.lineCount > governedFile.budget.disaster ? "disaster" : "hard-limit";
    pushSourceAtomicityFinding(collector, {
      checkId: `code-purity/file-budget-${budgetState}`,
      governedFile,
      lawId: sourceAtomicityLawId,
      reason: `${governedFile.budget.label} has ${governedFile.lineCount} lines and exceeds ${budgetState === "disaster" ? `disaster ${governedFile.budget.disaster}` : `hard limit ${governedFile.budget.hardLimit}`}.`,
      remediation: budgetState === "disaster" ? "Physically split the file before adding or preserving feature logic." : "Split or reduce the file by runtime role until it falls under the hard limit.",
      message: `${governedFile.repoPath} has ${governedFile.lineCount} lines and exceeds the ${governedFile.budget.label} ${budgetState} budget.`,
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
  const crossOwnerImports = countCrossOwnerImports(governedFile);
  return [
    importDeclarations.length > 16
      ? {
          checkId: "code-purity/import-declaration-budget",
          reason: `Import declaration count ${importDeclarations.length} exceeds hard limit 16.`,
          message: `${governedFile.repoPath} declares ${importDeclarations.length} imports and exceeds the hard limit 16.`,
          remediation: "Split the file by owner or role and collapse broad import surfaces.",
        }
      : null,
    uniqueImportSources.size > 14
      ? {
          checkId: "code-purity/import-source-budget",
          reason: `Import source count ${uniqueImportSources.size} exceeds hard limit 14.`,
          message: `${governedFile.repoPath} imports ${uniqueImportSources.size} unique sources and exceeds the hard limit 14.`,
          remediation: "Split the file by runtime role and keep only the owner-local dependencies in each slice.",
        }
      : null,
    crossOwnerImports > 4
      ? {
          checkId: "code-purity/cross-owner-import-budget",
          reason: `Cross-owner import count ${crossOwnerImports} exceeds hard limit 4.`,
          message: `${governedFile.repoPath} depends on ${crossOwnerImports} cross-owner surfaces and exceeds the hard limit 4.`,
          remediation: "Move cross-owner logic back to the lawful owner or split the file at the boundary.",
        }
      : null,
  ].filter((check): check is NonNullable<typeof check> => check !== null);
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
  if (namedExports > 10) {
    pushSourceAtomicityFinding(collector, {
      checkId: "code-purity/named-export-budget",
      governedFile,
      lawId: sourceAtomicityLawId,
      reason: `Named export count ${namedExports} exceeds hard limit 10.`,
      remediation: "Reduce the export surface or split the file into explicit owner-local contracts.",
      message: `${governedFile.repoPath} exports ${namedExports} symbols and exceeds the hard limit 10.`,
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
      governedFile,
      lawId: sourceAtomicityLawId,
      reason: "default export is forbidden in active source unless a framework requires it.",
      remediation: "Switch the file to explicit named exports.",
      message: `${governedFile.repoPath} uses a default export in active source.`,
    });
  }
};

const scanRequireCall = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  sourceAtomicityLawId: string,
): void => {
  const requireCall = governedFile.sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => callExpression.getExpression().getText() === "require");
  if (requireCall) {
    pushSourceAtomicityFinding(collector, {
      checkId: "code-purity/require-call",
      governedFile,
      lawId: sourceAtomicityLawId,
      reason: "CommonJS require remains in active source.",
      remediation: "Replace require with explicit ESM import syntax.",
      message: `${governedFile.repoPath} uses require instead of ESM imports.`,
    });
  }
};

const scanTypeEscapes = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  typeEscapeLawId: string,
): void => {
  scanAssertionEscapes(collector, governedFile, typeEscapeLawId);
  scanDirectiveEscapes(collector, governedFile, typeEscapeLawId);
};

const scanAssertionEscapes = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  typeEscapeLawId: string,
): void => {
  const anyKeyword = governedFile.sourceFile.getDescendantsOfKind(SyntaxKind.AnyKeyword)[0];
  if (anyKeyword) {
    pushSourceAtomicityFinding(collector, {
      checkId: "code-purity/any-keyword",
      governedFile,
      lawId: typeEscapeLawId,
      reason: `any escape appears near line ${anyKeyword.getStartLineNumber()}.`,
      remediation: "Replace any with a schema-validated unknown or a specific contract type.",
      message: `${governedFile.repoPath} contains an any escape near line ${anyKeyword.getStartLineNumber()}.`,
    });
  }
  const anyAssertion = governedFile.sourceFile.getDescendantsOfKind(SyntaxKind.AsExpression).find((expression) => expression.getTypeNode()?.getKind() === SyntaxKind.AnyKeyword);
  if (anyAssertion) {
    pushSourceAtomicityFinding(collector, {
      checkId: "code-purity/as-any",
      governedFile,
      lawId: typeEscapeLawId,
      reason: `as any appears near line ${anyAssertion.getStartLineNumber()}.`,
      remediation: "Replace as any with validated narrowing or a lawful type contract.",
      message: `${governedFile.repoPath} uses as any near line ${anyAssertion.getStartLineNumber()}.`,
    });
  }
  const unknownAsChain = governedFile.sourceFile.getDescendantsOfKind(SyntaxKind.AsExpression).find((expression) => expression.getTypeNode()?.getKind() === SyntaxKind.UnknownKeyword && Node.isAsExpression(expression.getParent()));
  if (unknownAsChain) {
    pushSourceAtomicityFinding(collector, {
      checkId: "code-purity/as-unknown-as",
      governedFile,
      lawId: typeEscapeLawId,
      reason: `as unknown as appears near line ${unknownAsChain.getStartLineNumber()}.`,
      remediation: "Replace double assertion with schema validation or an explicit narrowing guard.",
      message: `${governedFile.repoPath} uses as unknown as near line ${unknownAsChain.getStartLineNumber()}.`,
    });
  }
};

const scanDirectiveEscapes = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  typeEscapeLawId: string,
): void => {
  for (const directive of collectDirectiveComments(governedFile)) {
    pushSourceAtomicityFinding(collector, {
      checkId: "code-purity/directive-comment",
      governedFile,
      lawId: typeEscapeLawId,
      reason: `suppression directive ${directive.text.trim()} appears near line ${directive.line}.`,
      remediation: "Repair the type or lint defect directly instead of suppressing it.",
      message: `${governedFile.repoPath} contains a suppression directive near line ${directive.line}.`,
    });
  }
};

export const scanStructuralSourceShape = (
  governedFile: GovernedFile,
  lawIds: readonly string[],
  collector: InventoryFindingCollector,
): void => {
  const sourceAtomicityLawId = selectLawId(lawIds, "APEX-CODE-PURITY-001-V1");
  const typeEscapeLawId = selectLawId(lawIds, "APEX-CODE-PURITY-008-V1");
  const bridgeLawId = selectLawId(lawIds, "APEX-CODE-PURITY-010-V1");
  scanPathBudget(collector, governedFile, sourceAtomicityLawId, bridgeLawId);
  scanImportExportBudgets(collector, governedFile, sourceAtomicityLawId);
  scanTypeEscapes(collector, governedFile, typeEscapeLawId);
};