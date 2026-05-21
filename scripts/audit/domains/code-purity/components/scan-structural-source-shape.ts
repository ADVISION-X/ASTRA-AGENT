import { Node, SyntaxKind } from "ts-morph";

import { selectLawId } from "../../../shared/finding-utils.js";
import type { GovernedFile } from "./code-purity-governed-files.js";
import type { InventoryFindingCollector } from "./code-purity-finding-collector.js";
import { collectDirectiveComments, countCrossOwnerImports } from "./structural-metrics.js";

const bannedPathTokenPattern = /(bridge|compatibility|legacy|shadow|fallback|universal-agent|planner|next-action|action-plan|mission-loop|nerve-bus|commander-console)/u;

const pushSourceAtomicityFinding = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  checkId: string,
  lawId: string,
  reason: string,
  remediation: string,
  message: string,
): void => {
  collector.push(
    {
      checkId,
      filePath: governedFile.repoPath,
      lawId,
      owner: governedFile.owner,
      reason,
      remediation,
      role: governedFile.role,
      verificationCommand: "npm run ci:full",
    },
    message,
  );
};

export const scanStructuralSourceShape = (
  governedFile: GovernedFile,
  lawIds: readonly string[],
  collector: InventoryFindingCollector,
): void => {
  const sourceAtomicityLawId = selectLawId(lawIds, "APEX-CODE-PURITY-001-V1");
  const typeEscapeLawId = selectLawId(lawIds, "APEX-CODE-PURITY-008-V1");
  const bridgeLawId = selectLawId(lawIds, "APEX-CODE-PURITY-010-V1");

  if (bannedPathTokenPattern.test(governedFile.repoPath)) {
    pushSourceAtomicityFinding(
      collector,
      governedFile,
      "code-purity/banned-active-path",
      bridgeLawId,
      "Path contains a banned bridge/legacy token.",
      "Delete the bridge/legacy surface or rename it into the single live owner path.",
      `${governedFile.repoPath} contains a banned bridge/legacy/planner path token.`,
    );
  }

  if (governedFile.lineCount > governedFile.budget.hardLimit) {
    const budgetState = governedFile.lineCount > governedFile.budget.disaster ? "disaster" : "hard-limit";
    pushSourceAtomicityFinding(
      collector,
      governedFile,
      `code-purity/file-budget-${budgetState}`,
      sourceAtomicityLawId,
      `${governedFile.budget.label} has ${governedFile.lineCount} lines and exceeds ${budgetState === "disaster" ? `disaster ${governedFile.budget.disaster}` : `hard limit ${governedFile.budget.hardLimit}`}.`,
      budgetState === "disaster" ? "Physically split the file before adding or preserving feature logic." : "Split or reduce the file by runtime role until it falls under the hard limit.",
      `${governedFile.repoPath} has ${governedFile.lineCount} lines and exceeds the ${governedFile.budget.label} ${budgetState} budget.`,
    );
  }

  const importDeclarations = governedFile.sourceFile.getImportDeclarations();
  const uniqueImportSources = new Set(importDeclarations.map((declaration) => declaration.getModuleSpecifierValue()));
  const namedExports = governedFile.sourceFile.getExportedDeclarations().size;
  const crossOwnerImports = countCrossOwnerImports(governedFile);
  const importShapeChecks = [
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
    namedExports > 10
      ? {
          checkId: "code-purity/named-export-budget",
          reason: `Named export count ${namedExports} exceeds hard limit 10.`,
          message: `${governedFile.repoPath} exports ${namedExports} symbols and exceeds the hard limit 10.`,
          remediation: "Reduce the export surface or split the file into explicit owner-local contracts.",
        }
      : null,
  ].filter((check): check is NonNullable<typeof check> => check !== null);
  for (const check of importShapeChecks) {
    pushSourceAtomicityFinding(collector, governedFile, check.checkId, sourceAtomicityLawId, check.reason, check.remediation, check.message);
  }

  const exportStar = governedFile.sourceFile.getExportDeclarations().find((declaration) => declaration.getNamedExports().length === 0 && declaration.getModuleSpecifierValue() !== undefined);
  if (exportStar) {
    pushSourceAtomicityFinding(
      collector,
      governedFile,
      "code-purity/export-star",
      sourceAtomicityLawId,
      "export * hides the real ownership boundary.",
      "Replace export * with explicit public exports.",
      `${governedFile.repoPath} uses export * and hides ownership boundaries.`,
    );
  }
  if (governedFile.sourceFile.getDefaultExportSymbol()) {
    pushSourceAtomicityFinding(
      collector,
      governedFile,
      "code-purity/default-export",
      sourceAtomicityLawId,
      "default export is forbidden in active source unless a framework requires it.",
      "Switch the file to explicit named exports.",
      `${governedFile.repoPath} uses a default export in active source.`,
    );
  }
  const requireCall = governedFile.sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => callExpression.getExpression().getText() === "require");
  if (requireCall) {
    pushSourceAtomicityFinding(
      collector,
      governedFile,
      "code-purity/require-call",
      sourceAtomicityLawId,
      "CommonJS require remains in active source.",
      "Replace require with explicit ESM import syntax.",
      `${governedFile.repoPath} uses require instead of ESM imports.`,
    );
  }

  const anyKeyword = governedFile.sourceFile.getDescendantsOfKind(SyntaxKind.AnyKeyword)[0];
  if (anyKeyword) {
    pushSourceAtomicityFinding(
      collector,
      governedFile,
      "code-purity/any-keyword",
      typeEscapeLawId,
      `any escape appears near line ${anyKeyword.getStartLineNumber()}.`,
      "Replace any with a schema-validated unknown or a specific contract type.",
      `${governedFile.repoPath} contains an any escape near line ${anyKeyword.getStartLineNumber()}.`,
    );
  }
  const anyAssertion = governedFile.sourceFile.getDescendantsOfKind(SyntaxKind.AsExpression).find((expression) => expression.getTypeNode()?.getKind() === SyntaxKind.AnyKeyword);
  if (anyAssertion) {
    pushSourceAtomicityFinding(
      collector,
      governedFile,
      "code-purity/as-any",
      typeEscapeLawId,
      `as any appears near line ${anyAssertion.getStartLineNumber()}.`,
      "Replace as any with validated narrowing or a lawful type contract.",
      `${governedFile.repoPath} uses as any near line ${anyAssertion.getStartLineNumber()}.`,
    );
  }
  const unknownAsChain = governedFile.sourceFile.getDescendantsOfKind(SyntaxKind.AsExpression).find((expression) => expression.getTypeNode()?.getKind() === SyntaxKind.UnknownKeyword && Node.isAsExpression(expression.getParent()));
  if (unknownAsChain) {
    pushSourceAtomicityFinding(
      collector,
      governedFile,
      "code-purity/as-unknown-as",
      typeEscapeLawId,
      `as unknown as appears near line ${unknownAsChain.getStartLineNumber()}.`,
      "Replace double assertion with schema validation or an explicit narrowing guard.",
      `${governedFile.repoPath} uses as unknown as near line ${unknownAsChain.getStartLineNumber()}.`,
    );
  }
  for (const directive of collectDirectiveComments(governedFile)) {
    pushSourceAtomicityFinding(
      collector,
      governedFile,
      "code-purity/directive-comment",
      typeEscapeLawId,
      `suppression directive ${directive.text.trim()} appears near line ${directive.line}.`,
      "Repair the type or lint defect directly instead of suppressing it.",
      `${governedFile.repoPath} contains a suppression directive near line ${directive.line}.`,
    );
  }
};