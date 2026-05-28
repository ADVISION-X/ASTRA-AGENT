import { readFileSync } from "node:fs";
import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import {
  fileIncludesText,
  findNamedImportContract,
  getRequiredSourceFile,
  hasCallToImportedFunction,
  hasCallToLocalIdentifier,
  hasIdentifier,
  hasStringLiteral,
  literalText,
  trackSourceFile,
} from "./inspector-ast-shared.js";

const LAW_PATH = ".github/instructions/agent-rules/modules/module-amazon-product-mining.instructions.md";
const BLUEPRINT_PATH = "docs/法案辅助文件/GrassEye Amazon 产品挖掘施工图.md";
const KEYWORD_REVIEW_DEPTH_IDS = {
  acceptance: ["detailEvidence", "reviewCoverage", "fieldDisclosureMap", "reviewImagesIfVisible", "reviewVideosIfVisible", "reviewLanguage", "reviewRegionIfVisible", "rawReviewTextSnapshot"],
  evidence: ["KEYWORD_REVIEW_MAX_REVIEW_SAMPLES_PER_PRODUCT", "fieldDisclosureMap", "buildKeywordReviewDetailEvidence", "buildKeywordReviewSample", "reviewImagesIfVisible", "reviewVideosIfVisible", "reviewLanguage", "reviewRegionIfVisible", "rawReviewTextSnapshot", "aPlusContentIfVisible", "aPlusImageUrls", "variationOptions", "colorSizeStyleOptions", "qaContentIfVisible", "frequentlyBoughtTogetherIfVisible", "compareWithSimilarItemsIfVisible", "allOtherVisibleProductParameters"],
  support: ["detailEvidence", "reviewCoverage", "fieldDisclosureMap"],
} as const;

const hasKeywordReviewInputRefsCall = (sourceFile: SourceFile): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    if (!Node.isPropertyAccessExpression(expression) || expression.getName() !== "execute") {
      return false;
    }

    const executeInput = callExpression.getArguments()[0];
    if (!Node.isObjectLiteralExpression(executeInput)) {
      return false;
    }

    const inputRefsProperty = executeInput.getProperty("inputRefs");
    if (!Node.isPropertyAssignment(inputRefsProperty)) {
      return false;
    }

    const initializer = inputRefsProperty.getInitializer();
    return Node.isCallExpression(initializer)
      && Node.isIdentifier(initializer.getExpression())
      && initializer.getExpression().getText() === "buildKeywordOpportunityReviewInputRefs";
  });

const numericConstantAtLeast = (sourceFile: SourceFile, variableName: string, minimum: number): boolean => {
  const initializer = sourceFile.getVariableDeclaration(variableName)?.getInitializerIfKind(SyntaxKind.NumericLiteral);
  return (initializer?.getLiteralValue() ?? 0) >= minimum;
};

const missingIdentifiers = (sourceFile: SourceFile, identifiers: readonly string[]): string[] =>
  identifiers.filter((identifier) => !hasIdentifier(sourceFile, identifier));

const inspectKeywordReviewSchemaSurface = (input: {
  findings: InspectorFinding[];
  lawId: string;
  schemaFile: SourceFile | undefined;
}): void => {
  const schemaFile = input.schemaFile;
  const schemaIdentifiers = [
    "AmazonKeywordOpportunityDecisionSchema",
    "AmazonKeywordOpportunityHumanNextStepSchema",
    "AmazonKeywordOpportunityReviewRecordSchema",
    "AmazonKeywordOpportunityManualIngestSchema",
  ];
  const hasSchemaSurface = schemaFile
    ? schemaIdentifiers.every((identifier) => hasIdentifier(schemaFile, identifier))
    : false;
  if (!hasSchemaSurface) {
    input.findings.push(createFinding({
      checkId: "amazon-mining/keyword-review-schema-surface",
      lawId: input.lawId,
      filePath: "src/plugins/amazon-product-mining/amazon-product-mining.schema.ts",
      message: "Amazon keyword review schema must expose fixed decision, humanNextStep, review record, and manual-ingest contracts.",
    }));
  }

  const decisionTokens = ["PASS", "WATCH", "REJECT", "INSUFFICIENT_DATA"];
  const nextStepTokens = ["enter_next_validation", "mine_related_keywords", "reject", "rerun_or_collect_more_data"];
  const schemaText = schemaFile ? literalText(schemaFile) : "";
  if (!decisionTokens.every((token) => schemaText.includes(token)) || !nextStepTokens.every((token) => schemaText.includes(token))) {
    input.findings.push(createFinding({
      checkId: "amazon-mining/keyword-review-fixed-enums",
      lawId: input.lawId,
      filePath: "src/plugins/amazon-product-mining/amazon-product-mining.schema.ts",
      message: "Amazon keyword review schema must fix decision and humanNextStep enums to the governed values.",
    }));
  }
};

