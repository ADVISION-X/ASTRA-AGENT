import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";

import type { ExtensionTargetAuthority } from
  "../../src/lib/browser/chrome-extension/extension-target-authority.js";
import type { ExtensionChromeApi } from
  "../../src/lib/browser/chrome-extension/extension-runtime-types.js";
import { ExtensionDebuggerRuntime } from
  "../../src/lib/browser/chrome-extension/debugger-runtime.js";
import { BrowserAuthorityBroker } from
  "../../src/lib/browser/infrastructure/browser-authority-broker.js";
import { BrowserAuthorityIssuer } from
  "../../src/lib/browser/infrastructure/browser-authority-issuer.js";
import { workerFixture } from "./local-browser-auto-pairing-support.js";
import { decrypt, hashBrowserExtensionText } from "../../src/lib/browser/chrome-extension/websocket-actor-crypto.js";
import { decodeBrowserAuthorityFrame, encodeBrowserAuthorityFrame } from "../../src/lib/browser/transport/browser-authority-frame-codec.js";
import { parseBrowserAuthorityDiagnostic, } from "../../src/lib/browser/transport/browser-authority-diagnostic.js";
import { releaseWireFixture } from "./browser-lane-fifo-support.js";
import { exerciseAcquisitionWait } from "./local-browser-acquisition-wait-support.js";

type TargetFrame = Readonly<{
  kind: "TARGET_CLAIM" | "TARGET_REVOKE";
  body: Record<string, unknown>;
}>;
type TabUpdatedListener = Parameters<ExtensionChromeApi["tabs"]["onUpdated"]["addListener"]>[0];

export const exerciseLogicalPageAccessPriority = async (chromeApi: ExtensionChromeApi): Promise<void> => {
  const probe = new ExtensionDebuggerRuntime(chromeApi);
  probe.adoptAttached(3);
  probe.requireLogicalPageAccessCycles();
  await assert.rejects(probe.send(3, "Page.getFrameTree"),
    /BROWSER_PAGE_ACCESS_CYCLE_REQUIRED/u,
    "a raw CDP page read must not bypass the unique logical ChatGPT access boundary");
  await assert.doesNotReject(probe.withLogicalPageAccess(
    async () => undefined, () => probe.send(3, "Page.getFrameTree")));
  const accessOrder: string[] = [];
  let releaseCurrent!: () => void;
  let currentStarted!: () => void;
  const currentRelease = new Promise<void>((resolve) => { releaseCurrent = resolve; });
  const currentStart = new Promise<void>((resolve) => { currentStarted = resolve; });
  const currentAccess = probe.withLogicalPageAccess(
    async () => undefined,
    async () => { accessOrder.push("current"); currentStarted(); await currentRelease; });
  await currentStart;
  const ordinaryAccess = probe.withLogicalPageAccess(
    async () => undefined, async () => { accessOrder.push("ordinary"); });
  const urgentAccess = probe.withLogicalPageAccess(
    async () => undefined, async () => { accessOrder.push("rate-limit-ack"); }, "rate-limit-ack");
  releaseCurrent();
  await Promise.all([currentAccess, ordinaryAccess, urgentAccess]);
  assert.deepEqual(accessOrder, ["current", "rate-limit-ack", "ordinary"],
    "the exact rate-limit acknowledgement must take the next logical page-access cycle");
};

const closeRotatedTargets = async (input: Readonly<{
  authority: ExtensionTargetAuthority;
  hashes: readonly `sha256:${string}`[];
  targetRefs: readonly string[];
  targetFrames: TargetFrame[];
  removedTabs: number[];
  setRemoveFailureTabId(value: number | null): void;
}>): Promise<void> => {
  input.setRemoveFailureTabId(7);
  await assert.rejects(input.authority.releaseJobBoundChatGptTarget(input.hashes[0]!, "business-admitted", async () => undefined));
  assert.equal(input.removedTabs.includes(7), false);
  await input.authority.acquireJobBoundChatGptTarget("bound-observation", input.hashes[1]!, undefined, () => { assert.match(input.hashes[1]!, /^sha256:[a-f0-9]{64}$/u); });
  assert.equal(input.targetFrames.at(-1)?.body.targetRef, input.targetRefs[1],
    "closing job A must preserve job B's exact bound Tab");
  await input.authority.parkActiveTarget();
  await input.authority.releaseJobBoundChatGptTarget(input.hashes[1]!, "business-admitted", async () => undefined);
  await input.authority.releaseJobBoundChatGptTarget(input.hashes[2]!, "business-admitted", async () => undefined);
};

