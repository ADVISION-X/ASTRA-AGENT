import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

import { RuntimeLogEventType } from "../../src/lib/runtime-logs/index.js";
import {
  createRuntimeDebugBundle,
  findRuntimeDebugBundleRound,
} from "../../src/lib/runtime-logs/debug-bundle-contract.js";

const rootDir = mkdtempSync(join(tmpdir(), "runtime-log-debug-bundle-"));
try {
  const bundle = createRuntimeDebugBundle({
    rootDir,
    runId: "run-debug-bundle",
    missionId: "mission-debug-bundle",
    logMode: "TRACE",
  });
  bundle.appendEvent({
    eventId: "event-1",
    traceId: "run-debug-bundle",
    eventType: RuntimeLogEventType.RUNTIME_STAGE_FAILED,
    level: "error",
    modeVisibility: ["TRACE"],
    owner: "runtime-logs",
    status: "failed",
    createdAt: new Date().toISOString(),
    payload: { token: "secret-token" },
  });
  bundle.writeMissionSummary({ missionId: "mission-debug-bundle" });
  bundle.writeRoundSummary({
    roundId: "round-000001",
    roundIndex: 1,
    status: "failed",
    summary: { password: "secret" },
    failureClass: "INTERNAL_BUG",
    failureReason: "acceptance",
  });
  bundle.writeStageTimeline({ roundId: "round-000001", timeline: { stageName: "ACCEPTANCE_STAGE" } });
  bundle.writeRecoveryTrail({ roundId: "round-000001", trail: { action: "none" } });
  bundle.writeIndex();

  assert.match(readFileSync(bundle.runtimeLogPath, "utf8"), /\[REDACTED\]/u);
  assert.equal(findRuntimeDebugBundleRound(bundle.bundleDir, "round-000001")?.roundId, "round-000001");
} finally {
  rmSync(rootDir, { recursive: true, force: true });
}

process.stdout.write("[ACCEPTANCE] runtime-log-debug-bundle PASS\n");
emitQualityProofObservation({ lawId: "LAW-RUNTIME-LOG-SPINE-003-V3", evidenceMode: "exam.golden", clauses: ["forbidden:0","summary"], locator: "acceptance:runtime-log:debug-bundle", observedValue: "round-bound debug bundle retains redacted runtime log" });
