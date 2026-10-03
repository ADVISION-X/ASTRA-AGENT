import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { ExtensionTargetAuthority } from "../../src/lib/browser/chrome-extension/extension-target-authority.js";
import { ChatGptPageAccessGate } from "../../src/lib/browser/chrome-extension/chatgpt-page-access-gate.js";
import type { ExtensionChromeApi } from "../../src/lib/browser/chrome-extension/extension-runtime-types.js";
import { exerciseAuthenticatedMedia } from "./local-browser-authenticated-media-support.js";
import { exerciseLocalBrowserDomIntent } from "./local-browser-dom-intent-support.js";
import { emitLocalBrowserAutoPairingProofs } from "./local-browser-proof-support.js";
import { browserDomFacts } from "./local-browser-dom-runtime-fixture.js";
import { exerciseAutomaticPairing } from "./local-browser-auto-pairing-support.js";
import { exerciseAuthorizedContinuation, exerciseClaimBroker, exerciseClosedParkedTabRecovery, exerciseLogicalPageAccessPriority,
  exerciseTargetRotation } from "./local-browser-target-lifecycle-support.js";
import { rateLimitDetectorCdpResult, verifyKnownGptRateLimitDetector } from "./local-browser-rate-limit-detector.acceptance-support.js";
import { verifyRateLimitCommandAdmission } from "./local-browser-rate-limit-command.acceptance-support.js";
import { permit } from "./local-browser-terminal-fixture.js";
import { hashBrowserExtensionText } from "../../src/lib/browser/chrome-extension/websocket-actor-crypto.js";

const chrome = await exerciseAutomaticPairing(); await verifyKnownGptRateLimitDetector();
const state = { nextId: 3, activeId: 99, navigationCount: 0, physicalTargetsReads: 0, pointer: false,
  holdNavigation: false, frameNavigationDuringNavigate: false, switchBeforeInput: false, switchAfterInput: false,
  switchReadCountdown: 0, switchDuringTargets: null as "away" | "away-back" | null, attachFailure: null as number | null, removeFailure: null as number | null,
  created: null as Readonly<{ active: true; url: string }> | null, pointerResult: { x: 5, y: 5 } as unknown,
  detector: { state: "absent" } as Readonly<Record<string, unknown>>, runtime: null as ((expression: string) => Promise<unknown>) | null };
const attached: number[] = [], detached: number[] = [], activated: number[] = [], removed: number[] = [], inputs: string[] = [], methods: string[] = [], detectorStarts: number[] = [];
const chromeIdentities = new Map<number, string>();
const discarded = new Set<number>(), lostDebugger = new Set<number>(), urls = new Map<number, string>(), loaders = new Map<number, string>(), statuses = new Map<number, "loading" | "complete">();
const frames: { kind: "TARGET_CLAIM" | "TARGET_REVOKE"; body: Record<string, unknown> }[] = [], failures: Record<string, unknown>[] = [], failureOrder: string[] = [];
let event: Parameters<ExtensionChromeApi["debugger"]["onEvent"]["addListener"]>[0] = () => undefined;
let detach: Parameters<ExtensionChromeApi["debugger"]["onDetach"]["addListener"]>[0] = () => undefined;
let activation: Parameters<ExtensionChromeApi["tabs"]["onActivated"]["addListener"]>[0] = () => undefined;
let update: Parameters<ExtensionChromeApi["tabs"]["onUpdated"]["addListener"]>[0] = () => undefined;
let removal: (id: number) => void = () => undefined;
const switchTab = (id: number): void => { state.activeId = id; activation({ tabId: id, windowId: 1 }); };
const tabUpdated: typeof update = (id, changes, tab) => { if (changes.status === "loading" || changes.status === "complete") statuses.set(id, changes.status); update(id, changes, tab); };
const tabValue = (id: number) => ({ active: id === state.activeId, discarded: discarded.has(id), id,
  status: statuses.get(id) ?? "complete", title: "ChatGPT", windowId: 1 });
