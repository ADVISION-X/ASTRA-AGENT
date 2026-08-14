import {
  Node,
  SyntaxKind,
  type ObjectLiteralExpression,
  type PropertyAssignment,
  type SourceFile,
} from "ts-morph";

import { astIdentifierName } from "../../shared/ast-node-identity.js";
import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding, SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo, toRepoPath } from "../../shared/paths.js";

const deepResearchResultPath = "src/plugins/deep-research-analysis/deep-research-analysis.parser.ts";
const deepResearchEvidenceCheckId = "runtime-truth/deep-research-completed-contract";

const findObjectSchemaLiteral = (
  sourceFile: SourceFile,
  schemaName: string,
): ObjectLiteralExpression | undefined => {
  const initializer = sourceFile.getVariableDeclaration(schemaName)?.getInitializer();
  const objectCall = initializer?.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isPropertyAccessExpression(expression)
      && Node.isIdentifier(expression.getExpression())
      && astIdentifierName(expression.getExpression()) === "z"
      && expression.getName() === "object";
  });
  const argument = objectCall?.getArguments()[0];
  return argument && Node.isObjectLiteralExpression(argument) ? argument : undefined;
};

const findSchemaProperty = (
  schemaObject: ObjectLiteralExpression,
  propertyName: string,
): PropertyAssignment | undefined =>
  schemaObject.getProperties().find(
    (property): property is PropertyAssignment =>
      Node.isPropertyAssignment(property) && property.getName() === propertyName,
  );

const propertyHasMethodCall = (
  property: PropertyAssignment | undefined,
  methodName: string,
): boolean =>
  property !== undefined
  && property
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((callExpression) => {
      const expression = callExpression.getExpression();
      return Node.isPropertyAccessExpression(expression) && expression.getName() === methodName;
    });

const propertyHasLiteralValue = (
  property: PropertyAssignment | undefined,
  expectedValue: string,
): boolean =>
  property !== undefined
  && property
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((callExpression) => {
      const expression = callExpression.getExpression();
      const literalArgument = callExpression.getArguments()[0];
      return Node.isPropertyAccessExpression(expression)
        && expression.getName() === "literal"
        && literalArgument !== undefined
        && Node.isStringLiteral(literalArgument)
        && literalArgument.getLiteralValue() === expectedValue;
    });

const propertyIsRequired = (property: PropertyAssignment | undefined): boolean =>
  property !== undefined
  && !["optional", "nullable", "default"].some((methodName) =>
    propertyHasMethodCall(property, methodName));

export const inspectDeepResearchCompletedContract = (
  sourceFile: SourceFile,
  lawId: string,
): InspectorFinding[] => {
  const schemaObject = findObjectSchemaLiteral(sourceFile, "DeepResearchResultSchema");
  if (!schemaObject) {
    return [
      createFinding({
        checkId: deepResearchEvidenceCheckId,
        lawId,
        filePath: toRepoPath(sourceFile.getFilePath()),
        message: `${toRepoPath(sourceFile.getFilePath())} is missing DeepResearchResultSchema object truth.`,
      }),
    ];
  }
  const statusProperty = findSchemaProperty(schemaObject, "status");
  const jobStatusProperty = findSchemaProperty(schemaObject, "jobStatus");
  const finalAdjudicationProperty = findSchemaProperty(schemaObject, "finalAdjudication");
  const recordHashesProperty = findSchemaProperty(schemaObject, "recordHashes");
  const contractProblems = [
    ...(!propertyIsRequired(statusProperty) || !propertyHasLiteralValue(statusProperty, "success")
      ? ["status must be the required literal success"]
      : []),
    ...(!propertyIsRequired(jobStatusProperty) || !propertyHasLiteralValue(jobStatusProperty, "completed")
      ? ["jobStatus must be the required literal completed"]
      : []),
    ...(!propertyIsRequired(finalAdjudicationProperty)
      ? ["finalAdjudication must be present and required"]
      : []),
    ...(!propertyIsRequired(recordHashesProperty)
      ? ["recordHashes must be present and required"]
      : []),
  ];
  if (contractProblems.length === 0) {
    return [];
  }
  return [
    createFinding({
      checkId: deepResearchEvidenceCheckId,
      lawId,
      filePath: toRepoPath(sourceFile.getFilePath()),
      message: `${toRepoPath(sourceFile.getFilePath())} has an invalid completed Deep Research evidence contract: ${contractProblems.join("; ")}.`,
    }),
  ];
};

const missingSourceFinding = (
  lawId: string,
  repoPath: string,
): InspectorFinding =>
  createFinding({
      checkId: "runtime-truth/source-missing",
      lawId,
      filePath: repoPath,
      message: `${repoPath} is missing from the audit project.`,
    });

const inspectDomainEvaluation = (context: InspectorContext, lawId: string) => {
  const inspectedFiles = [deepResearchResultPath];
  const deepResearchSource = context.project.getSourceFile(resolveFromRepo(deepResearchResultPath));
  return {
    evidenceRefs: inspectedFiles,
    findings: [
      ...(deepResearchSource ? [] : [missingSourceFinding(lawId, deepResearchResultPath)]),
      ...(deepResearchSource
        ? inspectDeepResearchCompletedContract(deepResearchSource, lawId)
        : [createFinding({
            checkId: deepResearchEvidenceCheckId,
            lawId,
            filePath: deepResearchResultPath,
            message: `${deepResearchResultPath} is unavailable, so its completed-evidence contract could not execute.`,
          })]),
    ],
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  if (!context.checks) throw new Error("runtime-truth requires a runner-owned check session.");
  const lawId = selectLawId(context.planEntry.lawIds, "APEX-RUNTIME-TRUTH-001-V1");
  const inspectedFiles = [deepResearchResultPath];
  const evaluation = await context.checks.runAll(() => {
    const ownerEvaluation = inspectDomainEvaluation(context, lawId);
    return { findings: ownerEvaluation.findings, evidenceRefs: ownerEvaluation.evidenceRefs };
  });
  const findings = evaluation.findings;

  return context.checks.output({
    reportJson: {
      generatedAt: new Date().toISOString(),
      status: findings.length === 0 ? "PASS" : "FAIL",
      inspectedFiles,
      findings,
    },
  });
};
