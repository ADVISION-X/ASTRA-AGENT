import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { BrowserLaneCoordinator } from "../../src/lib/browser/infrastructure/browser-lane-coordinator.js";
import { BrowserTargetAcquirer } from "../../src/lib/browser/infrastructure/browser-target-acquirer.js";
import { BrowserMutationStore } from "../../src/lib/browser/exact-target/browser-mutation-store.js";
import { BrowserTargetLeaseManager } from "../../src/lib/browser/exact-target/browser-target-lease-manager.js";
import { binding, hash, runBrowserLaneTargetClaimAcceptance } from "./browser-lane-fifo-support.js";

const laneText = readFileSync("src/lib/browser/infrastructure/browser-lane-coordinator.ts", "utf8");
assert.match(laneText, /private readonly queue: LaneWaiter\[\] = \[\]/u);
assert.match(laneText, /PROVIDER_OBSERVATION_MIN_INTERVAL_MS = 70_000/u);
assert.match(laneText, /PROVIDER_OBSERVATION_RANDOM_SPAN_MS = 20_001/u);
assert.doesNotMatch(laneText, /settleRetiredTargetLocal|allDispatchedTargetsSettled|mayCrossUnresolved/u);
assert.doesNotMatch(readFileSync("src/lib/browser/infrastructure/browser-target-acquirer.ts", "utf8"), /expectedTargetRef|unreleasedTargetClaims/u);
assert.doesNotMatch(readFileSync("src/lib/browser/exact-target/browser-mutation-schema.ts", "utf8"), /browser_target_claims/u);
const root = await mkdtemp(join(tmpdir(), "browser-fifo-rebuild-"));
try {
  const store = new BrowserMutationStore(root); store.verifyRuntimeTaskProvenance(null);
  const database = Reflect.get(store, "database") as import("better-sqlite3").Database;
  assert.equal(database.prepare("select count(*) from sqlite_master where name='browser_target_claims'").pluck().get(), 0);
  const original = binding("a"), input = { deliveryPriorityReplayGrantHash: null, commandId: "unknown-command",
    exactCallIdentityHash: hash("1"), jobId: original.jobId, resultRevision: 0, attemptId: "attempt-old", leaseVersion: 1,
    executionFenceHash: hash("2"), productStepId: original.productStepId, callId: original.callId,
    childCapabilityId: "open_gpt_model_selector_v3", effectScope: "target_local", actionOrdinal: 1,
    targetRef: "historic-target", documentRef: "historic-document", actionId: "browser.dom.click.v1",
    positivePostconditionHash: hash("3"), negativePostconditionHash: hash("4"), requestHash: hash("5"), payloadHash: hash("6") } as const;
  store.prepare(input); store.markDispatched(input.commandId);
  assert.throws(() => store.prepare({ ...input, commandId: "other", jobId: "other-job", attemptId: "other-attempt",
    exactCallIdentityHash: hash("7"), logicalMutationId: null }), /BROWSER_MUTATION_UNSETTLED/u);
  const history = store.jobHistoryEvidence(original.jobId).historyHash;
  database.prepare("update browser_mutations set target_ref=?,document_ref=? where command_id=?").run("changed-target", "changed-document", input.commandId);
  assert.equal(store.jobHistoryEvidence(original.jobId).historyHash, history);
  let acquirer!: BrowserTargetAcquirer, creations = 0, deadline = 0;
  acquirer = new BrowserTargetAcquirer(() => ({ currentOperatorTargetJobRefHash: () => null }) as never,
    { requestPreauthorizedTargetAcquisition: (_mode: string, job: string, _url: unknown, until: number) => {
      creations += 1; deadline = until; queueMicrotask(() => acquirer.resolvePending("acquire", job));
    } } as never, { current: () => ({ kind: "PRESENT", authority: { authorityEpoch: 1 } }) } as never,
    { pendingJobBoundTargetAcquisition: null, mutationState: store } as never);
  const before = Date.now();
  await acquirer.ensureAvailableTarget({ binding: original as never, targetMode: "confirmed-readback", remainingMs: () => 5_000 });
  assert.equal(creations, 1); assert.ok(deadline >= before && deadline <= Date.now() + 5_000);
  const coordinator = Object.create(BrowserLaneCoordinator.prototype) as Record<string, unknown>;
  const waiter = { kind: "acquire", binding: original, jobRefHash: original.jobRefHash, targetMode: "fresh",
    requestKind: "interaction", eligibleAt: Date.now(), signal: new AbortController().signal,
    remainingMs: () => 5_000, stopAbortMonitor: () => undefined, complete: () => undefined, reject: () => undefined };
  Object.assign(coordinator, { queue: [waiter], active: false, observationNotBefore: 0, infrastructure: { mutationState: store } });
  const next = (): unknown => (coordinator.nextWaiter as () => unknown).call(coordinator);
  assert.equal(next(), null); assert.equal((coordinator.queue as unknown[]).length, 1);
  coordinator.queue = [{ ...waiter, targetMode: "confirmed-readback", requestKind: "provider-observation" }];
  assert.equal(next(), null);
  const sameRelease = { ...waiter, kind: "release", jobId: original.jobId, releaseAuthority: "business-admitted" };
  const otherRelease = { ...sameRelease, jobId: "other-job" }, adminRelease = { ...sameRelease, releaseAuthority: "website-admin-deletion" };
  coordinator.queue = [sameRelease, otherRelease]; assert.equal(next(), otherRelease); assert.equal(next(), null);
  coordinator.queue = [sameRelease, adminRelease]; assert.equal(next(), adminRelease); assert.equal(next(), null);
  assert.throws(() => store.purgeJob(original.jobId, "business-admitted" as never), /BROWSER_TARGET_INVALID/u);
  assert.equal(store.readCommand(input.commandId)?.state, "DISPATCHED");
  database.prepare("update browser_mutations set state='PREPARED' where command_id=?").run(input.commandId);
  store.prepare({ ...input, commandId: "retained", jobId: "retained-job", attemptId: "retained-attempt", exactCallIdentityHash: hash("8") });
  database.prepare("update browser_mutations set state='DISPATCHED' where command_id=?").run(input.commandId);
  assert.throws(() => store.purgeJob(original.jobId, undefined as never), /BROWSER_TARGET_INVALID/u);
  store.purgeJob(original.jobId, "website-admin-deletion");
  assert.equal(store.hasMutationForJob(original.jobId), false); assert.equal(store.readCommand("retained")?.state, "PREPARED");
  coordinator.queue = [{ ...waiter, requestKind: "provider-observation" }, { ...waiter, binding: binding("b"), jobRefHash: hash("b") }];
  coordinator.observationNotBefore = Date.now() + 70_000;
  const readyInteraction = (coordinator.queue as unknown[])[1];
  assert.equal(next(), readyInteraction);
  assert.equal(next(), null);
  coordinator.queue = []; coordinator.wakeTimer = null; coordinator.resolveBroker = () => ({});
  let samples = 0;
  const random = Math.random;
  Math.random = () => { samples += 1; return 0.5; };
  try {
    let epoch = 1; const originalLease = { get document() { return { navigationEpoch: epoch }; }, park: async () => undefined };
    const wrapped = (coordinator.withLifecycle as (lease: unknown, kind: string) => typeof originalLease).call(coordinator, originalLease, "provider-observation");
    epoch = 2; assert.equal(wrapped.document.navigationEpoch, 2);
    const start = Date.now(); await wrapped.park();
    assert.equal(samples, 1); assert.ok((coordinator.observationNotBefore as number) >= start + 70_000);
    assert.ok((coordinator.observationNotBefore as number) <= Date.now() + 90_000);
  } finally { Math.random = random; }
  store.close();
} finally { await rm(root, { recursive: true, force: true }); }
const manager = Object.create(BrowserTargetLeaseManager.prototype) as Record<string, unknown>;
manager.commandActor = { pendingMutationCommandIds: () => ["unknown"] };
const provider = { closed: false, commandInFlight: false, pendingMutationCommandIds: ["unknown"], atomicStep: { replayPolicy: "provider-effect-once" } };
const admission = manager.assertCommandAdmission as (provider: unknown, input: unknown) => void;
assert.doesNotThrow(() => admission.call(manager, provider, { kind: "dom-intent", intent: { kind: "observe" } }));
assert.throws(() => admission.call(manager, provider, { kind: "dom-intent", intent: { kind: "click" } }), /BROWSER_MUTATION_UNSETTLED/u);
await runBrowserLaneTargetClaimAcceptance();
console.log("browser lane FIFO native contract exercised");