export const exerciseTargetRotation = async (input: Readonly<{
  authority: ExtensionTargetAuthority;
  waitForCreatedTab(tabId: number): Promise<void>;
  targetTabUpdated: TabUpdatedListener;
  targetFrames: TargetFrame[];
  debuggerMethods: string[];
  activatedTabs: number[];
  removedTabs: number[];
  setRemoveFailureTabId(value: number | null): void;
}>): Promise<readonly `sha256:${string}`[]> => {
  const hashes = ["b", "c", "d"].map(
    (value) => `sha256:${value.repeat(64)}` as `sha256:${string}`,
  );
  const targetRefs: string[] = [];
  for (const [index, hash] of hashes.entries()) {
    const acquisition = input.authority.acquireJobBoundChatGptTarget("fresh", hash, undefined, () => { assert.match(hash, /^sha256:[a-f0-9]{64}$/u); });
    const tabId = 7 + index;
    await input.waitForCreatedTab(tabId);
    input.targetTabUpdated(tabId, { status: "complete" }, {
      id: tabId, url: "https://chatgpt.com/", title: "ChatGPT",
    });
    await acquisition;
    targetRefs.push(String(input.targetFrames.at(-1)?.body.targetRef));
    await input.authority.parkActiveTarget();
  }
  const navigationBaseline = input.debuggerMethods.filter((method) => method === "Page.navigate").length;
  for (const index of [0, 1, 2, 0]) {
    await input.authority.acquireJobBoundChatGptTarget("bound-observation", hashes[index]!, undefined, () => { assert.match(hashes[index]!, /^sha256:[a-f0-9]{64}$/u); });
    assert.equal(input.targetFrames.at(-1)?.body.targetRef, targetRefs[index]);
    await input.authority.parkActiveTarget();
  }
  assert.deepEqual(input.activatedTabs.slice(-4), [7, 8, 9, 7],
    "three job-owned Tabs must rotate A/B/C/A through exact Chrome activation");
  assert.equal(input.debuggerMethods.filter((method) => method === "Page.navigate").length,
    navigationBaseline, "normal bound observation must switch Tabs with zero navigation");
  await closeRotatedTargets({
    authority: input.authority, hashes, targetRefs, targetFrames: input.targetFrames,
    removedTabs: input.removedTabs, setRemoveFailureTabId: input.setRemoveFailureTabId,
  });
  return hashes;
};

