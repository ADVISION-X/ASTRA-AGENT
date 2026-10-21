import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { getEventListeners } from "node:events";
import { workerFixture } from "./local-browser-auto-pairing-support.js";
import { binding, hash, releaseWireFixture } from "./browser-lane-fifo-support.js";
import type { ExtensionChromeApi } from "../../src/lib/browser/chrome-extension/extension-runtime-types.js";
import type { ExtensionExactTargetRegistry } from "../../src/lib/browser/chrome-extension/exact-target-runtime.js";
import { decodeBrowserAuthorityFrame } from "../../src/lib/browser/transport/browser-authority-frame-codec.js";
import type { ExtensionTargetAuthority } from "../../src/lib/browser/chrome-extension/extension-target-authority.js";

const controlledClock = async () => {
  const original = { now: Date.now, set: globalThis.setTimeout, clear: globalThis.clearTimeout,
    performance: Object.getOwnPropertyDescriptor(performance, "now") };
  let now = Date.parse("2026-10-21T00:00:00Z"), id = 0;
  const timers = new Map<number, { at: number; run(): void }>();
  const flush = async () => { for (let n = 0; n < 12; n += 1) await new Promise<void>(resolve => setImmediate(resolve)); };
  Date.now = () => now;
  Object.defineProperty(performance, "now", { configurable: true, value: () => now });
  globalThis.setTimeout = ((run: () => void, ms: number) => {
    const key = ++id; timers.set(key, { at: now + Math.max(1, ms), run }); return key;
  }) as never;
  globalThis.clearTimeout = ((key: number) => { timers.delete(key); }) as never;
  return { flush, timers, now: () => now, jump: (ms: number) => { now += ms; },
    advance: async (ms: number) => {
      const until = now + ms; await flush();
      for (let n = 0; n < 1_000; n += 1) {
        const next = [...timers].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) { now = until; await flush(); return; }
        now = Math.max(now, next[1].at); timers.delete(next[0]); next[1].run(); await flush();
      }
      throw new Error("ACQUISITION_FIXTURE_TIMER_SPIN");
    }, restore: () => {
      Date.now = original.now; globalThis.setTimeout = original.set; globalThis.clearTimeout = original.clear;
      if (original.performance) Object.defineProperty(performance, "now", original.performance);
      else Reflect.deleteProperty(performance, "now");
    } };
};
type Clock = Awaited<ReturnType<typeof controlledClock>>;

