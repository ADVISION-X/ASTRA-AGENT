import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import type { BrowserTargetLease } from "../../src/lib/browser/browser-authority-api.js";
import { typedBrowserExecutionFailure } from "../../src/lib/browser/browser-failure.js";
import type { BrowserExecutionBinding } from
  "../../src/lib/browser/infrastructure/browser-authority-broker.js";
import type { BrowserInfrastructureSupervisor } from
  "../../src/lib/browser/infrastructure/browser-infrastructure-supervisor.js";

export const HASH = `sha256:${"a".repeat(64)}` as const;
export const CONFIRMED_EXACT_HASH = `sha256:${"c".repeat(64)}` as const;

export const binding = (
  jobId: string,
  productStepId = "fixture-step",
  callId = "fixture-call",
): BrowserExecutionBinding => ({
  kind: "production", ownerPluginId: "plugin", pluginVersion: 1, jobId,
  productStepId, callId, attemptId: `attempt:${jobId}`, deviceId: "device:1",
  leaseVersion: 1, localOrderId: jobId, contractManifestHash: HASH,
  executionRef: `execution:${jobId}`, jobRefHash: HASH, executionRefHash: HASH,
  writerLeaseEpoch: 1, writerFenceHash: HASH, candidateHash: HASH, commandTtlMs: 60_000,
});

export const fixtureLease = (
  entry: BrowserExecutionBinding,
  close: BrowserTargetLease["close"],
  identity?: Readonly<{ targetRef: string; documentRef: string }>,
): BrowserTargetLease => {
  const targetRef = identity?.targetRef
    ?? (entry.jobId === "job:historic" ? "target:historic" : `target:${entry.jobId}`);
  const documentRef = identity?.documentRef
    ?? (entry.jobId === "job:historic" ? "document:historic" : `document:${entry.jobId}`);
  const document = { documentRef, targetRef, navigationEpoch: 1 } as const;
  return {
    leaseRef: `lease:${entry.jobId}`, authorityRef: "authority:fixture", authorityEpoch: 1,
    executionBindingHash: HASH, ownerId: entry.ownerPluginId, agentJobRefHash: HASH,
    agentExecutionRefHash: HASH, writerLeaseEpoch: 1, writerFenceHash: HASH,
    target: { targetRef, authorityEpoch: 1, executionBindingHash: HASH }, document,
    async runAtomicStep(_identity, action) { return action(); },
    readAtomicStepOutcome: () => null,
    async navigate() { return document; },
    async executeDomIntent() { return { observed: true }; },
    async observeCapability() { return { observed: true }; },
    async captureScreenshot() { return { artifactRef: "screenshot:fixture", contentHash: HASH }; },
    async attachFile() {},
    async downloadAuthenticatedMedia(input) { return {
      authorityTargetHash: HASH, authorityDocumentHash: HASH,
      assistantTurnId: input.assistantTurnId, semanticMediaId: input.semanticMediaId,
      bytesBase64: "AQ==", sha256: HASH, sizeBytes: 1, mediaType: "image/png", width: 1, height: 1,
    }; },
    async wait() {}, async park() {}, close,
    async resolvePendingMutation() { return 0; },
    pendingMutationCount: () => 0, assertNoPendingMutations() {},
  };
};

const exerciseBasicFifo = async (
  supervisor: BrowserInfrastructureSupervisor,
  acquisitions: string[],
  signal: AbortSignal,
): Promise<void> => {
  const first = await supervisor.acquireJobBoundTargetLease(
    binding("job:1"), "owner:1", { signal, remainingMs: () => 60_000 },
  );
  let secondResolved = false;
  const secondPromise = supervisor.acquireJobBoundTargetLease(
    binding("job:2"), "owner:2", { signal, remainingMs: () => 60_000 },
  ).then((lease) => {
    secondResolved = true;
    return lease;
  });
  await Promise.resolve();
  assert.equal(secondResolved, false);
  assert.deepEqual(acquisitions, ["job:1"]);
  assert.equal(supervisor.readBrowserLaneWaiterCount(), 1);
  await first.close({ reason: "settled" });
  const second = await secondPromise;
  assert.deepEqual(acquisitions, ["job:1", "job:2"]);
  await second.close({ reason: "settled" });
  assert.equal(supervisor.readBrowserLaneState(), "idle");
};

