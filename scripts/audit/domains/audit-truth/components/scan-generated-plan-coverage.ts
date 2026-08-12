import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";
import { isOwnerInspectorRepoPath, normalizeAuditTruthPath } from "./audit-truth-scope.js";

const orchestrationPaths = new Set([
  "scripts/audit/ci-full.ts",
  "scripts/audit/ci-full-phase-plan.ts",
]);

const isFilteredPlanCall = (sourceFile: SourceFile): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    if (Node.isIdentifier(expression)) {
      return expression.getSymbol()?.getDeclarations().some((declaration) =>
        Node.isImportSpecifier(declaration)
        && declaration.getName() === "runGeneratedPlanFiltered"
        && declaration.getImportDeclaration().getModuleSpecifierValue().includes("run-generated-plan")) ?? false;
    }
    if (!Node.isPropertyAccessExpression(expression)
      || expression.getName() !== "runGeneratedPlanFiltered") return false;
    const receiver = expression.getExpression();
    return Node.isIdentifier(receiver)
      && (receiver.getSymbol()?.getDeclarations().some((declaration) =>
        Node.isNamespaceImport(declaration)
        && declaration.getFirstAncestorByKind(SyntaxKind.ImportDeclaration)
          ?.getModuleSpecifierValue().includes("run-generated-plan")) ?? false);
  });

const hasFilteredPlanCommandLiteral = (sourceFile: SourceFile): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).some((literal) =>
    literal.getLiteralText().includes("runGeneratedPlanFiltered"));

const listOwnerInspectorPaths = (context: InspectorContext): string[] =>
  context.project
    .getSourceFiles()
    .filter((sourceFile) => !sourceFile.isDeclarationFile())
    .map((sourceFile) => getRepoSourcePath(sourceFile))
    .filter((repoPath) => isOwnerInspectorRepoPath(repoPath))
    .sort((left, right) => left.localeCompare(right));

export const scanGeneratedPlanCoverage = (input: {
  context: InspectorContext;
  inspectedFiles: Set<string>;
  lawId: string;
}): { findings: InspectorFinding[] } => {
  const findings: InspectorFinding[] = [];
  const inspectorPaths = new Set(listOwnerInspectorPaths(input.context));
  const generatedPlanPaths = new Set(input.context.generatedPlan.map((entry) => entry.ownerInspectorPath));

  for (const sourceFile of input.context.project.getSourceFiles()) {
    const repoPath = getRepoSourcePath(sourceFile);
    if (!orchestrationPaths.has(normalizeAuditTruthPath(repoPath))) {
      continue;
    }
    input.inspectedFiles.add(repoPath);
    if (!isFilteredPlanCall(sourceFile) && !hasFilteredPlanCommandLiteral(sourceFile)) {
      continue;
    }
    findings.push(
      createFinding({
        checkId: "audit-truth/ci-owner-special-case",
        lawId: input.lawId,
        filePath: repoPath,
        message: `${repoPath} dispatches a filtered generated plan instead of the complete owner-neutral plan.`,
      }),
    );
  }

  for (const inspectorPath of inspectorPaths) {
    input.inspectedFiles.add(inspectorPath);
    if (generatedPlanPaths.has(inspectorPath)) {
      continue;
    }
    findings.push(
      createFinding({
        checkId: "audit-truth/missing-generated-plan-entry",
        lawId: input.lawId,
        filePath: inspectorPath,
        message: `${inspectorPath} exists in the project but is missing from the generated plan.`,
      }),
    );
  }

  for (const planEntry of input.context.generatedPlan) {
    input.inspectedFiles.add(planEntry.manifestPath);
    input.inspectedFiles.add(planEntry.ownerInspectorPath);
    if (inspectorPaths.has(planEntry.ownerInspectorPath)) {
      continue;
    }
    findings.push(
      createFinding({
        checkId: "audit-truth/orphan-generated-plan-entry",
        lawId: input.lawId,
        filePath: planEntry.ownerInspectorPath,
        message: `Generated plan references owner inspector ${planEntry.ownerInspectorPath} that is not present in the project.`,
      }),
    );
  }

  return { findings };
};
import { Node, SyntaxKind, type SourceFile } from "ts-morph";
