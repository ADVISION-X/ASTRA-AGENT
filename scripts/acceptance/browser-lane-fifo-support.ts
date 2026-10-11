import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { BrowserInfrastructureSupervisor } from "../../src/lib/browser/infrastructure/browser-infrastructure-supervisor.js";
import { ExtensionTargetAuthority } from "../../src/lib/browser/chrome-extension/extension-target-authority.js";
import { ExtensionExactTargetRegistry } from "../../src/lib/browser/chrome-extension/exact-target-runtime.js";
import { ExtensionTargetLoss } from "../../src/lib/browser/chrome-extension/extension-target-loss.js";
import { releaseJobBoundTarget } from "../../src/lib/browser/chrome-extension/extension-target-release.js";
import { parseBrowserAuthorityTargetRevoke } from "../../src/lib/browser/transport/browser-authority-frame-payload.js";
import { BrowserLaneCoordinator } from "../../src/lib/browser/infrastructure/browser-lane-coordinator.js";
import { getEventListeners } from "node:events";

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
  await releaseBudgetPhases();
  await queuedAcquireDeadlines();
  await releaseThroughWire(); delayedRevocation(); await delayedChromeCallbacks(); await intentionalClose();
};

const releaseBudgetPhases = async (): Promise<void> => {
  const original = { now: Date.now, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
  let now = Date.parse("2026-10-11T00:00:00.000Z"), id = 0;
  const timers = new Map<number, { run: () => void; ms: number }>();
  const tick = async () => { for (let step = 0; step < 30; step += 1) await Promise.resolve(); };
  const advance = async (ms: number) => {
    const found = [...timers].find(([, timer]) => timer.ms === ms); assert.ok(found);
    timers.delete(found![0]); now += ms; found![1].run(); await tick();
  };
  Date.now = () => now;
  globalThis.setTimeout = ((run: () => void, ms: number) => {
    const key = ++id; timers.set(key, { run, ms }); return key;
  }) as never;
  globalThis.clearTimeout = ((key: number) => { timers.delete(key); }) as never;
  try {
    let latest: string | null = new Date(now).toISOString(), dispatches = 0, budget = 0, reply = true;
    const infrastructure = { pendingJobBoundTargetAcquisition: null,
      mutationState: { latestProviderInputTerminalAt: () => latest, assertRuntimeTaskProvenance: () => undefined } };
    const broker = { currentOperatorTargetJobRefHash: () => binding("a").jobRefHash,
      acquireOperatorClaimedTargetLease: async () => ({ park: async () => undefined }) };
    const lane = new BrowserLaneCoordinator(() => broker as never, {
      requestPreauthorizedTargetRelease: (job: string, _authority: string, deadline: number) => {
        dispatches += 1; budget = deadline - now;
        if (reply) queueMicrotask(() => lane.resolvePending("release", job)); return 1;
      },
    } as never, { current: () => ({ kind: "PRESENT", authority: { authorityEpoch: 1 } }) } as never, infrastructure as never);
    const controller = new AbortController();
    const quietRelease = lane.releaseJobBoundTarget("quiet", "business-admitted", controller.signal);
    await tick(); assert.equal(dispatches, 0); await advance(40_000); await quietRelease;
    assert.equal(budget, 30_000, "the full quiet gate cannot consume dispatch budget");
    assert.equal(timers.size, 0); assert.equal(getEventListeners(controller.signal, "abort").length, 0);
    const queuedExpiry = async () => {
      const active = await lane.acquire(binding("a") as never, "owner", { targetMode: "fresh", eligibleAt: now,
        remainingMs: () => 60_000, signal: controller.signal });
      const activeHash = Reflect.get(lane, "activeJobRefHash"), queuedAbort = new AbortController();
      const cancelled = lane.releaseJobBoundTarget("queued-cancel", "business-admitted", queuedAbort.signal).then(() => null, error => error);
      now += 1_000;
      const first = lane.releaseJobBoundTarget("queued-a", "business-admitted", controller.signal).then(() => null, error => error);
      now += 1_000;
      const second = lane.releaseJobBoundTarget("queued-b", "business-admitted", controller.signal).then(() => null, error => error);
      assert.equal(timers.size, 1, "queued releases share the existing wake timer");
      queuedAbort.abort(); assert.match((await cancelled).message, /BROWSER_WAIT_ABORTED/u);
      assert.equal(getEventListeners(queuedAbort.signal, "abort").length, 0); assert.equal(timers.size, 1);
      assert.equal([...timers.values()][0]!.ms, 29_000, "queued abort recalculates the sole wake for the next release");
      assert.equal(lane.readState(), "busy"); assert.equal(Reflect.get(lane, "activeJobRefHash"), activeHash); assert.equal(dispatches, 1);
      await advance(29_000); assert.match((await first).message, /V6_DEADLINE_BUDGET_EXHAUSTED/u);
      assert.equal(lane.readState(), "busy"); assert.equal(Reflect.get(lane, "activeJobRefHash"), activeHash);
      assert.equal(dispatches, 1); assert.equal(timers.size, 1);
      assert.equal([...timers.values()][0]!.ms, 1_000, "active expiry cannot spin on past eligibility");
      await advance(1_000); assert.match((await second).message, /V6_DEADLINE_BUDGET_EXHAUSTED/u);
      assert.equal(timers.size, 0); assert.equal(dispatches, 1);
      await active.park({ reason: "fixture-complete", mode: "product-call-settlement" });
      assert.equal(lane.readState(), "idle");
    }; await queuedExpiry();
    const dispatchFailures = async () => {
      reply = false;
      const timed = lane.releaseJobBoundTarget("dispatch-timeout", "business-admitted", controller.signal).then(() => null, error => error);
      await tick(); assert.equal(budget, 30_000); await advance(30_000);
      assert.match((await timed).message, /BROWSER_TARGET_ACQUISITION_TIMEOUT/u); assert.equal(timers.size, 0);
      const aborted = new AbortController(); latest = new Date(now).toISOString();
      const denied = lane.releaseJobBoundTarget("quiet-abort", "business-admitted", aborted.signal).then(() => null, error => error);
      const before = dispatches; aborted.abort(); await advance(40_000);
      assert.match((await denied).message, /BROWSER_WAIT_ABORTED/u); assert.equal(dispatches, before);
      latest = null;
      const holding = await lane.acquire(binding("a") as never, "owner", { targetMode: "fresh", eligibleAt: now,
        remainingMs: () => 60_000, signal: controller.signal });
      const queued = Array.from({ length: 10 }, (_, index) => lane.releaseJobBoundTarget(`reset-${index}`, "business-admitted", controller.signal)
        .then(() => null, error => error));
      await assert.rejects(lane.releaseJobBoundTarget("eleventh", "business-admitted", controller.signal), /BROWSER_BACKPRESSURE/u);
      lane.reset("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE"); await Promise.all(queued);
      assert.equal(timers.size, 0); assert.equal(getEventListeners(controller.signal, "abort").length, 0);
      await holding.park({ reason: "fixture-complete", mode: "product-call-settlement" });
    }; await dispatchFailures();
  } finally { Date.now = original.now; globalThis.setTimeout = original.setTimeout; globalThis.clearTimeout = original.clearTimeout; }
};


const queuedAcquireDeadlines = async (): Promise<void> => {
  const original = { now: Date.now, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
  let now = Date.parse("2026-10-11T00:00:00.000Z"), timerId = 0;
  const timers = new Map<number, { at: number; run: () => void }>();
  const tick = async () => { for (let step = 0; step < 40; step += 1) await Promise.resolve(); };
  Date.now = () => now;
  globalThis.setTimeout = ((run: () => void, ms: number) => {
    const key = ++timerId; timers.set(key, { at: now + ms, run }); return key;
  }) as never;
  globalThis.clearTimeout = ((key: number) => { timers.delete(key); }) as never;
  const advance = async (ms: number) => {
    now += ms;
    for (const [key, timer] of [...timers]) if (timer.at <= now) { timers.delete(key); timer.run(); }
    await tick();
  };
  try {
    let claimed: string | null = null, dispatches = 0, reply = true;
    const state = { pendingJobBoundTargetAcquisition: null,
      mutationState: { latestProviderInputTerminalAt: () => null, assertRuntimeTaskProvenance: () => undefined } };
    const broker = { currentOperatorTargetJobRefHash: () => claimed,
      acquireOperatorClaimedTargetLease: async () => ({ get document() { return { documentRef: claimed }; },
        park: async () => { claimed = null; } }) };
    const lane = new BrowserLaneCoordinator(() => broker as never, {
      requestPreauthorizedTargetAcquisition: (_mode: string, job: string) => {
        dispatches += 1;
        if (reply) queueMicrotask(() => { claimed = job; lane.resolvePending("acquire", job); }); return dispatches;
      },
    } as never, { current: () => ({ kind: "PRESENT", authority: { authorityEpoch: 1 } }) } as never, state as never);
    const controller = new AbortController();
    const holding = await lane.acquire(binding("a") as never, "owner", { targetMode: "fresh", eligibleAt: now,
      remainingMs: () => 100_000, signal: controller.signal });
    const heldHash = Reflect.get(lane, "activeJobRefHash"), baseline = dispatches;
    await expireAcquireModes(lane, holding, controller, { now: () => now, advance, tick, timers,
      dispatches: () => dispatches, baseline, heldHash });
    assert.equal(lane.readState(), "idle");
    for (const failure of ["native-timeout", "extension-diagnostic"] as const) {
      reply = false;
      const failed = lane.acquire(binding("b") as never, "owner", { targetMode: "fresh", eligibleAt: now,
        remainingMs: () => 50, signal: controller.signal }).then(() => null, error => error);
      await tick(); assert.equal(lane.readState(), "busy"); assert.ok(state.pendingJobBoundTargetAcquisition);
      if (failure === "native-timeout") await advance(50);
      else {
        const refs = { jobRefHash: binding("b").jobRefHash, failedFrameSequence: String(dispatches) };
        lane.rejectPending("BROWSER_TARGET_ACQUISITION_TIMEOUT", { ...refs, jobRefHash: binding("e").jobRefHash });
        lane.rejectPending("BROWSER_TARGET_ACQUISITION_TIMEOUT", { ...refs, failedFrameSequence: "0" });
        assert.ok(state.pendingJobBoundTargetAcquisition, "foreign diagnostics cannot reject the active Target operation");
        lane.rejectPending("BROWSER_TARGET_ACQUISITION_TIMEOUT", refs);
      }
      assert.match((await failed).message, /BROWSER_TARGET_ACQUISITION_TIMEOUT/u);
      assert.equal(lane.readState(), "idle"); assert.equal(state.pendingJobBoundTargetAcquisition, null);
      reply = true;
      const next = await lane.acquire(binding("c") as never, "owner", { targetMode: "fresh", eligibleAt: now,
        remainingMs: () => 1_000, signal: controller.signal });
      assert.equal(next.document.documentRef, binding("c").jobRefHash);
      await next.park({ reason: "fixture-complete", mode: "product-call-settlement" });
    }
    assert.equal(timers.size, 0); assert.equal(getEventListeners(controller.signal, "abort").length, 0);
    const aborted = new AbortController(); aborted.abort();
    await assert.rejects(lane.acquire(binding("d") as never, "owner", { targetMode: "fresh", eligibleAt: now,
      remainingMs: () => 1_000, signal: aborted.signal }), /BROWSER_WAIT_ABORTED/u);
    await assert.rejects(lane.acquire(binding("d") as never, "owner", { targetMode: "fresh", eligibleAt: now,
      remainingMs: () => 0, signal: controller.signal }), /V6_DEADLINE_BUDGET_EXHAUSTED/u);
    assert.equal(timers.size, 0);
  } finally { Date.now = original.now; globalThis.setTimeout = original.setTimeout; globalThis.clearTimeout = original.clearTimeout; }
};

const expireAcquireModes = async (lane: BrowserLaneCoordinator,
  holding: Awaited<ReturnType<BrowserLaneCoordinator["acquire"]>>, controller: AbortController,
  clock: Readonly<{ now(): number; advance(ms: number): Promise<void>; tick(): Promise<void>;
    timers: Map<number, { at: number; run: () => void }>; dispatches(): number; baseline: number; heldHash: unknown }>,
): Promise<void> => {
  let expiry = clock.now() + 25;
  const renewed = lane.acquire(binding("d") as never, "owner", { targetMode: "bound-observation", eligibleAt: clock.now() - 1,
    remainingMs: () => expiry - clock.now(), signal: controller.signal }).then(lease => lease, error => error);
  expiry += 75;
  const modes = ["fresh", "bound-observation", "confirmed-readback", "authorized-continuation"] as const;
  const controllers = modes.map(() => new AbortController());
  const pending = modes.map((targetMode, index) => {
    const until = clock.now() + 30 + index * 10;
    return lane.acquire(binding("b") as never, "owner", { targetMode, eligibleAt: clock.now() - 1,
      remainingMs: () => until - clock.now(), signal: controllers[index]!.signal,
      ...(targetMode === "authorized-continuation" ? { parentJobId: "parent", parentAttemptId: "parent-attempt" } : {}) } as never)
      .then(() => null, error => error);
  });
  assert.equal(clock.timers.size, 1); await clock.advance(25);
  assert.equal(lane.readState(), "busy"); assert.equal(Reflect.get(lane, "activeJobRefHash"), clock.heldHash);
  assert.equal(clock.timers.size, 1, "renewed remainingMs must be reread instead of falsely expiring the waiter");
  for (let index = 0; index < modes.length; index += 1) {
    await clock.advance(index === 0 ? 5 : 10);
    assert.match((await pending[index]).message, /V6_DEADLINE_BUDGET_EXHAUSTED/u);
    assert.equal(getEventListeners(controllers[index]!.signal, "abort").length, 0);
    assert.equal(lane.readState(), "busy"); assert.equal(Reflect.get(lane, "activeJobRefHash"), clock.heldHash);
    assert.equal(clock.dispatches(), clock.baseline);
  }
  const cancelled = new AbortController();
  const abort = lane.acquire(binding("b") as never, "owner", { targetMode: "fresh", eligibleAt: clock.now(),
    remainingMs: () => 1_000, signal: cancelled.signal }).then(() => null, error => error);
  cancelled.abort(); assert.match((await abort).message, /BROWSER_WAIT_ABORTED/u);
  assert.equal(getEventListeners(cancelled.signal, "abort").length, 0);
  assert.equal(clock.timers.size, 1); assert.equal([...clock.timers.values()][0]!.at, expiry);
  await holding.park({ reason: "fixture-complete", mode: "product-call-settlement" });
  const next = await renewed;
  assert.equal(lane.readState(), "busy"); assert.equal(Reflect.get(lane, "activeJobRefHash"), binding("d").jobRefHash);
  assert.equal(clock.dispatches(), clock.baseline + 1); assert.equal(clock.timers.size, 0);
  await next.park({ reason: "fixture-complete", mode: "product-call-settlement" }); await clock.tick();
  assert.equal(getEventListeners(controller.signal, "abort").length, 0);
};