export const exerciseAuthorizedContinuation = async (input: Readonly<{
  authority: ExtensionTargetAuthority;
  nextCreatedTabId: number;
  waitForCreatedTab(tabId: number): Promise<void>;
  targetTabUpdated: TabUpdatedListener;
  targetFrames: TargetFrame[];
  debuggerMethods: string[];
  mainFrameUrlByTab: Map<number, string>;
}>): Promise<void> => {
  const hash = `sha256:${"e".repeat(64)}` as const;
  const url = "https://chatgpt.com/c/article-a";
  const navigationBaseline = input.debuggerMethods.filter((method) => method === "Page.navigate").length;
  const frameBaseline = input.targetFrames.length;
  const acquisition = input.authority.acquireJobBoundChatGptTarget("authorized-continuation", hash, url, () => { assert.match(hash, /^sha256:[a-f0-9]{64}$/u); });
  await input.waitForCreatedTab(input.nextCreatedTabId);
  input.targetTabUpdated(input.nextCreatedTabId, { status: "complete" }, {
    id: input.nextCreatedTabId, url: "https://chatgpt.com/", title: "ChatGPT",
  });
  await acquisition;
  assert.equal(input.mainFrameUrlByTab.get(input.nextCreatedTabId), url,
    "authorized continuation must navigate the new current-job Target to the exact parent WAL URL");
  assert.equal(input.debuggerMethods.filter((method) => method === "Page.navigate").length,
    navigationBaseline + 1,
    "authorized continuation must navigate exactly once before publishing its Target claim");
  assert.equal(input.targetFrames.length, frameBaseline + 1);
  assert.equal(input.targetFrames.at(-1)?.kind, "TARGET_CLAIM");
  assert.deepEqual(Object.keys(input.targetFrames.at(-1)?.body ?? {}).sort(),
    ["claimOrigin", "documentRef", "jobRefHash", "navigationEpoch", "targetRef"],
    "the parent conversation URL must remain absent from Target claim transport");
  await input.authority.parkActiveTarget();
  const parkedBaseline = input.debuggerMethods.filter((method) => method === "Page.navigate").length;
  await input.authority.acquireJobBoundChatGptTarget("authorized-continuation", hash, url, () => { assert.match(hash, /^sha256:[a-f0-9]{64}$/u); });
  assert.equal(input.debuggerMethods.filter((method) => method === "Page.navigate").length,
    parkedBaseline, "a parked current-job Target must be revalidated without re-navigation");
  await input.authority.parkActiveTarget();
  input.mainFrameUrlByTab.set(input.nextCreatedTabId, "https://chatgpt.com/c/article-b");
  await assert.rejects(input.authority.acquireJobBoundChatGptTarget("authorized-continuation", hash, url, () => { assert.match(hash, /^sha256:[a-f0-9]{64}$/u); }),
    /BROWSER_POSTCONDITION_FAILED/u,
    "a parked Target from article B must fail before article A can claim it");
  assert.equal(input.debuggerMethods.filter((method) => method === "Page.navigate").length,
    parkedBaseline, "mismatched parked continuation must fail without navigation");
  await input.authority.releaseJobBoundChatGptTarget(hash, "business-admitted", async () => undefined);
};

export const exerciseClosedParkedTabRecovery = async (input: Readonly<{
  authority: ExtensionTargetAuthority;
  readNextCreatedTabId(): number;
  waitForCreatedTab(tabId: number): Promise<void>;
  targetTabUpdated: TabUpdatedListener;
  targetFrames: TargetFrame[];
  targetFailures: readonly unknown[];
  removedTabs: number[];
}>): Promise<void> => {
  const closedJob = `sha256:${"f".repeat(64)}` as const;
  const closedTabId = input.readNextCreatedTabId();
  const firstClosedTabClaim = input.authority.acquireJobBoundChatGptTarget("fresh", closedJob, undefined, () => { assert.match(closedJob, /^sha256:[a-f0-9]{64}$/u); });
  await input.waitForCreatedTab(closedTabId);
  input.targetTabUpdated(closedTabId, { status: "complete" }, {
    id: closedTabId, url: "https://chatgpt.com/", title: "ChatGPT",
  });
  await firstClosedTabClaim;
  const oldTargetRef = input.targetFrames.at(-1)?.body.targetRef;
  await input.authority.parkActiveTarget();
  input.removedTabs.push(closedTabId);
  const replacementTabId = input.readNextCreatedTabId();
  const failuresBeforeClosedTabRecovery = input.targetFailures.length;
  await assert.rejects(
    input.authority.acquireJobBoundChatGptTarget("bound-observation", closedJob, undefined, () => { assert.match(closedJob, /^sha256:[a-f0-9]{64}$/u); }),
    /BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT/u,
    "a stale bound observation must not replace its missing current Tab",
  );
  assert.equal(input.readNextCreatedTabId(), replacementTabId,
    "a missing bound observation must not create a new system Tab");
  const replacement = input.authority.acquireJobBoundChatGptTarget("confirmed-readback", closedJob, undefined, () => { assert.match(closedJob, /^sha256:[a-f0-9]{64}$/u); });
  await input.waitForCreatedTab(replacementTabId);
  input.targetTabUpdated(replacementTabId, { status: "complete" }, {
    id: replacementTabId, url: "https://chatgpt.com/", title: "ChatGPT",
  });
  await replacement;
  assert.notEqual(input.targetFrames.at(-1)?.body.targetRef, oldTargetRef,
    "a closed parked Tab must be replaced with a current Target on the next acquisition");
  assert.equal(input.targetFailures.length, failuresBeforeClosedTabRecovery,
    "closed parked Tab recovery must not report an old Target failure first");
  await input.authority.parkActiveTarget();
  await input.authority.releaseJobBoundChatGptTarget(closedJob, "business-admitted", async () => undefined);
};

