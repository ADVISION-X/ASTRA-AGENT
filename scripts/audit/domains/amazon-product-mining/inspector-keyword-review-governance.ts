import { readFileSync } from "node:fs";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import {
  fileIncludesText,
  findNamedImportContract,
  getRequiredSourceFile,
  hasCallToImportedFunction,
  hasIdentifier,
  hasStringLiteral,
  literalText,
  trackSourceFile,
} from "./inspector-ast-shared.js";

const LAW_PATH = ".github/instructions/agent-rules/modules/module-amazon-product-mining.instructions.md";
const BLUEPRINT_PATH = "docs/法案辅助文件/GrassEye Amazon 产品挖掘施工图.md";

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
    "keyword opportunity review",
    "KEYWORD_OPPORTUNITY_REVIEW",
    "KEYWORD_REVIEW_PERSIST",
    "APP_HISTORY_UPDATE",
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

  const schemaIdentifiers = [
    "AmazonKeywordOpportunityDecisionSchema",
    "AmazonKeywordOpportunityHumanNextStepSchema",
    "AmazonKeywordOpportunityReviewRecordSchema",
    "AmazonKeywordOpportunityManualIngestSchema",
  ];
  if (!schemaFile || !schemaIdentifiers.every((identifier) => hasIdentifier(schemaFile, identifier))) {
    findings.push(createFinding({
      checkId: "amazon-mining/keyword-review-schema-surface",
      lawId,
      filePath: "src/plugins/amazon-product-mining/amazon-product-mining.schema.ts",
      message: "Amazon keyword review schema must expose fixed decision, humanNextStep, review record, and manual-ingest contracts.",
    }));
  }

  const decisionTokens = ["PASS", "WATCH", "REJECT", "INSUFFICIENT_DATA"];
  const nextStepTokens = ["enter_next_validation", "mine_related_keywords", "reject", "rerun_or_collect_more_data"];
  const schemaText = schemaFile ? literalText(schemaFile) : "";
  if (!decisionTokens.every((token) => schemaText.includes(token)) || !nextStepTokens.every((token) => schemaText.includes(token))) {
    findings.push(createFinding({
      checkId: "amazon-mining/keyword-review-fixed-enums",
      lawId,
      filePath: "src/plugins/amazon-product-mining/amazon-product-mining.schema.ts",
      message: "Amazon keyword review schema must fix decision and humanNextStep enums to the governed values.",
    }));
  }

  if (!storageSchemaFile || !fileIncludesText(storageSchemaFile, "amazon_mining_keyword_opportunity_reviews")) {
    findings.push(createFinding({
      checkId: "amazon-mining/keyword-review-storage-table",
      lawId,
      filePath: "src/plugins/amazon-product-mining/amazon-product-mining.storage-schema.ts",
      message: "Amazon mining storage schema must define the amazon_mining_keyword_opportunity_reviews table.",
    }));
  }

  if (!keywordReviewFile || !hasIdentifier(keywordReviewFile, "runKeywordOpportunityReview") || !hasIdentifier(keywordReviewFile, "ingestManualKeywordOpportunityReview")) {
    findings.push(createFinding({
      checkId: "amazon-mining/keyword-review-owner-module",
      lawId,
      filePath: "src/plugins/amazon-product-mining/amazon-product-mining.keyword-review.ts",
      message: "Amazon mining must expose a keyword review owner module with runtime review execution and manual ingest.",
    }));
  }

  if (!keywordReviewSupportFile) {
    findings.push(createFinding({
      checkId: "amazon-mining/keyword-review-support-module",
      lawId,
      filePath: "src/plugins/amazon-product-mining/amazon-product-mining.keyword-review-support.ts",
      message: "Amazon mining keyword review support module is required for the evidence slice and prompt contract.",
    }));
  }
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

export const inspectKeywordReviewAppSurface = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const pageFile = getRequiredSourceFile(context, "src/app/workbench-home-page.ts");
  const clientFile = getRequiredSourceFile(context, "src/app/workbench-home-client.ts");
  const routesFile = getRequiredSourceFile(context, "src/app/workbench-amazon-product-mining-routes.ts");
  trackSourceFile(inspectedFiles, pageFile);
  trackSourceFile(inspectedFiles, clientFile);
  trackSourceFile(inspectedFiles, routesFile);

  const pageTokens = [
    "Keyword Opportunity Review History",
    "data-amazon-product-mining-review-task-filter",
    "data-amazon-product-mining-review-filter",
    "data-amazon-product-mining-refresh-reviews",
  ];
  if (!pageFile || !pageTokens.every((token) => fileIncludesText(pageFile, token))) {
    findings.push(createFinding({
      checkId: "amazon-mining/keyword-review-app-page",
      lawId,
      filePath: "src/app/workbench-home-page.ts",
      message: "Workbench home page must expose the keyword review history table and filters.",
    }));
  }

  const clientTokens = [
    "refreshAmazonProductMiningReviews",
    "amazonProductMiningReviews",
    "/api/amazon-product-mining/keyword-reviews",
    "Open Package",
    "Open AI Review",
  ];
  if (!clientFile || !clientTokens.every((token) => fileIncludesText(clientFile, token))) {
    findings.push(createFinding({
      checkId: "amazon-mining/keyword-review-app-client",
      lawId,
      filePath: "src/app/workbench-home-client.ts",
      message: "Workbench home client must load, filter, and open keyword review artifacts.",
    }));
  }

  const routeTokens = [
    "GET:/api/amazon-product-mining/keyword-reviews",
    "GET:/api/amazon-product-mining/keyword-review",
    "POST:/api/amazon-product-mining/keyword-review/manual-ingest",
  ];
  if (!routesFile || !routeTokens.every((token) => hasStringLiteral(routesFile, token))) {
    findings.push(createFinding({
      checkId: "amazon-mining/keyword-review-routes",
      lawId,
      filePath: "src/app/workbench-amazon-product-mining-routes.ts",
      message: "Amazon routes must expose keyword review list, detail, and manual-ingest endpoints.",
    }));
  }

  const forbiddenTokens = ["Procure", "Sample Now", "Place Order", "Run Ads", "Final Selection"];
  const appSurfaceText = `${pageFile ? literalText(pageFile) : ""}\n${clientFile ? literalText(clientFile) : ""}`;
  if (forbiddenTokens.some((token) => appSurfaceText.includes(token))) {
    findings.push(createFinding({
      checkId: "amazon-mining/keyword-review-forbidden-actions",
      lawId,
      filePath: "src/app/workbench-home-page.ts",
      message: "Keyword review app surface must not expose procurement, sampling, ads, or final-selection actions.",
    }));
  }
};