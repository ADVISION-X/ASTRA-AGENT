import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { BrowserTargetLease } from "../../src/lib/browser/browser-authority-api.js";
import type { BrowserExecutionBinding } from "../../src/lib/browser/infrastructure/browser-authority-broker.js";
import { BrowserMutationStore } from "../../src/lib/browser/exact-target/browser-mutation-store.js";
import { BrowserInfrastructureSupervisor } from "../../src/lib/browser/infrastructure/browser-infrastructure-supervisor.js";
import {
  executionFailure,
  typedExecutionFailure,
} from "../../src/lib/typed-failure.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";

const HASH = `sha256:${"a".repeat(64)}` as const;
const binding = (jobId: string, productStepId = "fixture-step"): BrowserExecutionBinding => ({
  kind: "production",
  ownerPluginId: "plugin",
  pluginVersion: 1,
  jobId,
  productStepId,
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

const fixtureLease = (
  entry: BrowserExecutionBinding,
  close: BrowserTargetLease["close"],
): BrowserTargetLease => {
  const targetRef = entry.jobId === "job:historic" ? "target:historic" : `target:${entry.jobId}`;
  const documentRef = entry.jobId === "job:historic" ? "document:historic" : `document:${entry.jobId}`;
  return ({
  leaseRef: `lease:${entry.jobId}`,
  authorityRef: "authority:fixture",
  authorityEpoch: 1,
  executionBindingHash: HASH,
  ownerId: entry.ownerPluginId,
  agentJobRefHash: HASH,
  agentExecutionRefHash: HASH,
  writerLeaseEpoch: 1,
  writerFenceHash: HASH,
  target: { targetRef, authorityEpoch: 1, executionBindingHash: HASH },
  document: { documentRef, targetRef, navigationEpoch: 1 },
  async runAtomicStep(_identity, action) { return action(); },
  readAtomicStepRecovery: () => null,
  requiresMutationRecovery: () => false,
  async navigate() { throw new Error("FIXTURE_NAVIGATION_FORBIDDEN"); },
  async executeDomIntent() { throw new Error("FIXTURE_DOM_INTENT_FORBIDDEN"); },
  async observeCapability() { throw new Error("FIXTURE_CAPABILITY_FORBIDDEN"); },
  async captureScreenshot() { throw new Error("FIXTURE_SCREENSHOT_FORBIDDEN"); },
  async attachFile() { throw new Error("FIXTURE_ATTACHMENT_FORBIDDEN"); },
  async downloadAuthenticatedMedia() { throw new Error("FIXTURE_AUTHENTICATED_MEDIA_FORBIDDEN"); },
  async registerFileArtifact() { throw new Error("FIXTURE_ARTIFACT_FORBIDDEN"); },
  async issueFileArtifactGrant() { throw new Error("FIXTURE_ARTIFACT_GRANT_FORBIDDEN"); },
  async wait() { throw new Error("FIXTURE_WAIT_FORBIDDEN"); },
  async park() {},
  close,
  async resolvePendingMutation() { throw new Error("FIXTURE_MUTATION_RESOLUTION_FORBIDDEN"); },
  pendingMutationCount: () => 0,
  assertNoPendingMutations() {},
  });
};

const temporary = await mkdtemp(join(tmpdir(), "browser-lane-fifo-"));
let supervisor: BrowserInfrastructureSupervisor | null = null;
try {
  const logger = createRuntimeLogger({
    producer: "browser-lane-acceptance",
    owner: "browser-session",
    component: "browser-infrastructure",
    terminalEnabled: false,
    fileSink: { directoryPath: join(temporary, "runtime-logs") },
  });
  const mutationStore = new BrowserMutationStore(temporary);
  mutationStore.prepare({
    commandId: "historic-dispatched-command",
    exactCallIdentityHash: HASH,
    ownerPluginId: "plugin",
    pluginVersion: 1,
    jobId: "job:historic",
    attemptId: "attempt:historic",
    leaseVersion: 1,
    executionFenceHash: HASH,
    productStepId: "historic-step",
    childCapabilityId: "open_gpt_model_selector_v2",
    callId: "gpt-turn-flow.v3",
    effectScope: "target_local",
    actionOrdinal: 1,
    targetRef: "target:historic",
    documentRef: "document:historic",
    actionId: "browser.dom.click.v1",
    positivePostconditionHash: HASH,
    negativePostconditionHash: `sha256:${"b".repeat(64)}`,
    requestHash: HASH,
    payloadHash: HASH,
  });
  mutationStore.markDispatched("historic-dispatched-command");
  mutationStore.markReceiptMissing("historic-dispatched-command");
  mutationStore.close();
  supervisor = new BrowserInfrastructureSupervisor({
    dataDir: temporary,
    sourceFingerprint: HASH,
    profileConfig: {} as never,
    enrolledProfile: {} as never,
    releaseIdentity: {} as never,
    runtimeLogger: logger,
  });
  await supervisor.start();
  assert.equal(
    supervisor.readBrowserLaneState(),
    "idle",
    "a historical job-scoped DISPATCHED command must not deadlock unrelated jobs after restart",
  );
  assert.equal(
    supervisor.readBrowserReconciliationScope({
      jobId: "job:other",
      ownerPluginId: "plugin",
    }),
    null,
  );
  assert.equal(
    supervisor.readBrowserReconciliationScope({
      jobId: "job:historic",
      ownerPluginId: "wrong-plugin",
    }),
    null,
  );
  assert.equal(
    supervisor.readBrowserReconciliationScope({
      jobId: "job:historic",
      ownerPluginId: "plugin",
    })?.commandId,
    "historic-dispatched-command",
  );
  const acquisitions: string[] = [];
  const broker = {
    currentOperatorTargetStatus: () => "claimed" as const,
    revokeOperatorTargetClaim: () => {},
    acquireOperatorClaimedTargetLease: async (
      entry: BrowserExecutionBinding,
    ): Promise<BrowserTargetLease> => {
      acquisitions.push(entry.jobId);
      return fixtureLease(entry, async () => {
          if (entry.jobId === "job:unsettled") {
            throw executionFailure(
              "failed",
              "BROWSER_TARGET_LIFECYCLE_UNSETTLED",
              { mutationOutcome: "no" },
            );
          }
        });
    },
  };
  assert.equal(Reflect.set(supervisor, "broker", broker), true);

  const openSignal = new AbortController();
  const recovered = await supervisor.acquireJobBoundTargetLease(
    binding("job:historic", "historic-step"),
    "owner:historic",
    { signal: openSignal.signal, remainingMs: () => 60_000 },
  );
  assert.deepEqual([recovered.target.targetRef, recovered.document.documentRef],
    ["target:historic", "document:historic"]);
  await recovered.park({ reason: "recovery-scope-proven", mode: "recovery" });
  const first = await supervisor.acquireJobBoundTargetLease(
    binding("job:1"),
    "owner:1",
    { signal: openSignal.signal, remainingMs: () => 60_000 },
  );
  let secondResolved = false;
  const secondPromise = supervisor
    .acquireJobBoundTargetLease(binding("job:2"), "owner:2", {
      signal: openSignal.signal,
      remainingMs: () => 60_000,
    })
    .then((lease) => {
      secondResolved = true;
      return lease;
    });
  await Promise.resolve();
  assert.equal(secondResolved, false);
  assert.deepEqual(acquisitions, ["job:historic", "job:1"]);
  assert.equal(supervisor.readBrowserLaneWaiterCount(), 1);
  await first.close({ reason: "settled" });
  const second = await secondPromise;
  assert.deepEqual(acquisitions, ["job:historic", "job:1", "job:2"]);
  await second.close({ reason: "settled" });
  assert.equal(supervisor.readBrowserLaneState(), "idle");

  const active = await supervisor.acquireJobBoundTargetLease(
    binding("job:active"),
    "owner:active",
    { signal: openSignal.signal, remainingMs: () => 60_000 },
  );
  const aborted = new AbortController();
  const abortedPromise = supervisor.acquireJobBoundTargetLease(
    binding("job:aborted"),
    "owner:aborted",
    { signal: aborted.signal, remainingMs: () => 60_000 },
  );
  aborted.abort();
  await assert.rejects(abortedPromise, /BROWSER_WAIT_ABORTED/u);
  let remaining = 60_000;
  const expiredPromise = supervisor.acquireJobBoundTargetLease(
    binding("job:expired"),
    "owner:expired",
    { signal: openSignal.signal, remainingMs: () => remaining },
  );
  remaining = 0;
  await assert.rejects(expiredPromise, /V6_DEADLINE_BUDGET_EXHAUSTED/u);
  await active.close({ reason: "settled" });

  const boundedActive = await supervisor.acquireJobBoundTargetLease(
    binding("job:bounded-active"),
    "owner:bounded-active",
    { signal: openSignal.signal, remainingMs: () => 60_000 },
  );
  const waitingControllers = Array.from(
    { length: 10 },
    () => new AbortController(),
  );
  const laneSupervisor = supervisor;
  const waiting = waitingControllers.map((controller, index) =>
    laneSupervisor.acquireJobBoundTargetLease(
      binding(`job:waiting-${index}`),
      `owner:waiting-${index}`,
      { signal: controller.signal, remainingMs: () => 60_000 },
    ),
  );
  assert.equal(supervisor.readBrowserLaneWaiterCount(), 10);
  await assert.rejects(
    supervisor.acquireJobBoundTargetLease(
      binding("job:overflow"),
      "owner:overflow",
      { signal: openSignal.signal, remainingMs: () => 60_000 },
    ),
    (error) => {
      const failure = typedExecutionFailure(error);
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
    binding("job:unsettled"),
    "owner:unsettled",
    { signal: openSignal.signal, remainingMs: () => 60_000 },
  );
  await assert.rejects(
    unsettled.close({ reason: "unsettled" }),
    /BROWSER_TARGET_LIFECYCLE_UNSETTLED/u,
  );
  assert.equal(supervisor.readBrowserLaneState(), "idle");
  const afterLifecycleFault = await supervisor.acquireJobBoundTargetLease(
    binding("job:after-lifecycle-fault"),
    "owner:after-lifecycle-fault",
    { signal: openSignal.signal, remainingMs: () => 60_000 },
  );
  await afterLifecycleFault.close({ reason: "settled" });
  assert.equal(supervisor.readBrowserLaneState(), "idle",
    "one job's lifecycle fault must be reported without permanently freezing the global FIFO lane");
  assert.equal(supervisor.readBrowserLaneWaiterCount(), 0);
} finally {
  await supervisor?.stop();
  await rm(temporary, { recursive: true, force: true });
}

process.stdout.write("[ACCEPTANCE][browser-lane-fifo] PASS\n");