export const exerciseClaimBroker = async (input: Readonly<{
  hashes: readonly `sha256:${string}`[];
  activatedTabs: number[];
  removedTabs: number[];
}>): Promise<void> => {
  const issuer = new BrowserAuthorityIssuer();
  Reflect.set(issuer, "slot", {
    kind: "PRESENT", authority: { authorityEpoch: 7, authorityRef: "authority-7" },
  });
  const broker = new BrowserAuthorityBroker(issuer, () => undefined,
    () => { throw new Error("target lease factory is outside this claim-only acceptance"); });
  const initialClaim = {
    authorityEpoch: 7, targetRef: "target-1", documentRef: "document-1", navigationEpoch: 0,
    claimOrigin: "https://chatgpt.com", jobRefHash: input.hashes[0]!,
  } as const;
  broker.registerOperatorTargetClaim(initialClaim);
  broker.registerOperatorTargetClaim({ ...initialClaim, documentRef: "document-2", navigationEpoch: 1 });
  assert.throws(() => broker.registerOperatorTargetClaim({ ...initialClaim, targetRef: "target-2" }),
    /BROWSER_TARGET_INVALID/u, "an authenticated connection must not replace its claimed target without revoke");
  assert.throws(() => broker.registerOperatorTargetClaim({
    ...initialClaim, documentRef: "document-4", navigationEpoch: 3,
  }), /BROWSER_TARGET_INVALID/u, "Document claims must advance by exactly one navigation epoch");
  assert.throws(() => broker.registerOperatorTargetClaim({
    ...initialClaim, documentRef: "document-3", navigationEpoch: 2, jobRefHash: input.hashes[1]!,
  }), /BROWSER_TARGET_INVALID/u, "a live claim may never change its exact job identity");
  await assert.rejects(broker.acquireOperatorClaimedTargetLease({
    jobRefHash: input.hashes[1]!,
  } as never, "wrong-job"), /BROWSER_TARGET_INVALID/u,
  "an old claimed Tab must never be wrapped as a lease for a different job");
  assert.equal(new Set<number>(input.activatedTabs).has(99), false,
    "the interaction gate must never activate an operator Tab");
  assert.equal(new Set<number>(input.removedTabs).has(99), false,
    "the production owner must never remove an operator Tab");
};

