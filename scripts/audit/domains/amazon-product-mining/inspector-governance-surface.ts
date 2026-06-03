import { existsSync, readFileSync } from "node:fs";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import {
  fileIncludesText,
  getRequiredSourceFile,
  hasIdentifier,
  hasStringLiteral,
  identifierText,
  literalText,
  trackSourceFile,
} from "./inspector-ast-shared.js";

const REQUIRED_PLUGIN_FILES = [
  "src/plugins/amazon-product-mining/amazon-product-mining.schema.ts",
  "src/plugins/amazon-product-mining/amazon-product-mining.storage-schema.ts",
  "src/plugins/amazon-product-mining/amazon-product-mining.storage.ts",
  "src/plugins/amazon-product-mining/amazon-product-mining.logging.ts",
  "src/plugins/amazon-product-mining/amazon-product-mining.keyword.ts",
  "src/plugins/amazon-product-mining/amazon-product-mining.search.ts",
  "src/plugins/amazon-product-mining/amazon-product-mining.product-detail.ts",
  "src/plugins/amazon-product-mining/amazon-product-mining.reviews.ts",
  "src/plugins/amazon-product-mining/amazon-product-mining.keyword-review-evidence.ts",
  "src/plugins/amazon-product-mining/amazon-product-mining.keyword-review.ts",
  "src/plugins/amazon-product-mining/amazon-product-mining.keyword-review-support.ts",
  "src/plugins/amazon-product-mining/amazon-product-mining.package.ts",
  "src/plugins/amazon-product-mining/amazon-product-mining.package-zip.ts",
  "src/plugins/amazon-product-mining/amazon-product-mining.pdf.ts",
  "src/plugins/amazon-product-mining/amazon-product-mining.handoff.ts",
  "src/plugins/amazon-product-mining/amazon-product-mining.result.ts",
  "src/plugins/amazon-product-mining/amazon-product-mining.flow.ts",
  "src/plugins/amazon-product-mining/index.ts",
] as const;

const REQUIRED_ACCEPTANCE_FILES = [
  "scripts/acceptance/amazon-product-mining-storage.acceptance.ts",
  "scripts/acceptance/amazon-product-mining-keyword-dedup.acceptance.ts",
  "scripts/acceptance/amazon-product-mining-web-chat-restore.acceptance.ts",
  "scripts/acceptance/amazon-product-mining-search-page.acceptance.ts",
  "scripts/acceptance/amazon-product-mining-detail-page.acceptance.ts",
	  "scripts/acceptance/amazon-product-mining-review-pagination.acceptance.ts",
	  "scripts/acceptance/amazon-product-mining-package.acceptance.ts",
	  "scripts/acceptance/amazon-product-mining-package-final-gate.acceptance.ts",
	  "scripts/acceptance/amazon-product-mining-package-zip.acceptance.ts",
	  "scripts/acceptance/amazon-product-mining-production-attacks.acceptance.ts",
	  "scripts/acceptance/amazon-product-mining-flow.acceptance.ts",
  "scripts/acceptance/amazon-product-mining-keyword-opportunity-review.acceptance.ts",
  "scripts/acceptance/amazon-product-mining-keyword-review-boundary.acceptance.ts",
  "scripts/acceptance/amazon-product-mining-full-cycle.acceptance.ts",
  "scripts/acceptance/amazon-product-mining-app-shell.acceptance.ts",
] as const;

const GOVERNANCE_LAW_PATH = ".github/instructions/agent-rules/modules/module-amazon-product-mining.instructions.md";
const BLUEPRINT_PATH = "docs/法案辅助文件/GrassEye Amazon 产品挖掘施工图.md";

const FORBIDDEN_AI_IDENTIFIERS = [
  "nextAction",
  "actionPlan",
  "selector",
  "coordinate",
  "browserCommand",
  "cookieJar",
] as const;

const FORBIDDEN_PLUGIN_TERMS = ["fallback", "shadow", "bridge", "legacy", "compatibility"] as const;

const hasAnyToken = (text: string, tokens: readonly string[]): boolean =>
  tokens.some((token) => text.includes(token));

