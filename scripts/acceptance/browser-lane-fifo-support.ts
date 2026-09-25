import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { BrowserInfrastructureSupervisor } from
  "../../src/lib/browser/infrastructure/browser-infrastructure-supervisor.js";
import { ExtensionTargetAuthority } from
  "../../src/lib/browser/chrome-extension/extension-target-authority.js";
import { ExtensionExactTargetRegistry } from
  "../../src/lib/browser/chrome-extension/exact-target-runtime.js";

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
assert.throws(() => (revoker.onTargetRevoke as (input: unknown) => void).call(revoker, {
  targetRef: "target-tab-19", jobRefHash: hash("b"),
  releaseOutcome: "absent",
}), /BROWSER_TARGET_INVALID/u);
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
  await assertReusedTabRevocation();
  await assertDelayedOldTabCallbacks();
};
