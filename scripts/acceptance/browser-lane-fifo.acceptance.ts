import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { BrowserLaneCoordinator } from
  "../../src/lib/browser/infrastructure/browser-lane-coordinator.js";
import { BrowserTargetAcquirer } from
  "../../src/lib/browser/infrastructure/browser-target-acquirer.js";
import { BrowserTargetLeaseManager } from
  "../../src/lib/browser/exact-target/browser-target-lease-manager.js";
import { BrowserMutationStore } from
  "../../src/lib/browser/exact-target/browser-mutation-store.js";
import { typedBrowserExecutionFailure } from "../../src/lib/browser/browser-failure.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";

const lane = readFileSync("src/lib/browser/infrastructure/browser-lane-coordinator.ts", "utf8");
const leaseContract = readFileSync("src/lib/browser/exact-target/browser-target-lease.ts", "utf8");
const store = readFileSync("src/lib/browser/exact-target/browser-mutation-store.ts", "utf8");
const actor = readFileSync("src/lib/browser/exact-target/browser-command-actor.ts", "utf8");

assert.match(lane, /private readonly queue: LaneWaiter\[\] = \[\]/u,
  "Browser lane must remain one process-level queue");
assert.match(lane, /private wakeTimer:/u,
  "the one Browser lane must own exactly one wake timer");
assert.match(lane, /private observationNotBefore = 0/u,
  "the one Browser lane must own the global Provider observation cadence");
assert.match(lane, /PROVIDER_OBSERVATION_MIN_INTERVAL_MS = 70_000/u,
  "the global Provider observation cadence must start at 70 seconds");
assert.match(lane, /PROVIDER_OBSERVATION_RANDOM_SPAN_MS = 20_001/u,
  "the global Provider observation cadence must include every millisecond through 90 seconds");
assert.match(lane,
  /Math\.floor\(Math\.random\(\) \* PROVIDER_OBSERVATION_RANDOM_SPAN_MS\)/u,
  "Browser must sample the global 70-90 second interval once per completed observation");
assert.equal(lane.match(/Math\.random/gu)?.length, 1,
  "the one Browser lane must remain the sole random cadence sampler");
assert.match(lane, /waiter\.requestKind === "provider-observation"/u,
  "Browser-owned Provider observation requests must re-enter the same paced FIFO");
assert.doesNotMatch(leaseContract, /requestKind/u,
  "GPT and Product callers must not be able to self-report Browser request classification");
assert.doesNotMatch(lane, /setInterval|providerProbeQueue|observationQueue|releaseQueue/u,
  "the Browser lane must not grow per-Tab timers or a second queue");
assert.match(lane, /mutationBlocked && !this\.mayCrossUnresolved\(waiter\)/u,
  "unresolved DISPATCHED must stay behind the one scope-aware lane gate");
assert.match(lane, /settleRetiredTargetLocal\(waiter\.binding\)/u,
  "same-job target-local closure must settle the old WAL row before acquisition");
assert.ok(lane.indexOf("settleRetiredTargetLocal(waiter.binding)")
  < lane.indexOf("ensureAvailableTarget(waiter, parentConversationUrl)"));
assert.match(lane, /website-permanent-revocation/u);
assert.match(lane, /website-admin-deletion/u);
assert.match(lane, /releaseJobBoundTarget/u,
  "Website closure must release an exact job-bound Target through the same FIFO");
assert.doesNotMatch(lane, /\.\.\.lease/u,
  "Browser FIFO wrappers must preserve the lease's live Document getter");
assert.doesNotMatch(lane, /quarantine|Recovery|recoveryFor|reconciliation/u,
  "Browser lane must not recover or quarantine an old attempt");
assert.match(store, /where job_id=\? and attempt_id=\?/u,
  "Browser mutation lookup must bind the current attempt");
assert.match(store, /rows\.length === 1 && rows\[0\]!\.job_id === input\.jobId/u,
  "same-job closure must fail closed on zero, multiple, or cross-job unresolved rows");
assert.match(store, /row\.execution_fence_hash === input\.writerFenceHash/u,
  "the current execution fence must never retire its own unresolved mutation");
assert.match(store, /BROWSER_TARGET_LOCAL_EXECUTION_RETIRED/u);
assert.match(actor, /dispatchedForBinding/u,
  "pending mutations must be scoped to the current binding");
assert.doesNotMatch(actor, /dispatchedForJob/u,
  "a prior attempt must never block the job-wide lane");

