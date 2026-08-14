import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { astIdentifierName } from "../../shared/ast-node-identity.js";
import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import {
  getRequiredSourceFile,
  hasIdentifier,
  hasStringLiteral,
  trackSourceFile,
} from "./inspector-ast-shared.js";

const RUNTIME_STATE_PATH = "src/plugins/amazon-product-mining/amazon-product-mining.package-runtime-state.ts";
const PACKAGE_PATH = "src/plugins/amazon-product-mining/amazon-product-mining.package.ts";
const PACKAGE_REVIEW_ENTRIES_PATH = "src/plugins/amazon-product-mining/amazon-product-mining.package-keyword-review-entries.ts";
const HANDOFF_PATH = "src/plugins/amazon-product-mining/amazon-product-mining.handoff.ts";
const FLOW_PACKAGING_PATH = "src/plugins/amazon-product-mining/amazon-product-mining.flow-packaging.ts";
const ACCEPTANCE_PATH = "scripts/acceptance/amazon-product-mining-package.acceptance.ts";

type PackageAggregationFiles = {
  runtimeStateFile: SourceFile | undefined;
  packageFile: SourceFile | undefined;
  packageReviewEntriesFile: SourceFile | undefined;
  handoffFile: SourceFile | undefined;
  flowPackagingFile: SourceFile | undefined;
  acceptanceFile: SourceFile | undefined;
};

const hasCallWithObjectProperty = (
  sourceFile: SourceFile,
  calleeName: string,
  propertyName: string,
): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    if (!Node.isIdentifier(expression) || astIdentifierName(expression) !== calleeName) {
      return false;
    }
    return callExpression.getArguments().some((argument) =>
      Node.isObjectLiteralExpression(argument)
      && argument.getProperties().some((property) =>
        (Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property))
        && property.getName() === propertyName,
      ),
    );
  });

const variableInitializerHasIdentifier = (
  sourceFile: SourceFile,
  variableName: string,
  identifierName: string,
): boolean => {
  const initializer = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((declaration) => declaration.getName() === variableName)
    ?.getInitializer();
  return Boolean(initializer?.getDescendantsOfKind(SyntaxKind.Identifier)
    .some((identifier) => astIdentifierName(identifier) === identifierName));
};

const collectPackageAggregationFiles = (context: InspectorContext): PackageAggregationFiles => ({
  runtimeStateFile: getRequiredSourceFile(context, RUNTIME_STATE_PATH),
  packageFile: getRequiredSourceFile(context, PACKAGE_PATH),
  packageReviewEntriesFile: getRequiredSourceFile(context, PACKAGE_REVIEW_ENTRIES_PATH),
  handoffFile: getRequiredSourceFile(context, HANDOFF_PATH),
  flowPackagingFile: getRequiredSourceFile(context, FLOW_PACKAGING_PATH),
  acceptanceFile: getRequiredSourceFile(context, ACCEPTANCE_PATH),
});

const trackPackageAggregationFiles = (
  inspectedFiles: Set<string>,
  files: PackageAggregationFiles,
): void => {
  Object.values(files).forEach((sourceFile) => trackSourceFile(inspectedFiles, sourceFile));
};

const runtimeStatePasses = (sourceFile: SourceFile | undefined): boolean =>
  sourceFile !== undefined
  && hasIdentifier(sourceFile, "listKeywordOpportunityReviews")
  && hasCallWithObjectProperty(sourceFile, "buildStatusItems", "keywordReviews")
  && hasCallWithObjectProperty(sourceFile, "buildCompletenessReport", "keywordReviews");

const packagePasses = (
  packageFile: SourceFile | undefined,
  reviewEntriesFile: SourceFile | undefined,
): boolean =>
  packageFile !== undefined
  && reviewEntriesFile !== undefined
  && hasIdentifier(packageFile, "keywordOpportunityReviews")
  && hasIdentifier(packageFile, "attachKeywordReviewStatusToKeywordEntries")
  && hasIdentifier(reviewEntriesFile, "aiReviewStatus")
  && hasIdentifier(reviewEntriesFile, "aiReviewDecision")
  && hasIdentifier(reviewEntriesFile, "aiReviewFailureReason")
  && hasCallWithObjectProperty(packageFile, "buildExceptionSummaryArtifact", "keywordReviews");

const handoffPasses = (sourceFile: SourceFile | undefined): boolean =>
  sourceFile !== undefined
  && hasIdentifier(sourceFile, "failureReasons")
  && hasStringLiteral(sourceFile, "failed");

const flowPackagingPasses = (sourceFile: SourceFile | undefined): boolean =>
  sourceFile !== undefined
  && hasCallWithObjectProperty(sourceFile, "writeAmazonHandoffRecord", "failureReasons")
  && variableInitializerHasIdentifier(sourceFile, "shouldBeReady", "failureReasons");

const acceptancePasses = (sourceFile: SourceFile | undefined): boolean =>
  sourceFile !== undefined
  && hasIdentifier(sourceFile, "buildAmazonProductMiningKeywordReviewFailurePackageFixture")
  && hasIdentifier(sourceFile, "keywordReviewIssueCount")
  && hasIdentifier(sourceFile, "aiReviewStatus")
  && hasStringLiteral(sourceFile, "failed");

const missingPackageAggregationWires = (files: PackageAggregationFiles): string[] => [
  ...(runtimeStatePasses(files.runtimeStateFile) ? [] : ["package-runtime-state.keywordReviews"]),
  ...(packagePasses(files.packageFile, files.packageReviewEntriesFile) ? [] : ["master-package.keywordReviewAggregation"]),
  ...(handoffPasses(files.handoffFile) ? [] : ["handoff.failureReasons"]),
  ...(flowPackagingPasses(files.flowPackagingFile) ? [] : ["finalize.failureReasonsReadyGate"]),
  ...(acceptancePasses(files.acceptanceFile) ? [] : ["acceptance.keywordReviewFailureRegression"]),
];

export const inspectKeywordReviewPackageAggregation = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const files = collectPackageAggregationFiles(context);
  trackPackageAggregationFiles(inspectedFiles, files);
  const missing = missingPackageAggregationWires(files);
  if (missing.length === 0) {
    return;
  }

  findings.push(createFinding({
    checkId: "amazon-mining/keyword-review-package-readiness-aggregation",
    lawId,
    filePath: PACKAGE_PATH,
    message: "Keyword opportunity review results must aggregate into the master package, exception/completeness ledgers, and handoff readiness gate.",
    evidence: `missing=${missing.join(",")}`,
  }));
};