const exerciseAbortAndDeadline = async (
  supervisor: BrowserInfrastructureSupervisor,
  signal: AbortSignal,
): Promise<void> => {
  const active = await supervisor.acquireJobBoundTargetLease(
    binding("job:active"), "owner:active", { signal, remainingMs: () => 60_000 },
  );
  const aborted = new AbortController();
  const abortedPromise = supervisor.acquireJobBoundTargetLease(
    binding("job:aborted"), "owner:aborted", { signal: aborted.signal, remainingMs: () => 60_000 },
  );
  aborted.abort();
  await assert.rejects(abortedPromise, /BROWSER_WAIT_ABORTED/u);
  let remaining = 60_000;
  const expiredPromise = supervisor.acquireJobBoundTargetLease(
    binding("job:expired"), "owner:expired", { signal, remainingMs: () => remaining },
  );
  remaining = 0;
  await assert.rejects(expiredPromise, /V6_DEADLINE_BUDGET_EXHAUSTED/u);
  await active.close({ reason: "settled" });
};

const exerciseBackpressureAndLifecycle = async (
  supervisor: BrowserInfrastructureSupervisor,
  signal: AbortSignal,
): Promise<void> => {
  const boundedActive = await supervisor.acquireJobBoundTargetLease(
    binding("job:bounded-active"), "owner:bounded-active", { signal, remainingMs: () => 60_000 },
  );
  const waitingControllers = Array.from({ length: 10 }, () => new AbortController());
  const waiting = waitingControllers.map((controller, index) => supervisor.acquireJobBoundTargetLease(
    binding(`job:waiting-${index}`), `owner:waiting-${index}`,
    { signal: controller.signal, remainingMs: () => 60_000 },
  ));
  assert.equal(supervisor.readBrowserLaneWaiterCount(), 10);
  await assert.rejects(
    supervisor.acquireJobBoundTargetLease(
      binding("job:overflow"), "owner:overflow", { signal, remainingMs: () => 60_000 },
    ),
    (error) => {
      const failure = typedBrowserExecutionFailure(error);
      assert.equal(failure?.status, "failed");
      assert.equal(failure?.code, "BROWSER_BACKPRESSURE");
      assert.equal(failure?.mutationOutcome, "no");
      return true;
    },
  );
  waitingControllers.forEach((controller) => controller.abort());
  const waitingOutcomes = await Promise.allSettled(waiting);
  assert(waitingOutcomes.every((outcome) => outcome.status === "rejected"));
  await boundedActive.close({ reason: "settled" });

  const unsettled = await supervisor.acquireJobBoundTargetLease(
    binding("job:unsettled"), "owner:unsettled", { signal, remainingMs: () => 60_000 },
  );
  await assert.rejects(unsettled.close({ reason: "unsettled" }), /BROWSER_TARGET_LIFECYCLE_UNSETTLED/u);
  assert.equal(supervisor.readBrowserLaneState(), "idle");
  const afterLifecycleFault = await supervisor.acquireJobBoundTargetLease(
    binding("job:after-lifecycle-fault"), "owner:after-lifecycle-fault",
    { signal, remainingMs: () => 60_000 },
  );
  await afterLifecycleFault.close({ reason: "settled" });
  assert.equal(supervisor.readBrowserLaneState(), "idle",
    "one job's lifecycle fault must be reported without permanently freezing the global FIFO lane");
  assert.equal(supervisor.readBrowserLaneWaiterCount(), 0);
};

export const exerciseBrowserLaneScheduling = async (
  supervisor: BrowserInfrastructureSupervisor,
  acquisitions: string[],
): Promise<void> => {
  const signal = new AbortController().signal;
  await exerciseBasicFifo(supervisor, acquisitions, signal);
  await exerciseAbortAndDeadline(supervisor, signal);
  await exerciseBackpressureAndLifecycle(supervisor, signal);
};