const lifecycleLane = Object.create(BrowserLaneCoordinator.prototype) as Record<string, unknown>;
Object.assign(lifecycleLane, {
  active: true,
  activeJobRefHash: `sha256:${"a".repeat(64)}`,
  observationNotBefore: 0,
  pump: async () => undefined,
});
const lifecycleLease = (lifecycleLane.withLifecycle as (
  lease: unknown, requestKind: string,
) => { park(input: unknown): Promise<void> }).call(lifecycleLane, {
  park: async () => { throw new Error("PARK_REPLY_LOST"); },
}, "provider-observation");
await assert.rejects(lifecycleLease.park({}), /BROWSER_TARGET_LIFECYCLE_UNSETTLED/u);
assert.equal(lifecycleLane.active, false,
  "park failure must release the one lane instead of leaving it permanently busy");
assert.equal(lifecycleLane.activeJobRefHash, null);
assert.ok(Number(lifecycleLane.observationNotBefore) > Date.now(),
  "a failed observation lifecycle must still advance the global cadence");

const releaseHash = `sha256:${"b".repeat(64)}` as const;
const blockedLane = Object.create(BrowserLaneCoordinator.prototype) as Record<string, unknown>;
const blockedAcquire = {
  kind: "acquire", jobRefHash: `sha256:${"c".repeat(64)}`,
  binding: { kind: "production", jobId: "job-a" },
  requestKind: "interaction", targetMode: "fresh", eligibleAt: Date.now(),
  signal: new AbortController().signal, remainingMs: () => 10_000,
  stopAbortMonitor: () => undefined, complete: () => undefined, reject: () => undefined,
};
const exactRelease = {
  kind: "release", jobId: "job-b", jobRefHash: releaseHash,
  releaseAuthority: "website-admin-deletion", eligibleAt: Date.now(),
  signal: new AbortController().signal, remainingMs: () => 10_000,
  stopAbortMonitor: () => undefined, complete: () => undefined, reject: () => undefined,
};
const ordinaryRelease = {
  ...exactRelease, jobId: "job-c", jobRefHash: `sha256:${"d".repeat(64)}`,
  releaseAuthority: "business-admitted",
};
const waitNewRelease = {
  ...exactRelease, jobId: "job-b", jobRefHash: `sha256:${"f".repeat(64)}`,
  releaseAuthority: "wait-new-attempt",
};
const wrongJobPermanentRelease = {
  ...exactRelease, jobId: "job-c", jobRefHash: `sha256:${"e".repeat(64)}`,
};
const exactPrivacyRelease = {
  ...exactRelease, jobRefHash: `sha256:${"2".repeat(64)}`,
  releaseAuthority: "website-permanent-revocation",
};
Object.assign(blockedLane, {
  queue: [blockedAcquire, ordinaryRelease, waitNewRelease,
    wrongJobPermanentRelease, exactRelease, exactPrivacyRelease],
  infrastructure: { mutationState: {
    countDispatched: () => 1,
    hasMutationForJob: (jobId: string, unresolvedOnly: boolean) => unresolvedOnly && jobId === "job-b",
  } },
});
const selected = (blockedLane.nextWaiter as () => { kind: string; jobRefHash: string }).call(blockedLane);
assert.deepEqual([selected.kind, selected.jobRefHash], ["release", releaseHash],
  "Website-authorized exact release must not deadlock behind the job's unresolved WAL");
const selectedPrivacy = (blockedLane.nextWaiter as () => {
  kind: string; jobRefHash: string;
}).call(blockedLane);
assert.deepEqual([selectedPrivacy.kind, selectedPrivacy.jobRefHash],
  ["release", exactPrivacyRelease.jobRefHash],
  "the exact job's persisted permanent revocation may use the same bounded exception");
assert.equal((blockedLane.queue as unknown[]).length, 4,
  "acquire, admission, WAIT, and another job's deletion must remain blocked");

const sameJobAcquire = { ...blockedAcquire, binding: { kind: "production", jobId: "job-b" } };
const localSameJobAcquire = { ...blockedAcquire, binding: { kind: "local", jobId: "job-b" } };
Object.assign(blockedLane, { queue: [localSameJobAcquire, sameJobAcquire] });
assert.equal((blockedLane.nextWaiter as () => unknown).call(blockedLane), sameJobAcquire,
  "only the current production binding for the exact job may enter same-lane closure");

