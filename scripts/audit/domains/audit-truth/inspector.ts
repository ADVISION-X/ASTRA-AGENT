import { selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorOutput } from "../../shared/inspector-contracts.js";
import { scanAuditMetaQualityNoRegex } from "./components/scan-audit-meta-quality-no-regex.js";
import { scanAuditNoRegex } from "./components/scan-audit-no-regex.js";
import { scanAuditNoSourceTextSearch } from "./components/scan-audit-no-source-text-search.js";
import { scanGeneratedPlanCoverage } from "./components/scan-generated-plan-coverage.js";

const buildReportJson = (
  findings: InspectorOutput["findings"],
  inspectedFiles: readonly string[],
  inspectorFileCount: number,
  generatedPlanEntryCount: number,
) => ({
  generatedAt: new Date().toISOString(),
  status: findings.length === 0 ? "PASS" : "FAIL",
  inspectorFileCount,
  generatedPlanEntryCount,
  inspectedFiles,
  findings,
});

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const project = context.project;
  const inspectedFiles = new Set<string>();
  const astTruthLawId = selectLawId(context.planEntry.lawIds, "APEX-AUDIT-TRUTH-001-V1");
  const metaQualityLawId = selectLawId(context.planEntry.lawIds, "GRASSEYE-AUDIT-META-QUALITY-AST-SYMBOL-NO-REGEX-V1");
  const coverageLawId = selectLawId(context.planEntry.lawIds, "APEX-AUDIT-TRUTH-002-V1");

  const sourceTextScan = scanAuditNoSourceTextSearch({
    context: { ...context, project },
    inspectedFiles,
    lawId: metaQualityLawId,
  });
  const coverageScan = scanGeneratedPlanCoverage({
    context: { ...context, project },
    inspectedFiles,
    lawId: coverageLawId,
  });
  const regexScan = scanAuditNoRegex({
    context: { ...context, project },
    inspectedFiles,
    lawId: metaQualityLawId,
  });
  const metaQualityScan = scanAuditMetaQualityNoRegex({
    context: { ...context, project },
    inspectedFiles,
    lawId: metaQualityLawId,
  });

  const findings = [
    ...metaQualityScan.findings,
    ...sourceTextScan.findings,
    ...coverageScan.findings,
    ...regexScan.findings,
  ];
  const sortedInspectedFiles = [...inspectedFiles].sort();
  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: sortedInspectedFiles,
    reportJson: buildReportJson(
      findings,
      sortedInspectedFiles,
      sourceTextScan.inspectorFileCount,
      context.generatedPlan.length,
    ),
  };
};