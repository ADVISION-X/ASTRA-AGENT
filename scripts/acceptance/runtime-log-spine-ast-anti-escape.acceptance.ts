import assert from "node:assert/strict";

import { createAuditProject } from "../audit/shared/project.js";
import type { InspectorContext } from "../audit/shared/inspector-contracts.js";
import { resolveFromRepo } from "../audit/shared/paths.js";
import { collectCatchBranchLogFindings } from "../audit/domains/runtime-log-spine/catch-branch-log-inspector.js";
import { RuntimeLogSpineLaw } from "../audit/domains/runtime-log-spine/constants.js";
import { collectEventTypeRegistryFindings } from "../audit/domains/runtime-log-spine/event-type-registry-inspector.js";
import { collectFailureClassFindings } from "../audit/domains/runtime-log-spine/failure-class-inspector.js";
import { collectForbiddenConsoleFindings } from "../audit/domains/runtime-log-spine/forbidden-console-inspector.js";
import { collectModeVisibilityFindings } from "../audit/domains/runtime-log-spine/mode-visibility-inspector.js";
import { collectRuntimeLogEmitContractFindings } from "../audit/domains/runtime-log-spine/runtime-log-emit-contract-inspector.js";
import { collectAntiFakeInspectorFindingsWithSnapshot } from "../audit/domains/runtime-log-spine/anti-fake-inspector.js";
import { collectRuntimeLogSemanticMetrics } from "../audit/domains/runtime-log-spine/semantic-metrics-inspector.js";

const project = createAuditProject();
project.createSourceFile(
  resolveFromRepo("src/plugins/runtime-log-spine-ast-anti-escape.fixture.ts"),
  `
    import { createStageLogger, RuntimeFailureClass } from "../lib/runtime-logs/index.js";
    import { RuntimeLogEventType } from "../lib/runtime-logs/event-types.js";

    declare const logger: { emit(input: unknown): void };
    declare function risky(): void;

    const FakeRuntimeLogEventType = {
      MISSION_STOPPED: "MISSION_STOPPED"
    } as const;

    const log = console.log;
    log("escape");

    const { error } = console;
    error("escape");

    const { info } = globalThis.console;
    info("escape");

    const emit = logger["emit"];
    emit({
      traceId: "x",
      level: "info",
      eventType: FakeRuntimeLogEventType.MISSION_STOPPED,
      owner: "facebook-product-video-mining"
    });

    logger.emit({
      traceId: "x",
      level: "error",
      modeVisibility: ["DEBUG"],
      eventType: RuntimeLogEventType.MISSION_STOPPED,
      owner: "facebook-product-video-mining",
      status: "failed",
      reason: "x"
    });

    const stageLogger = createStageLogger({ logger });
    const stage = stageLogger.start({
      context: {} as never,
      stageName: "FIXTURE_STAGE",
      modeVisibility: ["FLOW", "DEBUG", "TRACE"],
    });

    stage.fail({
      reason: "fixture_failed",
      failureClass: RuntimeFailureClass.INTERNAL_BUG,
      durationMs: 0,
      retryable: false,
      terminal: false,
      recoveryPolicy: "skip_round",
    });

    export const run = () => {
      try {
        risky();
      } catch {
        return { ok: false };
      }

      return { ok: true };
    };
  `,
  { overwrite: true },
);

const context: InspectorContext = {
  project,
  planEntry: {
    capabilityDomain: "runtime-log-spine",
    ownerInspectorPath: "scripts/audit/domains/runtime-log-spine/inspector.ts",
    executionGroup: "foundation",
    clauseIds: ["primary"],
    blueprintRefs: [],
    manifestPath: "scripts/audit/domains/runtime-log-spine/manifest.json",
    lawIds: Object.values(RuntimeLogSpineLaw),
    evidenceModes: ["ast"],
  },
  generatedPlan: [],
  completedReports: {},
};

const findings = [
  ...collectForbiddenConsoleFindings(context).findings,
  ...collectEventTypeRegistryFindings(context).findings,
  ...collectRuntimeLogEmitContractFindings(context).findings,
  ...collectModeVisibilityFindings(context).findings,
  ...collectFailureClassFindings(context).findings,
  ...collectCatchBranchLogFindings(context).findings,
];

const semanticMetrics = collectRuntimeLogSemanticMetrics(context);
const antiFakeFindings = collectAntiFakeInspectorFindingsWithSnapshot(context, {
  semanticMetrics: {
    ...semanticMetrics.metrics,
    stageStartCount: 1,
    stageTerminalCount: 0,
  },
  stageCoveragePercent: 100,
  stagePairViolationCount: 0,
}).findings;

assert.ok(findings.some((finding) => finding.lawId === RuntimeLogSpineLaw.NO_CONSOLE));
assert.ok(findings.some((finding) => finding.lawId === RuntimeLogSpineLaw.EVENT_REGISTRY));
assert.ok(findings.some((finding) => finding.lawId === RuntimeLogSpineLaw.MODE_VISIBILITY));
assert.ok(findings.some((finding) => finding.lawId === RuntimeLogSpineLaw.FAILURE_CLASS));
assert.ok(findings.some((finding) => finding.lawId === RuntimeLogSpineLaw.NO_SILENT_BRANCH));
assert.ok(semanticMetrics.metrics.stageStartCount >= 1);
assert.ok(semanticMetrics.metrics.stageTerminalCount >= 1);
assert.ok(semanticMetrics.metrics.failureBranchCount >= 1);
assert.ok(antiFakeFindings.some((finding) => finding.checkId === "runtime-log-spine/anti-fake-stage-counts"));

process.stdout.write("[ACCEPTANCE] runtime-log-spine-ast-anti-escape PASS\n");
