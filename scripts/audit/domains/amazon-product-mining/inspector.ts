import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { SyntaxKind, type SourceFile } from "ts-morph";

import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { loadGeneratedAuditPlan } from "../../core/load-audit-plan.js";
import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding, InspectorOutput } from "../../shared/inspector-contracts.js";
import { createAuditProject } from "../../shared/project.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { getRepoSourcePath } from "../../shared/source-files.js";
import { inspectProductDetailDomContract } from "./inspector-product-detail-dom-contract.js";
import { buildAmazonMiningInspectorReport, inspectBrowserTabLifecycle } from "./inspector-tab-lifecycle.js";
import { inspectArtifactOutputs, inspectWorkbenchHomeSurface } from "./inspector-app-surface.js";

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
  "scripts/acceptance/amazon-product-mining-full-cycle.acceptance.ts",
  "scripts/acceptance/amazon-product-mining-app-ui.acceptance.ts",
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

const hasIdentifier = (sourceFile: SourceFile, identifierName: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).some((id) => id.getText() === identifierName);

const hasStringLiteral = (sourceFile: SourceFile, literalValue: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).some((lit) => lit.getLiteralValue() === literalValue);

const literalText = (sourceFile: SourceFile): string => [
  ...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText()),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((node) => node.getLiteralText()),
].join("\n");

const identifierText = (sourceFile: SourceFile): string =>
  sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText()).join("\n");

const fileIncludesText = (sourceFile: SourceFile, text: string): boolean =>
  literalText(sourceFile).includes(text) || identifierText(sourceFile).includes(text);

const getRequiredSourceFile = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

const trackSourceFile = (inspectedFiles: Set<string>, sourceFile: SourceFile | undefined): void => {
  if (sourceFile) inspectedFiles.add(getRepoSourcePath(sourceFile));
};

