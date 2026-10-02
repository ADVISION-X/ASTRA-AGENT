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

const laneSource = readFileSync("src/lib/browser/infrastructure/browser-lane-coordinator.ts", "utf8");
const acquirerSource = readFileSync("src/lib/browser/infrastructure/browser-target-acquirer.ts", "utf8");
const schemaSource = readFileSync("src/lib/browser/exact-target/browser-mutation-schema.ts", "utf8");
assert.match(laneSource, /private readonly queue: LaneWaiter\[\] = \[\]/u);
assert.match(laneSource, /PROVIDER_OBSERVATION_MIN_INTERVAL_MS = 70_000/u);
assert.match(laneSource, /PROVIDER_OBSERVATION_RANDOM_SPAN_MS = 20_001/u);
assert.doesNotMatch(laneSource, /settleRetiredTargetLocal|allDispatchedTargetsSettled|mayCrossUnresolved/u);
assert.doesNotMatch(acquirerSource, /expectedTargetRef|unreleasedTargetClaims/u);
assert.doesNotMatch(schemaSource, /browser_target_claims/u);

const root = await mkdtemp(join(tmpdir(), "browser-lane-targetless-"));
try {
  const store = new BrowserMutationStore(root);
  store.verifyRuntimeTaskProvenance(null);
  const db = Reflect.get(store, "database") as import("better-sqlite3").Database;
  assert.equal((db.prepare("select count(*) from sqlite_master where name='browser_target_claims'")
    .pluck().get() as number), 0, "Target claims must have no persistent table");
  const old = binding("a");
  const mutationInput = { deliveryPriorityReplayGrantHash: null,
    commandId: "unknown-command", exactCallIdentityHash: hash("1"),
    jobId: old.jobId, resultRevision: 0, attemptId: "attempt-old", leaseVersion: 1,
    executionFenceHash: hash("2"), productStepId: old.productStepId,
    callId: old.callId, childCapabilityId: "open_gpt_model_selector_v3",
    effectScope: "target_local", actionOrdinal: 1,
    targetRef: "historical-target", documentRef: "historical-document",
    actionId: "browser.dom.click.v1", positivePostconditionHash: hash("3"),
    negativePostconditionHash: hash("4"), requestHash: hash("5"), payloadHash: hash("6") } as const;
  store.prepare(mutationInput);
  store.markDispatched("unknown-command");
  assert.throws(() => store.prepare({ ...mutationInput,
    commandId: "new-command", exactCallIdentityHash: hash("7"),
    jobId: "other-job", attemptId: "other-attempt", logicalMutationId: null,
  }), /BROWSER_MUTATION_UNSETTLED/u,
  "the WAL writer must reject a new mutation from another job while any command is DISPATCHED");
  const historyBeforeTargetChange = store.jobHistoryEvidence(old.jobId).historyHash;
  db.prepare("update browser_mutations set target_ref=?,document_ref=? where command_id=?")
    .run("another-historical-target", "another-historical-document", "unknown-command");
  assert.equal(store.jobHistoryEvidence(old.jobId).historyHash, historyBeforeTargetChange,
    "historical Target/Document provenance must not enter source history identity");
  let created = 0;
  let acquirer!: BrowserTargetAcquirer;
  acquirer = new BrowserTargetAcquirer(
    () => ({ currentOperatorTargetJobRefHash: () => null }) as never,
    { requestPreauthorizedTargetAcquisition: (_mode: string, jobRefHash: string) => {
      created += 1;
      queueMicrotask(() => acquirer.resolvePending("acquire", jobRefHash));
    } } as never,
    { current: () => ({ kind: "PRESENT", authority: { authorityEpoch: 1 } }) } as never,
    { pendingJobBoundTargetAcquisition: null, mutationState: store } as never);
  await acquirer.ensureAvailableTarget({ binding: old as never,
    targetMode: "confirmed-readback", remainingMs: () => 5_000 });
  assert.equal(created, 1, "acquisition must use the current Browser authority regardless of old Target history");

  const coordinator = Object.create(BrowserLaneCoordinator.prototype) as Record<string, unknown>;
  const waiter = { kind: "acquire", binding: old, jobRefHash: old.jobRefHash,
    targetMode: "fresh", requestKind: "interaction", eligibleAt: Date.now(),
    signal: new AbortController().signal, remainingMs: () => 5_000,
    stopAbortMonitor: () => undefined, complete: () => undefined, reject: () => undefined };
  Object.assign(coordinator, { queue: [waiter], active: false,
    infrastructure: { mutationState: store } });
  assert.equal((coordinator.nextWaiter as () => unknown).call(coordinator), null,
    "a DISPATCHED WAL command must block new physical input without old Target settlement");
  assert.equal((coordinator.queue as unknown[]).length, 1);
  const readbackWaiter = { ...waiter, targetMode: "confirmed-readback",
    requestKind: "provider-observation" };
  coordinator.queue = [readbackWaiter];
  assert.equal((coordinator.nextWaiter as () => unknown).call(coordinator), null,
    "a mode string cannot bypass an unresolved writer without a trusted exact locator");
  const otherRelease = { ...waiter, kind: "release", jobId: "other-job" };
  const sameRelease = { ...waiter, kind: "release", jobId: old.jobId };
  coordinator.queue = [sameRelease, otherRelease];
  assert.equal((coordinator.nextWaiter as () => unknown).call(coordinator), otherRelease,
    "another job may release its live Target while an unrelated writer is DISPATCHED");
  assert.equal((coordinator.nextWaiter as () => unknown).call(coordinator), null,
    "the DISPATCHED writer's own Target must remain held until original terminal readback");
  assert.equal(store.readCommand("unknown-command")?.state, "DISPATCHED");
  assert.throws(() => store.purgeJob(old.jobId, "business-admitted" as never), /BROWSER_TARGET_INVALID/u,
    "purge must not delete the WAL row that enforces the global input barrier");
  assert.equal(store.readCommand("unknown-command")?.state, "DISPATCHED",
    "a new attempt must not fabricate terminal state for the old command");
  const adminRelease = { ...sameRelease, releaseAuthority: "website-admin-deletion" };
  coordinator.queue = [sameRelease, adminRelease];
  assert.equal((coordinator.nextWaiter as () => unknown).call(coordinator), adminRelease,
    "only exact Website deletion may release a same-job unresolved lane");
  assert.equal((coordinator.nextWaiter as () => unknown).call(coordinator), null);
  db.prepare("update browser_mutations set state='PREPARED' where command_id=?").run("unknown-command");
  store.prepare({ ...mutationInput, commandId: "retained-command", jobId: "retained-job",
    attemptId: "retained-attempt", exactCallIdentityHash: hash("8") });
  db.prepare("update browser_mutations set state='DISPATCHED' where command_id=?").run("unknown-command");
  assert.throws(() => store.purgeJob(old.jobId, undefined as never), /BROWSER_TARGET_INVALID/u);
  store.purgeJob(old.jobId, "website-admin-deletion");
  assert.equal(store.hasMutationForJob(old.jobId), false, "admin deletion physically purges the unknown fact without settling it");
  assert.equal(store.readCommand("retained-command")?.state, "PREPARED", "other job WAL must survive exact deletion");
  store.close();
} finally { await rm(root, { recursive: true, force: true }); }

const pendingManager = Object.create(BrowserTargetLeaseManager.prototype) as Record<string, unknown>;
pendingManager.commandActor = { pendingMutationCommandIds: () => ["unknown-command"] };
const pendingProvider = { closed: false, commandInFlight: false,
  pendingMutationCommandIds: ["unknown-command"],
  atomicStep: { replayPolicy: "provider-effect-once" } };
assert.doesNotThrow(() => (pendingManager.assertCommandAdmission as Function).call(pendingManager,
  pendingProvider, { kind: "dom-intent", intent: { kind: "observe" } }));
assert.throws(() => (pendingManager.assertCommandAdmission as Function).call(pendingManager,
  pendingProvider, { kind: "dom-intent", intent: { kind: "click" } }),
/BROWSER_MUTATION_UNSETTLED/u);
await runBrowserLaneTargetClaimAcceptance();
console.log("browser lane targetless FIFO acceptance passed");
