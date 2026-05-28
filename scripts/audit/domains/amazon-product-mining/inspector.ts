import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { loadGeneratedAuditPlan } from "../../core/load-audit-plan.js";
import { selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding, InspectorOutput } from "../../shared/inspector-contracts.js";
import { createAuditProject } from "../../shared/project.js";
import { inspectArtifactOutputs, inspectWorkbenchHomeSurface } from "./inspector-app-surface.js";
import {
  inspectAppShellRoutes,
  inspectForbiddenAiIdentifiers,
  inspectForbiddenPluginTerms,
  inspectGovernanceStatus,
  inspectNoAbilityGroupBoundary,
  inspectPluginPublicSurface,
  inspectRequiredAcceptanceFiles,
  inspectRequiredPluginFiles,
  inspectWorkbenchHandle,
} from "./inspector-governance-surface.js";
import {
  inspectKeywordReviewAppSurface,
  inspectKeywordReviewEvidenceSliceDepth,
  inspectKeywordReviewPromptAndFlow,
  inspectKeywordReviewLawAndBlueprint,
  inspectKeywordReviewSchemaAndStorage,
} from "./inspector-keyword-review-governance.js";
import { inspectPackageScript } from "./inspector-package-scripts.js";
import {
  inspectBrowserTabExtractionContract,
  inspectProductDetailDomFallbacks,
  inspectSearchExtractionProductionPath,
} from "./inspector-production-browser-paths.js";
import {
  inspectAmazonHumanPacingDelay,
  inspectAmazonWebChatRestoreContinuity,
  inspectFlowSearchBeforeDetail,
  inspectGptWebChatIsolationForKeywordMining,
  inspectPackageEvidenceDepthContract,
  inspectRejectedKeywordEvidencePurge,
  inspectReviewsPerPagePersistence,
} from "./inspector-production-paths.js";
import { buildAmazonMiningInspectorReport, inspectBrowserTabLifecycle } from "./inspector-tab-lifecycle.js";
import { inspectAmazonTaskResumeAndControls } from "./inspector-task-controls.js";

type AmazonMiningLawIds = {
  artifact: string;
  delivery: string;
  flow: string;
  humanPacing: string;
  keyword: string;
  keywordReviewBoundary: string;
  keywordReviewEvidenceDepth: string;
  keywordReviewSchema: string;
  keywordReviewSurface: string;
  rejectedKeywordPurge: string;
  taskResumeAndControls: string;
  review: string;
  search: string;
  surface: string;
  webChatRestore: string;
};

const selectAmazonMiningLawIds = (context: InspectorContext): AmazonMiningLawIds => ({
  artifact: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-PRODUCT-MINING-013-V1"),
  delivery: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-PRODUCT-MINING-015-V1"),
  flow: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-PRODUCT-MINING-001-V1"),
  humanPacing: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-PRODUCT-MINING-019-V1"),
  keyword: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-PRODUCT-MINING-003-V1"),
  keywordReviewBoundary: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-PRODUCT-MINING-016-V1"),
  keywordReviewEvidenceDepth: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-PRODUCT-MINING-023-V1"),
  keywordReviewSchema: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-PRODUCT-MINING-017-V1"),
  keywordReviewSurface: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-PRODUCT-MINING-018-V1"),
  rejectedKeywordPurge: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-PRODUCT-MINING-021-V1"),
  taskResumeAndControls: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-PRODUCT-MINING-024-V1"),
  review: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-PRODUCT-MINING-007-V1"),
  search: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-PRODUCT-MINING-005-V1"),
  surface: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-PRODUCT-MINING-002-V1"),
  webChatRestore: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-PRODUCT-MINING-022-V1"),
});

const inspectGovernanceAndSurface = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawIds: AmazonMiningLawIds,
): void => {
  inspectGovernanceStatus(findings, inspectedFiles, lawIds.flow);
  inspectRequiredPluginFiles(context, findings, inspectedFiles, lawIds.flow);
  inspectRequiredAcceptanceFiles(findings, inspectedFiles, lawIds.flow);
  inspectPluginPublicSurface(context, findings, inspectedFiles, lawIds.surface);
  inspectWorkbenchHandle(context, findings, inspectedFiles, lawIds.surface);
  inspectAppShellRoutes(context, findings, inspectedFiles, lawIds.surface);
  inspectWorkbenchHomeSurface(context, findings, inspectedFiles, lawIds.surface);
  inspectArtifactOutputs(context, findings, inspectedFiles, lawIds.artifact);
  inspectPackageScript(findings, inspectedFiles, lawIds.delivery);
};