const simulateDomReadAndInput = async (_tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>): Promise<unknown> => {
      if (method === "Runtime.callFunctionOn" && String(parameters?.functionDeclaration).includes("known-gpt-rate-limit-preflight.v2"))
        return rateLimitDetectorCdpResult(parameters, state.detector, detectorStarts);
      if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
      if (method === "DOM.resolveNode") return { object: { objectId: "candidate-root" } };
      if (method === "Runtime.callFunctionOn" && state.pointer) {
        if (String(parameters?.functionDeclaration).includes("spec.output")) {
          if (state.switchBeforeInput) { state.switchBeforeInput = false; switchTab(99); }
          return { result: { value: state.pointerResult } };
        }
        return { result: { value: browserDomFacts() } };
      }
      if (method === "Input.dispatchMouseEvent" && state.pointer) {
        inputs.push(String(parameters?.type)); if (state.switchAfterInput) { state.switchAfterInput = false; switchTab(99); }
        if (parameters?.type === "mouseReleased") urls.set(3, "https://chatgpt.com/c/interaction-ready"); return {};
      }
      if (method === "Runtime.evaluate" && state.runtime) return { result: { value: await state.runtime(String(parameters?.expression)) } };
  return {};
};
const targetChrome: ExtensionChromeApi = { runtime: chrome.runtime, alarms: chrome.alarms,
  debugger: { attach: async ({ tabId }) => { if (state.attachFailure === tabId) throw new Error("DEBUGGER_CONFLICT"); lostDebugger.delete(tabId); attached.push(tabId); },
    detach: async ({ tabId }) => { lostDebugger.add(tabId); detached.push(tabId); },
    getTargets: async () => { state.physicalTargetsReads += 1;
      if (state.switchDuringTargets) { const mode = state.switchDuringTargets, original = state.activeId;
        state.switchDuringTargets = null; switchTab(99); if (mode === "away-back") switchTab(original); }
      return Array.from({ length: state.nextId - 3 }, (_, index) => index + 3)
      .filter(id => !removed.includes(id)).map(id => ({ id: chromeIdentities.get(id) ?? `chrome-target-${id}`, tabId: id, attached: attached.includes(id) && !lostDebugger.has(id),
        title: "ChatGPT", type: "page" as const, url: urls.get(id) ?? "https://chatgpt.com/" })); },
    sendCommand: async ({ tabId }, method, parameters) => {
      methods.push(method);
      if (method === "Page.getNavigationHistory") return { currentIndex: 0, entries: [{ id: 1, url: urls.get(tabId) ?? "https://chatgpt.com/", title: "ChatGPT" }] };
      if (method === "Page.navigate") {
        state.navigationCount += 1; urls.set(tabId, String(parameters?.url)); loaders.set(tabId, `loader-${tabId}-navigation-${state.navigationCount}`); statuses.set(tabId, "loading");
        if (state.frameNavigationDuringNavigate) { state.frameNavigationDuringNavigate = false; event({ tabId }, "Page.frameNavigated"); }
        if (!state.holdNavigation) setTimeout(() => tabUpdated(tabId, { status: "complete" }, { id: tabId, url: urls.get(tabId)! }), 1);
        return { loaderId: loaders.get(tabId) };
      }
      if (method === "Page.getFrameTree") return { frameTree: { frame: { loaderId: loaders.get(tabId) ?? `loader-${tabId}`, url: urls.get(tabId) ?? "https://chatgpt.com/" } } };
      return simulateDomReadAndInput(tabId, method, parameters);
    }, onDetach: { addListener: callback => { detach = (target, reason) => { lostDebugger.add(target.tabId); callback(target, reason); }; } },
    onEvent: { addListener: callback => { event = callback; } } },
  tabs: { create: async input => { state.created = input; const id = state.nextId++; statuses.set(id, "loading"); switchTab(id); return { id }; },
    get: async id => { if (removed.includes(id)) throw new Error("TAB_ABSENT"); if (state.switchReadCountdown > 0 && --state.switchReadCountdown === 0) { switchTab(99); switchTab(id); } return tabValue(id); },
    remove: async id => { if (state.removeFailure === id) { state.removeFailure = null; throw new Error("REMOVE_UNPROVEN"); } removed.push(id); removal(id); },
    update: async id => { activated.push(id); switchTab(id); return tabValue(id); },
    onActivated: { addListener: callback => { activation = callback; } }, onUpdated: { addListener: callback => { update = callback; } },
    onRemoved: { addListener: callback => { removal = callback; } } } };
await exerciseLogicalPageAccessPriority(targetChrome);
const authority = new ExtensionTargetAuthority(targetChrome, async (kind, body) => { frames.push({ kind, body }); if (kind === "TARGET_REVOKE") failureOrder.push(kind); },
  failure => { failures.push({ ...failure }); failureOrder.push("DIAGNOSTIC"); }, async () => undefined);