const acquisitionFixture = async (chrome: ExtensionChromeApi, clock: Clock) => {
  let nextTab = 60, fakeClose = false, failedReadback = false, removeCount = 0, frameDelay = 0, createCount = 0;
  let createBlock: Promise<void> | null = null;
  const tabs = new Map<number, { id: number; windowId: number; active: boolean; discarded: false; status: string; url: string; loader: string; attached: boolean }>();
  const methods: string[] = [], updates: ((tab: number) => void)[] = [], errors: unknown[] = [], wire: string[] = [];
  const worker = await workerFixture({ ...chrome, tabs: { ...chrome.tabs,
    onUpdated: { addListener: cb => { updates.push(cb as never); } }, onRemoved: { addListener: () => undefined },
    create: async ({ url }) => { createCount += 1; if (createBlock) await createBlock; const id = nextTab++; tabs.set(id, { id, windowId: 1, active: true, discarded: false,
      status: "loading", url, loader: `loader-${id}`, attached: false }); return { id }; },
    get: async id => { const tab = tabs.get(id); if (!tab) throw new Error("TAB_ABSENT"); return tab; },
    update: async id => { for (const tab of tabs.values()) tab.active = tab.id === id; return tabs.get(id)!; },
    remove: async id => { removeCount += 1; if (!fakeClose) tabs.delete(id); },
  }, debugger: { ...chrome.debugger,
    attach: async ({ tabId }) => { tabs.get(tabId)!.attached = true; }, detach: async ({ tabId }) => { const tab = tabs.get(tabId); if (tab) tab.attached = false; },
    getTargets: async () => { if (failedReadback && removeCount) throw new Error("READBACK_FAILED");
      return [...tabs.values()].map(tab => ({ id: `chrome-${tab.id}`, tabId: tab.id, type: "page", title: "ChatGPT", url: tab.url, attached: tab.attached })); },
    sendCommand: async ({ tabId }, method, params) => {
      methods.push(method); const tab = tabs.get(tabId)!;
      if (method === "Page.getFrameTree" && frameDelay) { const delay = frameDelay; frameDelay = 0; await new Promise<void>(resolve => setTimeout(resolve, delay)); }
      if (method === "Page.navigate") { tab.url = String(params?.url); tab.loader += "-next"; tab.status = "complete"; }
      return method === "Page.getFrameTree" ? { frameTree: { frame: { id: `frame-${tabId}`, loaderId: tab.loader, url: tab.url } } } : {};
    },
  } } as ExtensionChromeApi);
  const authority = worker.authority as unknown as ExtensionTargetAuthority;
  authority.start();
  const key = Buffer.from(await crypto.subtle.exportKey("raw", worker.session.clientToServerKey));
  const node = releaseWireFixture({ serverToClient: key, clientToServer: key, commandPermit: Buffer.alloc(32, 9) }, 2);
  Reflect.set(node.issuer, "slot", { kind: "PRESENT", authority: { authorityEpoch: 1, authorityRef: "authority-wait", connectionGeneration: 1 } });
  Object.assign(node.state, { mutationState: { assertRuntimeTaskProvenance: () => undefined } });
  Object.assign(node.supervisor, { issuer: node.issuer, options: { enrolledProfile: { enrollmentHash: hash("a"), extensionTreeHash: hash("b"), policyHash: hash("c") },
    profileConfig: { extensionId: "extension-wait" }, releaseIdentity: { releaseBuildId: "build-wait" } },
    lane: { resolvePending: node.acquirer.resolvePending.bind(node.acquirer), observeCurrentTargetClaim: () => undefined } });
  const active = () => Reflect.get(node.transport, "active");
  Reflect.set(active().socket, "send", (value: string) => { wire.push(value); void worker.invoke("onMessage", worker.socket, value).catch(error => { errors.push(error); }); });
  const send = worker.socket.send.bind(worker.socket);
  Reflect.set(worker.socket, "send", (value: string) => { send(value); node.receive(value); });
  const complete = () => { for (const tab of tabs.values()) { tab.status = "complete"; for (const update of updates) update(tab.id); } };
  const start = (mode: "fresh" | "bound-observation" | "confirmed-readback" | "authorized-continuation" = "fresh", remaining = 200_000, signal = new AbortController().signal) =>
    node.acquirer.ensureAvailableTarget({ binding: binding("a") as never, targetMode: mode, remainingMs: () => remaining, signal },
      mode === "authorized-continuation" ? "https://chatgpt.com/c/parent" : undefined).then(() => null, error => error as Error);
  return { worker, node, tabs, methods, errors, wire, start, complete,
    registry: Reflect.get(worker.authority, "targets") as ExtensionExactTargetRegistry,
    holdCreate: (block: Promise<void> | null) => { createBlock = block; }, creates: () => createCount,
    setFrameDelay: (ms: number) => { frameDelay = ms; },
    setFakeClose: () => { fakeClose = true; }, setReadbackFailure: () => { failedReadback = true; },
    pulse: async () => { if (active()) active().lastHeartbeatAt = clock.now(); },
    park: async () => { await authority.parkActiveTarget(); await clock.flush(); },
    handlers: () => Array.from(worker.delivery.pendingTargetHandlers.values(), record => record.promise) };
};
type Fixture = Awaited<ReturnType<typeof acquisitionFixture>>;
const finishReady = async (f: Fixture, clock: Clock, result: Promise<Error | null>): Promise<void> => {
  f.complete(); await clock.advance(5_000); assert.equal(await result, null);
};
const seedBound = async (f: Fixture, clock: Clock, delay: number): Promise<void> => {
  const seed = f.start(); await clock.advance(5_000); await finishReady(f, clock, seed);
  await f.park(); f.setFrameDelay(delay);
};