const inspectKeywordReviewContracts = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawIds: AmazonMiningLawIds,
): void => {
  inspectKeywordReviewLawAndBlueprint(findings, inspectedFiles, lawIds.keywordReviewBoundary);
  inspectKeywordReviewSchemaAndStorage(context, findings, inspectedFiles, lawIds.keywordReviewSchema);
  inspectKeywordReviewPromptAndFlow(context, findings, inspectedFiles, lawIds.keywordReviewBoundary);
  inspectKeywordReviewEvidenceSliceDepth(context, findings, inspectedFiles, lawIds.keywordReviewEvidenceDepth);
  inspectKeywordReviewAppSurface(context, findings, inspectedFiles, lawIds.keywordReviewSurface);
};

const inspectProductionContracts = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawIds: AmazonMiningLawIds,
): void => {
  inspectGptWebChatIsolationForKeywordMining(context, findings, inspectedFiles, lawIds.keyword);
  inspectFlowSearchBeforeDetail(context, findings, inspectedFiles, lawIds.search);
  inspectAmazonHumanPacingDelay(context, findings, inspectedFiles, lawIds.humanPacing);
  inspectRejectedKeywordEvidencePurge(context, findings, inspectedFiles, lawIds.rejectedKeywordPurge);
  inspectAmazonTaskResumeAndControls(context, findings, inspectedFiles, lawIds.taskResumeAndControls);
  inspectAmazonWebChatRestoreContinuity(context, findings, inspectedFiles, lawIds.webChatRestore);
  inspectSearchExtractionProductionPath(context, findings, inspectedFiles, lawIds.search);
  inspectBrowserTabExtractionContract(
    context,
    findings,
    inspectedFiles,
    lawIds.search,
    {
      repoPath: "src/plugins/amazon-product-mining/amazon-product-mining.product-detail.ts",
      checkPrefix: "detail",
      subject: "Amazon product detail",
      scriptVariableName: "AMAZON_DETAIL_EXTRACT_SCRIPT",
      extractScriptImportPath: "./amazon-product-mining.product-detail-script.js",
      extractScriptRepoPath: "src/plugins/amazon-product-mining/amazon-product-mining.product-detail-script.ts",
    },
  );
  inspectBrowserTabExtractionContract(
    context,
    findings,
    inspectedFiles,
    lawIds.review,
    {
      repoPath: "src/plugins/amazon-product-mining/amazon-product-mining.reviews.ts",
      checkPrefix: "reviews",
      subject: "Amazon review page",
      scriptVariableName: "AMAZON_REVIEWS_EXTRACT_SCRIPT",
    },
  );
  inspectProductDetailDomFallbacks(context, findings, inspectedFiles, lawIds.search);
  inspectReviewsPerPagePersistence(context, findings, inspectedFiles, lawIds.review);
  inspectPackageEvidenceDepthContract(context, findings, inspectedFiles, lawIds.artifact);
  inspectForbiddenAiIdentifiers(context, findings, inspectedFiles, lawIds.keyword);
  inspectForbiddenPluginTerms(context, findings, inspectedFiles, lawIds.surface);
  inspectNoAbilityGroupBoundary(context, findings, inspectedFiles, lawIds.surface);
};

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const project = context.project;
  const lawIds = selectAmazonMiningLawIds(context);
  const findings: InspectorFinding[] = [];
  const inspectedFiles = new Set<string>();

  inspectGovernanceAndSurface(context, findings, inspectedFiles, lawIds);
  inspectKeywordReviewContracts(context, findings, inspectedFiles, lawIds);
  inspectProductionContracts(context, findings, inspectedFiles, lawIds);
  const tabLifecycleDebug = inspectBrowserTabLifecycle({ ...context, project }, findings, inspectedFiles, lawIds.surface);

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
};