const inspectKeywordReviewStorageSurface = (input: {
  findings: InspectorFinding[];
  lawId: string;
  storageSchemaFile: SourceFile | undefined;
}): void => {
  if (!input.storageSchemaFile || !fileIncludesText(input.storageSchemaFile, "amazon_mining_keyword_opportunity_reviews")) {
    input.findings.push(createFinding({
      checkId: "amazon-mining/keyword-review-storage-table",
      lawId: input.lawId,
      filePath: "src/plugins/amazon-product-mining/amazon-product-mining.storage-schema.ts",
      message: "Amazon mining storage schema must define the amazon_mining_keyword_opportunity_reviews table.",
    }));
  }
};

const inspectKeywordReviewOwnerSurface = (input: {
  findings: InspectorFinding[];
  keywordReviewFile: SourceFile | undefined;
  keywordReviewSupportFile: SourceFile | undefined;
  lawId: string;
}): void => {
  if (!input.keywordReviewFile || !hasIdentifier(input.keywordReviewFile, "runKeywordOpportunityReview") || !hasIdentifier(input.keywordReviewFile, "ingestManualKeywordOpportunityReview")) {
    input.findings.push(createFinding({
      checkId: "amazon-mining/keyword-review-owner-module",
      lawId: input.lawId,
      filePath: "src/plugins/amazon-product-mining/amazon-product-mining.keyword-review.ts",
      message: "Amazon mining must expose a keyword review owner module with runtime review execution and manual ingest.",
    }));
  }

  const hasReviewInputContract = input.keywordReviewFile
    && hasIdentifier(input.keywordReviewFile, "AMAZON_KEYWORD_OPPORTUNITY_REVIEW_MAX_INPUT_CHARS")
    && hasIdentifier(input.keywordReviewFile, "AMAZON_KEYWORD_OPPORTUNITY_REVIEW_PROVIDER_KIND")
    && hasIdentifier(input.keywordReviewFile, "buildKeywordOpportunityReviewInputRefs")
    && hasStringLiteral(input.keywordReviewFile, "amazon-product-mining-keyword-evidence-slice")
    && hasStringLiteral(input.keywordReviewFile, "gpt-web-chat")
    && hasCallToLocalIdentifier(input.keywordReviewFile, "buildKeywordOpportunityReviewInputRefs")
    && hasKeywordReviewInputRefsCall(input.keywordReviewFile);
  if (!hasReviewInputContract) {
    input.findings.push(createFinding({
      checkId: "amazon-mining/keyword-review-ai-input-contract",
      lawId: input.lawId,
      filePath: "src/plugins/amazon-product-mining/amazon-product-mining.keyword-review.ts",
      message: "Keyword opportunity review must feed GPT Web Chat with structured AI inputRefs and the governed evidence-slice input budget.",
    }));
  }

  if (!input.keywordReviewSupportFile) {
    input.findings.push(createFinding({
      checkId: "amazon-mining/keyword-review-support-module",
      lawId: input.lawId,
      filePath: "src/plugins/amazon-product-mining/amazon-product-mining.keyword-review-support.ts",
      message: "Amazon mining keyword review support module is required for the evidence slice and prompt contract.",
    }));
  }
};

const inspectKeywordReviewAppPageSurface = (input: {
  findings: InspectorFinding[];
  lawId: string;
  pageFiles: SourceFile[];
}): void => {
  const pageTokens = [
    "Publish Task Card",
    "Latest Task Summary Card",
    "Keyword Opportunity Review History",
    "data-amazon-product-mining-review-task-filter",
    "data-amazon-product-mining-review-filter",
    "data-amazon-product-mining-review-marketplace-filter",
    "data-amazon-product-mining-review-keyword-filter",
    "data-amazon-product-mining-review-sort",
    "data-amazon-product-mining-refresh-reviews",
    "Created At",
    "Keyword",
    "Decision",
    "Human Next Step",
    "Demand Signal",
    "Review Health",
    "Price Ceiling",
    "Competition Openness",
    "Improvement Opportunity",
    "Data Confidence",
    "Product Count",
    "Review Count",
    "Package Integrity",
    "Data Completeness",
    "Status",
  ];
  const hasPageSurface = input.pageFiles.length > 0
    && pageTokens.every((token) => input.pageFiles.some((file) => fileIncludesText(file, token)));
  if (!hasPageSurface) {
    input.findings.push(createFinding({
      checkId: "amazon-mining/keyword-review-app-page",
      lawId: input.lawId,
      filePath: "src/app/workbench-home-page.ts",
      message: "Workbench home page must expose the keyword review history table and filters.",
    }));
  }
};

