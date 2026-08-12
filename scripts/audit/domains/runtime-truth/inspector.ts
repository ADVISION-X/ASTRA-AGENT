import { Node, SyntaxKind, type ObjectLiteralExpression, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding, SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo, toRepoPath } from "../../shared/paths.js";

const deepResearchResultPath = "src/plugins/deep-research-analysis/deep-research-analysis.parser.ts";
const facebookSchemaPath = "src/plugins/facebook-product-video-mining/facebook-product-video-mining.schema.ts";

const deepResearchEvidenceCheckId = "runtime-truth/deep-research-completed-contract";
const facebookEvidenceCheckId = "runtime-truth/facebook-completed-contract";

const evidencePropertyNames = new Set([
  "artifactRef",
  "artifactRefs",
  "evidenceRef",
  "evidenceRefs",
  "videoArtifactRef",
  "videoEvidenceRef",
  "videoEvidenceRefs",
  "videoSha256",
]);

const findObjectSchemaLiteral = (
  sourceFile: SourceFile,
  schemaName: string,
): ObjectLiteralExpression | undefined => {
  const initializer = sourceFile.getVariableDeclaration(schemaName)?.getInitializer();
  const objectCall = initializer?.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isPropertyAccessExpression(expression)
      && expression.getExpression().getText() === "z"
      && expression.getName() === "object";
  });
  const argument = objectCall?.getArguments()[0];
  return argument && Node.isObjectLiteralExpression(argument) ? argument : undefined;
};

const findSchemaProperty = (
  schemaObject: ObjectLiteralExpression,
  propertyName: string,
) =>
  schemaObject.getProperties().find(
    (property) => Node.isPropertyAssignment(property) && property.getName() === propertyName,
  );

const propertyHasMethodCall = (
  property: ReturnType<typeof findSchemaProperty>,
  methodName: string,
): boolean =>
  property !== undefined
  && property
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((callExpression) => {
      const expression = callExpression.getExpression();
      return Node.isPropertyAccessExpression(expression) && expression.getName() === methodName;
    });

const propertyHasDefaultNull = (property: ReturnType<typeof findSchemaProperty>): boolean =>
  property !== undefined
  && property
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((callExpression) => {
      const expression = callExpression.getExpression();
      const defaultArgument = callExpression.getArguments()[0];
      return Node.isPropertyAccessExpression(expression)
        && expression.getName() === "default"
        && defaultArgument?.getKind() === SyntaxKind.NullKeyword;
    });

const propertyHasEmptyObjectDefault = (property: ReturnType<typeof findSchemaProperty>): boolean =>
  property !== undefined
  && property
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((callExpression) => {
      const expression = callExpression.getExpression();
      const defaultArgument = callExpression.getArguments()[0];
      return Node.isPropertyAccessExpression(expression)
        && expression.getName() === "default"
        && defaultArgument !== undefined
        && Node.isObjectLiteralExpression(defaultArgument)
        && defaultArgument.getProperties().length === 0;
    });

const schemaHasEvidenceProperty = (schemaObject: ObjectLiteralExpression): boolean =>
  schemaObject.getProperties().some(
    (property) => Node.isPropertyAssignment(property) && evidencePropertyNames.has(property.getName()),
  );

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
  const finalAdjudicationProperty = findSchemaProperty(schemaObject, "finalAdjudication");
  const recordHashesProperty = findSchemaProperty(schemaObject, "recordHashes");
  if (!propertyHasMethodCall(finalAdjudicationProperty, "nullable") && !propertyHasDefaultNull(finalAdjudicationProperty) && !propertyHasEmptyObjectDefault(recordHashesProperty)) {
    return [];
  }
  return [
    createFinding({
      checkId: deepResearchEvidenceCheckId,
      lawId,
      filePath: toRepoPath(sourceFile.getFilePath()),
      message: `${toRepoPath(sourceFile.getFilePath())} allows completed Deep Research results to omit final adjudication or record-hash evidence by default.`,
    }),
  ];
};

export const inspectFacebookCompletedContract = (
  sourceFile: SourceFile,
  lawId: string,
): InspectorFinding[] => {
  const schemaObject = findObjectSchemaLiteral(sourceFile, "FacebookProductVideoMiningRunStatusSchema");
  if (!schemaObject) {
    return [
      createFinding({
        checkId: facebookEvidenceCheckId,
        lawId,
        filePath: toRepoPath(sourceFile.getFilePath()),
        message: `${toRepoPath(sourceFile.getFilePath())} is missing FacebookProductVideoMiningRunStatusSchema object truth.`,
      }),
    ];
  }
  if (schemaHasEvidenceProperty(schemaObject)) {
    return [];
  }
  return [
    createFinding({
      checkId: facebookEvidenceCheckId,
      lawId,
      filePath: toRepoPath(sourceFile.getFilePath()),
      message: `${toRepoPath(sourceFile.getFilePath())} allows completed Facebook run status without any video evidence-bearing field.`,
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
  const inspectedFiles = [deepResearchResultPath, facebookSchemaPath];
  const deepResearchSource = context.project.getSourceFile(resolveFromRepo(deepResearchResultPath));
  const facebookSource = context.project.getSourceFile(resolveFromRepo(facebookSchemaPath));
  return {
    evidenceRefs: inspectedFiles,
    findings: [
      ...(deepResearchSource ? [] : [missingSourceFinding(lawId, deepResearchResultPath)]),
      ...(facebookSource ? [] : [missingSourceFinding(lawId, facebookSchemaPath)]),
      ...(deepResearchSource
        ? inspectDeepResearchCompletedContract(deepResearchSource, lawId)
        : [createFinding({
            checkId: deepResearchEvidenceCheckId,
            lawId,
            filePath: deepResearchResultPath,
            message: `${deepResearchResultPath} is unavailable, so its completed-evidence contract could not execute.`,
          })]),
      ...(facebookSource
        ? inspectFacebookCompletedContract(facebookSource, lawId)
        : [createFinding({
            checkId: facebookEvidenceCheckId,
            lawId,
            filePath: facebookSchemaPath,
            message: `${facebookSchemaPath} is unavailable, so its completed-evidence contract could not execute.`,
          })]),
    ],
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  if (!context.checks) throw new Error("runtime-truth requires a runner-owned check session.");
  const lawId = selectLawId(context.planEntry.lawIds, "APEX-RUNTIME-TRUTH-001-V1");
  const inspectedFiles = [deepResearchResultPath, facebookSchemaPath];
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
