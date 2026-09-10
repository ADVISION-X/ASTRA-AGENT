import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { executionFailure } from "../../src/lib/execution-failure.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { serializeTerminalFailure } from "../../src/lib/local-runtime/production/terminal-failure.js";
import { identityFor, task } from "./agent-production-runtime-fixtures.js";

const directory = await mkdtemp(path.join(tmpdir(), "agent-fresh-attempt-"));
try {
  const store = new ProductionRuntimeStore(directory);
  const job = task({
    jobId: "job:fresh-attempt",
    productId: "payment_screenshot_observation",
    actionId: "observe",
  });
  const identity = identityFor(job);
  store.acceptTask(job, identity, "attempt:1");
  store.recordAttemptFailure(
    job.job_id,
    "attempt:1",
    serializeTerminalFailure(executionFailure("failed", "PRODUCT_EXECUTION_FAILED")),
  );
  assert.throws(
    () => store.acceptTask(job, identity, "attempt:1"),
    /PRODUCTION_ATTEMPT_ALREADY_ACCEPTED/u,
    "a dead attempt must never be resumed",
  );
  const fresh = store.acceptTask(job, identity, "attempt:2");
  assert.equal(fresh.current_attempt_id, "attempt:2");
  assert.equal(fresh.attempt_failure, null);
  assert.equal(fresh.staged_result, null);
  assert.equal(fresh.current_reason, "LEASE_GRANTED");
  store.close();
} finally {
  await rm(directory, { recursive: true, force: true });
}

process.stdout.write("[ACCEPTANCE][agent-production-runtime-fresh-attempt] PASS\n");