const inspectKeywordReviewAppClientSurface = (input: {
  clientFiles: SourceFile[];
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  const clientTokens = [
    "amazonProductMiningReviewFilters",
    "amazonProductMiningReviewLoading",
    "amazonProductMiningReviewError",
    "renderAmazonProductMiningReviewFilters",
    "renderAmazonProductMiningReviewTable",
    "renderAmazonProductMiningReviewRow",
    "renderReviewInspector",
    "openInspector",
    "refreshAmazonProductMiningKeywordReviews",
    "refreshAmazonProductMiningReviews",
    "amazonProductMiningReviews",
    "/api/amazon-product-mining/keyword-reviews",
    "Open Package",
    "Open Master Report",
    "Open AI Review",
    "Open Evidence",
    "Loading reviews...",
    "Failed to load keyword reviews: ",
    "No keyword opportunity reviews yet.",
  ];
  const clientHasToken = (token: string): boolean => input.clientFiles.some((file) => fileIncludesText(file, token));
  if (input.clientFiles.length === 0 || !clientTokens.every((token) => clientHasToken(token))) {
    input.findings.push(createFinding({
      checkId: "amazon-mining/keyword-review-app-client",
      lawId: input.lawId,
      filePath: "src/app/workbench-home-client.ts",
      message: "Workbench home client must load, filter, and open keyword review artifacts.",
    }));
  }
};

const inspectKeywordReviewAppRouteSurface = (input: {
  findings: InspectorFinding[];
  lawId: string;
  routesFile: SourceFile | undefined;
}): void => {
  const routesFile = input.routesFile;
  const routeTokens = [
    "GET:/api/amazon-product-mining/keyword-reviews",
    "GET:/api/amazon-product-mining/keyword-review",
    "POST:/api/amazon-product-mining/keyword-review/manual-ingest",
  ];
  const hasRouteSurface = routesFile ? routeTokens.every((token) => hasStringLiteral(routesFile, token)) : false;
  if (!hasRouteSurface) {
    input.findings.push(createFinding({
      checkId: "amazon-mining/keyword-review-routes",
      lawId: input.lawId,
      filePath: "src/app/workbench-amazon-product-mining-routes.ts",
      message: "Amazon routes must expose keyword review list, detail, and manual-ingest endpoints.",
    }));
  }
};

const inspectKeywordReviewAppForbiddenSurface = (input: {
  clientFiles: SourceFile[];
  findings: InspectorFinding[];
  lawId: string;
  pageFile: SourceFile | undefined;
  pageFiles?: SourceFile[];
}): void => {
  const forbiddenTokens = [
    "Procure",
    "Sample Now",
    "Place Order",
    "Run Ads",
    "Final Selection",
    "grasseye:lastAmazonProductMiningReviews",
  ];
  const appSurfaceText = `${input.pageFiles?.map((file) => literalText(file)).join("\n") ?? ""}\n${input.pageFile ? literalText(input.pageFile) : ""}\n${input.clientFiles.map((file) => literalText(file)).join("\n")}`;
  if (forbiddenTokens.some((token) => appSurfaceText.includes(token))) {
    input.findings.push(createFinding({
      checkId: "amazon-mining/keyword-review-forbidden-actions",
      lawId: input.lawId,
      filePath: "src/app/workbench-home-page.ts",
      message: "Keyword review app surface must not expose procurement, sampling, ads, or final-selection actions.",
    }));
  }
};

export const inspectKeywordReviewLawAndBlueprint = (
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  inspectedFiles.add(LAW_PATH);
  inspectedFiles.add(BLUEPRINT_PATH);
  const lawText = readFileSync(resolveFromRepo(LAW_PATH), "utf8");
  const blueprintText = readFileSync(resolveFromRepo(BLUEPRINT_PATH), "utf8");
  const requiredTokens = [
    "GRASSEYE-AMAZON-PRODUCT-MINING-016-V1",
    "GRASSEYE-AMAZON-PRODUCT-MINING-017-V1",
    "GRASSEYE-AMAZON-PRODUCT-MINING-018-V1",
    "GRASSEYE-AMAZON-PRODUCT-MINING-019-V1",
    "GRASSEYE-AMAZON-PRODUCT-MINING-020-V1",
    "GRASSEYE-AMAZON-PRODUCT-MINING-021-V1",
    "keyword opportunity review",
    "KEYWORD_OPPORTUNITY_REVIEW",
    "KEYWORD_REVIEW_PERSIST",
    "APP_HISTORY_UPDATE",
    "APP_UI_KEYWORD_REVIEW_HISTORY",
    "LOAD_KEYWORD_REVIEW_HISTORY",
    "USER_OPENS_PACKAGE_OR_AI_REVIEW",
    "PRODUCT_DETAIL_OPEN_PACING",
    "REVIEW_PAGE_OPEN_PACING",
    "REJECT 后物理清理",
  ];
  const missing = requiredTokens.filter((token) => !lawText.includes(token) && !blueprintText.includes(token));
  if (missing.length === 0) {
    return;
  }

  findings.push(createFinding({
    checkId: "amazon-mining/keyword-review-law-blueprint",
    lawId,
    filePath: LAW_PATH,
    message: "Keyword opportunity review governance must be declared in the Amazon law and blueprint.",
    evidence: `missing=${missing.join(",")}`,
  }));
};

export const inspectKeywordReviewSchemaAndStorage = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const schemaFile = getRequiredSourceFile(context, "src/plugins/amazon-product-mining/amazon-product-mining.schema.ts");
  const storageSchemaFile = getRequiredSourceFile(context, "src/plugins/amazon-product-mining/amazon-product-mining.storage-schema.ts");
  const keywordReviewFile = getRequiredSourceFile(context, "src/plugins/amazon-product-mining/amazon-product-mining.keyword-review.ts");
  const keywordReviewSupportFile = getRequiredSourceFile(context, "src/plugins/amazon-product-mining/amazon-product-mining.keyword-review-support.ts");
  trackSourceFile(inspectedFiles, schemaFile);
  trackSourceFile(inspectedFiles, storageSchemaFile);
  trackSourceFile(inspectedFiles, keywordReviewFile);
  trackSourceFile(inspectedFiles, keywordReviewSupportFile);

  inspectKeywordReviewSchemaSurface({ findings, lawId, schemaFile });
  inspectKeywordReviewStorageSurface({ findings, lawId, storageSchemaFile });
  inspectKeywordReviewOwnerSurface({ findings, lawId, keywordReviewFile, keywordReviewSupportFile });
};

