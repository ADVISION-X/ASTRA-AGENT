import { existsSync, readFileSync } from "node:fs";

import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding, InspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { getRepoSourcePath } from "../../shared/source-files.js";

const REQUIRED_PLUGIN_FILES = [
  "src/plugins/amazon-product-mining/amazon-product-mining.schema.ts",
  "src/plugins/amazon-product-mining/amazon-product-mining.storage-schema.ts",
  "src/plugins/amazon-product-mining/amazon-product-mining.storage.ts",
  "src/plugins/amazon-product-mining/amazon-product-mining.logging.ts",
  "src/plugins/amazon-product-mining/amazon-product-mining.keyword.ts",
  "src/plugins/amazon-product-mining/amazon-product-mining.search.ts",
  "src/plugins/amazon-product-mining/amazon-product-mining.product-detail.ts",
  "src/plugins/amazon-product-mining/amazon-product-mining.reviews.ts",
  "src/plugins/amazon-product-mining/amazon-product-mining.package.ts",
  "src/plugins/amazon-product-mining/amazon-product-mining.pdf.ts",
  "src/plugins/amazon-product-mining/amazon-product-mining.handoff.ts",
  "src/plugins/amazon-product-mining/amazon-product-mining.result.ts",
  "src/plugins/amazon-product-mining/amazon-product-mining.flow.ts",
  "src/plugins/amazon-product-mining/index.ts",
] as const;

const REQUIRED_ACCEPTANCE_FILES = [
  "scripts/acceptance/amazon-product-mining-storage.acceptance.ts",
  "scripts/acceptance/amazon-product-mining-keyword-dedup.acceptance.ts",
  "scripts/acceptance/amazon-product-mining-search-page.acceptance.ts",
  "scripts/acceptance/amazon-product-mining-detail-page.acceptance.ts",
  "scripts/acceptance/amazon-product-mining-review-pagination.acceptance.ts",
  "scripts/acceptance/amazon-product-mining-package.acceptance.ts",
  "scripts/acceptance/amazon-product-mining-flow.acceptance.ts",
] as const;

const FORBIDDEN_IDENTIFIERS = [
  "nextAction",
  "actionPlan",
  "cookieJar",
  "fallback",
  "shadow",
  "bridge",
  "legacy",
] as const;

const hasIdentifier = (sourceFile: SourceFile, identifierName: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).some((id) => id.getText() === identifierName);

const hasStringLiteral = (sourceFile: SourceFile, literalValue: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).some((lit) => lit.getLiteralValue() === literalValue);

const getRequiredSourceFile = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

const trackSourceFile = (inspectedFiles: Set<string>, sourceFile: SourceFile | undefined): void => {
  if (sourceFile) inspectedFiles.add(getRepoSourcePath(sourceFile));
};

const inspectRequiredPluginFiles = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  for (const repoPath of REQUIRED_PLUGIN_FILES) {
    inspectedFiles.add(repoPath);
    if (getRequiredSourceFile(context, repoPath)) continue;
    findings.push(createFinding({
      checkId: "amazon-mining/required-plugin-file",
      lawId,
      filePath: repoPath,
      message: `${repoPath} is required for the Amazon product mining flow owner surface.`,
    }));
  }
};

const inspectRequiredAcceptanceFiles = (
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  for (const repoPath of REQUIRED_ACCEPTANCE_FILES) {
    inspectedFiles.add(repoPath);
    if (existsSync(resolveFromRepo(repoPath))) continue;
    findings.push(createFinding({
      checkId: "amazon-mining/required-acceptance-file",
      lawId,
      filePath: repoPath,
      message: `${repoPath} is required for Amazon product mining CI acceptance coverage.`,
    }));
  }
};

const inspectPluginPublicSurface = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const repoPath = "src/plugins/amazon-product-mining/index.ts";
  const pluginIndex = getRequiredSourceFile(context, repoPath);
  trackSourceFile(inspectedFiles, pluginIndex);
  const requiredExports = [
    "startAmazonProductMiningMission",
    "getAmazonProductMiningTaskStatus",
    "getLatestAmazonProductMiningTask",
    "exportAmazonProductMiningResult",
    "AmazonMiningSchemas",
  ];
  if (pluginIndex && requiredExports.every((name) => hasIdentifier(pluginIndex, name))) return;
  findings.push(createFinding({
    checkId: "amazon-mining/plugin-public-surface",
    lawId,
    filePath: repoPath,
    message: "Amazon mining plugin index.ts must expose required public functions and schemas.",
  }));
};

const inspectWorkbenchHandle = (
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
    "exportAmazonProductMiningResult",
  ];
  if (workbench && requiredNames.every((name) => hasIdentifier(workbench, name))) return;
  findings.push(createFinding({
    checkId: "amazon-mining/workbench-handle",
    lawId,
    filePath: repoPath,
    message: "workbench.ts must expose Amazon mining handle methods.",
  }));
};

const inspectAppShellRoutes = (
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
    "GET:/api/amazon-product-mining/export",
  ];
  if (routesFile && requiredRoutes.every((route) => hasStringLiteral(routesFile, route))) return;
  findings.push(createFinding({
    checkId: "amazon-mining/app-shell-routes",
    lawId,
    filePath: repoPath,
    message: "Amazon mining routes file must expose mission, run, latest, and export routes.",
  }));
};

const inspectPackageScript = (
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const packagePath = "package.json";
  inspectedFiles.add(packagePath);
  const scripts = (JSON.parse(readFileSync(resolveFromRepo(packagePath), "utf8")) as { scripts?: Record<string, string> }).scripts ?? {};
  if (!scripts["acceptance:amazon-product-mining"]) {
    findings.push(createFinding({
      checkId: "amazon-mining/package-acceptance-script",
      lawId,
      filePath: packagePath,
      message: "package.json must expose acceptance:amazon-product-mining script.",
    }));
  }
};

