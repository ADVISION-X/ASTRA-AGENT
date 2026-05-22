import type { InspectorContext, InspectorOutput } from "../../shared/inspector-contracts.js";
import { collectAiLogContractFindings } from "./ai-log-contract-inspector.js";
import { collectAntiFakeInspectorFindings } from "./anti-fake-inspector.js";
import { collectBrowserActionLogContractFindings } from "./browser-action-log-contract-inspector.js";
import { collectCatchBranchLogFindings } from "./catch-branch-log-inspector.js";
import { collectDebugBundleFindings } from "./debug-bundle-inspector.js";
import { collectEventTypeRegistryFindings } from "./event-type-registry-inspector.js";
import { collectFailureClassFindings } from "./failure-class-inspector.js";
import { collectForbiddenConsoleFindings } from "./forbidden-console-inspector.js";
import { renderRuntimeLogSpineMarkdown, writeRuntimeLogSpineReport, toInspectorFinding } from "./generated-report-writer.js";
import { collectModeVisibilityFindings } from "./mode-visibility-inspector.js";
import { collectRedactionFindings } from "./redaction-inspector.js";
import { collectRuntimeLogEmitContractFindings } from "./runtime-log-emit-contract-inspector.js";
import { collectStagePairCoverageFindings } from "./stage-pair-coverage-inspector.js";

type RuntimeLogSpineFinding = ReturnType<typeof collectForbiddenConsoleFindings>["findings"][number];

type PhaseRun = {
  name: string;
  findings: RuntimeLogSpineFinding[];
  inspectedFiles: string[];
  metrics?: Record<string, number>;
};

type CollectedPhaseRuns = {
  forbiddenConsole: ReturnType<typeof collectForbiddenConsoleFindings>;
  eventRegistry: ReturnType<typeof collectEventTypeRegistryFindings>;
  emitContract: ReturnType<typeof collectRuntimeLogEmitContractFindings>;
  modeVisibility: ReturnType<typeof collectModeVisibilityFindings>;
  stagePairs: ReturnType<typeof collectStagePairCoverageFindings>;
  catchBranches: ReturnType<typeof collectCatchBranchLogFindings>;
  failureClasses: ReturnType<typeof collectFailureClassFindings>;
  redaction: ReturnType<typeof collectRedactionFindings>;
  phaseRuns: PhaseRun[];
};

const phaseStatus = (findings: readonly RuntimeLogSpineFinding[]): "PASS" | "FAIL" =>
  findings.length === 0 ? "PASS" : "FAIL";

const collectPhaseRuns = (context: InspectorContext): CollectedPhaseRuns => {
  const forbiddenConsole = collectForbiddenConsoleFindings(context);
  const eventRegistry = collectEventTypeRegistryFindings(context);
  const emitContract = collectRuntimeLogEmitContractFindings(context);
  const modeVisibility = collectModeVisibilityFindings(context);
  const stagePairs = collectStagePairCoverageFindings(context);
  const catchBranches = collectCatchBranchLogFindings(context);
  const failureClasses = collectFailureClassFindings(context);
  const redaction = collectRedactionFindings(context);
  const debugBundle = collectDebugBundleFindings(context);
  const aiContract = collectAiLogContractFindings(context);
  const browserAction = collectBrowserActionLogContractFindings(context);
  const antiFake = collectAntiFakeInspectorFindings(context);
  return {
    forbiddenConsole,
    eventRegistry,
    emitContract,
    modeVisibility,
    stagePairs,
    catchBranches,
    failureClasses,
    redaction,
    phaseRuns: [
      { name: "forbidden-console", ...forbiddenConsole, metrics: { consoleViolationCount: forbiddenConsole.consoleViolationCount } },
      { name: "event-type-registry", ...eventRegistry },
      { name: "runtime-log-emit-contract", ...emitContract, metrics: { emitCallCount: emitContract.emitCallCount } },
      { name: "mode-visibility", ...modeVisibility },
      { name: "stage-pair-coverage", ...stagePairs, metrics: { stageCoveragePercent: stagePairs.stageCoveragePercent } },
      { name: "catch-branch-log", ...catchBranches },
      { name: "failure-class", ...failureClasses, metrics: { failureWithoutClassCount: failureClasses.failureWithoutClassCount } },
      { name: "redaction", ...redaction },
      { name: "debug-bundle", ...debugBundle },
      { name: "ai-log-contract", ...aiContract },
      { name: "browser-action-log-contract", ...browserAction },
      { name: "anti-fake-inspector", ...antiFake },
    ],
  };
};

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
  emitCallCount: collected.emitContract.emitCallCount,
  consoleCallCount: collected.forbiddenConsole.consoleViolationCount,
  consoleEscapeCount: collected.forbiddenConsole.consoleViolationCount,
  eventTypeLiteralCount: collected.eventRegistry.findings.length,
  missingModeVisibilityCount: collected.modeVisibility.findings.filter((finding) => finding.checkId.includes("mode-visibility")).length,
  missingTraceContractCount: collected.emitContract.findings.filter((finding) => finding.lawId === "GRASSEYE-RUNTIME-LOG-SPINE-003-V1").length,
  catchBranchCount: collected.catchBranches.inspectedFiles.length,
  catchBranchWithoutLogCount: collected.catchBranches.findings.length,
  failureBranchCount: collected.failureClasses.findings.length,
  failureWithoutClassCount: collected.failureClasses.failureWithoutClassCount,
  stageStartCount: collected.stagePairs.inspectedFiles.length,
  stageTerminalCount: collected.stagePairs.findings.length,
  stagePairViolationCount: collected.stagePairs.findings.length,
  heavyPayloadFlowViolationCount: collected.modeVisibility.findings.filter((finding) => finding.checkId.includes("heavy-payload")).length,
  redactionViolationCount: collected.redaction.findings.length,
  summary: {
    totalFindings: findings.length,
    fatalFindings: findings.length,
    scannedFiles: inspectedFiles.length,
    emitCallCount: collected.emitContract.emitCallCount,
    consoleViolationCount: collected.forbiddenConsole.consoleViolationCount,
    failureWithoutClassCount: collected.failureClasses.failureWithoutClassCount,
    stageCoveragePercent: collected.stagePairs.stageCoveragePercent,
  },
});

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  void context.project.getSourceFiles().length;
  const collected = collectPhaseRuns(context);
  const report = buildInspectorReportJson(collected);

  writeRuntimeLogSpineReport(report);

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings: report.findings.map(toInspectorFinding),
    inspectedFiles: report.inspectedFiles,
    reportJson: report,
    reportMarkdown: renderRuntimeLogSpineMarkdown(report),
  };
};
