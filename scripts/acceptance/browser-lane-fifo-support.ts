import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { BrowserInfrastructureSupervisor } from "../../src/lib/browser/infrastructure/browser-infrastructure-supervisor.js";
import { ExtensionTargetAuthority } from "../../src/lib/browser/chrome-extension/extension-target-authority.js";
import { ExtensionExactTargetRegistry } from "../../src/lib/browser/chrome-extension/exact-target-runtime.js";
import { ExtensionTargetLoss } from "../../src/lib/browser/chrome-extension/extension-target-loss.js";
import { releaseJobBoundTarget } from "../../src/lib/browser/chrome-extension/extension-target-release.js";
import { parseBrowserAuthorityTargetRevoke } from "../../src/lib/browser/transport/browser-authority-frame-payload.js";

export const hash = (digit: string): `sha256:${string}` => `sha256:${digit.repeat(64)}`;
export const binding = (digit: string) => ({ kind: "production" as const, jobId: `job-${digit}`, resultRevision: 0,
  attemptId: `attempt-${digit}`, productStepId: "article-step", callId: "profile-open", deviceId: "device-1",
  leaseVersion: 1, localOrderId: `job-${digit}`, contractManifestHash: hash("d"), executionRef: `execution-${digit}`,
  jobRefHash: hash(digit), executionRefHash: hash(digit), writerLeaseEpoch: 1, writerFenceHash: hash("e"),
  candidateHash: hash("f"), commandTtlMs: 5_000 });

const releaseThroughWire = async (): Promise<void> => {
  for (const mode of ["unbound", "gone", "live", "close-unproven", "remove-failed", "readback-failed"] as const) {
    const registry = new ExtensionExactTargetRegistry();
    const bound = mode === "unbound" ? null : registry.claimOperatorTarget(23, hash("a"), "loader-a", "chrome-a");
    let tabOpen = mode !== "gone", removals = 0, resolutions = 0;
    const bodies: Record<string, unknown>[] = [];
    let claim = bound;
    const supervisor = Object.create(BrowserInfrastructureSupervisor.prototype) as Record<string, unknown>;
    Object.assign(supervisor, { state: { pendingJobBoundTargetAcquisition: { action: "release", jobRefHash: hash("a") } },
      broker: { currentOperatorTargetJobRefHash: () => claim?.jobRefHash ?? null,
        revokeOperatorTargetClaim: (identity?: { targetRef: string; jobRefHash: string }) => {
          if (!identity || identity.targetRef === claim?.targetRef && identity.jobRefHash === claim.jobRefHash) claim = null;
        } }, lane: { resolvePending: (action: string, job: string) => {
          assert.equal(action, "release"); assert.equal(job, hash("a")); resolutions += 1;
        } } });
    const invoke = (body: Record<string, unknown>): void =>
      (supervisor.onTargetRevoke as (input: unknown) => void).call(supervisor, parseBrowserAuthorityTargetRevoke(body));
    const release = () => releaseJobBoundTarget({ targets: registry, createdTarget: { isPending: () => false } as never,
      readActiveJobRefHash: () => null, awaitOldCommandHandlers: async () => undefined,
      debuggerRuntime: { awaitPageReadPermission: async () => undefined,
        readTargets: async () => { if (mode === "readback-failed" && removals) throw new Error("READBACK_FAILED");
          return tabOpen ? [{ id: "chrome-a", tabId: 23, attached: true }] : []; },
        readTab: async () => { if (!tabOpen) throw new Error("TAB_ABSENT"); return { id: 23 }; },
        forgetAttached: () => undefined, removeTab: async () => {
          removals += 1; if (mode === "remove-failed") throw new Error("REMOVE_FAILED");
          if (mode !== "close-unproven") tabOpen = false;
        } } as never, sendRevoke: async body => { bodies.push(body); invoke(body); } }, hash("a"));
    if (mode.endsWith("failed") || mode === "close-unproven") {
      await assert.rejects(release()); assert.equal(registry.findByJobRefHash(hash("a")), bound);
      assert.equal(claim, bound); assert.deepEqual(bodies, []); assert.equal(resolutions, 0); continue;
    }
    await release();
    const released = mode === "live";
    assert.deepEqual(bodies, [{ targetRef: released ? bound!.targetRef : null, jobRefHash: hash("a"),
      releaseOutcome: released ? "released" : "absent" }]);
    assert.equal(removals, released ? 1 : 0); assert.equal(resolutions, 1); assert.equal(claim, null);
    assert.equal(registry.findByJobRefHash(hash("a")), null);
    for (const invalid of [ { ...bodies[0], releaseOutcome: released ? "absent" : "released" },
      { ...bodies[0], documentRef: "foreign-document" } ]) assert.throws(() => parseBrowserAuthorityTargetRevoke(invalid));
    assert.throws(() => invoke({ targetRef: null, jobRefHash: hash("b"), releaseOutcome: "absent" }));
    (supervisor.state as { pendingJobBoundTargetAcquisition: unknown }).pendingJobBoundTargetAcquisition = { action: "acquire", jobRefHash: hash("a") };
    assert.throws(() => invoke(bodies[0]!)); assert.equal(resolutions, 1);
  }
};

