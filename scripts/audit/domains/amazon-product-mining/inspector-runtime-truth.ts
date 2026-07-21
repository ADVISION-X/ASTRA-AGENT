import { Node, SyntaxKind } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import {
  getRequiredSourceFile,
  hasIdentifier,
  hasPropertyAccessNamed,
  trackSourceFile,
} from "./inspector-ast-shared.js";

const objectLiteralHasPropertyAssignment = (node: Node, propertyName: string): boolean =>
  Node.isObjectLiteralExpression(node)
  && Node.isPropertyAssignment(node.getProperty(propertyName));

const hasMethodCallWithObjectProperty = (
  sourceFile: NonNullable<ReturnType<typeof getRequiredSourceFile>>,
  methodName: string,
  propertyName: string,
): boolean => sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
  const expression = callExpression.getExpression();
  if (!Node.isPropertyAccessExpression(expression) || expression.getName() !== methodName) {
    return false;
  }
  const firstArgument = callExpression.getArguments()[0];
  return firstArgument !== undefined && objectLiteralHasPropertyAssignment(firstArgument, propertyName);
});

const propertyAssignmentCallsIdentifier = (
  sourceFile: NonNullable<ReturnType<typeof getRequiredSourceFile>>,
  propertyName: string,
  identifierName: string,
): boolean => sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((assignment) => {
  if (assignment.getName() !== propertyName) {
    return false;
  }
  const initializer = assignment.getInitializer();
  const callExpressions = [
    ...(Node.isCallExpression(initializer) ? [initializer] : []),
    ...(initializer?.getDescendantsOfKind(SyntaxKind.CallExpression) ?? []),
  ];
  return callExpressions.some((callExpression) =>
    Node.isIdentifier(callExpression.getExpression()) && callExpression.getExpression().getText() === identifierName,
  );
});

const exportedFunctionCallsIdentifier = (
  sourceFile: NonNullable<ReturnType<typeof getRequiredSourceFile>>,
  exportedFunctionName: string,
  identifierName: string,
): boolean => (sourceFile.getExportedDeclarations().get(exportedFunctionName) ?? []).some((declaration) =>
  declaration.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) =>
    Node.isIdentifier(callExpression.getExpression()) && callExpression.getExpression().getText() === identifierName,
  ),
);

const sourceHasLiteralValueContaining = (
  sourceFile: NonNullable<ReturnType<typeof getRequiredSourceFile>>,
  value: string,
): boolean => [
  ...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
].some((literal) => literal.getLiteralValue().includes(value));

const storageReadsReviewHistory = (
  storageFile: NonNullable<ReturnType<typeof getRequiredSourceFile>>,
): boolean =>
  hasIdentifier(storageFile, "getMinedKeywordHistoryForDedup")
  && hasIdentifier(storageFile, "normalizeAmazonTargetMarketKey")
  && sourceHasLiteralValueContaining(storageFile, "amazon_mining_keyword_opportunity_reviews")
  && !hasIdentifier(storageFile, "getAllMinedKeywordsForDedup");

const keywordRefillsShortage = (
  keywordFile: NonNullable<ReturnType<typeof getRequiredSourceFile>>,
): boolean =>
  hasIdentifier(keywordFile, "buildKeywordRefillPrompt")
  && hasIdentifier(keywordFile, "currentTaskKeywords")
  && hasIdentifier(keywordFile, "hasNearDuplicateAmazonKeyword")
  && hasIdentifier(keywordFile, "AMAZON_KEYWORD_GENERATION_INSUFFICIENT_NEW_KEYWORDS_REASON")
  && hasIdentifier(keywordFile, "keywordHistoryPolicy")
  && sourceHasLiteralValueContaining(keywordFile, "historical_refresh");

const storagePersistsHistoryPolicy = (
  storageFile: NonNullable<ReturnType<typeof getRequiredSourceFile>>,
): boolean =>
  hasIdentifier(storageFile, "keywordHistoryPolicy")
  && sourceHasLiteralValueContaining(storageFile, "keyword_history_policy")
  && sourceHasLiteralValueContaining(storageFile, "keyword_history_relation");

export const inspectAmazonRuntimeFailureEvidenceContract = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const repoPath = "src/plugins/amazon-product-mining/amazon-product-mining.flow-packaging.ts";
  const sourceFile = getRequiredSourceFile(context, repoPath);
  trackSourceFile(inspectedFiles, sourceFile);
  if (!sourceFile) {
    return;
  }

  const logsFailure = hasPropertyAccessNamed(sourceFile, "logFailure");
  const finalMissionCarriesStatus = hasMethodCallWithObjectProperty(sourceFile, "logMissionComplete", "status");
  if (logsFailure && finalMissionCarriesStatus) {
    return;
  }
  findings.push(createFinding({
    checkId: "amazon-mining/runtime-final-status-truth",
    lawId,
    filePath: repoPath,
    message: "Final Amazon mining runtime logs must preserve failed/review_required task truth and must not emit success-only MISSION_COMPLETED.",
    evidence: `logsFailure=${String(logsFailure)} finalMissionCarriesStatus=${String(finalMissionCarriesStatus)}`,
  }));
};

