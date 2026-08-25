import assert from "node:assert/strict";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

import {
  RuntimeFailureClass,
  createMissionTrace,
  createRuntimeLogger,
  createStageLogger,
} from "../../src/lib/runtime-logs/index.js";
import type { RuntimeLogEventInput } from "../../src/lib/runtime-logs/schema.js";

const emitted: RuntimeLogEventInput[] = [];
const logger = createRuntimeLogger({ terminalEnabled: false });
const originalEmit = logger.emit;
logger.emit = (event) => {
  emitted.push(event);
  originalEmit(event);
};

const stageLogger = createStageLogger({ logger });
const context = createMissionTrace({
  missionId: "mission-stage-acceptance",
  runId: "run-stage-acceptance",
  owner: "runtime-logs",
});
const stage = stageLogger.start({ context, stageName: "ACCEPTANCE_STAGE" });
stage.fail({
  reason: "acceptance failure proof",
  failureClass: RuntimeFailureClass.INTERNAL_BUG,
  retryable: false,
  terminal: true,
  recoveryPolicy: "terminal",
});

assert.equal(emitted.length, 2);
assert.equal(emitted[0]?.status, "started");
assert.equal(emitted[1]?.status, "failed");
assert.equal((emitted[1]?.payload as Record<string, unknown>).failureClass, RuntimeFailureClass.INTERNAL_BUG);
assert.equal(typeof emitted[1]?.durationMs, "number");

process.stdout.write("[ACCEPTANCE] runtime-log-stage-pair PASS\n");
emitQualityProofObservation({ lawId: "LAW-RUNTIME-LOG-SPINE-002-V2", evidenceMode: "exam.golden", locator: "acceptance:runtime-log:stage-pair", observedValue: "started and failed stages retain failure class and duration" });