const inspectFlowSearchBeforeDetail = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const repoPath = "src/plugins/amazon-product-mining/amazon-product-mining.flow.ts";
  const flowFile = getRequiredSourceFile(context, repoPath);
  trackSourceFile(inspectedFiles, flowFile);
  if (!flowFile) return;
  const text = flowFile.getFullText();
  // Skip past import declarations to find actual call positions in the function body
  const lastFromIdx = Math.max(text.lastIndexOf("from '"), text.lastIndexOf('from "'));
  const bodyStart = lastFromIdx > 0 ? lastFromIdx : 0;
  const persistSearchIdx = text.indexOf("persistSearchResults", bodyStart);
  const productDetailOpenIdx = text.indexOf("runProductDetailExtraction(", bodyStart);
  if (persistSearchIdx < 0 || productDetailOpenIdx < 0) {
    findings.push(createFinding({
      checkId: "amazon-mining/search-before-detail",
      lawId,
      filePath: repoPath,
      message: "flow.ts must call persistSearchResults before runProductDetailExtraction (law 005).",
    }));
    return;
  }
  if (persistSearchIdx > productDetailOpenIdx) {
    findings.push(createFinding({
      checkId: "amazon-mining/search-persist-before-detail",
      lawId,
      filePath: repoPath,
      message: "persistSearchResults must appear before runProductDetailExtraction in flow.ts (law 005).",
    }));
  }
};

const inspectReviewsPerPagePersistence = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const repoPath = "src/plugins/amazon-product-mining/amazon-product-mining.reviews.ts";
  const reviewsFile = getRequiredSourceFile(context, repoPath);
  trackSourceFile(inspectedFiles, reviewsFile);
  if (!reviewsFile) return;
  // onPageExtracted callback must be present and called inside a while loop (law 007)
  const hasOnPageExtracted = hasIdentifier(reviewsFile, "onPageExtracted");
  const hasWhileLoop = reviewsFile.getDescendantsOfKind(SyntaxKind.WhileStatement).length > 0;
  const hasPerPagePersistence = hasOnPageExtracted && hasWhileLoop;
  if (!hasOnPageExtracted || !hasPerPagePersistence) {
    findings.push(createFinding({
      checkId: "amazon-mining/reviews-per-page-persistence",
      lawId,
      filePath: repoPath,
      message: "reviews.ts must persist reviews per page inside pagination loop via onPageExtracted callback (law 007).",
    }));
  }
};

const inspectForbiddenIdentifiers = (
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
    if (!sourceFile) continue;
    for (const forbiddenId of FORBIDDEN_IDENTIFIERS) {
      if (!hasIdentifier(sourceFile, forbiddenId)) continue;
      findings.push(createFinding({
        checkId: `amazon-mining/forbidden-identifier-${forbiddenId}`,
        lawId,
        filePath: repoPath,
        message: `Forbidden identifier '${forbiddenId}' found in ${repoPath}. AI must not use planning/navigation/bridging patterns.`,
      }));
    }
  }
};

const inspectNoAbilityGroupBoundary = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const repoPath = "src/plugins/amazon-product-mining/amazon-product-mining.flow.ts";
  const flowFile = getRequiredSourceFile(context, repoPath);
  trackSourceFile(inspectedFiles, flowFile);
  if (!flowFile) return;
  // Verify app routes file does NOT contain direct capability calls
  const routesPath = "src/app/workbench-amazon-product-mining-routes.ts";
  const routesFile = getRequiredSourceFile(context, routesPath);
  trackSourceFile(inspectedFiles, routesFile);
  if (!routesFile) return;
  const forbiddenCapabilityPatterns = [
    "createAiInputGatewayAbilityGroup",
    "createDomAutomationAbilityGroup",
    "createForensicsPersistenceAbilityGroup",
  ];
  for (const pattern of forbiddenCapabilityPatterns) {
    if (!hasIdentifier(routesFile, pattern)) continue;
    findings.push(createFinding({
      checkId: "amazon-mining/no-direct-capability-in-routes",
      lawId,
      filePath: routesPath,
      message: `Routes file must not directly call ${pattern}. Business logic belongs in the plugin, not app shell.`,
    }));
  }
};

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const flowLawId = selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-PRODUCT-MINING-001-V1");
  const surfaceLawId = selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-PRODUCT-MINING-002-V1");
  const keywordLawId = selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-PRODUCT-MINING-003-V1");
  const searchLawId = selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-PRODUCT-MINING-005-V1");
  const reviewLawId = selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-PRODUCT-MINING-007-V1");
  const findings: InspectorFinding[] = [];
  const inspectedFiles = new Set<string>();

  inspectRequiredPluginFiles(context, findings, inspectedFiles, flowLawId);
  inspectRequiredAcceptanceFiles(findings, inspectedFiles, flowLawId);
  inspectPluginPublicSurface(context, findings, inspectedFiles, surfaceLawId);
  inspectWorkbenchHandle(context, findings, inspectedFiles, surfaceLawId);
  inspectAppShellRoutes(context, findings, inspectedFiles, surfaceLawId);
  inspectPackageScript(findings, inspectedFiles, surfaceLawId);
  inspectFlowSearchBeforeDetail(context, findings, inspectedFiles, searchLawId);
  inspectReviewsPerPagePersistence(context, findings, inspectedFiles, reviewLawId);
  inspectForbiddenIdentifiers(context, findings, inspectedFiles, keywordLawId);
  inspectNoAbilityGroupBoundary(context, findings, inspectedFiles, surfaceLawId);

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...inspectedFiles].sort(),
  };
};
