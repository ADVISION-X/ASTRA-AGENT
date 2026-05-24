import { Node, SyntaxKind, type Node as MorphNode, type PropertyAccessExpression, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding, InspectorOutput } from "../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../shared/source-files.js";

const normalizeAuditTruthPath = (repoPath: string): string => {
  if (repoPath.startsWith("scripts/")) {
    return repoPath;
  }
  const markerIndex = repoPath.indexOf("/scripts/");
  return markerIndex >= 0 ? repoPath.slice(markerIndex + 1) : repoPath;
};

const isOwnerInspectorFile = (sourceFile: SourceFile): boolean =>
  /^scripts\/audit\/domains\/[^/]+\/inspector\.ts$/u.test(
    normalizeAuditTruthPath(getRepoSourcePath(sourceFile)),
  );

const listAuditTruthOwnerInspectorFiles = (context: InspectorContext): SourceFile[] =>
  context.project
    .getSourceFiles()
    .filter((sourceFile) => !sourceFile.isDeclarationFile() && isOwnerInspectorFile(sourceFile))
    .sort((left, right) => getRepoSourcePath(left).localeCompare(getRepoSourcePath(right)));

const isTrackedSourceTextAccess = (expression: PropertyAccessExpression): boolean => {
  if (expression.getName() !== "getText" && expression.getName() !== "getFullText") {
    return false;
  }
  return expression.getExpression().getType().getSymbol()?.getName() !== "CommentRange";
};

const findForbiddenTextVariableNames = (sourceFile: SourceFile): Set<string> => {
  const variableNames = new Set<string>();
  for (const declaration of sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    const initializer = declaration.getInitializer();
    if (!initializer || !Node.isCallExpression(initializer)) {
      continue;
    }
    const expression = initializer.getExpression();
    if (Node.isPropertyAccessExpression(expression) && isTrackedSourceTextAccess(expression)) {
      variableNames.add(declaration.getName());
    }
  }
  return variableNames;
};

const hasProjectUsage = (sourceFile: SourceFile): boolean =>
  sourceFile
    .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .some((expression) => expression.getText() === "context.project");

const isSearchMethod = (name: string): boolean => ["includes", "match", "test"].includes(name);

const receiverUsesTrackedSourceText = (receiver: MorphNode): boolean => {
  if (Node.isIdentifier(receiver)) {
    return false;
  }
  if (!Node.isCallExpression(receiver)) {
    return false;
  }
  const receiverExpression = receiver.getExpression();
  return Node.isPropertyAccessExpression(receiverExpression) && isTrackedSourceTextAccess(receiverExpression);
};

const findSourceTextJudgment = (sourceFile: SourceFile): string | undefined => {
  const forbiddenNames = findForbiddenTextVariableNames(sourceFile);
  const matchedCall = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => {
    const expression = callExpression.getExpression();
    if (!Node.isPropertyAccessExpression(expression) || !isSearchMethod(expression.getName())) {
      return false;
    }
    const receiver = expression.getExpression();
    if (Node.isIdentifier(receiver)) {
      return forbiddenNames.has(receiver.getText());
    }
    return receiverUsesTrackedSourceText(receiver);
  });
  return matchedCall?.getText();
};

const pushInspectorAstTruthFindings = (
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  inspectorFiles: readonly SourceFile[],
  lawId: string,
): void => {
  for (const inspectorFile of inspectorFiles) {
    const repoPath = getRepoSourcePath(inspectorFile);
    inspectedFiles.add(repoPath);
    if (!hasProjectUsage(inspectorFile)) {
      findings.push(
        createFinding({
          checkId: "audit-truth/inspector-project-usage",
          lawId,
          filePath: repoPath,
          message: `${repoPath} does not use context.project and cannot prove AST-first enforcement.`,
        }),
      );
    }

    const sourceTextJudgment = findSourceTextJudgment(inspectorFile);
    if (!sourceTextJudgment) {
      continue;
    }
    findings.push(
      createFinding({
        checkId: "audit-truth/source-text-judgment",
        lawId,
        filePath: repoPath,
        message: `${repoPath} uses source-text judgment ${sourceTextJudgment} on tracked ts-morph text.`,
      }),
    );
  }
};

const pushGeneratedPlanCoverageFindings = (
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  context: InspectorContext,
  inspectorFiles: readonly SourceFile[],
  lawId: string,
): void => {
  const inspectorPaths = new Set(inspectorFiles.map((inspectorFile) => getRepoSourcePath(inspectorFile)));
  const generatedPlanPaths = new Set(context.generatedPlan.map((entry) => entry.ownerInspectorPath));

  for (const inspectorPath of inspectorPaths) {
    if (generatedPlanPaths.has(inspectorPath)) {
      continue;
    }
    findings.push(
      createFinding({
        checkId: "audit-truth/missing-generated-plan-entry",
        lawId,
        filePath: inspectorPath,
        message: `${inspectorPath} exists in the project but is missing from the generated plan.`,
      }),
    );
  }

  for (const planEntry of context.generatedPlan) {
    inspectedFiles.add(planEntry.manifestPath);
    inspectedFiles.add(planEntry.ownerInspectorPath);
    if (inspectorPaths.has(planEntry.ownerInspectorPath)) {
      continue;
    }
    findings.push(
      createFinding({
        checkId: "audit-truth/orphan-generated-plan-entry",
        lawId,
        filePath: planEntry.ownerInspectorPath,
        message: `Generated plan references owner inspector ${planEntry.ownerInspectorPath} that is not present in the project.`,
      }),
    );
  }
};

const buildReportJson = (
  findings: readonly InspectorFinding[],
  inspectedFiles: readonly string[],
  inspectorFileCount: number,
  generatedPlanEntryCount: number,
) => ({
  generatedAt: new Date().toISOString(),
  status: findings.length === 0 ? "PASS" : "FAIL",
  inspectorFileCount,
  generatedPlanEntryCount,
  inspectedFiles,
  findings,
});

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  void context.project.getSourceFiles().length;
  const inspectorFiles = listAuditTruthOwnerInspectorFiles(context);
  const inspectedFiles = new Set<string>();
  const findings: InspectorFinding[] = [];
  const astTruthLawId = selectLawId(context.planEntry.lawIds, "APEX-AUDIT-TRUTH-001-V1");
  const coverageLawId = selectLawId(context.planEntry.lawIds, "APEX-AUDIT-TRUTH-002-V1");

  pushInspectorAstTruthFindings(findings, inspectedFiles, inspectorFiles, astTruthLawId);
  pushGeneratedPlanCoverageFindings(findings, inspectedFiles, context, inspectorFiles, coverageLawId);

  const sortedInspectedFiles = [...inspectedFiles].sort();
  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: sortedInspectedFiles,
    reportJson: buildReportJson(findings, sortedInspectedFiles, inspectorFiles.length, context.generatedPlan.length),
  };
};