const hash = (character: string) => `sha256:${character.repeat(64)}` as const;
const binding = (character: string) => ({
  kind: "production" as const,
  jobId: `job-${character}`, resultRevision: 0, attemptId: `attempt-${character}`,
  productStepId: "article-step", callId: "profile-open",
  deviceId: "device-1", leaseVersion: 1, localOrderId: `job-${character}`,
  contractManifestHash: hash("d"), executionRef: `execution-${character}`,
  jobRefHash: hash(character), executionRefHash: hash(character), writerLeaseEpoch: 1,
  writerFenceHash: hash("e"), candidateHash: hash("f"), commandTtlMs: 5_000,
});
const wait = (targetMode: "fresh" | "bound-observation", signal: AbortSignal,
  eligibleAt = Date.now()) => ({ targetMode, signal, eligibleAt, remainingMs: () => 5_000 });
const createBehaviorLane = (events: string[], unresolved = 0) => {
  const instance = Object.create(BrowserLaneCoordinator.prototype);
  const targetAcquirer = {
    ensureAvailableTarget: async (waiter: { targetMode: string }, parentConversationUrl?: string) => {
      events.push(parentConversationUrl
        ? `ensure:${waiter.targetMode}:${parentConversationUrl}` : `ensure:${waiter.targetMode}`);
    },
    releaseJobBoundTarget: async (_remainingMs: number, jobRefHash: string) => {
      events.push(`release:${jobRefHash}`);
    },
    reset: () => undefined, resolvePending: () => undefined, rejectPending: () => undefined,
  };
  Object.assign(instance, {
    queue: [], targetAcquirer, active: false, activeJobRefHash: null,
    wakeTimer: null, observationNotBefore: 0,
    infrastructure: { mutationState: {
      countDispatched: () => unresolved,
      hasMutationForJob: (jobId: string, unresolvedOnly: boolean) => unresolvedOnly && unresolved > 0 && jobId === "job-a",
      settleRetiredTargetLocal: () => ({ effectScope: "provider_effect",
        childCapabilityId: "submit_exact_gpt_turn_once", logicalMutationId: hash("9") }),
      latestProviderInputTerminalAt: () => null,
      readUniqueConfirmedConversationUrl: (
        parentJobId: string,
        parentAttemptId: string,
        parentProductStepId: string,
      ) => {
        assert.equal(parentAttemptId, "attempt:article:A");
        assert.equal(parentProductStepId, "article-step");
        events.push(`wal:${parentJobId}`);
        return `https://chatgpt.com/c/${parentJobId.replaceAll(":", "-")}`;
      },
    } },
    resolveBroker: () => ({
      acquireOperatorClaimedTargetLease: async (exactBinding: { jobId: string }) => ({
        pendingMutationCount: () => unresolved,
        park: async () => { events.push(`park:${exactBinding.jobId}`); },
      }),
    }),
  });
  return instance as BrowserLaneCoordinator;
};