const deliverTarget = async (worker: Awaited<ReturnType<typeof workerFixture>>, sequence: number,
  body: Record<string, unknown>): Promise<void> => {
  await worker.invoke("onMessage", worker.socket, encodeBrowserAuthorityFrame(await worker.frame("TARGET_ACQUIRE", sequence, body)));
  await flushTargetCallbacks(worker);
};
const flushTargetCallbacks = async (worker: Awaited<ReturnType<typeof workerFixture>>): Promise<void> => {
  await new Promise<void>(resolve => setImmediate(resolve));
  await Reflect.get(Reflect.get(worker.actor, "commandDelivery"), "sendTail");
};
const authenticatedBackpressure = async (chrome: ExtensionChromeApi): Promise<void> => {
  let fail!: (error: Error) => void, started!: () => void, creates = 0;
  const start = new Promise<void>(resolve => { started = resolve; });
  const creation = new Promise<{ id: number }>((_resolve, reject) => { fail = reject; });
  const [worker, job, sibling, third] = await Promise.all([workerFixture({ ...chrome, tabs: { ...chrome.tabs, create: async () => {
    creates += 1; if (creates === 1) { started(); return creation; } throw new Error("BROWSER_TARGET_CLEANUP_FAILED"); } } }),
    hashBrowserExtensionText("backpressure-job"), hashBrowserExtensionText("sibling"), hashBrowserExtensionText("third")]);
  await Promise.all([deliverTarget(worker, 2, { action: "acquire", jobRefHash: job, targetMode: "fresh" }), start]);
  for (const [sequence, body] of [[3, { action: "acquire", targetMode: "fresh", jobRefHash: sibling }],
    [4, { action: "release", releaseAuthority: "website-admin-deletion", jobRefHash: third }]] as const) {
    await deliverTarget(worker, sequence, body);
    assert.equal(worker.delivery.pendingTargetHandlers.size, 1); assert.equal(creates, 1); assert.equal(worker.closes(), 0);
    assert.equal(worker.delivery.mutationSlot, null);
    const diagnostic = await decrypt(worker.session.clientToServerKey, "client-to-server", decodeBrowserAuthorityFrame(worker.frames.at(-1)!));
    const parsed = parseBrowserAuthorityDiagnostic(diagnostic);
    assert.equal(parsed.reasonCode, "BROWSER_BACKPRESSURE"); assert.equal(parsed.refs.failedFrameSequence, String(sequence));
    assert.equal(parsed.refs.jobRefHash, body.jobRefHash);
  }
  const handlers = Array.from(worker.delivery.pendingTargetHandlers.values(), record => record.promise); fail(new Error("BROWSER_TARGET_CLEANUP_FAILED"));
  await Promise.allSettled(handlers); await flushTargetCallbacks(worker);
  assert.equal(worker.delivery.pendingTargetHandlers.size, 0); assert.equal(worker.delivery.commandAdmissionSuspended, false);
  await deliverTarget(worker, 5, { action: "acquire", jobRefHash: sibling, targetMode: "fresh" });
  await Promise.allSettled(Array.from(worker.delivery.pendingTargetHandlers.values(), record => record.promise)); await flushTargetCallbacks(worker);
  assert.equal(creates, 2, "the next legal acquire must enter the real Chrome create after the old handler exits");
  assert.equal(worker.delivery.pendingTargetHandlers.size, 0); assert.equal(worker.closes(), 0);
};
const releaseFailureRetirement = async (chrome: ExtensionChromeApi): Promise<void> => {
  let creates = 0;
  const worker = await workerFixture({ ...chrome, debugger: { ...chrome.debugger,
    getTargets: async () => { throw new Error("BROWSER_TARGET_CLEANUP_FAILED"); } }, tabs: { ...chrome.tabs,
      create: async () => { creates += 1; throw new Error("BROWSER_TARGET_CLEANUP_FAILED"); } } });
  const [job, other] = await Promise.all([hashBrowserExtensionText("failed-release"), hashBrowserExtensionText("next-acquire")]);
  const registry = Reflect.get(worker.authority, "targets") as { claimOperatorTarget(...args: unknown[]): unknown; findByJobRefHash(hash: string): unknown };
  const bound = registry.claimOperatorTarget(23, job, "loader", "chrome-23");
  await deliverTarget(worker, 2, { action: "release", jobRefHash: job, releaseAuthority: "business-admitted" });
  await Promise.allSettled(Array.from(worker.delivery.pendingTargetHandlers.values(), record => record.promise)); await flushTargetCallbacks(worker);
  assert.equal(worker.delivery.commandAdmissionSuspended, false); assert.equal(worker.delivery.pendingTargetHandlers.size, 0);
  assert.equal(registry.findByJobRefHash(job), bound); assert.equal(worker.closes(), 0);
  await deliverTarget(worker, 3, { action: "acquire", jobRefHash: other, targetMode: "fresh" });
  await Promise.allSettled(Array.from(worker.delivery.pendingTargetHandlers.values(), record => record.promise)); await flushTargetCallbacks(worker);
  assert.equal(creates, 1, "release failure retirement must reopen the real acquire path without touching the old registry");
  assert.equal(registry.findByJobRefHash(job), bound); assert.equal(worker.closes(), 0);
};
const rotatedTargetCallbacks = async (chrome: ExtensionChromeApi): Promise<void> => {
  for (const rotation of ["socket", "server-key", "client-key"] as const) for (const outcome of ["acquire-failed", "release-failed", "release-absent"] as const) {
    let finish!: () => void, fail!: (error: Error) => void, started!: () => void;
    const start = new Promise<void>(resolve => { started = resolve; });
    const native = new Promise<never[]>((resolve, reject) => { finish = () => resolve([]); fail = reject; });
    const [old, job] = await Promise.all([workerFixture({ ...chrome,
      tabs: { ...chrome.tabs, create: async () => { started(); await native; throw new Error("UNEXPECTED_CREATE_SUCCESS"); } },
      debugger: { ...chrome.debugger, getTargets: () => { started(); return native; } } }), hashBrowserExtensionText("rotated-release")]);
    const registry = Reflect.get(old.authority, "targets") as { claimOperatorTarget(...args: unknown[]): unknown; findByJobRefHash(hash: string): unknown };
    const bound = outcome === "acquire-failed" ? null : registry.claimOperatorTarget(23, job, "loader", "chrome-23");
    await Promise.all([deliverTarget(old, 2, outcome === "acquire-failed" ? { action: "acquire", jobRefHash: job, targetMode: "fresh" }
      : { action: "release", jobRefHash: job, releaseAuthority: "business-admitted" }), start]);
    const handlers = Array.from(old.delivery.pendingTargetHandlers.values(), record => record.promise), current = await workerFixture(chrome);
    const session = { ...old.session, serverToClientKey: rotation === "server-key" ? current.session.serverToClientKey : old.session.serverToClientKey,
      clientToServerKey: rotation === "client-key" ? current.session.clientToServerKey : old.session.clientToServerKey };
    const socket = rotation === "socket" ? current.socket : old.socket;
    Object.assign(old.connection, { socket, session }); old.delivery.commandAdmissionSuspended = true;
    const slot = { jobId: "rotated-release", commandId: "kept", receiptBindingHash: job, fact: null }; old.delivery.mutationSlot = slot;
    const [serverToClient, clientToServer] = await Promise.all([crypto.subtle.exportKey("raw", session.serverToClientKey), crypto.subtle.exportKey("raw", session.clientToServerKey)]);
    const node = releaseWireFixture({ serverToClient: Buffer.from(serverToClient), clientToServer: Buffer.from(clientToServer), commandPermit: Buffer.alloc(32, 9) }, 2);
    const originalSend = socket.send.bind(socket); Reflect.set(socket, "send", (value: string) => { originalSend(value); node.receive(value); });
    const waiting = node.acquirer.releaseJobBoundTarget(10_000, job, "website-admin-deletion");
    const pending = node.state.pendingJobBoundTargetAcquisition; assert.equal(pending?.requestSequence, 2);
    if (outcome === "release-absent") finish(); else fail(new Error("BROWSER_TARGET_CLEANUP_FAILED"));
    await Promise.allSettled(handlers); await flushTargetCallbacks(old);
    assert.equal(old.delivery.pendingTargetHandlers.size, 0); assert.equal(old.delivery.commandAdmissionSuspended, true);
    assert.equal(old.delivery.mutationSlot, slot); assert.equal(node.state.pendingJobBoundTargetAcquisition, pending);
    assert.equal(node.closes(), 0); assert.equal(current.frames.length, 0); assert.equal(old.frames.length, 0);
    assert.equal(registry.findByJobRefHash(job), outcome === "release-absent" ? null : bound);
    node.deliver({ targetRef: null, jobRefHash: job, releaseOutcome: "absent", requestSequence: 2 }); await waiting;
    assert.equal(node.state.pendingJobBoundTargetAcquisition, null); assert.equal(node.closes(), 0);
  }
};
export const exerciseAuthenticatedTargetIsolation = async (chrome: ExtensionChromeApi): Promise<void> => {
  await exerciseAcquisitionWait(chrome);
  await authenticatedBackpressure(chrome); await releaseFailureRetirement(chrome); await rotatedTargetCallbacks(chrome);
};
