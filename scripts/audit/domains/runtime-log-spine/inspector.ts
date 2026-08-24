import { type InspectorContext, type InspectorOutput, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { renderRuntimeLogSpineMarkdown, toInspectorFinding } from "./generated-report-writer.js";
import { collectRuntimeLogPhaseRuns, type CollectedPhaseRuns } from "./phase-runs.js";
import { collectRedactionFindings } from "./redaction-inspector.js";

type RuntimeLogSpineFinding = CollectedPhaseRuns["phaseRuns"][number]["findings"][number];

const phaseStatus = (findings: readonly RuntimeLogSpineFinding[]): "PASS" | "FAIL" =>
  findings.length === 0 ? "PASS" : "FAIL";

const buildInspectorReportJson = (collected: CollectedPhaseRuns) => {
  const findings = collected.phaseRuns.flatMap((phase) => phase.findings);
  const inspectedFiles = [...new Set(collected.phaseRuns.flatMap((phase) => phase.inspectedFiles))].sort();
  const phases = buildInspectorPhases(collected);
  const counts = buildInspectorCounts(collected, findings, inspectedFiles);
  return {
    generatedAt: new Date().toISOString(),
    status: findings.length === 0 ? "PASS" : "FAIL",
    scannedFiles: inspectedFiles.length,
    inspectedFiles,
    ...counts,
    phases,
    findings,
  } as const;
};

const buildInspectorPhases = (collected: CollectedPhaseRuns) => collected.phaseRuns.map((phase) => ({
  name: phase.name,
  status: phaseStatus(phase.findings),
  findingCount: phase.findings.length,
  scannedFiles: phase.inspectedFiles.length,
  ...(phase.metrics ? { metrics: phase.metrics } : {}),
}));

const buildInspectorCounts = (
  collected: CollectedPhaseRuns,
  findings: RuntimeLogSpineFinding[],
  inspectedFiles: string[],
) => ({
  emitCallCount: collected.semanticMetrics.metrics.emitCallCount,
  consoleCallCount: collected.forbiddenConsole.consoleViolationCount,
  consoleEscapeCount: collected.forbiddenConsole.consoleViolationCount,
  eventTypeLiteralCount: collected.eventRegistry.findings.length,
  missingModeVisibilityCount: collected.modeVisibility.findings.filter((finding) => finding.checkId.includes("mode-visibility")).length,
  missingTraceContractCount: collected.emitContract.findings.filter((finding) => finding.lawId === "GRASSEYE-RUNTIME-LOG-SPINE-003-V1").length,
  catchBranchCount: collected.semanticMetrics.metrics.catchClauseCount,
  catchBranchWithoutLogCount: collected.catchBranches.findings.length,
  failureBranchCount: collected.semanticMetrics.metrics.failureBranchCount,
  failureWithoutClassCount: collected.failureClasses.failureWithoutClassCount,
  stageStartCount: collected.semanticMetrics.metrics.stageStartCount,
  stageTerminalCount: collected.semanticMetrics.metrics.stageTerminalCount,
  stagePairViolationCount: collected.stagePairs.findings.length,
  heavyPayloadFlowViolationCount: collected.modeVisibility.findings.filter((finding) => finding.checkId.includes("heavy-payload")).length,
  redactionViolationCount: collected.redaction.findings.length,
  summary: {
    totalFindings: findings.length,
    fatalFindings: findings.length,
    scannedFiles: inspectedFiles.length,
    emitCallCount: collected.semanticMetrics.metrics.emitCallCount,
    consoleViolationCount: collected.forbiddenConsole.consoleViolationCount,
    failureWithoutClassCount: collected.failureClasses.failureWithoutClassCount,
    stageCoveragePercent: collected.stagePairs.stageCoveragePercent,
  },
});



const inspectDomainEvaluation = async (context: InspectorContext): Promise<Omit<InspectorOutput, "executedChecks">> => {
  const collected = collectRuntimeLogPhaseRuns({ ...context, project: context.project });
  const report = buildInspectorReportJson(collected);

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,

    findings: report.findings.map(toInspectorFinding),
    inspectedFiles: report.inspectedFiles,
    reportJson: report,
    reportMarkdown: renderRuntimeLogSpineMarkdown(report),
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  if (!context.checks) throw new Error("runtime-log-spine requires a runner-owned check session.");
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
