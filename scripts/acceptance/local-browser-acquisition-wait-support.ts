import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { getEventListeners } from "node:events";
import { workerFixture } from "./local-browser-auto-pairing-support.js";
import { binding, hash, releaseWireFixture } from "./browser-lane-fifo-support.js";
import type { ExtensionChromeApi } from "../../src/lib/browser/chrome-extension/extension-runtime-types.js";
import type { ExtensionExactTargetRegistry } from "../../src/lib/browser/chrome-extension/exact-target-runtime.js";
import { decodeBrowserAuthorityFrame } from "../../src/lib/browser/transport/browser-authority-frame-codec.js";
import { ExtensionTargetAuthority } from "../../src/lib/browser/chrome-extension/extension-target-authority.js";
import type { ExtensionDebuggerRuntime } from "../../src/lib/browser/chrome-extension/debugger-runtime.js";
import type { ExtensionInteractionReadiness } from "../../src/lib/browser/chrome-extension/extension-interaction-readiness.js";
import type { BrowserCommandPermit } from "../../src/lib/browser/transport/command-permit.js";
import { permit } from "./local-browser-terminal-fixture.js";

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
  let activate: Parameters<ExtensionChromeApi["tabs"]["onActivated"]["addListener"]>[0] = () => undefined;
  const events = new Set<Parameters<ExtensionChromeApi["debugger"]["onEvent"]["addListener"]>[0]>();
  const tabs = new Map<number, { id: number; windowId: number; active: boolean; discarded: false; status: string; url: string; loader: string; attached: boolean }>();
  const methods: string[] = [], errors: unknown[] = [], wire: string[] = [];
  const worker = await workerFixture({ ...chrome, tabs: { ...chrome.tabs,
    onActivated: { addListener: callback => { activate = callback; } },
    onRemoved: { addListener: () => undefined },
    create: async ({ url }) => { createCount += 1; if (createBlock) await createBlock; const id = nextTab++;
      for (const tab of tabs.values()) tab.active = false;
      tabs.set(id, { id, windowId: 1, active: true, discarded: false, status: "loading", url, loader: `loader-${id}`, attached: false });
      activate({ tabId: id, windowId: 1 }); return { id }; },
    get: async id => { const tab = tabs.get(id); if (!tab) throw new Error("TAB_ABSENT"); return tab; },
    update: async id => { for (const tab of tabs.values()) tab.active = tab.id === id; activate({ tabId: id, windowId: 1 }); return tabs.get(id)!; },
    remove: async id => { removeCount += 1; if (!fakeClose) tabs.delete(id); },
  }, debugger: { ...chrome.debugger,
    onEvent: { addListener: callback => { events.add(callback); } },
    attach: async ({ tabId }) => { tabs.get(tabId)!.attached = true; }, detach: async ({ tabId }) => { const tab = tabs.get(tabId); if (tab) tab.attached = false; },
    getTargets: async () => { if (failedReadback && removeCount) throw new Error("READBACK_FAILED");
      return [...tabs.values()].map(tab => ({ id: `chrome-${tab.id}`, tabId: tab.id, type: "page", title: "ChatGPT", url: tab.url, attached: tab.attached })); },
    sendCommand: async ({ tabId }, method, params) => {
      methods.push(method); const tab = tabs.get(tabId)!;
      if (method === "Page.getFrameTree" && frameDelay) { const delay = frameDelay; frameDelay = 0; await new Promise<void>(resolve => setTimeout(resolve, delay)); }
      if (method === "Page.navigate") { tab.url = String(params?.url); tab.loader += "-next"; }
      return method === "Page.getFrameTree" ? { frameTree: { frame: { id: `frame-${tabId}`, loaderId: tab.loader, url: tab.url } } } : {};
    },
  } } as ExtensionChromeApi);
  const authority: unknown = Reflect.get(worker.actor, "targetAuthority");
  if (!(authority instanceof ExtensionTargetAuthority)) throw new Error("ACQUISITION_FIXTURE_AUTHORITY_INVALID");
  authority.start();
  const key = Buffer.from(await crypto.subtle.exportKey("raw", worker.session.clientToServerKey));
  const node = releaseWireFixture({ serverToClient: key, clientToServer: key, commandPermit: Buffer.alloc(32, 9) }, 2);
  Reflect.set(node.issuer, "slot", { kind: "PRESENT", authority: { authorityEpoch: 1, authorityRef: "authority-wait", connectionGeneration: 1 } });
  const locatorUrl = "https://chatgpt.com/c/wait-original";
  const source = { state: "CONFIRMED", anchorState: "trusted", attemptId: "source-attempt", resultRevision: 0,
    productStepId: "source-step", callId: "turn-submit", childCapabilityId: "submit_exact_gpt_turn_once",
    effectIdentityHash: hash("d"), walAuthorityHash: hash("e") };
  Object.assign(node.state, { mutationState: { assertRuntimeTaskProvenance: () => undefined,
    jobHistoryEvidence: (job: string) => { assert.equal(job, "job-a"); return { walHistoryVerified: true, replayEffects: [source] }; },
    readSourceConfirmedProviderEffect: (input: { jobId: string; effectIdentityHash: string }) => {
      assert.equal(input.jobId, "job-a"); assert.equal(input.effectIdentityHash, source.effectIdentityHash);
      return { conversationLocator: { canonicalConversationUrl: locatorUrl } };
    } } });
  Object.assign(node.supervisor, { issuer: node.issuer, options: { enrolledProfile: { enrollmentHash: hash("a"), extensionTreeHash: hash("b"), policyHash: hash("c") },
    profileConfig: { extensionId: "extension-wait" }, releaseIdentity: { releaseBuildId: "build-wait" } },
    lane: { resolvePending: node.acquirer.resolvePending.bind(node.acquirer), observeCurrentTargetClaim: () => undefined } });
  const active = () => Reflect.get(node.transport, "active");
  Reflect.set(active().socket, "send", (value: string) => { wire.push(value); void worker.invoke("onMessage", worker.socket, value).catch(error => { errors.push(error); }); });
  const send = worker.socket.send.bind(worker.socket);
  Reflect.set(worker.socket, "send", (value: string) => { send(value); node.receive(value); });
  const start = (mode: "fresh" | "bound-observation" | "confirmed-readback" | "authorized-continuation" = "fresh", remaining = 200_000, signal = new AbortController().signal, digit = "a") =>
    node.acquirer.ensureAvailableTarget({ binding: binding(digit) as never, targetMode: mode, remainingMs: () => remaining, signal },
      mode === "authorized-continuation" ? "https://chatgpt.com/c/parent" : undefined).then(() => null, error => error as Error);
  return { worker, authority, node, tabs, methods, errors, wire, start,
    navigate: (url: string, spa = false) => {
      const tab = tabs.get(60)!; tab.url = url; if (!spa) tab.loader += "-external";
      for (const event of events) event({ tabId: 60 }, spa ? "Page.navigatedWithinDocument" : "Page.frameNavigated",
        spa ? { frameId: "frame-60", url } : { frame: { id: "frame-60", loaderId: tab.loader, url } });
    },
    registry: Reflect.get(worker.authority, "targets") as ExtensionExactTargetRegistry,
    holdCreate: (block: Promise<void> | null) => { createBlock = block; }, creates: () => createCount,
    setFrameDelay: (ms: number) => { frameDelay = ms; },
    setFakeClose: () => { fakeClose = true; }, setReadbackFailure: () => { failedReadback = true; },
    pulse: async () => { if (active()) active().lastHeartbeatAt = clock.now(); },
    park: async () => { await authority.parkActiveTarget(); await clock.flush(); },
    handlers: () => Array.from(worker.delivery.pendingTargetHandlers.values(), record => record.promise) };
};
type Fixture = Awaited<ReturnType<typeof acquisitionFixture>>;
const interact = (f: Fixture, currentPermit: BrowserCommandPermit,
  action: (runtime: ExtensionDebuggerRuntime) => Promise<unknown>, observation = false): Promise<unknown> => {
  const target = f.registry.findByJobRefHash(hash("a"))!;
  const runtime = Reflect.get(f.worker.authority, "debuggerRuntime") as ExtensionDebuggerRuntime;
  const readiness = Reflect.get(f.worker.authority, "interactionReadiness") as ExtensionInteractionReadiness;
  const gate = Reflect.get(f.worker.authority, "pageAccessGate") as { enter(): Promise<void> };
  const assertCurrent = (): void => { f.authority.resolve(target.targetRef, target.documentRef); };
  const bound = { ...currentPermit, targetRef: target.targetRef, documentRef: target.documentRef };
  return runtime.withLogicalPageAccess(() => gate.enter(), () => observation
    ? readiness.executeObservation(target, () => action(runtime), assertCurrent, bound)
    : readiness.executeMutation(target, () => action(runtime), assertCurrent, "click", bound));
};
const finishReady = async (clock: Clock, result: Promise<Error | null>): Promise<void> => {
  await clock.advance(5_000); assert.equal(await result, null);
};
const seedBound = async (f: Fixture, clock: Clock, delay: number): Promise<void> => {
  const seed = f.start(); await clock.advance(5_000); await finishReady(clock, seed);
  await f.park(); f.setFrameDelay(delay);
};