const inspectLawStatus = (
  findings: InspectorFinding[],
  lawId: string,
  lawText: string,
): void => {
  if (
    lawText.includes("status: active")
    && !hasAnyToken(lawText, ["status: draft", "Phase 1", "Phase 2", "Activation Checklist"])
  ) {
    return;
  }
  findings.push(createFinding({
    checkId: "amazon-mining/governance-law-status",
    lawId,
    filePath: GOVERNANCE_LAW_PATH,
    message: "Amazon mining law file must be active production governance with no draft/Phase residue.",
  }));
};

const inspectBlueprintStatus = (
  findings: InspectorFinding[],
  lawId: string,
  blueprintText: string,
): void => {
  if (
    blueprintText.includes("status: frozen-production")
    && !hasAnyToken(blueprintText, ["status: frozen-phase-1", "Phase 1", "Phase 2", "draft -> active", "runId"])
  ) {
    return;
  }
  findings.push(createFinding({
    checkId: "amazon-mining/blueprint-status",
    lawId,
    filePath: BLUEPRINT_PATH,
    message: "Amazon mining blueprint must be frozen-production and taskId-only with no phase residue.",
  }));
};

const inspectBlueprintLifecycleTokens = (
  findings: InspectorFinding[],
  lawId: string,
  blueprintText: string,
): void => {
  const missingTabLifecycleTokens = [
    "专用工作标签",
    "复用当前活动标签",
    "不得按页面持续新开标签",
  ].filter((token) => !blueprintText.includes(token));
  if (missingTabLifecycleTokens.length === 0) {
    return;
  }
  findings.push(createFinding({
    checkId: "amazon-mining/blueprint-tab-lifecycle",
    lawId,
    filePath: BLUEPRINT_PATH,
    message: "Amazon mining blueprint must freeze the browser tab lifecycle contract for a single dedicated workspace tab.",
    evidence: `missing=${missingTabLifecycleTokens.join(",")}`,
  }));
};

const inspectKeywordReviewGovernanceTokens = (
  findings: InspectorFinding[],
  lawId: string,
  lawText: string,
  blueprintText: string,
): void => {
  const missingKeywordReviewTokens = [
    "GRASSEYE-AMAZON-PRODUCT-MINING-016-V1",
    "GRASSEYE-AMAZON-PRODUCT-MINING-017-V1",
    "GRASSEYE-AMAZON-PRODUCT-MINING-018-V1",
    "GRASSEYE-AMAZON-PRODUCT-MINING-019-V1",
    "GRASSEYE-AMAZON-PRODUCT-MINING-020-V1",
    "GRASSEYE-AMAZON-PRODUCT-MINING-021-V1",
    "GRASSEYE-AMAZON-PRODUCT-MINING-022-V1",
    "GRASSEYE-AMAZON-PRODUCT-MINING-023-V1",
    "GRASSEYE-AMAZON-PRODUCT-MINING-024-V1",
    "GRASSEYE-AMAZON-PRODUCT-MINING-025-V1",
    "KEYWORD_FULL_PACKAGE_BUILD",
    "KEYWORD_FULL_PACKAGE_INTEGRITY_GATE",
    "KEYWORD_ADVANCED_AI_HANDOFF",
    "KEYWORD_OPPORTUNITY_REVIEW",
    "KEYWORD_REVIEW_PERSIST",
    "APP_HISTORY_UPDATE",
    "Keyword Opportunity Review History",
  ].filter((token) => !lawText.includes(token) && !blueprintText.includes(token));
  if (missingKeywordReviewTokens.length === 0) {
    return;
  }
  findings.push(createFinding({
    checkId: "amazon-mining/keyword-review-governance-tokens",
    lawId,
    filePath: GOVERNANCE_LAW_PATH,
    message: "Amazon mining governance must declare keyword opportunity review laws and blueprint stages.",
    evidence: `missing=${missingKeywordReviewTokens.join(",")}`,
  }));
};

export const inspectGovernanceStatus = (
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  inspectedFiles.add(GOVERNANCE_LAW_PATH);
  inspectedFiles.add(BLUEPRINT_PATH);
  const lawText = readFileSync(resolveFromRepo(GOVERNANCE_LAW_PATH), "utf8");
  const blueprintText = readFileSync(resolveFromRepo(BLUEPRINT_PATH), "utf8");
  inspectLawStatus(findings, lawId, lawText);
  inspectBlueprintStatus(findings, lawId, blueprintText);
  inspectBlueprintLifecycleTokens(findings, lawId, blueprintText);
  inspectKeywordReviewGovernanceTokens(findings, lawId, lawText, blueprintText);
};