const slowReadyModes = async (chrome: ExtensionChromeApi, clock: Clock): Promise<void> => {
  const modes = ["fresh", "bound-observation", "confirmed-readback", "authorized-continuation"] as const;
  for (const [index, mode] of modes.entries()) {
    const f = await acquisitionFixture(chrome, clock);
    if (mode === "bound-observation" || mode === "confirmed-readback") {
      await seedBound(f, clock, [0, 45_000, 90_000][index]!);
    }
    await f.pulse(); const started = clock.now(), result = f.start(mode);
    await clock.advance([15_000, 45_000, 90_000, 45_000][index]! - 1);
    assert.ok(f.node.state.pendingJobBoundTargetAcquisition, `loading ${mode} must preserve the original pending`);
    assert.equal(f.worker.frames.map(decodeBrowserAuthorityFrame).filter(frame => frame.kind === "TARGET_CLAIM").length,
      mode === "bound-observation" || mode === "confirmed-readback" ? 1 : 0, "loading must not start a claim ACK timer");
    await finishReady(f, clock, result);
    assert.ok(clock.now() - started < 120_000); assert.equal(f.node.broker.currentOperatorTargetJobRefHash(), hash("a"));
    assert.equal(f.worker.delivery.pendingTargetHandlers.size, 0); assert.deepEqual(f.errors, []);
    assert.equal(f.methods.filter(method => method === "Page.navigate").length, mode === "authorized-continuation" ? 1 : 0);
    await f.park();
  }
  const ready = await acquisitionFixture(chrome, clock), result = ready.start();
  await clock.advance(4_000); await finishReady(ready, clock, result);
  assert.equal(ready.worker.delivery.pendingTargetHandlers.size, 0, "ready pages proceed without a minimum loading delay"); await ready.park();
};

const deadlineAndCancellation = async (chrome: ExtensionChromeApi, clock: Clock): Promise<void> => {
  for (const mode of ["deadline", "short-budget", "abort-loading", "abort-in-dispatch"] as const) {
    const f = await acquisitionFixture(chrome, clock), controller = new AbortController(), start = clock.now();
    if (mode === "abort-in-dispatch") {
      const socket = Reflect.get(f.node.transport, "active").socket, send = socket.send.bind(socket);
      socket.send = (value: string) => { send(value); if (f.wire.length === 1) controller.abort(); };
    }
    const result = f.start("fresh", mode === "short-budget" ? 50_000 : 200_000, controller.signal);
    const pending = f.node.state.pendingJobBoundTargetAcquisition!;
    assert.equal(pending.deadlineAt - start, mode === "short-budget" ? 50_000 : 120_000);
    if (mode.startsWith("abort")) {
      await clock.advance(5_000); await f.pulse(); controller.abort(); await clock.flush();
      assert.equal(f.wire.length, 2, "active abort must send exactly one original-request cancellation");
      f.complete(); await clock.advance(5_000); assert.match((await result)!.message, /BROWSER_WAIT_ABORTED/u);
    } else {
      await clock.advance(pending.deadlineAt - clock.now() - 1); assert.equal(f.node.state.pendingJobBoundTargetAcquisition, pending);
      await clock.advance(1); assert.match((await result)!.message, /BROWSER_TARGET_ACQUISITION_TIMEOUT/u);
      await clock.advance(5_000);
    }
    assert.equal(f.node.broker.currentOperatorTargetStatus(), "absent"); assert.equal(getEventListeners(controller.signal, "abort").length, 0);
    assert.equal(f.worker.delivery.pendingTargetHandlers.size, 0); assert.equal(f.tabs.size, 0); assert.deepEqual(f.errors, []);
  }
};

