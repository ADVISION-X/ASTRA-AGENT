import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { BrowserTargetAcquirer } from
  "../../src/lib/browser/infrastructure/browser-target-acquirer.js";
import { BrowserInfrastructureSupervisor } from
  "../../src/lib/browser/infrastructure/browser-infrastructure-supervisor.js";
import { ExtensionTargetAuthority } from
  "../../src/lib/browser/chrome-extension/extension-target-authority.js";
import { ExtensionExactTargetRegistry } from
  "../../src/lib/browser/chrome-extension/exact-target-runtime.js";
import { BrowserMutationStore } from
  "../../src/lib/browser/exact-target/browser-mutation-store.js";
import { oldTargetUnavailableFact } from "../../src/lib/execution-failure.js";

export const hash = (character: string) => `sha256:${character.repeat(64)}` as const;
export const binding = (character: string) => ({
  kind: "production" as const,
  jobId: `job-${character}`, resultRevision: 0, attemptId: `attempt-${character}`,
  productStepId: "article-step", callId: "profile-open",
  deviceId: "device-1", leaseVersion: 1, localOrderId: `job-${character}`,
  contractManifestHash: hash("d"), executionRef: `execution-${character}`,
  jobRefHash: hash(character), executionRefHash: hash(character), writerLeaseEpoch: 1,
  writerFenceHash: hash("e"), candidateHash: hash("f"), commandTtlMs: 5_000,
});
const assertOldTargetUnavailableFact = async (
  historicalStore: BrowserMutationStore, oldJobHash: ReturnType<typeof hash>,
): Promise<void> => {
  let typedAcquirer: BrowserTargetAcquirer;
  typedAcquirer = new BrowserTargetAcquirer(
    () => ({ currentOperatorTargetJobRefHash: () => null }) as never,
    { requestPreauthorizedTargetAcquisition: () => {
      queueMicrotask(() => {
        typedAcquirer.rejectPending("BROWSER_OLD_TARGET_INSTANCE_UNAVAILABLE", {
          jobRefHash: oldJobHash, targetRef: "target-tab-19", failedFrameSequence: "16",
        });
        typedAcquirer.rejectPending("BROWSER_OLD_TARGET_INSTANCE_UNAVAILABLE", {
          jobRefHash: oldJobHash, targetRef: "target-tab-19", failedFrameSequence: "17",
        });
      });
      return 17;
    } } as never,
    { current: () => ({ kind: "PRESENT", authority: { authorityEpoch: 1 } }) } as never,
    { pendingJobBoundTargetAcquisition: null, mutationState: historicalStore } as never,
  );
  let unavailableError: unknown = null;
  try {
    await typedAcquirer.ensureAvailableTarget({ binding: binding("b") as never,
      targetMode: "confirmed-readback", remainingMs: () => 5_000 });
  } catch (error) { unavailableError = error; }
  const unavailable = oldTargetUnavailableFact(unavailableError);
  assert.equal(unavailable?.jobRefHash, oldJobHash);
  assert.equal(unavailable?.targetRefHash,
    `sha256:${createHash("sha256").update("target-tab-19").digest("hex")}`,
    "only an exact matching authenticated acquisition diagnostic may prove old-instance unavailability");
};

const assertHistoricalClaimOwnership = async (): Promise<void> => {
const historicalRoot = await mkdtemp(join(tmpdir(), "browser-lane-historical-claim-"));
const historicalStore = new BrowserMutationStore(historicalRoot);
historicalStore.verifyRuntimeTaskProvenance(null);
try {
  const oldJobHash = hash("b");
  const newJobHash = hash("a");
  const historicalDb = Reflect.get(historicalStore, "database") as import("better-sqlite3").Database;
  historicalDb.prepare(`insert into browser_target_claims(
    target_ref,job_ref_hash,tab_id,claim_source,claimed_at,released_at
  ) values(?,?,?,'legacy_wal',?,null)`).run(
    "target-tab-19", oldJobHash, 19, new Date().toISOString(),
  );
  historicalStore.recordTargetClaim({ jobRefHash: newJobHash, targetRef: "target-tab-19" });
  assert.deepEqual(historicalStore.unreleasedTargetClaims().map((claim) =>
    [claim.jobRefHash, claim.claimSource]), [
    [oldJobHash, "legacy_wal"], [newJobHash, "authenticated_claim"],
  ], "a reused numeric tab id must preserve the old claim and persist the current authenticated claim");

  const acquisitions: Array<{ jobRefHash: string; expectedTargetRef: string | undefined }> = [];
  let historicalAcquirer: BrowserTargetAcquirer;
  historicalAcquirer = new BrowserTargetAcquirer(
    () => ({ currentOperatorTargetJobRefHash: () => null }) as never,
    { requestPreauthorizedTargetAcquisition: (
      _targetMode: string, jobRefHash: string, _url: string | undefined, expectedTargetRef: string | undefined,
    ) => {
      acquisitions.push({ jobRefHash, expectedTargetRef });
      queueMicrotask(() => historicalAcquirer.resolvePending("acquire", jobRefHash));
    } } as never,
    { current: () => ({ kind: "PRESENT", authority: { authorityEpoch: 1 } }) } as never,
    { pendingJobBoundTargetAcquisition: null, mutationState: historicalStore } as never,
  );
  await historicalAcquirer.ensureAvailableTarget({ binding: binding("c") as never,
    targetMode: "fresh", remainingMs: () => 5_000 });
  assert.deepEqual(acquisitions, [{ jobRefHash: hash("c"), expectedTargetRef: undefined }],
    "another job's historical claims must not become a global acquisition mutex");
  await assert.rejects(historicalAcquirer.ensureAvailableTarget({ binding: binding("a") as never,
    targetMode: "fresh", remainingMs: () => 5_000 }), /BROWSER_OLD_TARGET_RECONCILIATION_REQUIRED/u,
  "the same job must settle its own old claim before fresh execution");
  await historicalAcquirer.ensureAvailableTarget({ binding: binding("a") as never,
    targetMode: "confirmed-readback", remainingMs: () => 5_000 });
  assert.deepEqual(acquisitions.at(-1), { jobRefHash: hash("a"), expectedTargetRef: "target-tab-19" },
    "same-job readback must bind the exact old target candidate");
  await assertOldTargetUnavailableFact(historicalStore, oldJobHash);
} finally {
  historicalStore.close();
  await rm(historicalRoot, { recursive: true, force: true });
}

};