const slowReadyModes = async (chrome: ExtensionChromeApi, clock: Clock): Promise<void> => {
  const modes = ["fresh", "bound-observation", "confirmed-readback", "authorized-continuation"] as const;
  for (const [index, mode] of modes.entries()) {
    process.stderr.write(`[QUALITY][browser-acquisition:start] ${mode}\n`);
    const f = await acquisitionFixture(chrome, clock);
    if (mode === "bound-observation" || mode === "confirmed-readback") {
      await seedBound(f, clock, [0, 45_000, 90_000][index]!);
    }
    await f.pulse(); const started = clock.now(), result = f.start(mode);
    await clock.advance([15_000, 45_000, 90_000, 45_000][index]! - 1);
    await finishReady(clock, result);
    process.stderr.write(`[QUALITY][browser-acquisition:complete] ${mode}\n`);
    assert.ok(clock.now() - started < 120_000); assert.equal(f.node.broker.currentOperatorTargetJobRefHash(), hash("a"));
    assert.equal(f.worker.delivery.pendingTargetHandlers.size, 0); assert.deepEqual(f.errors, []);
    assert.equal(f.methods.filter(method => method === "Page.navigate").length, mode === "confirmed-readback" ? 1 : 0);
    await f.park();
  }
  const ready = await acquisitionFixture(chrome, clock), result = ready.start();
  await clock.advance(4_000); await finishReady(clock, result);
  assert.equal(ready.worker.delivery.pendingTargetHandlers.size, 0, "ready pages proceed without a minimum loading delay"); await ready.park();
};