const claimSendRetirement = async (chrome: ExtensionChromeApi, clock: Clock): Promise<void> => {
  for (const boundary of ["queue-deadline", "queue-abort", "queue-ack", "encrypt-deadline", "encrypt-abort", "encrypt-ack"] as const) {
    const f = await acquisitionFixture(chrome, clock), controller = new AbortController();
    let unblock!: () => void, entered!: () => void;
    const blocked = new Promise<void>(resolve => { unblock = resolve; }), encrypting = new Promise<void>(resolve => { entered = resolve; });
    const delivery = Reflect.get(f.worker.actor, "commandDelivery"), encrypt = crypto.subtle.encrypt.bind(crypto.subtle);
    const result = f.start("fresh", 200_000, controller.signal); await clock.advance(5_000);
    if (boundary.startsWith("queue")) delivery.sendTail = blocked;
    else Reflect.set(crypto.subtle, "encrypt", async (...args: Parameters<SubtleCrypto["encrypt"]>) => { entered(); await blocked; return encrypt(...args); });
    try {
      f.complete(); await clock.advance(5_000);
      if (boundary.startsWith("encrypt")) await encrypting;
      if (boundary.endsWith("abort")) { await f.pulse(); controller.abort(); await clock.flush(); }
      else if (boundary.endsWith("ack")) await clock.advance(30_000);
      else { clock.jump(120_000); }
      unblock(); await clock.advance(5_000);
      const failure = await result; assert.ok(failure); assert.equal(f.node.broker.currentOperatorTargetStatus(), "absent");
      assert.equal(f.worker.frames.map(decodeBrowserAuthorityFrame).filter(frame => frame.kind === "TARGET_CLAIM").length, 0, boundary);
      assert.equal(f.registry.findByJobRefHash(hash("a")), null); assert.equal(f.tabs.size, 0); assert.equal(f.worker.delivery.pendingTargetHandlers.size, 0);
    } finally { unblock(); Reflect.set(crypto.subtle, "encrypt", encrypt); }
  }
};

const cleanupProof = async (chrome: ExtensionChromeApi, clock: Clock): Promise<void> => {
  for (const mode of ["absent", "fake-close", "readback-failure", "replacement"] as const) {
    const f = await acquisitionFixture(chrome, clock), result = f.start(); await clock.advance(5_000);
    if (mode === "fake-close") f.setFakeClose();
    if (mode === "readback-failure") f.setReadbackFailure();
    Reflect.get(f.worker.actor, "targetClaims").fail("BROWSER_AUTHENTICATION_INCOMPLETE");
    let unblock!: () => void; const blocked = new Promise<void>(resolve => { unblock = resolve; });
    Reflect.get(f.worker.actor, "commandDelivery").sendTail = blocked;
    f.complete(); await clock.advance(5_000);
    const original = f.registry.findByJobRefHash(hash("a")); assert.ok(original);
    if (mode === "replacement") { f.registry.remove(original!.targetRef); f.registry.claimOperatorTarget(99, hash("a"), "new-loader", "chrome-99"); }
    await clock.advance(30_000); unblock(); await clock.flush(); await clock.advance(5_000);
    const failure = await result; assert.ok(failure);
    const after = f.registry.findByJobRefHash(hash("a"));
    if (mode === "fake-close" || mode === "readback-failure") assert.equal(after, original, "unproven close must preserve the exact resource record");
    else if (mode === "replacement") assert.equal(after?.tabId, 99, "cleanup cannot delete a replacement job record");
    else assert.equal(after, null);
    assert.equal(Reflect.get(f.worker.authority, "activeTarget"), null); assert.equal(f.node.broker.currentOperatorTargetStatus(), "absent");
  }
};

const lateNodeAdmission = async (chrome: ExtensionChromeApi, clock: Clock): Promise<void> => {
  for (const abort of [false, true]) {
    const f = await acquisitionFixture(chrome, clock), controller = new AbortController(), result = f.start("fresh", 200_000, controller.signal);
    await clock.advance(5_000); const pending = f.node.state.pendingJobBoundTargetAcquisition!;
    if (abort) controller.abort(); else clock.jump(pending.deadlineAt - clock.now());
    const claim = { targetRef: "target-late", documentRef: "document-late", navigationEpoch: 0, claimOrigin: "https://chatgpt.com", jobRefHash: hash("a") };
    assert.throws(() => Reflect.get(f.node.supervisor, "onTargetClaim").call(f.node.supervisor, claim), /BROWSER_TARGET_INVALID/u);
    assert.equal(Reflect.get(f.node.state, "workspace"), undefined); assert.equal(f.node.broker.currentOperatorTargetStatus(), "absent");
    f.complete(); await clock.advance(125_000); assert.ok(await result); assert.equal(getEventListeners(controller.signal, "abort").length, 0);
  }
};