const delayedRevocation = (): void => {
  let claim: { targetRef: string; jobRefHash: `sha256:${string}`; documentRef: string } | null = {
    targetRef: "target-tab-19", jobRefHash: hash("a"), documentRef: "document-new" };
  let resolved = 0;
  const supervisor = Object.create(BrowserInfrastructureSupervisor.prototype) as Record<string, unknown>;
  Object.assign(supervisor, { state: { pendingJobBoundTargetAcquisition: { action: "release", jobRefHash: hash("b") } },
    broker: { currentOperatorTargetJobRefHash: () => claim?.jobRefHash ?? null,
      revokeOperatorTargetClaim: (identity?: { targetRef: string; jobRefHash: string; documentRef?: string }) => {
        if (!identity || claim?.targetRef === identity.targetRef && claim.jobRefHash === identity.jobRefHash
          && (identity.documentRef === undefined || claim.documentRef === identity.documentRef)) claim = null;
      } }, lane: { resolvePending: () => { resolved += 1; } } });
  const deliver = (body: Record<string, unknown>): void =>
    (supervisor.onTargetRevoke as (value: unknown) => void).call(supervisor, parseBrowserAuthorityTargetRevoke(body));
  deliver({ targetRef: "target-tab-19", jobRefHash: hash("b"), documentRef: "document-old" });
  deliver({ targetRef: null, jobRefHash: hash("b"), releaseOutcome: "absent" });
  assert.equal(claim?.jobRefHash, hash("a")); assert.equal(resolved, 1);
  deliver({ targetRef: "target-tab-19", jobRefHash: hash("a"), documentRef: "document-old" });
  assert.equal(claim?.documentRef, "document-new");
  deliver({ targetRef: "target-tab-19", jobRefHash: hash("a"), documentRef: "document-new" });
  assert.equal(claim, null);
};

const delayedChromeCallbacks = async (): Promise<void> => {
  let removed!: (id: number) => void, detached!: (target: { tabId: number }, reason: "target_closed" | "canceled_by_user") => void;
  let unblock!: () => void;
  let barrier = new Promise<void>(resolve => { unblock = resolve; });
  const registry = new ExtensionExactTargetRegistry(), old = registry.claimOperatorTarget(19, hash("a"), "old", "chrome-old");
  const frames: unknown[] = [], extension = Object.create(ExtensionTargetAuthority.prototype) as Record<string, unknown>;
  const runtime = { awaitPageReadPermission: () => barrier, readTab: async () => ({ id: 19 }),
    readTargets: async () => [{ id: "chrome-new", tabId: 19, attached: true }] };
  const created = { markTabRemoved: () => { throw new Error("STALE_EVENT_TOUCHED_NEW_TAB"); } };
  Object.assign(extension, { targets: registry, activeTarget: old, navigationPublication: null, debuggerRuntime: runtime,
    removedTabIds: new Set<number>(), orphanCandidates: new Map(), orphanRetryTimers: new Map(), createdTarget: created,
    chromeApi: { debugger: { onDetach: { addListener: (cb: typeof detached) => { detached = cb; } }, onEvent: { addListener: () => undefined } },
      tabs: { onUpdated: { addListener: () => undefined }, onActivated: { addListener: () => undefined }, onRemoved: { addListener: (cb: typeof removed) => { removed = cb; } } } },
    targetLoss: new ExtensionTargetLoss({ debuggerRuntime: runtime as never, targets: registry, createdTarget: created as never,
      readActiveTabId: () => (extension.activeTarget as { tabId: number } | null)?.tabId ?? null,
      clearActiveTarget: () => { extension.activeTarget = null; extension.navigationPublication = null; },
      reportTargetFailure: async () => { throw new Error("STALE_TARGET_LOSS"); }, sendRevoke: async body => { frames.push(body); } }) });
  (extension.start as () => void).call(extension); removed(19); detached({ tabId: 19 }, "target_closed");
  registry.remove(old.targetRef); const current = registry.claimOperatorTarget(19, hash("b"), "new", "chrome-new"); extension.activeTarget = current;
  unblock(); await new Promise<void>(resolve => setTimeout(resolve, 0));
  barrier = Promise.resolve(); removed(19); detached({ tabId: 19 }, "target_closed");
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  assert.equal(registry.findByTabId(19), current); assert.equal(extension.activeTarget, current);
  assert.deepEqual(frames, []); assert.equal((extension.removedTabIds as Set<number>).has(19), false);
};

const intentionalClose = async (): Promise<void> => {
  const registry = new ExtensionExactTargetRegistry(), bound = registry.claimOperatorTarget(23, hash("a"), "loader", "chrome-a");
  let open = true; const reports: unknown[] = [], revokes: unknown[] = [];
  const runtime = { awaitPageReadPermission: async () => undefined, readTab: async () => { if (!open) throw new Error("ABSENT"); return { id: 23 }; },
    readTargets: async () => open ? [{ id: "chrome-a", tabId: 23, attached: true }] : [], forgetAttached: () => undefined };
  const loss = new ExtensionTargetLoss({ debuggerRuntime: runtime as never, targets: registry, createdTarget: { markTabRemoved: () => undefined } as never,
    readActiveTabId: () => null, clearActiveTarget: () => undefined, reportTargetFailure: async input => { reports.push(input); }, sendRevoke: async body => { revokes.push(body); } });
  await releaseJobBoundTarget({ targets: registry, createdTarget: { isPending: () => false } as never, readActiveJobRefHash: () => null,
    awaitOldCommandHandlers: async () => undefined, debuggerRuntime: { ...runtime, removeTab: async () => {
      open = false; await loss.consumeTabRemoval(23, bound); await loss.consumeDebuggerDetach(23, "target_closed", bound);
    } } as never, sendRevoke: async body => { revokes.push(parseBrowserAuthorityTargetRevoke(body)); } }, hash("a"));
  assert.deepEqual(reports, []); assert.equal(revokes.length, 1); assert.equal(registry.findByTabId(23), null);
};
export const runBrowserLaneTargetClaimAcceptance = async (): Promise<void> => {
  await releaseThroughWire(); delayedRevocation(); await delayedChromeCallbacks(); await intentionalClose();
};