const inspectGovernanceStatus = (
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  inspectedFiles.add(GOVERNANCE_LAW_PATH);
  inspectedFiles.add(BLUEPRINT_PATH);
  const lawText = readFileSync(resolveFromRepo(GOVERNANCE_LAW_PATH), "utf8");
  const blueprintText = readFileSync(resolveFromRepo(BLUEPRINT_PATH), "utf8");

  if (!lawText.includes("status: active") || lawText.includes("status: draft") || /Phase 1|Phase 2|Activation Checklist/.test(lawText)) {
    findings.push(createFinding({
      checkId: "amazon-mining/governance-law-status",
      lawId,
      filePath: GOVERNANCE_LAW_PATH,
      message: "Amazon mining law file must be active production governance with no draft/Phase residue.",
    }));
  }

  if (!blueprintText.includes("status: frozen-production") || blueprintText.includes("status: frozen-phase-1") || /Phase 1|Phase 2|draft -> active|runId/.test(blueprintText)) {
    findings.push(createFinding({
      checkId: "amazon-mining/blueprint-status",
      lawId,
      filePath: BLUEPRINT_PATH,
      message: "Amazon mining blueprint must be frozen-production and taskId-only with no phase residue.",
    }));
  }

  const missingTabLifecycleTokens = [
    "专用工作标签",
    "复用当前活动标签",
    "不得按页面持续新开标签",
  ].filter((token) => !blueprintText.includes(token));

  if (missingTabLifecycleTokens.length > 0) {
    findings.push(createFinding({
      checkId: "amazon-mining/blueprint-tab-lifecycle",
      lawId,
      filePath: BLUEPRINT_PATH,
      message: "Amazon mining blueprint must freeze the browser tab lifecycle contract for a single dedicated workspace tab.",
      evidence: `missing=${missingTabLifecycleTokens.join(",")}`,
    }));
  }
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

const inspectPackageScript = (
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const packagePath = "package.json";
  inspectedFiles.add(packagePath);
  const scripts = (JSON.parse(readFileSync(resolveFromRepo(packagePath), "utf8")) as { scripts?: Record<string, string> }).scripts ?? {};
  const acceptanceScript = scripts["acceptance:amazon-product-mining"];
  if (!acceptanceScript) {
    findings.push(createFinding({
      checkId: "amazon-mining/package-acceptance-script",
      lawId,
      filePath: packagePath,
      message: "package.json must expose acceptance:amazon-product-mining script.",
    }));
  }
  if (acceptanceScript && !acceptanceScript.includes("amazon-product-mining-app-ui.acceptance.ts")) {
    findings.push(createFinding({
      checkId: "amazon-mining/package-acceptance-script-app-ui",
      lawId,
      filePath: packagePath,
      message: "acceptance:amazon-product-mining must include amazon-product-mining-app-ui.acceptance.ts.",
    }));
  }
  if (scripts["audit:amazon-product-mining"] !== "node --import tsx scripts/audit/domains/amazon-product-mining/inspector.ts") {
    findings.push(createFinding({
      checkId: "amazon-mining/package-audit-script",
      lawId,
      filePath: packagePath,
      message: "package.json must expose audit:amazon-product-mining using the amazon inspector entrypoint.",
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

const inspectProductDetailDomFallbacks = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const repoPath = "src/plugins/amazon-product-mining/amazon-product-mining.product-detail.ts";
  const detailFile = getRequiredSourceFile(context, repoPath);
  trackSourceFile(inspectedFiles, detailFile);
  inspectProductDetailDomContract({
    sourceFile: detailFile,
    findings,
    lawId,
    filePath: repoPath,
  });
};

const inspectForbiddenAiIdentifiers = (
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
    const sourceText = `${literalText(sourceFile)}\n${identifierText(sourceFile)}`;
    for (const forbiddenId of FORBIDDEN_AI_IDENTIFIERS) {
      if (!sourceText.includes(forbiddenId) && !hasIdentifier(sourceFile, forbiddenId)) continue;
      findings.push(createFinding({
        checkId: `amazon-mining/forbidden-identifier-${forbiddenId}`,
        lawId,
        filePath: repoPath,
        message: `Forbidden identifier '${forbiddenId}' found in ${repoPath}. AI must not use planning/navigation/bridging patterns.`,
      }));
    }
  }
};

const inspectForbiddenPluginTerms = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  for (const repoPath of REQUIRED_PLUGIN_FILES) {
    const sourceFile = getRequiredSourceFile(context, repoPath);
    trackSourceFile(inspectedFiles, sourceFile);
    if (!sourceFile) continue;
    const sourceText = `${literalText(sourceFile)}\n${identifierText(sourceFile)}`.toLowerCase();
    for (const forbiddenTerm of FORBIDDEN_PLUGIN_TERMS) {
      if (!sourceText.includes(forbiddenTerm)) continue;
      findings.push(createFinding({
        checkId: `amazon-mining/forbidden-plugin-term-${forbiddenTerm}`,
        lawId,
        filePath: repoPath,
        message: `Active Amazon plugin code must not contain forbidden term '${forbiddenTerm}' in any case form.`,
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

  inspectGovernanceStatus(findings, inspectedFiles, flowLawId);
  inspectRequiredPluginFiles(context, findings, inspectedFiles, flowLawId);
  inspectRequiredAcceptanceFiles(findings, inspectedFiles, flowLawId);
  inspectPluginPublicSurface(context, findings, inspectedFiles, surfaceLawId);
  inspectWorkbenchHandle(context, findings, inspectedFiles, surfaceLawId);
  inspectAppShellRoutes(context, findings, inspectedFiles, surfaceLawId);
  inspectWorkbenchHomeSurface(context, findings, inspectedFiles, surfaceLawId);
  inspectArtifactOutputs(context, findings, inspectedFiles, surfaceLawId);
  inspectPackageScript(findings, inspectedFiles, surfaceLawId);
  inspectFlowSearchBeforeDetail(context, findings, inspectedFiles, searchLawId);
  inspectProductDetailDomFallbacks(context, findings, inspectedFiles, searchLawId);
  inspectReviewsPerPagePersistence(context, findings, inspectedFiles, reviewLawId);
  inspectForbiddenAiIdentifiers(context, findings, inspectedFiles, keywordLawId);
  inspectForbiddenPluginTerms(context, findings, inspectedFiles, surfaceLawId);
  inspectNoAbilityGroupBoundary(context, findings, inspectedFiles, surfaceLawId);
  const tabLifecycleDebug = inspectBrowserTabLifecycle(context, findings, inspectedFiles, surfaceLawId);

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...inspectedFiles].sort(),
    reportJson: buildAmazonMiningInspectorReport({ findings, tabLifecycleDebug }),
  };
};

const runInspectorFromCli = async (): Promise<void> => {
  buildAuditArtifacts();
  const planEntry = loadGeneratedAuditPlan().find((entry) => entry.capabilityDomain === "amazon-product-mining");
  if (!planEntry) {
    throw new Error("amazon-product-mining audit plan entry is missing.");
  }
  const output = await inspectDomain({
    project: createAuditProject(),
    planEntry,
    generatedPlan: [planEntry],
    completedReports: {},
  });
  if (output.findings.length > 0) {
    throw new Error(`amazon-product-mining failed with ${output.findings.length} finding(s).`);
  }
  process.stdout.write("[AUDIT] amazon-product-mining PASS\n");
};

const isEntrypoint = (): boolean => {
  const invokedPath = process.argv[1];
  return invokedPath !== undefined && resolve(invokedPath) === fileURLToPath(import.meta.url);
};

if (isEntrypoint()) {
  await runInspectorFromCli();
}