authority.start();
const until = async (condition: () => boolean): Promise<void> => { const deadline = Date.now() + 10_000;
  while (!condition()) { if (Date.now() >= deadline) throw new Error("FIXTURE_CONDITION_TIMEOUT"); await new Promise<void>(resolve => setTimeout(resolve, 1)); } };
const waitForCreatedTab = (id: number) => until(() => state.nextId > id);
const job = `sha256:${"a".repeat(64)}` as const;
const first = authority.acquireJobBoundChatGptTarget("fresh", job); await waitForCreatedTab(3);
assert.deepEqual(attached, []); assert.deepEqual([...frames], []);
tabUpdated(3, { status: "complete" }, { id: 3, url: "https://chatgpt.com/" }); await first;
assert.deepEqual(attached, [3]); assert.ok(state.physicalTargetsReads > 0); assert.deepEqual(state.created, { active: true, url: "https://chatgpt.com/" });
assert.equal(state.activeId, 3); assert.deepEqual(Object.keys(frames[0]!.body).sort(), ["claimOrigin", "documentRef", "jobRefHash", "navigationEpoch", "targetRef"]);
assert.equal(frames[0]!.body.claimOrigin, "https://chatgpt.com"); const initialClaim = frames[0]!.body;
const targetRef = String(initialClaim.targetRef), documentRef = String(initialClaim.documentRef), target = authority.resolve(targetRef, documentRef);
const execute = async (command: Parameters<ExtensionTargetAuthority["executeRegisteredCommand"]>[0], current = target,
  kind: Parameters<ExtensionTargetAuthority["executeRegisteredCommand"]>[2] = "mutation") => {
  const result = await authority.executeRegisteredCommand(command, current, kind, `sha256:${"e".repeat(64)}`);
  const row = result as Record<string, unknown>; return row?.schemaVersion === "grasseye.browser.command-preflight.v1" ? row.commandResult : result;
};
await exerciseAuthenticatedMedia({ authority, targetRef, documentRef, setRuntime: callback => { state.runtime = callback; } }); assert.deepEqual(activated, []);
switchTab(99); await execute({ kind: "wait", durationMs: 1 }, target, "observation"); assert.deepEqual(activated, [3]);
const click = { kind: "dom-intent" as const, intent: { kind: "click" as const, selector: "button[data-testid='interaction-ready']", expectedMatches: 1,
  postClickUrl: { equals: "https://chatgpt.com/c/interaction-ready" } } };
state.pointer = true;
await verifyRateLimitCommandAdmission({ executeRegisteredCommand: execute, simpleClick: click, interactionTarget: target, firstTargetRef: targetRef,
  firstDocumentRef: documentRef, providerInputMethods: inputs, rateLimitDetectorStartedAt: detectorStarts,
  setRateLimitDetectorState: value => { state.detector = value; } });
