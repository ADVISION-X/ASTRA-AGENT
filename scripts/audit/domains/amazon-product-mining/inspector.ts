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
import { inspectPackageScript } from "./inspector-package-scripts.js";
import {
  inspectBrowserTabExtractionContract,
  inspectFlowSearchBeforeDetail,
  inspectGptWebChatIsolationForKeywordMining,
  inspectProductDetailDomFallbacks,
  inspectReviewsPerPagePersistence,
  inspectSearchExtractionProductionPath,
} from "./inspector-production-paths.js";
import { buildAmazonMiningInspectorReport, inspectBrowserTabLifecycle } from "./inspector-tab-lifecycle.js";

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const project = context.project;
  const flowLawId = selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-PRODUCT-MINING-001-V1");
  const surfaceLawId = selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-PRODUCT-MINING-002-V1");
  const keywordLawId = selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-PRODUCT-MINING-003-V1");
  const artifactLawId = selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-PRODUCT-MINING-013-V1");
  const deliveryLawId = selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-PRODUCT-MINING-015-V1");
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
  inspectArtifactOutputs(context, findings, inspectedFiles, artifactLawId);
  inspectPackageScript(findings, inspectedFiles, deliveryLawId);
  inspectGptWebChatIsolationForKeywordMining(context, findings, inspectedFiles, keywordLawId);
  inspectFlowSearchBeforeDetail(context, findings, inspectedFiles, searchLawId);
  inspectSearchExtractionProductionPath(context, findings, inspectedFiles, searchLawId);
  inspectBrowserTabExtractionContract(
    context,
    findings,
    inspectedFiles,
    searchLawId,
    {
      repoPath: "src/plugins/amazon-product-mining/amazon-product-mining.product-detail.ts",
      checkPrefix: "detail",
      subject: "Amazon product detail",
      scriptVariableName: "AMAZON_DETAIL_EXTRACT_SCRIPT",
    },
  );
  inspectBrowserTabExtractionContract(
    context,
    findings,
    inspectedFiles,
    reviewLawId,
    {
      repoPath: "src/plugins/amazon-product-mining/amazon-product-mining.reviews.ts",
      checkPrefix: "reviews",
      subject: "Amazon review page",
      scriptVariableName: "AMAZON_REVIEWS_EXTRACT_SCRIPT",
    },
  );
  inspectProductDetailDomFallbacks(context, findings, inspectedFiles, searchLawId);
  inspectReviewsPerPagePersistence(context, findings, inspectedFiles, reviewLawId);
  inspectForbiddenAiIdentifiers(context, findings, inspectedFiles, keywordLawId);
  inspectForbiddenPluginTerms(context, findings, inspectedFiles, surfaceLawId);
  inspectNoAbilityGroupBoundary(context, findings, inspectedFiles, surfaceLawId);
  const tabLifecycleDebug = inspectBrowserTabLifecycle({ ...context, project }, findings, inspectedFiles, surfaceLawId);

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
