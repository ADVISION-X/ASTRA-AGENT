import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { ProductionGptBrowserLifecycle } from "../production-browser-lifecycle.js";
import { createRuntimeLogger } from "../../../lib/runtime-logs/index.js";
import { typedExecutionFailure } from "../../../lib/execution-failure.js";
import { HASH_A, HASH_B, task } from "../../../../scripts/acceptance/agent-production-runtime-fixtures.js";

const temporary = await mkdtemp(path.join(tmpdir(), "agent-mismatch-acceptance-"));
try {
  const runtimeLogger = createRuntimeLogger({
    producer: "agent-mismatch-acceptance", owner: "production-runtime", component: "gpt-child", terminalEnabled: false,
    fileSink: { directoryPath: path.join(temporary, "runtime-logs") },
  });
  const waitTask = task({
    jobId: "job:agent-mismatch-acceptance", productId: "payment_screenshot_observation", actionId: "observe",
  });
  const cleanupError = new Error("TEST_REACQUIRED_TARGET_CLOSE_FAILED");
  const originalBrowser = {
    target: { targetRef: "target:provider-wait:original" },
    pendingMutationCount: () => 0,
    requiresMutationRecovery: () => false,
    park: async () => undefined,
    close: async () => undefined,
  };
  const mismatchedBrowser = {
    ...originalBrowser,
    target: { targetRef: "target:provider-wait:mismatched" },
    close: async () => { throw cleanupError; },
  };
  let mismatchAcquisitions = 0;
  const mismatchLifecycle = new ProductionGptBrowserLifecycle(
    {
      acquireJobBoundTargetLease: async () => {
        mismatchAcquisitions += 1;
        return mismatchAcquisitions === 1 ? originalBrowser : mismatchedBrowser;
      },
    } as never,
    runtimeLogger,
    HASH_A,
    {
      jobId: waitTask.job_id, attemptId: "attempt:provider-wait-mismatch",
      resultRevision: 0,
      deviceId: "device:1", leaseVersion: 1,
      executionFenceHash: HASH_A, capabilityManifestHash: HASH_B,
      expiresAtMonotonic: performance.now() + 10_000, commandTtlMs: 1_000,
      abortSignal: new AbortController().signal,
    },
  );
  const mismatchActive = await mismatchLifecycle.browserFor(
    "session:provider-wait-mismatch",
    "corpus_research",
    "text-wait",
  );
  await assert.rejects(
    () => mismatchLifecycle.yieldForProviderProbe(
      mismatchActive, "corpus_research", "text-wait", "checkpoint_gpt_text_response",
      "https://chatgpt.com/c/mismatch", Date.now() + 1_000,
    ),
    (error: unknown) => {
      assert.ok(error instanceof AggregateError);
      assert.equal(typedExecutionFailure(error)?.code, "BROWSER_RECONCILIATION_IDENTITY_MISMATCH");
      assert.deepEqual(error.errors, [cleanupError]);
      return true;
    },
  );
  await mismatchLifecycle.settle(null);

  let recoveryExpectedTargetRef: string | undefined;
  const recoveryLifecycle = new ProductionGptBrowserLifecycle(
    {
      acquireJobBoundTargetLease: async (_binding: unknown, _ownerId: unknown, wait: Readonly<{
        expectedTargetRef?: string;
      }>) => {
        recoveryExpectedTargetRef = wait.expectedTargetRef;
        return {
          target: { targetRef: "target:confirmed-submit" },
          pendingMutationCount: () => 0,
          park: async () => undefined,
          close: async () => undefined,
        };
      },
    } as never,
    runtimeLogger,
    HASH_A,
    {
      jobId: waitTask.job_id, attemptId: "attempt:confirmed-submit-recovery",
      resultRevision: 0,
      deviceId: "device:1", leaseVersion: 1,
      executionFenceHash: HASH_A, capabilityManifestHash: HASH_B,
      expiresAtMonotonic: performance.now() + 10_000, commandTtlMs: 1_000,
      abortSignal: new AbortController().signal,
    },
  );
  await recoveryLifecycle.browserFor(
    "session:confirmed-submit-recovery", "observe", "turn-submit", "target:confirmed-submit",
  );
  assert.equal(recoveryExpectedTargetRef, "target:confirmed-submit",
    "confirmed-submit recovery must reacquire the exact parked Target without a root reset");
  await recoveryLifecycle.settle(null);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