export const inspectRequiredPluginFiles = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  for (const repoPath of REQUIRED_PLUGIN_FILES) {
    inspectedFiles.add(repoPath);
    if (getRequiredSourceFile(context, repoPath)) {
      continue;
    }
    findings.push(createFinding({
      checkId: "amazon-mining/required-plugin-file",
      lawId,
      filePath: repoPath,
      message: `${repoPath} is required for the Amazon product mining flow owner surface.`,
    }));
  }
};

export const inspectRequiredAcceptanceFiles = (
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  for (const repoPath of REQUIRED_ACCEPTANCE_FILES) {
    inspectedFiles.add(repoPath);
    if (existsSync(resolveFromRepo(repoPath))) {
      continue;
    }
    findings.push(createFinding({
      checkId: "amazon-mining/required-acceptance-file",
      lawId,
      filePath: repoPath,
      message: `${repoPath} is required for Amazon product mining CI acceptance coverage.`,
    }));
  }
};

export const inspectPluginPublicSurface = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const repoPath = "src/plugins/amazon-product-mining/index.ts";
  const pluginIndex = getRequiredSourceFile(context, repoPath);
  const resultRepoPath = "src/plugins/amazon-product-mining/amazon-product-mining.result.ts";
  const resultFile = getRequiredSourceFile(context, resultRepoPath);
  trackSourceFile(inspectedFiles, pluginIndex);
  trackSourceFile(inspectedFiles, resultFile);
	  const requiredExports = [
	    "startAmazonProductMiningMission",
	    "getAmazonProductMiningTaskStatus",
	    "getLatestAmazonProductMiningTask",
	    "listAmazonProductMiningKeywordReviews",
	    "getAmazonProductMiningKeywordReview",
	    "exportAmazonProductMiningResult",
	    "AmazonMiningSchemas",
	  ];
  const requiredReadModelSymbols = [
    "buildTaskReadModel",
    "createKeywordProgress",
    "getSearchResultsForKeyword",
    "getProductDetailsForTask",
    "getReviewsForProduct",
    "getSearchResultProductLinksForTask",
    "listKeywordOpportunityReviews",
  ];
  const requiredResultSymbols = [
    "AmazonTaskKeywordProgress",
    "AmazonTaskRunSummary",
    "AmazonTaskResultSnapshot",
    "keywords",
    "summary",
  ];
  if (
    pluginIndex
    && resultFile
    && requiredExports.every((name) => hasIdentifier(pluginIndex, name))
    && requiredReadModelSymbols.every((name) => hasIdentifier(pluginIndex, name))
    && requiredResultSymbols.every((name) => hasIdentifier(resultFile, name))
  ) {
    return;
  }
  findings.push(createFinding({
    checkId: "amazon-mining/plugin-public-surface",
    lawId,
    filePath: repoPath,
    message: "Amazon mining plugin index.ts must expose required public functions and schemas.",
  }));
};

export const inspectWorkbenchHandle = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const repoPath = "src/lib/local-runtime/workbench.ts";
  const workbench = getRequiredSourceFile(context, repoPath);
  trackSourceFile(inspectedFiles, workbench);
	  const requiredNames = [
	    "startAmazonProductMiningMission",
	    "getAmazonProductMiningTaskStatus",
	    "getLatestAmazonProductMiningTask",
	    "listAmazonProductMiningKeywordReviews",
	    "getAmazonProductMiningKeywordReview",
	    "exportAmazonProductMiningResult",
	  ];
  if (workbench && requiredNames.every((name) => hasIdentifier(workbench, name))) {
    return;
  }
  findings.push(createFinding({
    checkId: "amazon-mining/workbench-handle",
    lawId,
    filePath: repoPath,
    message: "workbench.ts must expose Amazon mining handle methods.",
  }));
};