const retiredRoot = await mkdtemp(join(tmpdir(), "browser-lane-retired-target-local-"));
const retiredStore = new BrowserMutationStore(retiredRoot);
try {
  const currentBinding = binding("a");
  const oldCommandId = "old-target-local-command";
  const oldExactCallIdentityHash = hash("1");
  retiredStore.prepare({
    commandId: oldCommandId,
    exactCallIdentityHash: oldExactCallIdentityHash,
    jobId: currentBinding.jobId,
    resultRevision: currentBinding.resultRevision,
    attemptId: "attempt-old",
    leaseVersion: 1,
    executionFenceHash: hash("2"),
    productStepId: currentBinding.productStepId,
    callId: currentBinding.callId,
    childCapabilityId: "open_gpt_model_selector_v3",
    effectScope: "target_local",
    actionOrdinal: 1,
    targetRef: "target-old",
    documentRef: "document-old",
    actionId: "browser.dom.click.v1",
    positivePostconditionHash: hash("3"),
    negativePostconditionHash: hash("4"),
    requestHash: hash("5"),
    payloadHash: hash("6"),
  });
  retiredStore.markDispatched(oldCommandId);
  const retiredEvents: string[] = [];
  const retiredLane = createBehaviorLane(retiredEvents);
  const mutationState = {
    countDispatched: () => retiredStore.countDispatched(),
    hasMutationForJob: (jobId: string, unresolvedOnly: boolean) => retiredStore.hasMutationForJob(jobId, unresolvedOnly),
    latestProviderInputTerminalAt: () => retiredStore.latestProviderInputTerminalAt(),
    settleRetiredTargetLocal: (exactBinding: Parameters<BrowserMutationStore["settleRetiredTargetLocal"]>[0]) => {
      retiredEvents.push("settle:target-local");
      return retiredStore.settleRetiredTargetLocal(exactBinding);
    },
    authorityHash: (commandId: string) => retiredStore.authorityHash(commandId),
    readUniqueConfirmedConversationUrl: (
      parentJobId: string,
      parentAttemptId: string,
      parentProductStepId: string,
    ) => retiredStore.readUniqueConfirmedConversationUrl(
      parentJobId, parentAttemptId, parentProductStepId,
    ),
  };
  Reflect.set(Reflect.get(retiredLane, "infrastructure"), "mutationState", mutationState);
  Reflect.set(retiredLane, "runtimeLogger", createRuntimeLogger({
    producer: "browser-lane-retired-target-local-acceptance",
    owner: "browser-session",
    component: "browser-infrastructure",
    terminalEnabled: false,
    fileSink: { directoryPath: join(retiredRoot, "runtime-logs") },
  }));
  Reflect.set(retiredLane, "resolveBroker", () => ({
    acquireOperatorClaimedTargetLease: async () => ({
      pendingMutationCount: () => retiredStore.countDispatched(),
      park: async () => { retiredEvents.push("park:current-attempt"); },
    }),
  }));
  const retiredLease = await retiredLane.acquire(
    currentBinding as never,
    "owner-current-attempt",
    wait("fresh", new AbortController().signal),
  );
  assert.deepEqual(retiredEvents.slice(0, 2), ["settle:target-local", "ensure:fresh"],
    "the real old target-local WAL row must settle before current Target acquisition");
  const retiredFact = retiredStore.readExactCallMutationFact({
    jobId: currentBinding.jobId,
    attemptId: "attempt-old",
    exactCallIdentityHash: oldExactCallIdentityHash,
    actionOrdinal: 1,
  });
  assert.equal(retiredFact?.authorityRef, `browser-mutation:${oldCommandId}`,
    "same-lane settlement must preserve the original command identity");
  assert.deepEqual({
    outcome: retiredFact?.outcome,
    mutationOutcome: retiredFact?.mutationOutcome,
    failureCode: retiredFact?.failureCode,
    physicalInputCount: retiredFact?.physicalInputCount,
  }, {
    outcome: "REJECTED",
    mutationOutcome: "dispatched",
    failureCode: "BROWSER_TARGET_LOCAL_EXECUTION_RETIRED",
    physicalInputCount: 0,
  }, "same-lane settlement must preserve physical input evidence and record the exact retired reason");
  await retiredLease.park({ reason: "retired-target-local-verified", mode: "product-call-settlement" });
} finally {
  retiredStore.close();
  await rm(retiredRoot, { recursive: true, force: true });
}

const providerUnknown = await createBehaviorLane([], 1).acquire(binding("a") as never, "owner-a",
  wait("fresh", new AbortController().signal)).catch((error: unknown) => error);
const providerFailure = typedBrowserExecutionFailure(providerUnknown);
assert.equal(providerFailure?.mutationOutcome, "dispatched");
assert.deepEqual(providerFailure?.browserEffect, { effectScope: "provider_effect",
  childCapabilityId: "submit_exact_gpt_turn_once", browserOutcome: "DISPATCHED",
  providerEffectIdentityHash: hash("9") }, "unknown Provider effect must never serialize as no");

const readOnlyManager = Object.create(BrowserTargetLeaseManager.prototype) as Record<string, unknown>;
const pendingProvider = { closed: false, commandInFlight: false, pendingMutationCommandIds: ["provider"],
  atomicStep: { replayPolicy: "provider-effect-once" } };
assert.doesNotThrow(() => (readOnlyManager.assertCommandAdmission as Function).call(readOnlyManager,
  pendingProvider, { kind: "dom-intent", intent: { kind: "observe" } }));
assert.throws(() => (readOnlyManager.assertCommandAdmission as Function).call(readOnlyManager,
  pendingProvider, { kind: "dom-intent", intent: { kind: "click" } }), /BROWSER_MUTATION_UNSETTLED/u,
"a Provider readback lease with pending WAL must reject every mutation command");

const fifoEvents: string[] = [];
const fifoLane = createBehaviorLane(fifoEvents);
Reflect.set(fifoLane, "observationNotBefore", Date.now() + 40);
const observationController = new AbortController();
const firstObservation = fifoLane.acquire(binding("a") as never, "owner-a",
  wait("bound-observation", observationController.signal));
const firstMutation = await fifoLane.acquire(binding("b") as never, "owner-b",
  wait("fresh", new AbortController().signal));
await firstMutation.park({ reason: "mutation-finished", mode: "product-call-settlement" });
const firstObserved = await firstObservation;
assert.deepEqual(fifoEvents.slice(0, 3), ["ensure:fresh", "park:job-b", "ensure:bound-observation"],
  "an ineligible observation must not block a later eligible interaction, then must regain FIFO priority");