const claimSendRetirement = async (chrome: ExtensionChromeApi, clock: Clock): Promise<void> => {
  for (const boundary of ["queue-deadline", "queue-abort", "queue-ack", "encrypt-deadline", "encrypt-abort", "encrypt-ack"] as const) {
    process.stderr.write(`[QUALITY][browser-acquisition:start] claim-${boundary}\n`);
    const f = await acquisitionFixture(chrome, clock), controller = new AbortController();
    let unblock!: () => void, entered!: () => void;
    const blocked = new Promise<void>(resolve => { unblock = resolve; }), encrypting = new Promise<void>(resolve => { entered = resolve; });
    const delivery = Reflect.get(f.worker.actor, "commandDelivery"), encrypt = crypto.subtle.encrypt.bind(crypto.subtle);
    const result = f.start("fresh", 200_000, controller.signal);
    if (boundary.startsWith("queue")) delivery.sendTail = blocked;
    else Reflect.set(crypto.subtle, "encrypt", async (...args: Parameters<SubtleCrypto["encrypt"]>) => { entered(); await blocked; return encrypt(...args); });
    try {
      await clock.advance(5_000);
      if (boundary.startsWith("encrypt")) await encrypting;
      if (boundary.endsWith("abort")) { await f.pulse(); controller.abort(); await clock.flush(); }
      else if (boundary.endsWith("ack")) await clock.advance(30_000);
      else { clock.jump(120_000); }
      unblock(); await clock.advance(5_000);
      const failure = await result; assert.ok(failure); assert.equal(f.node.broker.currentOperatorTargetStatus(), "absent");
      assert.equal(f.worker.frames.map(decodeBrowserAuthorityFrame).filter(frame => frame.kind === "TARGET_CLAIM").length, 0, boundary);
      assert.equal(f.registry.findByJobRefHash(hash("a")), null); assert.equal(f.tabs.size, 0); assert.equal(f.worker.delivery.pendingTargetHandlers.size, 0);
    } finally { unblock(); Reflect.set(crypto.subtle, "encrypt", encrypt); }
    process.stderr.write(`[QUALITY][browser-acquisition:complete] claim-${boundary}\n`);
  }
};