const nativeStillInFlight = async (chrome: ExtensionChromeApi, clock: Clock): Promise<void> => {
  const f = await acquisitionFixture(chrome, clock), controller = new AbortController();
  let unblock!: () => void; f.holdCreate(new Promise<void>(resolve => { unblock = resolve; }));
  const result = f.start("fresh", 200_000, controller.signal); await clock.advance(5_000); assert.equal(f.creates(), 1);
  const record = f.worker.delivery.pendingTargetHandlers.get(2), slot = { marker: "retain" };
  Reflect.set(f.worker.delivery, "mutationSlot", slot);
  await f.pulse();
  for (const [job, sequence] of [[hash("b"), 2], [hash("a"), 99]] as const) {
    f.node.transport.requestPreauthorizedTargetAcquisitionCancellation(job, sequence, clock.now() + 30_000); await clock.flush();
    assert.equal(Reflect.get(record!, "cancelled"), false, "foreign job/request cannot cancel the active native");
  }
  controller.abort(); await clock.flush();
  assert.equal(Reflect.get(record!, "cancelled"), true); assert.equal(f.worker.delivery.pendingTargetHandlers.get(2), record);
  assert.equal(f.worker.delivery.mutationSlot, slot); Reflect.set(f.worker.delivery, "mutationSlot", null);
  await clock.advance(115_000); assert.match((await result)!.message, /BROWSER_TARGET_ACQUISITION_TIMEOUT/u);
  assert.equal(f.worker.delivery.pendingTargetHandlers.size, 1, "caller deadline cannot fake native exit");
  await finishNative(f, clock, unblock);
};
const finishNative = async (f: Fixture, clock: Clock, unblock: () => void): Promise<void> => {
  await f.pulse(); f.node.transport.requestPreauthorizedTargetAcquisition("fresh", hash("b"), undefined, clock.now() + 120_000);
  await clock.flush(); assert.equal(f.creates(), 1); assert.equal(f.worker.delivery.pendingTargetHandlers.size, 1);
  f.holdCreate(null); unblock(); await clock.advance(10_000);
  assert.equal(f.worker.delivery.pendingTargetHandlers.size, 0); assert.equal(f.tabs.size, 0);
  await f.pulse(); const next = f.start(); await clock.advance(5_000); await finishReady(f, clock, next); await f.park();
};