const gate = new ChatGptPageAccessGate(), starts: number[] = [];
for (let index = 0; index < 3; index += 1) { await gate.enter(); starts.push(performance.now()); }
assert.ok(starts.slice(1).every((value, index) => value - starts[index]! >= 1500));
switchTab(99); await execute(click); const activationCount = activated.length; await execute(click); assert.equal(activated.length, activationCount);
for (const mode of ["origin", "away-back", "before-input", "discarded"] as const) {
  const before = inputs.length; urls.set(3, mode === "origin" ? "http://127.0.0.1:4173/" : "https://chatgpt.com/");
  if (mode === "away-back") state.switchReadCountdown = 2;
  if (mode === "before-input") state.switchBeforeInput = true;
  if (mode === "discarded") discarded.add(3);
  const result = await execute(click) as Record<string, unknown>; assert.equal(result.failureCode, "BROWSER_TARGET_NOT_INTERACTIVE"); assert.equal(result.mutationCount, 0);
  if (mode === "origin") assert.equal(result.nativeCauseCode, "BROWSER_ORIGIN_REJECTED");
  assert.equal(inputs.length, before); discarded.delete(3); switchTab(3);
}
urls.set(3, "https://chatgpt.com/"); state.switchAfterInput = true; const beforeLateSwitch = inputs.length;
await assert.rejects(execute(click), /BROWSER_TARGET_NOT_INTERACTIVE/u); assert.equal(inputs.length, beforeLateSwitch + 1); switchTab(3);
state.pointer = false;
const select = (url: string, current = target) => execute({ kind: "dom-intent", intent: { kind: "selectExactGptConversation", canonicalConversationUrl: url } }, current, "lifecycle") as Promise<Record<string, unknown>>;
urls.set(3, "https://chatgpt.com/c/sidebar-target?messageId=one#tail"); const baselineNavigation = state.navigationCount;
const same = await select("https://chatgpt.com/c/sidebar-target"); assert.equal(same.documentRef, target.documentRef); assert.equal(state.navigationCount, baselineNavigation);
loaders.set(3, "same-url-new-loader"); const reloaded = await select("https://chatgpt.com/c/sidebar-target"); assert.notEqual(reloaded.documentRef, target.documentRef); assert.equal(state.navigationCount, baselineNavigation);
const reloadedTarget = authority.resolve(String(reloaded.targetRef), String(reloaded.documentRef)), beforeNavigationClaims = frames.length;
loaders.set(3, "unannounced-document");
await assert.rejects(select("https://chatgpt.com/c/foreign-document", reloadedTarget), /BROWSER_DOCUMENT_INVALID/u);
assert.equal(state.navigationCount, baselineNavigation); assert.equal(frames.length, beforeNavigationClaims);
loaders.set(3, reloadedTarget.loaderId);
chromeIdentities.set(3, "replacement-chrome-target");
await assert.rejects(select("https://chatgpt.com/c/foreign-target", reloadedTarget), /BROWSER_TARGET_INVALID/u);
assert.equal(state.navigationCount, baselineNavigation); assert.equal(frames.length, beforeNavigationClaims);
chromeIdentities.delete(3);
for (const mode of ["away", "away-back"] as const) {
  state.switchDuringTargets = mode;
  await assert.rejects(select("https://chatgpt.com/c/inactive-during-qualification", reloadedTarget), /BROWSER_TARGET_NOT_INTERACTIVE/u);
  assert.equal(state.navigationCount, baselineNavigation); assert.equal(frames.length, beforeNavigationClaims); switchTab(3);
}
state.holdNavigation = true; state.frameNavigationDuringNavigate = true;
const selecting = select("https://chatgpt.com/c/sidebar-next", reloadedTarget); await until(() => state.navigationCount === baselineNavigation + 1);
assert.equal(statuses.get(3), "loading"); assert.equal(frames.length, beforeNavigationClaims, "A new loader acknowledgement with a loading Tab cannot publish a claim.");
tabUpdated(99, { status: "complete" }, { id: 99, url: "https://chatgpt.com/" }); await Promise.resolve(); assert.equal(frames.length, beforeNavigationClaims);
tabUpdated(3, { status: "complete" }, { id: 3, url: urls.get(3)! }); const selected = await selecting; state.holdNavigation = false;
assert.deepEqual(frames.slice(beforeNavigationClaims).map(frame => frame.kind), ["TARGET_CLAIM"]); assert.notEqual(selected.documentRef, reloadedTarget.documentRef);
const selectedTarget = authority.resolve(String(selected.targetRef), String(selected.documentRef)); await select("https://chatgpt.com/c/sidebar-absent", selectedTarget);
assert.equal(state.navigationCount, baselineNavigation + 2); assert.equal(inputs.length, beforeLateSwitch + 1);
const currentClaim = frames.at(-1)!.body, current = authority.resolve(String(currentClaim.targetRef), String(currentClaim.documentRef));
const removedBefore = removed.length; await authority.retireInvalidCommandTarget({ message: "BROWSER_DOCUMENT_INVALID" },
  { ...permit("unknown-cause"), targetRef: current.targetRef, documentRef: current.documentRef }, "click"); assert.equal(removed.length, removedBefore);