export const inspectAppShellRoutes = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const repoPath = "src/app/workbench-amazon-product-mining-routes.ts";
  const routesFile = getRequiredSourceFile(context, repoPath);
  trackSourceFile(inspectedFiles, routesFile);
	  const requiredRoutes = [
	    "POST:/api/amazon-product-mining/mission",
	    "GET:/api/amazon-product-mining/run",
	    "GET:/api/amazon-product-mining/latest",
	    "GET:/api/amazon-product-mining/keyword-reviews",
	    "GET:/api/amazon-product-mining/keyword-review",
	    "GET:/api/amazon-product-mining/export",
	  ];
  if (!routesFile || !requiredRoutes.every((route) => hasStringLiteral(routesFile, route))) {
    findings.push(createFinding({
      checkId: "amazon-mining/app-shell-routes",
      lawId,
      filePath: repoPath,
      message: "Amazon mining routes file must expose mission, run, latest, and export routes.",
    }));
    return;
  }
  if (fileIncludesText(routesFile, "runId") || fileIncludesText(routesFile, "taskId || runId")) {
    findings.push(createFinding({
      checkId: "amazon-mining/app-shell-routes-taskid-only",
      lawId,
      filePath: repoPath,
      message: "Amazon mining routes file must remain taskId-only with no runId compatibility.",
    }));
  }
};

export const inspectForbiddenAiIdentifiers = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const checkFiles = [
    "src/plugins/amazon-product-mining/amazon-product-mining.keyword.ts",
    "src/plugins/amazon-product-mining/amazon-product-mining.flow.ts",
  ];
  for (const repoPath of checkFiles) {
    const sourceFile = getRequiredSourceFile(context, repoPath);
    trackSourceFile(inspectedFiles, sourceFile);
    if (!sourceFile) {
      continue;
    }
    const sourceText = `${literalText(sourceFile)}\n${identifierText(sourceFile)}`;
    for (const forbiddenId of FORBIDDEN_AI_IDENTIFIERS) {
      if (!sourceText.includes(forbiddenId) && !hasIdentifier(sourceFile, forbiddenId)) {
        continue;
      }
      findings.push(createFinding({
        checkId: `amazon-mining/forbidden-identifier-${forbiddenId}`,
        lawId,
        filePath: repoPath,
        message: `Forbidden identifier '${forbiddenId}' found in ${repoPath}. AI must not use planning/navigation/bridging patterns.`,
      }));
    }
  }
};

export const inspectForbiddenPluginTerms = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  for (const repoPath of REQUIRED_PLUGIN_FILES) {
    const sourceFile = getRequiredSourceFile(context, repoPath);
    trackSourceFile(inspectedFiles, sourceFile);
    if (!sourceFile) {
      continue;
    }
    const sourceText = `${literalText(sourceFile)}\n${identifierText(sourceFile)}`.toLowerCase();
    for (const forbiddenTerm of FORBIDDEN_PLUGIN_TERMS) {
      if (!sourceText.includes(forbiddenTerm)) {
        continue;
      }
      findings.push(createFinding({
        checkId: `amazon-mining/forbidden-plugin-term-${forbiddenTerm}`,
        lawId,
        filePath: repoPath,
        message: `Active Amazon plugin code must not contain forbidden term '${forbiddenTerm}' in any case form.`,
      }));
    }
  }
};

export const inspectNoAbilityGroupBoundary = (
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

  const routesPath = "src/app/workbench-amazon-product-mining-routes.ts";
  const routesFile = getRequiredSourceFile(context, routesPath);
  trackSourceFile(inspectedFiles, routesFile);
  if (!routesFile) {
    return;
  }

  const forbiddenCapabilityPatterns = [
    "createAiInputGatewayAbilityGroup",
    "createDomAutomationAbilityGroup",
    "createForensicsPersistenceAbilityGroup",
  ];
  for (const pattern of forbiddenCapabilityPatterns) {
    if (!hasIdentifier(routesFile, pattern)) {
      continue;
    }
    findings.push(createFinding({
      checkId: "amazon-mining/no-direct-capability-in-routes",
      lawId,
      filePath: routesPath,
      message: `Routes file must not directly call ${pattern}. Business logic belongs in the plugin, not app shell.`,
    }));
  }
};
