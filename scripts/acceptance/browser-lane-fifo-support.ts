import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { BrowserInfrastructureSupervisor } from
  "../../src/lib/browser/infrastructure/browser-infrastructure-supervisor.js";
import { ExtensionTargetAuthority } from
  "../../src/lib/browser/chrome-extension/extension-target-authority.js";
import { ExtensionExactTargetRegistry } from
  "../../src/lib/browser/chrome-extension/exact-target-runtime.js";
import { ExtensionTargetLoss } from
  "../../src/lib/browser/chrome-extension/extension-target-loss.js";
import { releaseJobBoundTarget } from
  "../../src/lib/browser/chrome-extension/extension-target-release.js";

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
  state: { pendingJobBoundTargetAcquisition: {
    action: "release", jobRefHash: hash("b"),
  } },
  issuer: { current: () => ({ kind: "PRESENT", authority: { authorityEpoch: 1 } }) },
  lane: { resolvePending: () => undefined },
});
(revoker.onTargetRevoke as (input: unknown) => void).call(revoker, {
  targetRef: "target-tab-19", jobRefHash: hash("b"), documentRef: "document-old",
});
assert.equal(currentClaim?.jobRefHash, hash("a"),
  "a delayed old ordinary revoke must not clear a new claim reusing the same numeric tab id");
assert.doesNotThrow(() => (revoker.onTargetRevoke as (input: unknown) => void).call(revoker, {
  targetRef: "target-tab-19", jobRefHash: hash("b"),
  releaseOutcome: "absent",
}));
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
const debuggerRuntime = {
  awaitPageReadPermission: () => pageBarrier,
  readTab: async () => ({ id: 19 }),
  readTargets: async () => [{ id: "chrome-new", tabId: 19, attached: true }],
};
const createdTarget = { markTabRemoved: () => {
  throw new Error("stale removal must not touch a newly created tab");
} };
Object.assign(extension, {
  chromeApi: {
    debugger: { onDetach: { addListener: (listener: typeof onDetach) => { onDetach = listener; } },
      onEvent: { addListener: () => undefined } },
    tabs: { onUpdated: { addListener: () => undefined },
      onActivated: { addListener: () => undefined },
      onRemoved: { addListener: (listener: typeof onRemoved) => { onRemoved = listener; } } },
  },
  targets: targetRegistry, activeTarget: oldTarget, navigationPublication: null,
  debuggerRuntime,
  removedTabIds: new Set<number>(), orphanCandidates: new Map(),
  orphanRetryTimers: new Map(), createdTarget,
  send: async (_kind: string, body: unknown) => { deliveredFrames.push(body); },
  targetLoss: new ExtensionTargetLoss({
    debuggerRuntime: debuggerRuntime as never, targets: targetRegistry,
    createdTarget: createdTarget as never,
    readActiveTabId: () => (extension.activeTarget as { tabId: number } | null)?.tabId ?? null,
    clearActiveTarget: () => { extension.activeTarget = null; extension.navigationPublication = null; },
    reportTargetFailure: async () => { throw new Error("an old tab event must not report a Target failure"); },
    sendRevoke: async (body) => { deliveredFrames.push(body); },
  }),
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

const assertOwnReleaseIsNotReportedAsLoss = async (): Promise<void> => {
  const registry = new ExtensionExactTargetRegistry();
  const reported: unknown[] = [];
  const frames: Readonly<{ releaseOutcome: string }>[] = [];
  let tabOpen = true;
  const debuggerRuntime = {
    awaitPageReadPermission: async () => undefined,
    readTab: async () => { if (!tabOpen) throw new Error("tab closed"); return { id: 23 }; },
    readTargets: async () => (tabOpen ? [{ id: "chrome-a", tabId: 23, attached: true }] : []),
    forgetAttached: () => undefined,
  };
  const loss = new ExtensionTargetLoss({ debuggerRuntime: debuggerRuntime as never, targets: registry,
    createdTarget: { markTabRemoved: () => undefined } as never, readActiveTabId: () => null,
    clearActiveTarget: () => undefined, reportTargetFailure: async (failure) => { reported.push(failure); },
    sendRevoke: async (body) => { frames.push(body as never); } });
  const release = (removeTab: () => Promise<void>) => releaseJobBoundTarget({
    targets: registry, createdTarget: { isPending: () => false } as never,
    readActiveJobRefHash: () => undefined, awaitOldCommandHandlers: async () => undefined,
    debuggerRuntime: { ...debuggerRuntime, removeTab } as never,
    sendRevoke: async (body: unknown) => { frames.push(body as never); },
  } as never, hash("a"));
  const bound = registry.claimOperatorTarget(23, hash("a"), "loader-a", "chrome-a");
  await release(async () => {
    tabOpen = false;
    await loss.consumeTabRemoval(23, bound);
    await loss.consumeDebuggerDetach(23, "target_closed", bound);
  });
  assert.deepEqual(reported, [],
    "Chrome events for the deliberate release of a job Target must not be reported as a Target loss");
  assert.deepEqual(frames.map((frame) => frame.releaseOutcome), ["released"],
    "a deliberate release must revoke its Target exactly once");
  assert.equal(registry.findByTabId(23), null);
  tabOpen = true;
  const kept = registry.claimOperatorTarget(23, hash("a"), "loader-a", "chrome-a");
  frames.length = 0;
  await assert.rejects(release(async () => undefined), /BROWSER_TARGET_CLEANUP_FAILED/u);
  assert.equal(registry.findByJobRefHash(hash("a"))?.targetRef, kept.targetRef,
    "a close that cannot be proven must leave the Target registered for the next release attempt");
  assert.deepEqual(frames, [], "an unproven close must not revoke the Target");
};

export const runBrowserLaneTargetClaimAcceptance = async (): Promise<void> => {
  await assertReusedTabRevocation();
  await assertDelayedOldTabCallbacks();
  await assertOwnReleaseIsNotReportedAsLoss();
};
