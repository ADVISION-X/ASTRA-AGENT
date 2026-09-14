import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { BrowserLaneCoordinator } from
  "../../src/lib/browser/infrastructure/browser-lane-coordinator.js";
import { BrowserTargetAcquirer } from
  "../../src/lib/browser/infrastructure/browser-target-acquirer.js";

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
assert.match(lane, /waiter\.requestKind === "provider-observation"/u,
  "Browser-owned Provider observation requests must re-enter the same paced FIFO");
assert.doesNotMatch(leaseContract, /requestKind/u,
  "GPT and Product callers must not be able to self-report Browser request classification");
assert.doesNotMatch(lane, /setInterval|providerProbeQueue|observationQueue|releaseQueue/u,
  "the Browser lane must not grow per-Tab timers or a second queue");
assert.match(lane, /mutationBlocked && !exactPermanentCleanup/u,
  "unresolved DISPATCHED must block every operation except exact permanent cleanup");
assert.match(lane, /hasUnresolvedMutationForJob\(waiter\.jobId\)/u,
  "the cleanup exception must bind the exact job's unresolved DISPATCHED row");
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
assert.doesNotMatch(store, /atomicStepRecovery|callRecoveryScope|reconciliationScope/u,
  "Browser store must expose no recovery consumer");
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
const attemptReplacedRelease = {
  ...exactRelease, jobId: "job-b", jobRefHash: `sha256:${"1".repeat(64)}`,
  releaseAuthority: "attempt-replaced",
};
const wrongJobPermanentRelease = {
  ...exactRelease, jobId: "job-c", jobRefHash: `sha256:${"e".repeat(64)}`,
};
const exactPrivacyRelease = {
  ...exactRelease, jobRefHash: `sha256:${"2".repeat(64)}`,
  releaseAuthority: "website-permanent-revocation",
};
Object.assign(blockedLane, {
  queue: [blockedAcquire, ordinaryRelease, waitNewRelease, attemptReplacedRelease,
    wrongJobPermanentRelease, exactRelease, exactPrivacyRelease],
  infrastructure: { mutationState: {
    countDispatched: () => 1,
    hasUnresolvedMutationForJob: (jobId: string) => jobId === "job-b",
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
assert.equal((blockedLane.queue as unknown[]).length, 5,
  "acquire, admission, WAIT, attempt replacement, and another job's deletion must remain blocked");

const hash = (character: string) => `sha256:${character.repeat(64)}` as const;
const binding = (character: string) => ({
  jobId: `job-${character}`, resultRevision: 0, attemptId: `attempt-${character}`,
  deviceId: "device-1", leaseVersion: 1, localOrderId: `job-${character}`,
  contractManifestHash: hash("d"), executionRef: `execution-${character}`,
  jobRefHash: hash(character), executionRefHash: hash(character), writerLeaseEpoch: 1,
  writerFenceHash: hash("e"), candidateHash: hash("f"), commandTtlMs: 5_000,
});
const wait = (targetMode: "fresh" | "bound-observation", signal: AbortSignal,
  eligibleAt = Date.now()) => ({ targetMode, signal, eligibleAt, remainingMs: () => 5_000 });
const createBehaviorLane = (events: string[], unresolved = 0) => {
  const instance = Object.create(BrowserLaneCoordinator.prototype) as Record<string, unknown>;
  const targetAcquirer = {
    ensureAvailableTarget: async (waiter: { targetMode: string }) => {
      events.push(`ensure:${waiter.targetMode}`);
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
      hasUnresolvedMutationForJob: (jobId: string) => unresolved > 0 && jobId === "job-a",
      latestProviderInputTerminalAt: () => null,
    } },
    resolveBroker: () => ({
      acquireOperatorClaimedTargetLease: async (exactBinding: { jobId: string }) => ({
        pendingMutationCount: () => unresolved,
        park: async () => { events.push(`park:${exactBinding.jobId}`); },
      }),
    }),
  });
  return instance as unknown as BrowserLaneCoordinator;
};

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
await firstObserved.park({ reason: "observation-finished", mode: "product-call-settlement" });
assert.ok(Number(Reflect.get(fifoLane, "observationNotBefore")) >= Date.now() + 29_000,
  "one completed observation must advance the single global cadence by 30 seconds");

const secondObservationController = new AbortController();
const secondObservation = fifoLane.acquire(binding("c") as never, "owner-c",
  wait("bound-observation", secondObservationController.signal));
const observedRejection = secondObservation.catch((error: unknown) => error);
const secondMutation = await fifoLane.acquire(binding("d") as never, "owner-d",
  wait("fresh", new AbortController().signal));
await secondMutation.park({ reason: "later-mutation-finished", mode: "product-call-settlement" });
assert.equal(fifoEvents.at(-2), "ensure:fresh",
  "a 30-second observation cadence must not block a later ready mutation");
secondObservationController.abort();
assert.match(String(await observedRejection), /BROWSER_WAIT_ABORTED/u);

const releaseEvents: string[] = [];
const releaseLane = createBehaviorLane(releaseEvents);
const activeLease = await releaseLane.acquire(binding("a") as never, "owner-a",
  wait("fresh", new AbortController().signal));
const releaseInfrastructure = Reflect.get(releaseLane, "infrastructure") as {
  mutationState: {
    countDispatched(): number;
    hasUnresolvedMutationForJob(jobId: string): boolean;
  };
};
releaseInfrastructure.mutationState.countDispatched = () => 1;
releaseInfrastructure.mutationState.hasUnresolvedMutationForJob = (jobId) => jobId === "job-a";
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