export const inspectKeywordReviewPromptAndFlow = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const flowFile = getRequiredSourceFile(context, "src/plugins/amazon-product-mining/amazon-product-mining.flow.ts");
  const supportFile = getRequiredSourceFile(context, "src/plugins/amazon-product-mining/amazon-product-mining.keyword-review-support.ts");
  trackSourceFile(inspectedFiles, flowFile);
  trackSourceFile(inspectedFiles, supportFile);

  const reviewImport = flowFile ? findNamedImportContract(flowFile, "./amazon-product-mining.keyword-review.js", "runKeywordOpportunityReview") : undefined;
  if (!flowFile || !reviewImport || !hasCallToImportedFunction(flowFile, reviewImport)) {
    findings.push(createFinding({
      checkId: "amazon-mining/keyword-review-flow-call",
      lawId,
      filePath: "src/plugins/amazon-product-mining/amazon-product-mining.flow.ts",
      message: "Amazon flow must call runKeywordOpportunityReview inside the keyword loop.",
    }));
  }

  const requiredPromptTokens = [
    "You are not a final procurement decision AI.",
    "You are not a profit calculation AI.",
    "You are not a supply-chain judgment AI.",
    "Your task is only candidate-list screening",
    "Even PASS is not a product choice.",
    "REJECT means this keyword evidence is too weak to keep as a candidate pool in this mining task",
    "PASS | WATCH | REJECT | INSUFFICIENT_DATA",
    "enter_next_validation | mine_related_keywords | reject | rerun_or_collect_more_data",
  ];
  if (!supportFile || !requiredPromptTokens.every((token) => fileIncludesText(supportFile, token))) {
    findings.push(createFinding({
      checkId: "amazon-mining/keyword-review-prompt-boundary",
      lawId,
      filePath: "src/plugins/amazon-product-mining/amazon-product-mining.keyword-review-support.ts",
      message: "Keyword review prompt must declare the keyword-only screening boundary and the fixed JSON contract.",
    }));
  }
};