const boundClaimFailure = async (chrome: ExtensionChromeApi, clock: Clock): Promise<void> => {
  const f = await acquisitionFixture(chrome, clock); await seedBound(f, clock, 0); await f.pulse();
  const record = f.registry.findByJobRefHash(hash("a"));
  let unblock!: () => void;
  Reflect.get(f.worker.actor, "commandDelivery").sendTail = new Promise<void>(resolve => { unblock = resolve; });
  const result = f.start("bound-observation"); await clock.advance(35_000); unblock(); await clock.advance(5_000);
  assert.match((await result)!.message, /BROWSER_AUTHENTICATION_INCOMPLETE/u);
  assert.equal(f.registry.findByJobRefHash(hash("a")), record); assert.equal(f.tabs.size, 1);
  assert.equal(Reflect.get(f.worker.authority, "activeTarget"), null); assert.equal(f.node.broker.currentOperatorTargetStatus(), "absent");
};
const budgetIsolation = async (chrome: ExtensionChromeApi, clock: Clock): Promise<void> => {
  const f = await acquisitionFixture(chrome, clock), controller = new AbortController();
  controller.abort(); assert.match((await f.start("fresh", 200_000, controller.signal))!.message, /BROWSER_WAIT_ABORTED/u);
  assert.match((await f.start("fresh", 0))!.message, /V6_DEADLINE_BUDGET_EXHAUSTED/u); assert.equal(f.wire.length, 0);
  for (const deadline of [NaN, Infinity, clock.now(), clock.now() + 120_001]) {
    assert.throws(() => f.node.transport.requestPreauthorizedTargetAcquisition("fresh", hash("a"), undefined, deadline), /BROWSER_COMMAND_PERMIT_EXPIRED/u);
  }
  assert.throws(() => f.node.transport.requestPreauthorizedTargetRelease(hash("a"), "business-admitted", clock.now() + 30_001), /BROWSER_COMMAND_PERMIT_EXPIRED/u);
  assert.throws(() => f.node.transport.requestPreauthorizedTargetAcquisitionCancellation(hash("a"), 2, clock.now() + 30_001), /BROWSER_COMMAND_PERMIT_EXPIRED/u);
  let remaining = 50_000;
  const result = f.node.acquirer.ensureAvailableTarget({ binding: binding("a") as never, targetMode: "fresh",
    signal: new AbortController().signal, remainingMs: () => remaining }).then(() => null, error => error as Error);
  const pending = f.node.state.pendingJobBoundTargetAcquisition!, originalDeadline = pending.deadlineAt;
  remaining = 200_000; await clock.advance(49_999);
  assert.equal(f.node.state.pendingJobBoundTargetAcquisition, pending); assert.equal(pending.deadlineAt, originalDeadline);
  await clock.advance(5_001); assert.match((await result)!.message, /BROWSER_TARGET_ACQUISITION_TIMEOUT/u);
  assert.equal(f.worker.delivery.pendingTargetHandlers.size, 0); assert.equal(f.tabs.size, 0);
};
const readinessBoundary = async (chrome: ExtensionChromeApi, clock: Clock): Promise<void> => {
  for (const readyAt of [6_000, 25_000, 45_000, 119_000]) {
    const f = await acquisitionFixture(chrome, clock), started = clock.now(), result = f.start();
    await clock.advance(readyAt); const deadlineAt = f.node.state.pendingJobBoundTargetAcquisition!.deadlineAt;
    f.complete(); await clock.flush();
    assert.equal(f.node.state.pendingJobBoundTargetAcquisition, null, `qualified readiness at ${readyAt}ms must be admitted before D`);
    assert.equal(await result, null); assert.equal(clock.now() - started, readyAt); assert.ok(clock.now() < deadlineAt);
    assert.equal(f.worker.delivery.pendingTargetHandlers.size, 0); await f.park();
  }
  const f = await acquisitionFixture(chrome, clock); await seedBound(f, clock, 48_000); await f.pulse();
  const result = f.start("fresh", 50_000), deadlineAt = f.node.state.pendingJobBoundTargetAcquisition!.deadlineAt;
  await clock.advance(55_000); assert.match((await result)!.message, /BROWSER_TARGET_ACQUISITION_TIMEOUT/u);
  assert.equal(f.methods.filter(method => method === "Page.navigate").length, 1);
  assert.ok(clock.now() >= deadlineAt); assert.equal(f.worker.delivery.pendingTargetHandlers.size, 0);
  assert.equal(f.registry.findByJobRefHash(hash("a"))?.tabId, 60, "bound reset timeout preserves the original resource");
};

export const exerciseAcquisitionWait = async (chrome: ExtensionChromeApi): Promise<void> => {
  const clock = await controlledClock();
  try {
    await slowReadyModes(chrome, clock); await deadlineAndCancellation(chrome, clock);
    await claimSendRetirement(chrome, clock); await cleanupProof(chrome, clock); await lateNodeAdmission(chrome, clock);
    await nativeStillInFlight(chrome, clock); await boundClaimFailure(chrome, clock);
    await budgetIsolation(chrome, clock);
    await readinessBoundary(chrome, clock);
    assert.equal(clock.timers.size, 0, "every acquisition/ACK/cleanup timer must retire");
  } finally { clock.restore(); }
};
