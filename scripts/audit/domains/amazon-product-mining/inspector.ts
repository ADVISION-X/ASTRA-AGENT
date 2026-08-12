import { selectLawId } from "../../shared/finding-utils.js";
import { type InspectorContext, type InspectorFinding, type InspectorOutput, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
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
import { inspectKeywordReviewPackageAggregation } from "./inspector-keyword-review-package-aggregation.js";
import { inspectKeywordFullPackageHandoff } from "./inspector-keyword-full-package.js";
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
  inspectNeutralKeywordGenerationPrompt,
  inspectPackageEvidenceDepthContract,
  inspectRejectedKeywordEvidenceRetention,
  inspectReviewsPerPagePersistence,
} from "./inspector-production-paths.js";
import {
  inspectAmazonRuntimeFailureEvidenceContract,
  inspectDuplicateProductDetailSuppressionContract,
  inspectKeywordHistoricalDedupContract,
  inspectKeywordReviewLooseQuoteParserContract,
  inspectSearchSponsoredUrlNormalization,
} from "./inspector-runtime-truth.js";
import { buildAmazonMiningInspectorReport, inspectBrowserTabLifecycle } from "./inspector-tab-lifecycle.js";
import { inspectAmazonTaskResumeAndControls } from "./inspector-task-controls.js";

type AmazonMiningLawIds = {
  artifact: string;
  delivery: string;
  flow: string;
  humanPacing: string;
  keyword: string;
  keywordGeneration: string;
  keywordReviewBoundary: string;
  keywordReviewEvidenceDepth: string;
  keywordReviewFullPackage: string;
  keywordReviewSchema: string;
  keywordReviewSurface: string;
  rejectedKeywordRetention: string;
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
  keywordGeneration: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-PRODUCT-MINING-004-V1"),
  keywordReviewBoundary: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-PRODUCT-MINING-016-V1"),
  keywordReviewEvidenceDepth: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-PRODUCT-MINING-023-V1"),
  keywordReviewFullPackage: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-PRODUCT-MINING-025-V1"),
  keywordReviewSchema: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-PRODUCT-MINING-017-V1"),
  keywordReviewSurface: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-PRODUCT-MINING-018-V1"),
  rejectedKeywordRetention: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-PRODUCT-MINING-021-V1"),
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
  inspectGovernanceStatus(context, findings, inspectedFiles, lawIds.flow);
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
  inspectKeywordReviewLawAndBlueprint(context, findings, inspectedFiles, lawIds.keywordReviewBoundary);
  inspectKeywordReviewSchemaAndStorage(context, findings, inspectedFiles, lawIds.keywordReviewSchema);
  inspectKeywordReviewPromptAndFlow(context, findings, inspectedFiles, lawIds.keywordReviewBoundary);
  inspectKeywordReviewEvidenceSliceDepth(context, findings, inspectedFiles, lawIds.keywordReviewEvidenceDepth);
  inspectKeywordFullPackageHandoff(context, findings, inspectedFiles, lawIds.keywordReviewFullPackage);
  inspectKeywordReviewPackageAggregation(context, findings, inspectedFiles, lawIds.keywordReviewBoundary);
  inspectKeywordReviewAppSurface(context, findings, inspectedFiles, lawIds.keywordReviewSurface);
};

const inspectProductionContracts = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawIds: AmazonMiningLawIds,
): void => {
  inspectGptWebChatIsolationForKeywordMining(context, findings, inspectedFiles, lawIds.keyword);
  inspectNeutralKeywordGenerationPrompt(context, findings, inspectedFiles, lawIds.keywordGeneration);
  inspectFlowSearchBeforeDetail(context, findings, inspectedFiles, lawIds.search);
  inspectAmazonHumanPacingDelay(context, findings, inspectedFiles, lawIds.humanPacing);
  inspectRejectedKeywordEvidenceRetention(context, findings, inspectedFiles, lawIds.rejectedKeywordRetention);
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
  inspectAmazonRuntimeFailureEvidenceContract(context, findings, inspectedFiles, lawIds.artifact);
  inspectDuplicateProductDetailSuppressionContract(context, findings, inspectedFiles, lawIds.search);
  inspectSearchSponsoredUrlNormalization(context, findings, inspectedFiles, lawIds.search);
  inspectKeywordHistoricalDedupContract(context, findings, inspectedFiles, lawIds.keywordGeneration);
  inspectKeywordReviewLooseQuoteParserContract(context, findings, inspectedFiles, lawIds.keywordReviewBoundary);
  inspectForbiddenAiIdentifiers(context, findings, inspectedFiles, lawIds.keyword);
  inspectForbiddenPluginTerms(context, findings, inspectedFiles, lawIds.surface);
  inspectNoAbilityGroupBoundary(context, findings, inspectedFiles, lawIds.surface);
};



const inspectDomainEvaluation = async (context: InspectorContext): Promise<Omit<InspectorOutput, "executedChecks">> => {
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

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  if (!context.checks) throw new Error("amazon-product-mining requires a runner-owned check session.");
  let reportJson: unknown;
  let reportMarkdown: string | undefined;
  await context.checks.runAll(async () => {
    const evaluation = await inspectDomainEvaluation(context);
    reportJson = evaluation.reportJson;
    reportMarkdown = evaluation.reportMarkdown;
    return {
      findings: evaluation.findings,
      evidenceRefs: [context.planEntry.ownerInspectorPath, ...evaluation.inspectedFiles],
    };
  });
  return context.checks.output({
    ...(reportJson === undefined ? {} : { reportJson }),
    ...(reportMarkdown === undefined ? {} : { reportMarkdown }),
  });
};