const cadenceStartedAt = Date.now();
await firstObserved.park({ reason: "observation-finished", mode: "product-call-settlement" });
const sampledObservationInterval = Number(Reflect.get(fifoLane, "observationNotBefore"))
  - cadenceStartedAt;
assert.ok(sampledObservationInterval >= 70_000 && sampledObservationInterval <= 90_050,
  "one completed observation must sample one global cadence between 70 and 90 seconds");

const continuationEvents: string[] = [];
const continuationLane = createBehaviorLane(continuationEvents);
const continuationLease = await continuationLane.acquire(binding("z") as never, "owner-z", {
  targetMode: "authorized-continuation",
  parentJobId: "job:article:A",
  parentAttemptId: "attempt:article:A",
  signal: new AbortController().signal,
  eligibleAt: Date.now(),
  remainingMs: () => 5_000,
});
assert.deepEqual(continuationEvents.slice(0, 2), [
  "wal:job:article:A",
  "ensure:authorized-continuation:https://chatgpt.com/c/job-article-A",
], "the Browser owner must resolve the exact parent WAL before requesting a current-job Target");
await continuationLease.park({ reason: "continuation-finished", mode: "product-call-settlement" });
await assert.rejects(createBehaviorLane([]).acquire(binding("a") as never, "owner-a", {
  targetMode: "authorized-continuation",
  parentJobId: "job-a",
  parentAttemptId: "attempt:article:A",
  signal: new AbortController().signal,
  eligibleAt: Date.now(),
  remainingMs: () => 5_000,
}), /BROWSER_PARENT_JOB_SELF_REFERENCE/u);

const secondObservationController = new AbortController();
const secondObservation = fifoLane.acquire(binding("c") as never, "owner-c",
  wait("bound-observation", secondObservationController.signal));
const observedRejection = secondObservation.catch((error: unknown) => error);
const secondMutation = await fifoLane.acquire(binding("d") as never, "owner-d",
  wait("fresh", new AbortController().signal));
await secondMutation.park({ reason: "later-mutation-finished", mode: "product-call-settlement" });
assert.equal(fifoEvents.at(-2), "ensure:fresh",
  "a 60-second observation cadence must not block a later ready mutation");
secondObservationController.abort();
assert.match(String(await observedRejection), /BROWSER_WAIT_ABORTED/u);

const releaseEvents: string[] = [];
const releaseLane = createBehaviorLane(releaseEvents);
const activeLease = await releaseLane.acquire(binding("a") as never, "owner-a",
  wait("fresh", new AbortController().signal));
const releaseInfrastructure = Reflect.get(releaseLane, "infrastructure") as {
  mutationState: {
    countDispatched(): number;
    hasMutationForJob(jobId: string, unresolvedOnly: boolean): boolean;
  };
};
releaseInfrastructure.mutationState.countDispatched = () => 1;
releaseInfrastructure.mutationState.hasMutationForJob = (jobId, unresolvedOnly) => unresolvedOnly && jobId === "job-a";
const exactReleasePromise = releaseLane.releaseJobBoundTarget(
  "job-a", "website-admin-deletion", new AbortController().signal,
);
await Promise.resolve();
assert.equal(releaseEvents.some((event) => event.startsWith("release:")), false,
  "an active lease must remain the sole lane owner until its zero-input park completes");
await activeLease.park({ reason: "website-authorized-job-release", mode: "product-call-settlement" });
await exactReleasePromise;
const releasedJobHash = `sha256:${createHash("sha256").update("job-a").digest("hex")}`;
assert.equal(releaseEvents.at(-1), `release:${releasedJobHash}`,
  "after exact active park, unresolved DISPATCHED permits only the queued same-job release");

const releaseFrames: string[] = [];
let releaseAcquirer: BrowserTargetAcquirer;
releaseAcquirer = new BrowserTargetAcquirer(
  () => ({ currentOperatorTargetJobRefHash: () => null }) as never,
  { requestPreauthorizedTargetRelease: (jobRefHash: string) => {
    releaseFrames.push(jobRefHash);
    queueMicrotask(() => releaseAcquirer.resolvePending("release", jobRefHash));
  } } as never,
  { current: () => ({ kind: "PRESENT", authority: { authorityEpoch: 1 } }) } as never,
  { pendingJobBoundTargetAcquisition: null } as never,
);
await releaseAcquirer.releaseJobBoundTarget(5_000, releasedJobHash as `sha256:${string}`);
assert.deepEqual(releaseFrames, [releasedJobHash],
  "the selected FIFO release must cross the one preauthorized WebSocket path and settle only on exact ack");

console.log("browser lane FIFO disposable-attempt acceptance passed");