const assertClaimGenerationSettlement = async (): Promise<void> => {
const settlementRoot = await mkdtemp(join(tmpdir(), "browser-lane-claim-generation-"));
const settlementStore = new BrowserMutationStore(settlementRoot);
settlementStore.verifyRuntimeTaskProvenance(null);
try {
  const settlementJobId = "job-settlement";
  const settlementJobHash = `sha256:${createHash("sha256").update(settlementJobId).digest("hex")}` as const;
  const targetRef = "target-tab-23";
  settlementStore.prepare({ deliveryPriorityReplayGrantHash: null,
    commandId: "settlement-dispatched", logicalMutationId: hash("9"),
    exactCallIdentityHash: hash("1"),
    jobId: settlementJobId, resultRevision: 0, attemptId: "attempt-settlement",
    leaseVersion: 1, executionFenceHash: hash("2"), productStepId: "step",
    callId: "call", childCapabilityId: "submit_exact_gpt_turn_once",
    effectScope: "provider_effect", actionOrdinal: 1, targetRef,
    documentRef: "document-settlement", actionId: "browser.dom.click.v1",
    positivePostconditionHash: hash("3"), negativePostconditionHash: hash("4"),
    requestHash: hash("5"), payloadHash: hash("6"),
  });
  settlementStore.markDispatched("settlement-dispatched");
  settlementStore.recordTargetClaim({ jobRefHash: settlementJobHash, targetRef });
  const settlementDb = Reflect.get(settlementStore, "database") as import("better-sqlite3").Database;
  const claimsBeforeRestart = (settlementDb.prepare(
    "select count(*) as count from browser_target_claims",
  ).get() as { count: number }).count;
  const restartedStore = new BrowserMutationStore(settlementRoot);
  assert.equal(((Reflect.get(restartedStore, "database") as import("better-sqlite3").Database)
    .prepare("select count(*) as count from browser_target_claims").get() as { count: number }).count,
  claimsBeforeRestart, "ordinary restart must not ingest another legacy_wal claim");
  restartedStore.close();
  settlementStore.markTargetReleased({ jobRefHash: settlementJobHash, targetRefs: [targetRef],
    outcome: "quiesced", proofHash: hash("7") });
  assert.equal(settlementStore.allDispatchedTargetsSettled(), true);
  settlementStore.recordTargetClaim({ jobRefHash: settlementJobHash, targetRef });
  assert.equal(settlementStore.allDispatchedTargetsSettled(), false,
    "an old release proof cannot settle a newly authenticated claim with the same numeric tab id");
  settlementStore.markTargetReleased({ jobRefHash: settlementJobHash, targetRefs: [targetRef],
    outcome: "quiesced", proofHash: hash("8") });
  assert.equal(settlementStore.allDispatchedTargetsSettled(), true,
    "the latest claim must receive its own typed quiescence proof before global mutation resumes");
} finally {
  settlementStore.close();
  await rm(settlementRoot, { recursive: true, force: true });
}

};