const cleanupProof = async (chrome: ExtensionChromeApi, clock: Clock): Promise<void> => {
  for (const mode of ["absent", "fake-close", "readback-failure", "replacement"] as const) {
    const f = await acquisitionFixture(chrome, clock), result = f.start();
    if (mode === "fake-close") f.setFakeClose();
    if (mode === "readback-failure") f.setReadbackFailure();
    Reflect.get(f.worker.actor, "targetClaims").fail("BROWSER_AUTHENTICATION_INCOMPLETE");
    let unblock!: () => void; const blocked = new Promise<void>(resolve => { unblock = resolve; });
    Reflect.get(f.worker.actor, "commandDelivery").sendTail = blocked;
    await clock.advance(5_000);
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
    const pending = f.node.state.pendingJobBoundTargetAcquisition!;
    if (abort) controller.abort(); else clock.jump(pending.deadlineAt - clock.now());
    const claim = { targetRef: "target-late", documentRef: "document-late", navigationEpoch: 0, claimOrigin: "https://chatgpt.com", jobRefHash: hash("a") };
    assert.throws(() => Reflect.get(f.node.supervisor, "onTargetClaim").call(f.node.supervisor, claim), /BROWSER_TARGET_INVALID/u);
    assert.equal(Reflect.get(f.node.state, "workspace"), undefined); assert.equal(f.node.broker.currentOperatorTargetStatus(), "absent");
    await clock.advance(125_000); assert.ok(await result); assert.equal(getEventListeners(controller.signal, "abort").length, 0);
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
  await f.pulse(); const next = f.start(); await clock.advance(5_000); await finishReady(clock, next); await f.park();
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
};
const readinessBoundary = async (chrome: ExtensionChromeApi, clock: Clock): Promise<void> => {
  const f = await acquisitionFixture(chrome, clock); await seedBound(f, clock, 48_000); await f.pulse();
  const result = f.start("fresh", 50_000), deadlineAt = f.node.state.pendingJobBoundTargetAcquisition!.deadlineAt;
  await clock.advance(55_000); assert.match((await result)!.message, /BROWSER_TARGET_ACQUISITION_TIMEOUT/u);
  assert.equal(f.methods.filter(method => method === "Page.navigate").length, 1);
  assert.ok(clock.now() >= deadlineAt); assert.equal(f.worker.delivery.pendingTargetHandlers.size, 0);
  assert.equal(f.registry.findByJobRefHash(hash("a"))?.tabId, 60, "bound reset timeout preserves the original resource");
};

const liveRequalification = async (chrome: ExtensionChromeApi, clock: Clock): Promise<void> => {
  for (const mode of ["normal", "cancel-before-cycle", "origin-failure"] as const) {
    const f = await acquisitionFixture(chrome, clock), first = f.start();
    await finishReady(clock, first);
    const original = f.registry.findByJobRefHash(hash("a"))!;
    const controller = new AbortController();
    let release!: () => void;
    const runtime = Reflect.get(f.worker.authority, "debuggerRuntime") as ExtensionDebuggerRuntime;
    const held = mode === "cancel-before-cycle" ? runtime.withLogicalPageAccess(async () => undefined,
      () => new Promise<void>(resolve => { release = resolve; })) : Promise.resolve();
    if (mode === "origin-failure") f.tabs.get(60)!.url = "https://example.com/";
    const pending = f.start(mode === "origin-failure" ? "bound-observation" : "confirmed-readback", 200_000, controller.signal);
    assert.equal(f.node.broker.currentOperatorTargetStatus(), "claimed", "Node retains the old live claim until the original Extension park revokes it");
    if (mode === "cancel-before-cycle") { await clock.flush(); controller.abort(); await clock.flush(); release(); }
    await held; await clock.advance(5_000);
    const result = await pending;
    if (mode === "normal") {
      assert.equal(result, null); assert.equal(f.creates(), 1);
      assert.equal(f.registry.findByJobRefHash(hash("a"))?.targetRef, original.targetRef);
      assert.equal(f.tabs.get(60)?.url, "https://chatgpt.com/c/wait-original");
      await f.park();
    } else {
      assert.match(result!.message, mode === "origin-failure" ? /BROWSER_ORIGIN_REJECTED/u : /BROWSER_WAIT_ABORTED/u);
      assert.equal(Reflect.get(f.worker.authority, "activeTarget"), null);
      assert.equal(f.node.broker.currentOperatorTargetStatus(), "absent");
      assert.equal(f.registry.findByJobRefHash(hash("a")), original); assert.equal(f.creates(), 1);
      assert.equal(f.methods.includes("Page.navigate"), false, "failed or cancelled requalification cannot navigate");
      const sibling = f.start("fresh", 200_000, new AbortController().signal, "b");
      await finishReady(clock, sibling); assert.equal(f.creates(), 2); await f.park();
    }
    assert.equal(f.worker.delivery.pendingTargetHandlers.size, 0);
    process.stderr.write(`[QUALITY][browser-acquisition:complete] live-${mode}\n`);
  }
};

const locationRevocation = async (chrome: ExtensionChromeApi, clock: Clock): Promise<void> => {
  for (const mode of ["published-document", "spa-before-native", "full-before-native", "same-url-refresh"] as const) {
    const f = await acquisitionFixture(chrome, clock); await finishReady(clock, f.start());
    const initial = f.registry.findByJobRefHash(hash("a"))!, input = permit("location");
    if (mode === "published-document" || mode === "same-url-refresh") {
      f.navigate(mode === "published-document" ? "https://chatgpt.com/c/wrong" : "https://chatgpt.com/");
      await clock.advance(5_000);
      assert.notEqual(f.registry.findByJobRefHash(hash("a"))?.documentRef, initial.documentRef);
    }
    const result = interact(f, input, async runtime => {
      if (mode === "spa-before-native" || mode === "full-before-native") {
        await Promise.resolve(); f.navigate("https://chatgpt.com/c/wrong", mode === "spa-before-native");
      }
      await runtime.send(60, "Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter" });
    }).then(() => null, error => error as Error);
    await clock.advance(5_000);
    const error = await result;
    if (mode === "same-url-refresh") assert.equal(error, null);
    else assert.match(error!.message, /BROWSER_TARGET_NOT_INTERACTIVE/u);
    assert.equal(f.methods.filter(method => method.startsWith("Input.")).length, mode === "same-url-refresh" ? 1 : 0);
    if (mode.endsWith("before-native")) assert.equal(Reflect.get(error!, "browserInputStarted"), false);
    await f.park(); process.stderr.write(`[QUALITY][browser-location:complete] ${mode}\n`);
  }
};

