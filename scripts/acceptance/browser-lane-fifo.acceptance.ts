import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { BrowserTargetLease } from "../../src/lib/browser/browser-authority-api.js";
import type { BrowserExecutionBinding } from "../../src/lib/browser/infrastructure/browser-authority-broker.js";
import { BrowserInfrastructureSupervisor } from "../../src/lib/browser/infrastructure/browser-infrastructure-supervisor.js";
import { executionFailure, typedExecutionFailure } from "../../src/lib/typed-failure.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";

const HASH = `sha256:${"a".repeat(64)}` as const;
const binding = (jobId: string): BrowserExecutionBinding => ({
  kind: "production",
  ownerPluginId: "plugin",
  jobId,
  attemptId: `attempt:${jobId}`,
  deviceId: "device:1",
  leaseVersion: 1,
  localOrderId: jobId,
  contractManifestHash: HASH,
  executionRef: `execution:${jobId}`,
  jobRefHash: HASH,
  executionRefHash: HASH,
  writerLeaseEpoch: 1,
  writerFenceHash: HASH,
  candidateHash: HASH,
  commandTtlMs: 60_000,
});

const temporary = await mkdtemp(join(tmpdir(), "browser-lane-fifo-"));
try {
  const logger = createRuntimeLogger({
    producer: "browser-lane-acceptance",
    owner: "browser-session",
    component: "browser-infrastructure",
    terminalEnabled: false,
    fileSink: { directoryPath: join(temporary, "runtime-logs") },
  });
  const supervisor = new BrowserInfrastructureSupervisor({
    dataDir: temporary,
    sourceFingerprint: HASH,
    profileConfig: {} as never,
    enrolledProfile: {} as never,
    releaseIdentity: {} as never,
    runtimeLogger: logger,
  });
  const acquisitions: string[] = [];
  const broker = {
    currentOperatorTargetStatus: () => "claimed" as const,
    acquireOperatorClaimedTargetLease: async (entry: BrowserExecutionBinding): Promise<BrowserTargetLease> => {
      acquisitions.push(entry.jobId);
      return {
        close: async () => {
          if (entry.jobId === "job:unknown") {
            throw executionFailure("review_required", "BROWSER_OUTCOME_UNKNOWN", { mutationOutcome: "unknown" });
          }
        },
      } as unknown as BrowserTargetLease;
    },
  };
  (supervisor as unknown as { broker: typeof broker }).broker = broker;

  const openSignal = new AbortController();
  const first = await supervisor.acquireJobBoundTargetLease(
    binding("job:1"), "owner:1", { signal: openSignal.signal, remainingMs: () => 60_000 },
  );
  let secondResolved = false;
  const secondPromise = supervisor.acquireJobBoundTargetLease(
    binding("job:2"), "owner:2", { signal: openSignal.signal, remainingMs: () => 60_000 },
  ).then((lease) => { secondResolved = true; return lease; });
  await Promise.resolve();
  assert.equal(secondResolved, false);
  assert.deepEqual(acquisitions, ["job:1"]);
  assert.equal(supervisor.readBrowserLaneWaiterCount(), 1);
  await first.close({ reason: "settled" });
  const second = await secondPromise;
  assert.deepEqual(acquisitions, ["job:1", "job:2"]);
  await second.close({ reason: "settled" });
  assert.equal(supervisor.readBrowserLaneState(), "idle");

  const active = await supervisor.acquireJobBoundTargetLease(
    binding("job:active"), "owner:active", { signal: openSignal.signal, remainingMs: () => 60_000 },
  );
  const aborted = new AbortController();
  const abortedPromise = supervisor.acquireJobBoundTargetLease(
    binding("job:aborted"), "owner:aborted", { signal: aborted.signal, remainingMs: () => 60_000 },
  );
  aborted.abort();
  await assert.rejects(abortedPromise, /BROWSER_WAIT_ABORTED/u);
  let remaining = 60_000;
  const expiredPromise = supervisor.acquireJobBoundTargetLease(
    binding("job:expired"), "owner:expired", { signal: openSignal.signal, remainingMs: () => remaining },
  );
  remaining = 0;
  await assert.rejects(expiredPromise, /V6_DEADLINE_BUDGET_EXHAUSTED/u);
  await active.close({ reason: "settled" });

  const boundedActive = await supervisor.acquireJobBoundTargetLease(
    binding("job:bounded-active"), "owner:bounded-active",
    { signal: openSignal.signal, remainingMs: () => 60_000 },
  );
  const waitingControllers = Array.from({ length: 10 }, () => new AbortController());
  const waiting = waitingControllers.map((controller, index) => supervisor.acquireJobBoundTargetLease(
    binding(`job:waiting-${index}`), `owner:waiting-${index}`,
    { signal: controller.signal, remainingMs: () => 60_000 },
  ));
  assert.equal(supervisor.readBrowserLaneWaiterCount(), 10);
  await assert.rejects(supervisor.acquireJobBoundTargetLease(
    binding("job:overflow"), "owner:overflow", { signal: openSignal.signal, remainingMs: () => 60_000 },
  ), (error) => {
    const failure = typedExecutionFailure(error);
    assert.equal(failure?.status, "recovery_pending");
    assert.equal(failure?.code, "BROWSER_BACKPRESSURE");
    assert.equal(failure?.mutationOutcome, "no");
    return true;
  });
  waitingControllers.forEach((controller) => controller.abort());
  const waitingOutcomes = await Promise.allSettled(waiting);
  assert(waitingOutcomes.every((outcome) => outcome.status === "rejected"));
  await boundedActive.close({ reason: "settled" });

  const unknown = await supervisor.acquireJobBoundTargetLease(
    binding("job:unknown"), "owner:unknown", { signal: openSignal.signal, remainingMs: () => 60_000 },
  );
  await assert.rejects(unknown.close({ reason: "unknown" }), /BROWSER_OUTCOME_UNKNOWN/u);
  assert.equal(supervisor.readBrowserLaneState(), "unknown");
  await assert.rejects(supervisor.acquireJobBoundTargetLease(
    binding("job:blocked"), "owner:blocked", { signal: openSignal.signal, remainingMs: () => 60_000 },
  ), (error) => {
    const failure = typedExecutionFailure(error);
    assert.equal(failure?.status, "review_required");
    assert.equal(failure?.code, "BROWSER_OUTCOME_UNKNOWN");
    assert.equal(failure?.mutationOutcome, "unknown");
    return true;
  });
} finally {
  await rm(temporary, { recursive: true, force: true });
}

process.stdout.write("[ACCEPTANCE][browser-lane-fifo] PASS\n");