await authority.parkActiveTarget(); assert.equal(frames.at(-1)?.kind, "TARGET_REVOKE"); assert.deepEqual(detached, []);
await authority.acquireJobBoundChatGptTarget("confirmed-readback", job); assert.deepEqual(attached, [3]); assert.equal(state.nextId, 4);
assert.equal(frames.at(-1)?.body.targetRef, targetRef); assert.equal(methods.includes("Page.bringToFront"), false); await authority.releaseActiveTarget(false); assert.deepEqual(detached, []);
await exerciseLocalBrowserDomIntent(); const beforeFresh = state.navigationCount; await authority.acquireJobBoundChatGptTarget("fresh", job);
assert.equal(state.navigationCount, beforeFresh + 1); assert.equal(state.nextId, 4); assert.equal(frames.at(-1)?.body.targetRef, targetRef);
assert.notEqual(frames.at(-1)?.body.documentRef, documentRef);
failureOrder.length = 0; detach({ tabId: 3 }, "target_closed"); await new Promise<void>(resolve => setTimeout(resolve, 0));
assert.deepEqual(failureOrder, ["DIAGNOSTIC", "TARGET_REVOKE"]); assert.equal(failures.at(-1)?.nativeCauseCode, "CHROME_DEBUGGER_TARGET_CLOSED");
const replacement = authority.acquireJobBoundChatGptTarget("confirmed-readback", job); await waitForCreatedTab(4);
tabUpdated(4, { status: "complete" }, { id: 4, url: "https://chatgpt.com/" }); await replacement; assert.equal(frames.at(-1)?.body.targetRef, "target-tab-4");
const replacementClaim = frames.at(-1)!.body; await select("https://chatgpt.com/c/replacement-readback", authority.resolve(String(replacementClaim.targetRef), String(replacementClaim.documentRef)));
assert.equal(state.nextId, 5); assert.equal(state.activeId, 4); detach({ tabId: 4 }, "canceled_by_user"); await new Promise<void>(resolve => setTimeout(resolve, 0));
assert.equal(failures.at(-1)?.reasonCode, "BROWSER_DEVTOOLS_CONFLICT"); assert.equal(failures.at(-1)?.nativeCauseCode, "CHROME_DEBUGGER_CANCELED_BY_USER");
for (const bad of ["origin", "debugger"] as const) {
  const id = state.nextId; if (bad === "debugger") state.attachFailure = id;
  const attempt = authority.acquireJobBoundChatGptTarget("fresh", job); await waitForCreatedTab(id);
  if (bad === "origin") urls.set(id, "https://example.com/");
  tabUpdated(id, { status: "complete" }, { id, url: urls.get(id) ?? "https://chatgpt.com/" });
  await assert.rejects(attempt, new RegExp(bad === "origin" ? "BROWSER_ORIGIN_REJECTED" : "BROWSER_DEVTOOLS_CONFLICT", "u"));
  assert.ok(removed.includes(id)); state.attachFailure = null;
}
const rotation = await exerciseTargetRotation({ authority, waitForCreatedTab, targetTabUpdated: tabUpdated, targetFrames: frames,
  debuggerMethods: methods, activatedTabs: activated, removedTabs: removed, setRemoveFailureTabId: value => { state.removeFailure = value; } });
await exerciseAuthorizedContinuation({ authority, nextCreatedTabId: state.nextId, waitForCreatedTab, targetTabUpdated: tabUpdated,
  targetFrames: frames, debuggerMethods: methods, mainFrameUrlByTab: urls });
await exerciseClosedParkedTabRecovery({ authority, readNextCreatedTabId: () => state.nextId, waitForCreatedTab, targetTabUpdated: tabUpdated,
  targetFrames: frames, targetFailures: failures, removedTabs: removed });
await exerciseClaimBroker({ hashes: rotation, activatedTabs: activated, removedTabs: removed });

const compareAfterBarrier = async (): Promise<void> => {
  for (const field of ["jobRefHash", "targetRef", "documentRef", "chromeTargetId", "tabId"] as const) {
    const fixture = Object.create(ExtensionTargetAuthority.prototype) as ExtensionTargetAuthority;
    const targets = Reflect.get(authority, "targets") as import("../../src/lib/browser/chrome-extension/exact-target-runtime.js").ExtensionExactTargetRegistry;
    const original = targets.claimOperatorTarget(100, await hashBrowserExtensionText("job-retire"), "loader", "chrome-original");
    let release!: () => void; const barrier = new Promise<void>(resolve => { release = resolve; }); let revocations = 0;
    Object.assign(fixture, { targets, activeTarget: original, navigationPublication: null,
      debuggerRuntime: { awaitPageReadPermission: () => barrier }, send: async () => { revocations += 1; } });
    const retiring = fixture.retireInvalidCommandTarget({ errorCode: "BROWSER_ORIGIN_REJECTED" }, { ...permit("retire"), jobId: "job-retire",
      targetRef: original.targetRef, documentRef: original.documentRef }, "click");
    await Promise.resolve(); const current = { ...original, [field]: field === "tabId" ? 101 : field === "jobRefHash" ? `sha256:${"f".repeat(64)}` : "replacement" };
    Reflect.set(fixture, "activeTarget", current); release(); await retiring;
    assert.equal(Reflect.get(fixture, "activeTarget"), current); assert.equal(revocations, 0); targets.remove(original.targetRef);
  }
};
await compareAfterBarrier(); emitLocalBrowserAutoPairingProofs(); console.log("automatic pairing and exact Target navigation exercised");