const firstSubmitLocation = async (chrome: ExtensionChromeApi, clock: Clock): Promise<void> => {
  for (const migrated of [false, true]) {
    const f = await acquisitionFixture(chrome, clock); await finishReady(clock, f.start());
    const submit = { ...permit("first-submit"), childCapabilityId: "submit_exact_gpt_turn_once", replayPolicy: "provider-effect-once" as const };
    const dispatched = interact(f, submit, async runtime => {
      await runtime.send(60, "Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter" });
      if (migrated) f.navigate("https://chatgpt.com/c/first-submit", true);
      return runtime.send(60, "Page.getFrameTree");
    });
    await clock.advance(5_000); await dispatched;
    const target = f.registry.findByJobRefHash(hash("a"))!, reference = target.pendingSubmit;
    assert.equal(reference?.state.started, true); assert.equal(reference?.state.physicalInputCount, 1);
    const blocked = interact(f, permit("new-preparation"), async () => { assert.fail("pending locator cannot admit another ordinary input"); })
      .then(() => null, error => error as Error);
    assert.match((await blocked)!.message, /BROWSER_TARGET_NOT_INTERACTIVE/u);
    const locator = interact(f, { ...permit("locator"), childCapabilityId: "get_submitted_gpt_conversation_url",
      replayPolicy: "observation-only", mutationClass: "observation" }, runtime => runtime.send(60, "Page.getFrameTree"), true);
    await clock.advance(5_000); await locator;
    let ackEntered = 0;
    const ack = interact(f, { ...permit("ack"), childCapabilityId: "acknowledge_known_gpt_rate_limit" }, async () => { ackEntered += 1; });
    await clock.advance(5_000); await ack;
    assert.equal(ackEntered, 1, "pending location adds no qualification gate to the original acknowledgement");
    assert.equal(target.pendingSubmit, reference); assert.equal(f.methods.filter(method => method.startsWith("Input.")).length, 1);
    await f.park(); process.stderr.write(`[QUALITY][browser-location:complete] first-submit-${migrated ? "migrated" : "root"}\n`);
  }
};

export const exerciseAcquisitionWait = async (chrome: ExtensionChromeApi): Promise<void> => {
  const clock = await controlledClock();
  try {
    for (const scenario of [slowReadyModes, claimSendRetirement, cleanupProof, lateNodeAdmission,
      nativeStillInFlight, boundClaimFailure, budgetIsolation, readinessBoundary,
      liveRequalification, locationRevocation, firstSubmitLocation]) await scenario(chrome, clock);
    assert.equal(clock.timers.size, 0, "every acquisition/ACK/cleanup timer must retire");
  } finally { clock.restore(); }
};