const assertReusedTabRevocation = async (): Promise<void> => {
let currentClaim: { targetRef: string; jobRefHash: `sha256:${string}`;
  documentRef: string } | null = {
  targetRef: "target-tab-19", jobRefHash: hash("a"), documentRef: "document-new",
};
const revoker = Object.create(BrowserInfrastructureSupervisor.prototype) as Record<string, unknown>;
Object.assign(revoker, {
  broker: {
    currentOperatorTargetJobRefHash: () => currentClaim?.jobRefHash ?? null,
    revokeOperatorTargetClaim: (identity: typeof currentClaim) => {
      if (identity && currentClaim?.targetRef === identity.targetRef
        && currentClaim.jobRefHash === identity.jobRefHash
        && (identity.documentRef === undefined || currentClaim.documentRef === identity.documentRef)) {
        currentClaim = null;
      }
    },
  },
  state: { mutationState: { markTargetReleased: () => undefined },
    pendingJobBoundTargetAcquisition: {
      action: "release", jobRefHash: hash("b"), targetRefs: ["target-tab-19"],
    } },
  issuer: { current: () => ({ kind: "PRESENT", authority: { authorityEpoch: 1 } }) },
  lane: { resolvePending: () => undefined },
});
(revoker.onTargetRevoke as (input: unknown) => void).call(revoker, {
  targetRef: "target-tab-19", jobRefHash: hash("b"), documentRef: "document-old",
});
assert.equal(currentClaim?.jobRefHash, hash("a"),
  "a delayed old ordinary revoke must not clear a new claim reusing the same numeric tab id");
(revoker.onTargetRevoke as (input: unknown) => void).call(revoker, {
  targetRef: "target-tab-19", jobRefHash: hash("b"),
  targetRefs: ["target-tab-19"], releaseOutcome: "quiesced",
});
assert.equal(currentClaim?.jobRefHash, hash("a"),
  "an old job's release for a reused tab id must not revoke another job's live broker claim");
(revoker.onTargetRevoke as (input: unknown) => void).call(revoker, {
  targetRef: "target-tab-19", jobRefHash: hash("a"), documentRef: "document-new",
});
assert.equal(currentClaim, null,
  "the matching current ordinary park/revoke must clear its exact broker claim");

};

const assertDelayedOldTabCallbacks = async (): Promise<void> => {
let onRemoved!: (tabId: number) => void;
let onDetach!: (target: { tabId: number }, reason: "target_closed" | "canceled_by_user") => void;
const targetRegistry = new ExtensionExactTargetRegistry();
const oldTarget = targetRegistry.claimOperatorTarget(19, hash("a"), "loader-old", "chrome-old");
let releasePageBarrier!: () => void;
let pageBarrier: Promise<void> = new Promise((resolve) => { releasePageBarrier = resolve; });
const deliveredFrames: unknown[] = [];
const extension = Object.create(ExtensionTargetAuthority.prototype) as Record<string, unknown>;
Object.assign(extension, {
  chromeApi: {
    debugger: { onDetach: { addListener: (listener: typeof onDetach) => { onDetach = listener; } },
      onEvent: { addListener: () => undefined } },
    tabs: { onUpdated: { addListener: () => undefined },
      onActivated: { addListener: () => undefined },
      onRemoved: { addListener: (listener: typeof onRemoved) => { onRemoved = listener; } } },
  },
  targets: targetRegistry, activeTarget: oldTarget, navigationPublication: null,
  debuggerRuntime: {
    awaitPageReadPermission: () => pageBarrier,
    readTab: async () => ({ id: 19 }),
    readTargets: async () => [{ id: "chrome-new", tabId: 19, attached: true }],
  },
  removedTabIds: new Set<number>(), orphanCandidates: new Map(),
  orphanRetryTimers: new Map(), createdTarget: { markTabRemoved: () => {
    throw new Error("stale removal must not touch a newly created tab");
  } },
  send: async (_kind: string, body: unknown) => { deliveredFrames.push(body); },
});
(extension.start as () => void).call(extension);
onRemoved(19);
onDetach({ tabId: 19 }, "target_closed");
targetRegistry.remove(oldTarget.targetRef);
const newTarget = targetRegistry.claimOperatorTarget(19, hash("b"), "loader-new", "chrome-new");
extension.activeTarget = newTarget;
releasePageBarrier();
await new Promise<void>((resolve) => setTimeout(resolve, 0));
assert.equal(targetRegistry.findByTabId(19)?.chromeTargetId, "chrome-new");
assert.equal((extension.removedTabIds as Set<number>).has(19), false);
assert.equal(extension.activeTarget, newTarget);
assert.deepEqual(deliveredFrames, [],
  "old tab callbacks delayed behind the page barrier must not revoke a reused tab id");
pageBarrier = Promise.resolve();
onRemoved(19);
onDetach({ tabId: 19 }, "target_closed");
await new Promise<void>((resolve) => setTimeout(resolve, 0));
assert.equal(targetRegistry.findByTabId(19)?.chromeTargetId, "chrome-new");
assert.equal((extension.removedTabIds as Set<number>).has(19), false);
assert.deepEqual(deliveredFrames, [],
  "an old tab event delivered after a new claim must not clear that live claim");

};

export const runBrowserLaneTargetClaimAcceptance = async (): Promise<void> => {
  await assertHistoricalClaimOwnership();
  await assertClaimGenerationSettlement();
  await assertReusedTabRevocation();
  await assertDelayedOldTabCallbacks();
};
