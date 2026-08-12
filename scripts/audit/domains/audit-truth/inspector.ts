import { selectLawId } from "../../shared/finding-utils.js";
import { type InspectorContext, type InspectorOutput, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
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



const inspectDomainEvaluation = async (context: InspectorContext): Promise<Omit<InspectorOutput, "executedChecks">> => {
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

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  if (!context.checks) throw new Error("audit-truth requires a runner-owned check session.");
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