export const inspectSearchSponsoredUrlNormalization = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const repoPath = "src/plugins/amazon-product-mining/amazon-product-mining.search.ts";
  const sourceFile = getRequiredSourceFile(context, repoPath);
  trackSourceFile(inspectedFiles, sourceFile);
  if (!sourceFile) {
    return;
  }

  const hasNormalizer = hasIdentifier(sourceFile, "normalizeSearchProductUrl");
  const productUrlUsesNormalizer = propertyAssignmentCallsIdentifier(sourceFile, "productUrl", "normalizeSearchProductUrl");
  if (hasNormalizer && productUrlUsesNormalizer) {
    return;
  }
  findings.push(createFinding({
    checkId: "amazon-mining/search-sponsored-url-normalization",
    lawId,
    filePath: repoPath,
    message: "Search result persistence must normalize Amazon /sspa/click sponsored URLs to their target product URLs before detail mining and evidence packaging.",
    evidence: `hasNormalizer=${String(hasNormalizer)} productUrlUsesNormalizer=${String(productUrlUsesNormalizer)}`,
  }));
};

export const inspectKeywordReviewLooseQuoteParserContract = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const repoPath = "src/plugins/amazon-product-mining/amazon-product-mining.keyword-review-support.ts";
  const sourceFile = getRequiredSourceFile(context, repoPath);
  trackSourceFile(inspectedFiles, sourceFile);
  if (!sourceFile) {
    return;
  }

  const hasRepairHelper = hasIdentifier(sourceFile, "escapeLooseQuotesInsideJsonStrings");
  const parserUsesRepairHelper = exportedFunctionCallsIdentifier(sourceFile, "parseKeywordReviewResponse", "escapeLooseQuotesInsideJsonStrings");
  if (hasRepairHelper && parserUsesRepairHelper) {
    return;
  }
  findings.push(createFinding({
    checkId: "amazon-mining/keyword-review-loose-quote-parser",
    lawId,
    filePath: repoPath,
    message: "Keyword opportunity review parsing must tolerate GPT Web Chat JSON-like responses with unescaped evidence quotes instead of failing the whole keyword.",
    evidence: `hasRepairHelper=${String(hasRepairHelper)} parserUsesRepairHelper=${String(parserUsesRepairHelper)}`,
  }));
};

export const inspectKeywordHistoricalDedupContract = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const storagePath = "src/plugins/amazon-product-mining/amazon-product-mining.storage.ts";
  const flowPath = "src/plugins/amazon-product-mining/amazon-product-mining.flow.ts";
  const keywordPath = "src/plugins/amazon-product-mining/amazon-product-mining.keyword.ts";
  const storageFile = getRequiredSourceFile(context, storagePath);
  const flowFile = getRequiredSourceFile(context, flowPath);
  const keywordFile = getRequiredSourceFile(context, keywordPath);
  trackSourceFile(inspectedFiles, storageFile);
  trackSourceFile(inspectedFiles, flowFile);
  trackSourceFile(inspectedFiles, keywordFile);

  const readsHistory = storageFile ? storageReadsReviewHistory(storageFile) : false;
  const usesHistoricalPool = flowFile ? hasPropertyAccessNamed(flowFile, "getMinedKeywordHistoryForDedup") : false;
  const refillsShortage = keywordFile ? keywordRefillsShortage(keywordFile) : false;
  const persistsPolicy = storageFile ? storagePersistsHistoryPolicy(storageFile) : false;

  if (readsHistory && usesHistoricalPool && refillsShortage && persistsPolicy) {
    return;
  }
  findings.push(createFinding({
    checkId: "amazon-mining/keyword-historical-dedup-pool",
    lawId,
    filePath: storagePath,
    message: "Keyword generation must present and enforce a historical dedup pool from queued keywords plus keyword opportunity review history, refill or fail in default mode, and persist explicit historical_refresh markers in refresh mode.",
    evidence: `storageReadsReviewHistory=${String(readsHistory)} flowUsesHistoricalPool=${String(usesHistoricalPool)} keywordRefillsShortage=${String(refillsShortage)} storagePersistsHistoryPolicy=${String(persistsPolicy)}`,
  }));
};

export const inspectDuplicateProductDetailSuppressionContract = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const flowPath = "src/plugins/amazon-product-mining/amazon-product-mining.flow.ts";
  const flowFile = getRequiredSourceFile(context, flowPath);
  trackSourceFile(inspectedFiles, flowFile);
  if (!flowFile) {
    return;
  }
  const checksExistingDetails = hasPropertyAccessNamed(flowFile, "getProductDetailsForTask");
  const linksExistingDetail = flowFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    if (!Node.isPropertyAccessExpression(expression) || expression.getName() !== "persistProductDetail") {
      return false;
    }
    const firstArgument = callExpression.getArguments()[0];
    return Node.isIdentifier(firstArgument) && firstArgument.getText() === "existingDetail";
  });
  if (checksExistingDetails && linksExistingDetail) {
    return;
  }
  findings.push(createFinding({
    checkId: "amazon-mining/duplicate-product-detail-suppression",
    lawId,
    filePath: flowPath,
    message: "Detail mining must link duplicate search cards to an existing task product detail instead of reopening the same ASIN/product URL.",
    evidence: `checksExistingDetails=${String(checksExistingDetails)} linksExistingDetail=${String(linksExistingDetail)}`,
  }));
};