export const inspectKeywordReviewEvidenceSliceDepth = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const supportPath = "src/plugins/amazon-product-mining/amazon-product-mining.keyword-review-support.ts";
  const evidencePath = "src/plugins/amazon-product-mining/amazon-product-mining.keyword-review-evidence.ts";
  const reviewPath = "src/plugins/amazon-product-mining/amazon-product-mining.keyword-review.ts";
  const acceptancePath = "scripts/acceptance/amazon-product-mining-keyword-opportunity-review.acceptance.ts";
  const supportFile = getRequiredSourceFile(context, supportPath);
  const evidenceFile = getRequiredSourceFile(context, evidencePath);
  const reviewFile = getRequiredSourceFile(context, reviewPath);
  const acceptanceFile = getRequiredSourceFile(context, acceptancePath);
  [supportFile, evidenceFile, reviewFile, acceptanceFile].forEach((sourceFile) => trackSourceFile(inspectedFiles, sourceFile));
  if (!supportFile || !evidenceFile || !reviewFile || !acceptanceFile) return;
  const missing = [
    ...missingIdentifiers(supportFile, KEYWORD_REVIEW_DEPTH_IDS.support),
    ...missingIdentifiers(evidenceFile, KEYWORD_REVIEW_DEPTH_IDS.evidence),
    ...missingIdentifiers(acceptanceFile, KEYWORD_REVIEW_DEPTH_IDS.acceptance),
    ...(numericConstantAtLeast(evidenceFile, "KEYWORD_REVIEW_MAX_REVIEW_SAMPLES_PER_PRODUCT", 8) ? [] : ["reviewSampleLimitAtLeast8"]),
    ...(numericConstantAtLeast(reviewFile, "AMAZON_KEYWORD_OPPORTUNITY_REVIEW_MAX_INPUT_CHARS", 900_000) ? [] : ["keywordReviewMaxInputAtLeast900k"]),
  ];
  if (missing.length === 0) return;
  findings.push(createFinding({
    checkId: "amazon-mining/keyword-review-evidence-slice-depth",
    lawId,
    filePath: evidencePath,
    message: "Keyword opportunity review input must carry rich product detail evidence, field disclosure, and review media/language/region metadata for advanced-AI readability.",
    evidence: `missing=${missing.join(",")}`,
  }));
};

export const inspectKeywordReviewAppSurface = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const pageFile = getRequiredSourceFile(context, "src/app/workbench-home-page.ts");
  const workspaceFile = getRequiredSourceFile(context, "src/app/skills/amazon-product-mining/amazon-product-mining-workspace.ts");
  const publishFile = getRequiredSourceFile(context, "src/app/skills/amazon-product-mining/amazon-product-mining-task-publish.ts");
  const historyFile = getRequiredSourceFile(context, "src/app/skills/amazon-product-mining/amazon-product-mining-keyword-history.ts");
  const clientFile = getRequiredSourceFile(context, "src/app/workbench-home-client.ts");
  const clientHelperFile = getRequiredSourceFile(context, "src/app/workbench-home-amazon-product-mining-review-client.ts");
  const routesFile = getRequiredSourceFile(context, "src/app/workbench-amazon-product-mining-routes.ts");
  const clientFiles = [clientFile, clientHelperFile].filter((file): file is SourceFile => file !== undefined);

  trackSourceFile(inspectedFiles, pageFile);
  trackSourceFile(inspectedFiles, workspaceFile);
  trackSourceFile(inspectedFiles, publishFile);
  trackSourceFile(inspectedFiles, historyFile);
  trackSourceFile(inspectedFiles, clientFile);
  trackSourceFile(inspectedFiles, clientHelperFile);
  trackSourceFile(inspectedFiles, routesFile);

  const pageFiles = [pageFile, workspaceFile, publishFile, historyFile].filter((file): file is SourceFile => file !== undefined);
  inspectKeywordReviewAppPageSurface({ findings, lawId, pageFiles });
  inspectKeywordReviewAppClientSurface({ clientFiles, findings, lawId });
  inspectKeywordReviewAppRouteSurface({ findings, lawId, routesFile });
  inspectKeywordReviewAppForbiddenSurface({ clientFiles, findings, lawId, pageFile, pageFiles });
};
