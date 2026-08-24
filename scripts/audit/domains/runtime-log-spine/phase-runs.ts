import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { collectAiLogContractFindings } from "./ai-log-contract-inspector.js";
import { collectAntiFakeInspectorFindingsWithSnapshot } from "./anti-fake-inspector.js";
import { collectBrowserActionLogContractFindings } from "./browser-action-log-contract-inspector.js";
import { collectCatchBranchLogFindings } from "./catch-branch-log-inspector.js";
import { collectDebugBundleFindings } from "./debug-bundle-inspector.js";
import { collectEventTypeRegistryFindings } from "./event-type-registry-inspector.js";
import { collectFailureClassFindings } from "./failure-class-inspector.js";
import { collectForbiddenConsoleFindings } from "./forbidden-console-inspector.js";
import { collectModeVisibilityFindings } from "./mode-visibility-inspector.js";
import { collectRedactionFindings } from "./redaction-inspector.js";
import { collectRuntimeLogEmitContractFindings } from "./runtime-log-emit-contract-inspector.js";
import { collectRuntimeLogSemanticMetrics } from "./semantic-metrics-inspector.js";
import { collectStagePairCoverageFindings } from "./stage-pair-coverage-inspector.js";

type RuntimeLogSpineFinding = ReturnType<typeof collectForbiddenConsoleFindings>["findings"][number];

type PhaseRun = {
  name: string;
  findings: RuntimeLogSpineFinding[];
  inspectedFiles: string[];
  metrics?: Record<string, number>;
};

export type CollectedPhaseRuns = {
  forbiddenConsole: ReturnType<typeof collectForbiddenConsoleFindings>;
  eventRegistry: ReturnType<typeof collectEventTypeRegistryFindings>;
  emitContract: ReturnType<typeof collectRuntimeLogEmitContractFindings>;
  modeVisibility: ReturnType<typeof collectModeVisibilityFindings>;
  stagePairs: ReturnType<typeof collectStagePairCoverageFindings>;
  catchBranches: ReturnType<typeof collectCatchBranchLogFindings>;
  failureClasses: ReturnType<typeof collectFailureClassFindings>;
  redaction: ReturnType<typeof collectRedactionFindings>;
  semanticMetrics: ReturnType<typeof collectRuntimeLogSemanticMetrics>;
  phaseRuns: PhaseRun[];
};

const buildSemanticMetricsPhase = (semanticMetrics: ReturnType<typeof collectRuntimeLogSemanticMetrics>): PhaseRun => ({
  name: "semantic-metrics-self-audit",
  findings: [],
  inspectedFiles: semanticMetrics.inspectedFiles,
  metrics: {
    emitCallCount: semanticMetrics.metrics.emitCallCount,
    stageStartCount: semanticMetrics.metrics.stageStartCount,
    stageTerminalCount: semanticMetrics.metrics.stageTerminalCount,
    failureBranchCount: semanticMetrics.metrics.failureBranchCount,
  },
});

export const collectRuntimeLogPhaseRuns = (context: InspectorContext): CollectedPhaseRuns => {
  const forbiddenConsole = collectForbiddenConsoleFindings(context);
  const eventRegistry = collectEventTypeRegistryFindings(context);
  const emitContract = collectRuntimeLogEmitContractFindings(context);
  const modeVisibility = collectModeVisibilityFindings(context);
  const stagePairs = collectStagePairCoverageFindings(context);
  const catchBranches = collectCatchBranchLogFindings(context);
  const failureClasses = collectFailureClassFindings(context);
  const redaction = collectRedactionFindings(context);
  const semanticMetrics = collectRuntimeLogSemanticMetrics(context);
  const debugBundle = collectDebugBundleFindings(context);
  const aiContract = collectAiLogContractFindings(context);
  const browserAction = collectBrowserActionLogContractFindings(context);
  const antiFake = collectAntiFakeInspectorFindingsWithSnapshot(context, {
    semanticMetrics: semanticMetrics.metrics,
    stageCoveragePercent: stagePairs.stageCoveragePercent,
    stagePairViolationCount: stagePairs.findings.length,
  });

  return {
    forbiddenConsole,
    eventRegistry,
    emitContract,
    modeVisibility,
    stagePairs,
    catchBranches,
    failureClasses,
    redaction,
    semanticMetrics,
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
      buildSemanticMetricsPhase(semanticMetrics),
      { name: "anti-fake-inspector", ...antiFake },
    ],
  };
};
