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
  let navigationEpoch = 1;
  let document = { documentRef, targetRef, navigationEpoch } as const;
  return {
    leaseRef: `lease:${entry.jobId}`, authorityRef: "authority:fixture", authorityEpoch: 1,
    executionBindingHash: HASH, ownerId: entry.ownerPluginId, agentJobRefHash: HASH,
    agentExecutionRefHash: HASH, writerLeaseEpoch: 1, writerFenceHash: HASH,
    target: { targetRef, authorityEpoch: 1, executionBindingHash: HASH },
    get document() { return document; },
    async runAtomicStep(_identity, action) { return action(); },
    readAtomicStepOutcome: () => null,
    async executeDomIntent(intent) {
      if (intent.kind === "selectExactGptConversation") {
        navigationEpoch += 1;
        document = { documentRef: `${documentRef}:${navigationEpoch}`, targetRef, navigationEpoch };
      }
      return { observed: true };
    },
    async observeCapability() { return { observed: true }; },
    async captureScreenshot() { return { artifactRef: "screenshot:fixture", contentHash: HASH }; },
    async attachFile() {},
    async readAuthenticatedMedia(input) { return {
      authorityTargetHash: HASH, authorityDocumentHash: HASH,
      assistantTurnId: "conversation-turn-2", precedingUserTurnId: input.userTurnId,
      currentUrl: input.canonicalConversationUrl, semanticMediaId: input.semanticMediaId,
      bytesBase64: "AQ==", sha256: HASH, sizeBytes: 1, mediaType: "image/png",
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
    binding("job:1"), "owner:1", { signal, remainingMs: () => 60_000, purpose: "general" },
  );
  let secondResolved = false;
  const secondPromise = supervisor.acquireJobBoundTargetLease(
    binding("job:2"), "owner:2", { signal, remainingMs: () => 60_000, purpose: "general" },
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
    binding("job:active"), "owner:active", { signal, remainingMs: () => 60_000, purpose: "general" },
  );
  const aborted = new AbortController();
  const abortedPromise = supervisor.acquireJobBoundTargetLease(
    binding("job:aborted"), "owner:aborted",
    { signal: aborted.signal, remainingMs: () => 60_000, purpose: "general" },
  );
  aborted.abort();
  await assert.rejects(abortedPromise, /BROWSER_WAIT_ABORTED/u);
  let remaining = 60_000;
  const expiredPromise = supervisor.acquireJobBoundTargetLease(
    binding("job:expired"), "owner:expired", { signal, remainingMs: () => remaining, purpose: "general" },
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
    binding("job:bounded-active"), "owner:bounded-active",
    { signal, remainingMs: () => 60_000, purpose: "general" },
  );
  const waitingControllers = Array.from({ length: 10 }, () => new AbortController());
  const waiting = waitingControllers.map((controller, index) => supervisor.acquireJobBoundTargetLease(
    binding(`job:waiting-${index}`), `owner:waiting-${index}`,
    { signal: controller.signal, remainingMs: () => 60_000, purpose: "general" },
  ));
  assert.equal(supervisor.readBrowserLaneWaiterCount(), 10);
  await assert.rejects(
    supervisor.acquireJobBoundTargetLease(
      binding("job:overflow"), "owner:overflow",
      { signal, remainingMs: () => 60_000, purpose: "general" },
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
    binding("job:unsettled"), "owner:unsettled",
    { signal, remainingMs: () => 60_000, purpose: "general" },
  );
  await assert.rejects(unsettled.close({ reason: "unsettled" }), /BROWSER_TARGET_LIFECYCLE_UNSETTLED/u);
  assert.equal(supervisor.readBrowserLaneState(), "idle");
  const afterLifecycleFault = await supervisor.acquireJobBoundTargetLease(
    binding("job:after-lifecycle-fault"), "owner:after-lifecycle-fault",
    { signal, remainingMs: () => 60_000, purpose: "general" },
  );
  await afterLifecycleFault.close({ reason: "settled" });
  assert.equal(supervisor.readBrowserLaneState(), "idle",
    "one job's lifecycle fault must be reported without permanently freezing the global FIFO lane");
  assert.equal(supervisor.readBrowserLaneWaiterCount(), 0);
};

const exerciseProviderProbeGate = async (
  supervisor: BrowserInfrastructureSupervisor,
  signal: AbortSignal,
): Promise<void> => {
  const nativeNow = performance.now.bind(performance);
  let now = 0;
  Object.defineProperty(performance, "now", { configurable: true, value: () => now });
  try {
    const active = await supervisor.acquireJobBoundTargetLease(
      binding("job:provider-pending"), "owner:provider-pending",
      { signal, remainingMs: () => 60_000, purpose: "general" },
    );
    await active.park({
      reason: "provider-pending", mode: "normal-provider-wait",
      startProviderProbeCooldown: true,
    });
    let firstResolved = false;
    let secondResolved = false;
    const firstProbe = supervisor.acquireJobBoundTargetLease(
      binding("job:provider-probe"), "owner:provider-probe",
      { signal, remainingMs: () => 60_000, purpose: "provider-probe" },
    ).then((lease) => { firstResolved = true; return lease; });
    const secondProbe = supervisor.acquireJobBoundTargetLease(
      binding("job:second-provider-probe"), "owner:second-provider-probe",
      { signal, remainingMs: () => 60_000, purpose: "provider-probe" },
    ).then((lease) => { secondResolved = true; return lease; });
    const general = await supervisor.acquireJobBoundTargetLease(
      binding("job:general-behind-probe"), "owner:general-behind-probe",
      { signal, remainingMs: () => 60_000, purpose: "general" },
    );
    assert.equal(firstResolved || secondResolved, false,
      "different jobs must share the same process-level Provider probe eligibility time");
    await general.close({ reason: "settled" });

    now = 30_000;
    const first = await firstProbe;
    assert.equal(secondResolved, false, "one eligibility instant must release only one Provider probe");
    const documentBeforeSelection = first.document.documentRef;
    await first.executeDomIntent({
      kind: "selectExactGptConversation", canonicalConversationUrl: "https://chatgpt.com/c/provider-probe",
    });
    assert.notEqual(first.document.documentRef, documentBeforeSelection,
      "the FIFO lease wrapper must preserve the live Document getter after conversation selection");
    await first.close({ reason: "settled" });

    now = 60_000;
    const second = await secondProbe;
    await second.park({
      reason: "provider-still-pending", mode: "normal-provider-wait",
      startProviderProbeCooldown: true,
    });
    let thirdResolved = false;
    const thirdProbe = supervisor.acquireJobBoundTargetLease(
      binding("job:third-provider-probe"), "owner:third-provider-probe",
      { signal, remainingMs: () => 60_000, purpose: "provider-probe" },
    ).then((lease) => { thirdResolved = true; return lease; });
    now = 89_999;
    await Promise.resolve();
    assert.equal(thirdResolved, false, "pending must start a new shared 30-second gate");
    now = 90_000;
    const third = await thirdProbe;
    await third.close({ reason: "settled" });
  } finally {
    Object.defineProperty(performance, "now", { configurable: true, value: nativeNow });
  }
};

export const exerciseBrowserLaneScheduling = async (
  supervisor: BrowserInfrastructureSupervisor,
  acquisitions: string[],
): Promise<void> => {
  const signal = new AbortController().signal;
  await exerciseBasicFifo(supervisor, acquisitions, signal);
  await exerciseAbortAndDeadline(supervisor, signal);
  await exerciseBackpressureAndLifecycle(supervisor, signal);
  await exerciseProviderProbeGate(supervisor, signal);
};
