import assert from "node:assert/strict";

import { createAuditProject } from "../audit/shared/project.js";
import type { InspectorContext } from "../audit/shared/inspector-contracts.js";
import { createInspectorCheckSession } from "../audit/shared/inspector-check-session.js";
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
import { collectBrowserActionLogContractFindings } from "../audit/domains/runtime-log-spine/browser-action-log-contract-inspector.js";

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
      owner: "deep-research-analysis"
    });

    logger.emit({
      traceId: "x",
      level: "error",
      modeVisibility: ["DEBUG"],
      eventType: RuntimeLogEventType.MISSION_STOPPED,
      owner: "deep-research-analysis",
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
project.createSourceFile(
  resolveFromRepo("src/plugins/runtime-log-browser-action-unbound.fixture.ts"),
  `
    import type { BrowserTargetSession } from "../lib/browser/browser-controller.js";
    import type { RuntimeLogger } from "../lib/runtime-logs/index.js";
    import {
      emitAmazonOrderDetailNavigationStarted,
      emitAmazonOrderDetailNavigationTerminal,
    } from "./amazon-invoice-upload/amazon-dom-step-trace.js";

    declare const browser: BrowserTargetSession;
    declare const logger: RuntimeLogger;

    export async function runUnboundBrowserAction(): Promise<void> {
      const browserActionId = "browser:governed";
      const unrelatedActionId = "browser:unrelated";
      emitAmazonOrderDetailNavigationStarted({
        runtimeLogger: logger,
        executionId: "execution:fixture",
        browserActionId: unrelatedActionId,
        beforeHash: "before",
        runtimeLogRef: "runtime-logs/workbench.jsonl",
        amazonOrderId: "fixture-order",
      });
      await browser.open({
        url: "https://sellercentral.amazon.ae/orders-v3/order/fixture",
        title: "fixture",
        browserActionId: browserActionId,
      });
      emitAmazonOrderDetailNavigationTerminal({
        runtimeLogger: logger,
        executionId: "execution:fixture",
        browserActionId: unrelatedActionId,
        runtimeLogRef: "runtime-logs/workbench.jsonl",
        actionResult: "success",
        beforeHash: "before",
        afterHash: "after",
        durationMs: 1,
        navigationMode: "reused_host_tab",
        observedUrlMatchesRequest: true,
        reason: "fixture",
      });
    }
  `,
  { overwrite: true },
);

const planEntry: InspectorContext["planEntry"] = {
    capabilityDomain: "runtime-log-spine",
    ownerInspectorPath: "scripts/audit/domains/runtime-log-spine/inspector.ts",
    executionGroup: "foundation",
    bindings: Object.values(RuntimeLogSpineLaw).map((lawId) => ({
      lawId,
      clauseId: `${lawId.toLowerCase()}-fixture-requirement`,
      evidenceMode: "static",
      checkIds: ["runtime-log-spine/owner-assertion-set"],
      sourceEvidence: [{
        filePath: "scripts/audit/domains/runtime-log-spine/inspector.ts",
        symbolName: "inspectDomain",
      }],
    })),
    blueprintRefs: [],
    manifestPath: "scripts/audit/domains/runtime-log-spine/manifest.json",
    lawIds: Object.values(RuntimeLogSpineLaw),
};
const context: InspectorContext = {
  checks: createInspectorCheckSession(planEntry, "acceptance-run:runtime-log-spine-ast").checks,
  project,
  planEntry,
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
const browserActionFindings = collectBrowserActionLogContractFindings(context).findings;

assert.ok(findings.some((finding) => finding.lawId === RuntimeLogSpineLaw.NO_CONSOLE));
assert.ok(findings.some((finding) => finding.lawId === RuntimeLogSpineLaw.EVENT_REGISTRY));
assert.ok(findings.some((finding) => finding.lawId === RuntimeLogSpineLaw.MODE_VISIBILITY));
assert.ok(findings.some((finding) => finding.lawId === RuntimeLogSpineLaw.FAILURE_CLASS));
assert.ok(findings.some((finding) => finding.lawId === RuntimeLogSpineLaw.NO_SILENT_BRANCH));
assert.ok(semanticMetrics.metrics.stageStartCount >= 1);
assert.ok(semanticMetrics.metrics.stageTerminalCount >= 1);
assert.ok(semanticMetrics.metrics.failureBranchCount >= 1);
assert.ok(antiFakeFindings.some((finding) => finding.checkId === "runtime-log-spine/anti-fake-stage-counts"));
assert.ok(
  browserActionFindings.some((finding) =>
    finding.checkId === "runtime-log-spine/browser-action-log-contract"
    && finding.file === "src/plugins/runtime-log-browser-action-unbound.fixture.ts"),
  "caller-correlated browser logs must use the same browserActionId binding as the governed action",
);

process.stdout.write("[ACCEPTANCE] runtime-log-spine-ast-anti-escape PASS\n");
