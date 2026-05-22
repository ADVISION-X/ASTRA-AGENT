import type { InspectorContext, InspectorOutput } from "../../shared/inspector-contracts.js";
import { collectAiLogContractFindings } from "./ai-log-contract-inspector.js";
import { collectBrowserActionLogContractFindings } from "./browser-action-log-contract-inspector.js";
import { collectCatchBranchLogFindings } from "./catch-branch-log-inspector.js";
import { collectDebugBundleFindings } from "./debug-bundle-inspector.js";
import { collectEventTypeRegistryFindings } from "./event-type-registry-inspector.js";
import { collectFailureClassFindings } from "./failure-class-inspector.js";
import { collectForbiddenConsoleFindings } from "./forbidden-console-inspector.js";
import { writeRuntimeLogSpineReport, toInspectorFinding } from "./generated-report-writer.js";
import { collectModeVisibilityFindings } from "./mode-visibility-inspector.js";
import { collectRedactionFindings } from "./redaction-inspector.js";
import { collectRuntimeLogEmitContractFindings } from "./runtime-log-emit-contract-inspector.js";
import { collectStagePairCoverageFindings } from "./stage-pair-coverage-inspector.js";
import type { RuntimeLogSpineFinding, RuntimeLogSpinePhase } from "./constants.js";

type PhaseRun = {
  name: string;
  findings: RuntimeLogSpineFinding[];
  inspectedFiles: string[];
  metrics?: Record<string, number>;
};

const phaseStatus = (findings: readonly RuntimeLogSpineFinding[]): "PASS" | "FAIL" =>
  findings.length === 0 ? "PASS" : "FAIL";

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
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

  const phaseRuns: PhaseRun[] = [
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
  ];

  const findings = phaseRuns.flatMap((phase) => phase.findings);
  const inspectedFiles = [...new Set(phaseRuns.flatMap((phase) => phase.inspectedFiles))].sort();
  const phases: RuntimeLogSpinePhase[] = phaseRuns.map((phase) => ({
    name: phase.name,
    status: phaseStatus(phase.findings),
    findingCount: phase.findings.length,
    scannedFiles: phase.inspectedFiles.length,
    ...(phase.metrics ? { metrics: phase.metrics } : {}),
  }));

  writeRuntimeLogSpineReport({
    generatedAt: new Date().toISOString(),
    status: findings.length === 0 ? "PASS" : "FAIL",
    summary: {
      totalFindings: findings.length,
      fatalFindings: findings.length,
      scannedFiles: inspectedFiles.length,
      emitCallCount: emitContract.emitCallCount,
      consoleViolationCount: forbiddenConsole.consoleViolationCount,
      failureWithoutClassCount: failureClasses.failureWithoutClassCount,
      stageCoveragePercent: stagePairs.stageCoveragePercent,
    },
    phases,
    findings,
  });

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings: findings.map(toInspectorFinding),
    inspectedFiles,
  };
};
