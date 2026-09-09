import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";

import {
  GRASSEYE_AUTO_PAIRING_ALARM,
  GRASSEYE_TOOL_EXTENSION_ID,
  PairingAutoBootstrap,
  type WorkbenchPairingState,
} from "../../src/lib/browser/chrome-extension/pairing-auto-bootstrap.js";
import { ExtensionTargetAuthority } from "../../src/lib/browser/chrome-extension/extension-target-authority.js";
import type { ExtensionChromeApi, ExtensionDebugTarget } from "../../src/lib/browser/chrome-extension/extension-runtime-types.js";
import type { BrowserTargetLeaseManager } from "../../src/lib/browser/exact-target/browser-target-lease-manager.js";
import { BrowserAuthorityBroker } from "../../src/lib/browser/infrastructure/browser-authority-broker.js";
import { BrowserAuthorityIssuer } from "../../src/lib/browser/infrastructure/browser-authority-issuer.js";
import { exerciseAuthenticatedMedia } from "./local-browser-authenticated-media-support.js";
import { exerciseLocalBrowserDomIntent } from "./local-browser-dom-intent-support.js";
import { emitLocalBrowserAutoPairingProofs } from "./local-browser-proof-support.js";
import { browserDomFacts } from "./local-browser-dom-runtime-fixture.js";
import { exercisePairingReadback } from "./local-browser-pairing-readback-support.js";
import { exerciseForkFailureChildSurvival } from "./local-browser-fork-failure-support.js";

const secret = "a".repeat(64);
const currentBuild = "build-00000000-0000-4000-8000-000000000001";
const nextBuild = "build-00000000-0000-4000-8000-000000000002";

await exercisePairingReadback(secret, currentBuild);

type RuntimeStartupListener = () => void;
type TabActivatedListener = Parameters<ExtensionChromeApi["tabs"]["onActivated"]["addListener"]>[0];
type TabUpdatedListener = Parameters<ExtensionChromeApi["tabs"]["onUpdated"]["addListener"]>[0];
type DebuggerDetachListener = Parameters<ExtensionChromeApi["debugger"]["onDetach"]["addListener"]>[0];
type AlarmListener = Parameters<ExtensionChromeApi["alarms"]["onAlarm"]["addListener"]>[0];

const listeners: {
  runtimeStartup?: RuntimeStartupListener;
  tabUpdated?: TabUpdatedListener;
  alarm?: AlarmListener;
} = {};
let createdAlarm: Readonly<{ name: string; periodInMinutes: number }> | null = null;
let reloads = 0;
const chromeApi: ExtensionChromeApi = {
  runtime: {
    id: GRASSEYE_TOOL_EXTENSION_ID,
    getManifest: () => ({ version: "1.0.0" }),
    getPlatformInfo: async () => ({}),
    reload: () => { reloads += 1; },
    onMessage: { addListener: () => undefined },
    onStartup: { addListener: (listener) => { listeners.runtimeStartup = listener; } },
  },
  debugger: {
    attach: async () => undefined,
    detach: async () => undefined,
    getTargets: async () => [],
    sendCommand: async () => ({}),
    onDetach: { addListener: () => undefined },
    onEvent: { addListener: () => undefined },
  },
  tabs: {
    create: async () => ({ id: 1 }),
    get: async (tabId) => ({ active: true, discarded: false, id: tabId, status: "complete",
      url: "https://chatgpt.com/", title: "ChatGPT", windowId: 1 }),
    remove: async () => undefined,
    update: async (tabId) => ({ active: true, discarded: false, id: tabId, status: "complete",
      url: "https://chatgpt.com/", title: "ChatGPT", windowId: 1 }),
    onActivated: { addListener: () => undefined },
    onUpdated: { addListener: (listener) => { listeners.tabUpdated = listener; } },
  },
  alarms: {
    create: async (name, alarmInfo) => { createdAlarm = { name, periodInMinutes: alarmInfo.periodInMinutes }; },
    onAlarm: { addListener: (listener) => { listeners.alarm = listener; } },
  },
};

let resolveRead: (value: WorkbenchPairingState) => void = () => { throw new Error("pairing read was not started"); };
let reads = 0;
let pairs = 0;
const singleFlight = new PairingAutoBootstrap(
  chromeApi,
  { canAttemptAutomaticPairing: () => true, pair: async (value) => { assert.equal(value, secret); pairs += 1; } },
  currentBuild,
  () => {
    reads += 1;
    return new Promise<WorkbenchPairingState>((resolve) => { resolveRead = resolve; });
  },
);
const first = singleFlight.attempt();
const second = singleFlight.attempt();
assert.equal(first, second, "concurrent wake events must share one in-flight pairing attempt");
assert.equal(reads, 1);
resolveRead({ authority: "absent", pairingSecret: secret, releaseBuildId: currentBuild });
await first;
assert.equal(pairs, 1);

const staleBootstrap = new PairingAutoBootstrap(
  chromeApi,
  { canAttemptAutomaticPairing: () => true, pair: async () => { throw new Error("stale code must reload before pairing"); } },
  currentBuild,
  async () => ({ authority: "absent", pairingSecret: secret, releaseBuildId: nextBuild }),
);
await staleBootstrap.attempt();
assert.equal(reloads, 1, "a different exact AGENT build identity must trigger one extension reload");

let eventReads = 0;
const eventBootstrap = new PairingAutoBootstrap(
  chromeApi,
  { canAttemptAutomaticPairing: () => true, pair: async () => undefined },
  currentBuild,
  async () => { eventReads += 1; return { authority: "present", pairingSecret: null, releaseBuildId: currentBuild }; },
);
eventBootstrap.start();
await eventBootstrap.attempt();
assert.deepEqual(createdAlarm, { name: GRASSEYE_AUTO_PAIRING_ALARM, periodInMinutes: 1 });
assert.equal(eventReads, 1, "service-worker load must make one immediate attempt");

listeners.runtimeStartup?.();
await eventBootstrap.attempt();
assert.equal(eventReads, 2, "Chrome startup must wake automatic pairing");
listeners.tabUpdated?.(1, { status: "complete" }, { id: 1, url: "https://example.com/" });
await Promise.resolve();
assert.equal(eventReads, 2, "non-Workbench tabs must not wake pairing");
listeners.tabUpdated?.(2, { status: "complete" }, { id: 2, url: "http://127.0.0.1:4173/" });
await eventBootstrap.attempt();
assert.equal(eventReads, 3, "the exact Workbench tab must wake automatic pairing");
listeners.alarm?.({ name: "unrelated" });
await Promise.resolve();
assert.equal(eventReads, 3, "unrelated alarms must not wake pairing");
listeners.alarm?.({ name: GRASSEYE_AUTO_PAIRING_ALARM });
await eventBootstrap.attempt();
assert.equal(eventReads, 4, "the sole fallback alarm must wake automatic pairing");

const connectedBootstrap = new PairingAutoBootstrap(
  chromeApi,
  { canAttemptAutomaticPairing: () => false, pair: async () => { throw new Error("must not pair"); } },
  currentBuild,
  async () => { throw new Error("must not fetch"); },
);
await connectedBootstrap.attempt();

const rejectedBootstrap = new PairingAutoBootstrap(
  chromeApi,
  { canAttemptAutomaticPairing: () => true, pair: async () => { throw new Error("must not pair"); } },
  currentBuild,
  async () => { throw new Error("BROWSER_PAIRING_ORIGIN_REJECTED"); },
);
await rejectedBootstrap.attempt();
assert.equal(rejectedBootstrap.currentFailureCode(), "BROWSER_PAIRING_ORIGIN_REJECTED");

let createdTab: Readonly<{ active: false; url: string }> | null = null;
let debuggerEvent: Parameters<ExtensionChromeApi["debugger"]["onEvent"]["addListener"]>[0] | null = null;
let debuggerDetach: DebuggerDetachListener = () => { throw new Error("debugger detach listener was not installed"); };
let targetTabUpdated: TabUpdatedListener = () => { throw new Error("target tab listener was not installed"); };
let nextCreatedTabId = 3;
let getTargetsCalls = 0;
let debuggerTargets: readonly ExtensionDebugTarget[] = [];
let getTargetsFailure: Error | null = null;
let frameTreeFailureTabId: number | null = null;
let attachFailureTabId: number | null = null;
let evaluateRuntime: ((expression: string) => Promise<unknown>) | null = null;
let forkTransitionClick = false;
let basicPointerClick = false;
let switchBeforeProviderInput = false;
let switchAfterProviderInput = false;
let switchAwayAndBackTabReadCountdown = 0;
let navigateSerial = 0;
let activeTabId = 99;
let targetTabActivated: TabActivatedListener = () => { throw new Error("target activation listener was not installed"); };
const activatedTabs: number[] = [];
const discardedTabIds = new Set<number>();
const providerInputMethods: string[] = [];
const attachedTabs: number[] = [];
const detachedTabs: number[] = [];
const debuggerMethods: string[] = [];
const removedTabs: number[] = [];
const mainFrameUrlByTab = new Map<number, string>();
const mainFrameLoaderByTab = new Map<number, string>();
const targetFrames: Array<Readonly<{ kind: "TARGET_CLAIM" | "TARGET_REVOKE"; body: Record<string, unknown> }>> = [];
const targetFailures: Array<Readonly<Record<string, unknown>>> = [];
const targetFailureOrder: string[] = [];

const sendForkTransitionCommand = (
  method: string,
  parameters: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | null => {
  if (!forkTransitionClick && !basicPointerClick) return null;
  if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
  if (method === "DOM.resolveNode") return { object: { objectId: "candidate-root" } };
  if (method === "Runtime.callFunctionOn" && String(parameters?.functionDeclaration ?? "").includes("spec.output")) {
    if (switchBeforeProviderInput) {
      switchBeforeProviderInput = false;
      activeTabId = 99;
      targetTabActivated({ tabId: activeTabId, windowId: 1 });
    }
    return { result: { value: { x: 5, y: 5 } } };
  }
  if (method === "Runtime.callFunctionOn") return { result: { value: browserDomFacts() } };
  if (method === "Runtime.releaseObject") return {};
  if (method !== "Input.dispatchMouseEvent") return null;
  providerInputMethods.push(String(parameters?.type));
  if (switchAfterProviderInput) {
    switchAfterProviderInput = false;
    activeTabId = 99;
    targetTabActivated({ tabId: activeTabId, windowId: 1 });
  }
  if (basicPointerClick && !forkTransitionClick && parameters?.type === "mouseReleased") {
    mainFrameUrlByTab.set(3, "https://chatgpt.com/c/interaction-ready");
  }
  if (forkTransitionClick && parameters?.type === "mouseReleased") {
    mainFrameUrlByTab.set(4, "https://chatgpt.com/c/fork-child");
    debuggerTargets = [
      ...debuggerTargets.filter((candidate) => candidate.tabId !== 4),
      { attached: false, id: "debug-target-4", tabId: 4, title: "Fork child",
        type: "page", url: "https://chatgpt.com/c/fork-child" },
    ];
  }
  return {};
};

const sendTargetChromeCommand: ExtensionChromeApi["debugger"]["sendCommand"] = async (
  { tabId }, method, parameters,
) => {
  debuggerMethods.push(method);
  const forkResult = sendForkTransitionCommand(method, parameters);
  if (forkResult) return forkResult;
  if (method === "Runtime.evaluate" && evaluateRuntime) {
    return { result: { value: await evaluateRuntime(String(parameters?.expression)) } };
  }
  if (method === "Page.getNavigationHistory") {
    return { currentIndex: 0, entries: [{ id: 1,
      url: mainFrameUrlByTab.get(tabId) ?? "https://chatgpt.com/", title: "ChatGPT" }] };
  }
  if (method === "Page.getFrameTree" && tabId === frameTreeFailureTabId) {
    throw new Error("temporary frame tree read failure");
  }
  if (method === "Page.navigate" && typeof parameters?.url === "string") {
    mainFrameUrlByTab.set(tabId, parameters.url);
    debuggerTargets = debuggerTargets.map((candidate) => candidate.tabId === tabId
      ? { ...candidate, url: parameters.url as string } : candidate);
    navigateSerial += 1;
    const loaderId = `loader-${tabId}-navigate-${navigateSerial}`;
    mainFrameLoaderByTab.set(tabId, loaderId);
    return { loaderId };
  }
  return method === "Page.getFrameTree"
    ? { frameTree: { frame: { loaderId: mainFrameLoaderByTab.get(tabId) ?? `loader-${tabId}`,
      url: mainFrameUrlByTab.get(tabId) ?? "https://chatgpt.com/" } } }
    : {};
};

const targetChromeApi: ExtensionChromeApi = {
  runtime: chromeApi.runtime,
  debugger: {
    attach: async ({ tabId }) => {
      if (tabId === attachFailureTabId) throw new Error("another debugger owns the new task tab");
      attachedTabs.push(tabId);
    },
    detach: async ({ tabId }) => { detachedTabs.push(tabId); },
    getTargets: async () => {
      getTargetsCalls += 1;
      if (getTargetsFailure) throw getTargetsFailure;
      return debuggerTargets;
    },
    sendCommand: sendTargetChromeCommand,
    onDetach: { addListener: (listener) => { debuggerDetach = listener; } },
    onEvent: { addListener: (listener) => { debuggerEvent = listener; } },
  },
  tabs: {
    create: async (input) => {
      createdTab = input;
      return { id: nextCreatedTabId++ };
    },
    get: async (tabId) => {
      if (switchAwayAndBackTabReadCountdown > 0) {
        switchAwayAndBackTabReadCountdown -= 1;
        if (switchAwayAndBackTabReadCountdown === 0) {
          activeTabId = 99;
          targetTabActivated({ tabId: activeTabId, windowId: 1 });
          activeTabId = tabId;
          targetTabActivated({ tabId: activeTabId, windowId: 1 });
        }
      }
      return { active: tabId === activeTabId, discarded: discardedTabIds.has(tabId), id: tabId, status: "complete",
        url: mainFrameUrlByTab.get(tabId) ?? "https://chatgpt.com/", title: "ChatGPT", windowId: 1 };
    },
    remove: async (tabId) => {
      removedTabs.push(tabId);
      debuggerTargets = debuggerTargets.filter((candidate) => candidate.tabId !== tabId);
    },
    update: async (tabId) => {
      activatedTabs.push(tabId);
      activeTabId = tabId;
      targetTabActivated({ tabId, windowId: 1 });
      return { active: true, discarded: false, id: tabId, status: "complete",
        url: mainFrameUrlByTab.get(tabId) ?? "https://chatgpt.com/", title: "ChatGPT", windowId: 1 };
    },
    onActivated: { addListener: (listener) => { targetTabActivated = listener; } },
    onUpdated: { addListener: (listener) => { targetTabUpdated = listener; } },
    onRemoved: { addListener: () => undefined },
  },
  alarms: chromeApi.alarms,
};


for (const stage of ["child-attach", "child-frame", "claim", "source-detach", "source-remove"] as const) {
  await exerciseForkFailureChildSurvival(stage);
}
const targetAuthority = new ExtensionTargetAuthority(
  targetChromeApi,
  async (kind, body) => { targetFrames.push({ kind, body }); if (kind === "TARGET_REVOKE") targetFailureOrder.push(kind); },
  (failure) => { targetFailures.push(failure); targetFailureOrder.push("DIAGNOSTIC"); },
);
targetAuthority.start();
const firstAcquisition = targetAuthority.acquireJobBoundChatGptTarget();
await Promise.resolve();
assert.deepEqual(attachedTabs, [], "the task-owned tab must not attach before Chrome reports page completion");
targetTabUpdated(3, { status: "complete" }, { id: 3, url: "https://chatgpt.com/", title: "ChatGPT" });
await firstAcquisition;
assert.deepEqual(attachedTabs, [3]);
assert.equal(getTargetsCalls, 0, "job acquisition must not enumerate or reuse operator ChatGPT tabs");
assert.deepEqual(createdTab, { active: false, url: "https://chatgpt.com/" });
assert.equal(targetFrames[0]?.kind, "TARGET_CLAIM");
assert.deepEqual(Object.keys(targetFrames[0]?.body ?? {}).sort(),
  ["claimOrigin", "documentRef", "navigationEpoch", "targetRef"],
  "the Target claim wire must not contain a full page URL");
assert.equal(targetFrames[0]?.body.claimOrigin, "https://chatgpt.com");
const firstTargetRef = String(targetFrames[0]?.body.targetRef);
const firstDocumentRef = String(targetFrames[0]?.body.documentRef);
await exerciseAuthenticatedMedia({
  authority: targetAuthority,
  targetRef: firstTargetRef,
  documentRef: firstDocumentRef,
  setRuntime: (runtime) => { evaluateRuntime = runtime; },
});
assert.deepEqual(activatedTabs, [], "authenticated-media probe must not activate the production Tab");
const interactionTarget = targetAuthority.resolve(firstTargetRef, firstDocumentRef);
const simpleClick = {
  kind: "dom-intent" as const,
  intent: {
    kind: "click" as const,
    selector: "button[data-testid='interaction-ready']",
    expectedMatches: 1,
    postClickUrl: { equals: "https://chatgpt.com/c/interaction-ready" },
  },
};
basicPointerClick = true;
const firstInteractiveReceipt = await targetAuthority.executeRegisteredCommand(
  simpleClick, interactionTarget, "mutation",
) as Readonly<Record<string, unknown>>;
assert.equal(firstInteractiveReceipt.postconditionVerified, true);
assert.deepEqual(activatedTabs, [3], "the first inactive mutation must activate only the exact system Tab once");
await targetAuthority.executeRegisteredCommand(simpleClick, interactionTarget, "mutation");
assert.deepEqual(activatedTabs, [3], "an already-active system Tab must not call tabs.update again");

const providerInputsBeforeQualificationSwitch = providerInputMethods.length;
mainFrameUrlByTab.set(3, "https://chatgpt.com/");
switchAwayAndBackTabReadCountdown = 2;
const switchedAwayAndBackDuringQualification = await targetAuthority.executeRegisteredCommand(
  simpleClick, interactionTarget, "mutation",
) as Readonly<Record<string, unknown>>;
assert.equal(switchedAwayAndBackDuringQualification.failureCode, "BROWSER_TARGET_NOT_INTERACTIVE");
assert.equal(switchedAwayAndBackDuringQualification.mutationCount, 0);
assert.equal(providerInputMethods.length, providerInputsBeforeQualificationSwitch,
  "a user switch away and back during qualification must permanently invalidate that interaction lease");

const providerInputsBeforeSwitch = providerInputMethods.length;
mainFrameUrlByTab.set(3, "https://chatgpt.com/");
switchBeforeProviderInput = true;
const switchedBeforeInput = await targetAuthority.executeRegisteredCommand(
  simpleClick, interactionTarget, "mutation",
) as Readonly<Record<string, unknown>>;
assert.equal(switchedBeforeInput.failureCode, "BROWSER_TARGET_NOT_INTERACTIVE");
assert.equal(switchedBeforeInput.mutationCount, 0);
assert.equal(providerInputMethods.length, providerInputsBeforeSwitch,
  "a user tab switch before Provider input must produce zero physical input");

activeTabId = 3;
targetTabActivated({ tabId: 3, windowId: 1 });
mainFrameUrlByTab.set(3, "https://chatgpt.com/");
switchAfterProviderInput = true;
const providerInputsBeforeLateSwitch = providerInputMethods.length;
await assert.rejects(
  targetAuthority.executeRegisteredCommand(simpleClick, interactionTarget, "mutation"),
  /BROWSER_TARGET_NOT_INTERACTIVE/u,
  "a user tab switch after Provider input starts must preserve an uncertain dispatched result",
);
assert.equal(providerInputMethods.length, providerInputsBeforeLateSwitch + 1,
  "a post-input tab switch must not replay or finish the remaining pointer sequence");

activeTabId = 3;
targetTabActivated({ tabId: 3, windowId: 1 });
discardedTabIds.add(3);
const discardedReceipt = await targetAuthority.executeRegisteredCommand(
  simpleClick, interactionTarget, "mutation",
) as Readonly<Record<string, unknown>>;
discardedTabIds.delete(3);
assert.equal(discardedReceipt.failureCode, "BROWSER_TARGET_NOT_INTERACTIVE");
assert.equal(discardedReceipt.mutationCount, 0, "a discarded system Tab must fail before physical input");
basicPointerClick = false;
await targetAuthority.parkActiveTarget();
assert.equal(targetFrames.at(-1)?.kind, "TARGET_REVOKE");
assert.deepEqual(detachedTabs, [], "logical park must keep the one debugger session alive across local restarts");
await targetAuthority.acquireJobBoundChatGptTarget(firstTargetRef);
assert.deepEqual(attachedTabs, [3],
  "same-job recovery must retain the extension-owned debugger session on the exact production Tab");
assert.equal(nextCreatedTabId, 4);
assert.equal(targetFrames.at(-1)?.body.targetRef, firstTargetRef);
assert.equal(debuggerMethods.filter((method) => method === "Page.bringToFront").length, 0,
  "initial claim and exact reacquire must never foreground the single production Tab");
await targetAuthority.releaseActiveTarget(false);
assert.deepEqual(detachedTabs, [], "socket suspension must preserve the one production debugger session");

debuggerTargets = [{
  attached: true,
  id: "debug-target-3",
  tabId: 3,
  title: "ChatGPT",
  type: "page",
  url: "https://chatgpt.com/c/exact-recovery",
}];
mainFrameUrlByTab.set(3, "https://chatgpt.com/c/exact-recovery");
const recoveredFrames: typeof targetFrames = [];
const rebuiltAuthority = new ExtensionTargetAuthority(
  targetChromeApi,
  async (kind, body) => { recoveredFrames.push({ kind, body }); },
  () => undefined,
);
await rebuiltAuthority.acquireJobBoundChatGptTarget(firstTargetRef);
assert.equal(getTargetsCalls, 1, "a rebuilt MV3 actor must inspect debugger ownership once for the exact prior tabId");
assert.deepEqual(attachedTabs, [3], "a rebuilt MV3 actor must adopt the still-attached exact Target without reattaching");
assert.equal(recoveredFrames.at(-1)?.body.targetRef, firstTargetRef,
  "a rebuilt MV3 actor must restore the same deterministic targetRef");
assert.notEqual(recoveredFrames.at(-1)?.body.documentRef, targetFrames[0]?.body.documentRef,
  "a rebuilt MV3 actor must publish the current page as a new Document");
assert.equal(debuggerMethods.filter((method) => method === "Page.bringToFront").length, 0,
  "MV3 recovery must not foreground the exact Target");
await rebuiltAuthority.releaseActiveTarget(false);
mainFrameUrlByTab.delete(3);

const discoveryFailureAuthority = new ExtensionTargetAuthority(
  targetChromeApi, async () => undefined, () => undefined,
);
getTargetsFailure = new Error("temporary target discovery failure");
await assert.rejects(
  discoveryFailureAuthority.acquireJobBoundChatGptTarget(firstTargetRef),
  /BROWSER_TARGET_DISCOVERY_UNAVAILABLE/u,
  "a transient getTargets failure must not be promoted to physical Target loss",
);
getTargetsFailure = null;
assert.equal(nextCreatedTabId, 4, "target discovery failure must not create a replacement tab");

const frameFailureAuthority = new ExtensionTargetAuthority(
  targetChromeApi, async () => undefined, () => undefined,
);
frameTreeFailureTabId = 3;
await assert.rejects(
  frameFailureAuthority.acquireJobBoundChatGptTarget(firstTargetRef),
  /BROWSER_EXACT_TARGET_UNAVAILABLE/u,
  "a transient frame read failure must preserve exact-target unavailability without physical-loss authority",
);
frameTreeFailureTabId = null;
assert.equal(nextCreatedTabId, 4, "frame read failure must not create a replacement tab");
await frameFailureAuthority.acquireJobBoundChatGptTarget(firstTargetRef);
await frameFailureAuthority.releaseActiveTarget(false);

const originFailureAuthority = new ExtensionTargetAuthority(
  targetChromeApi, async () => undefined, () => undefined,
);
mainFrameUrlByTab.set(3, "https://example.com/");
await assert.rejects(
  originFailureAuthority.acquireJobBoundChatGptTarget(firstTargetRef),
  /BROWSER_ORIGIN_REJECTED/u,
  "an origin mismatch must remain an origin failure and must never authorize Target replacement",
);
mainFrameUrlByTab.set(3, "https://chatgpt.com/c/exact-recovery");
assert.equal(nextCreatedTabId, 4, "origin failure must not create a replacement tab");

debuggerTargets = [];
const physicallyAbsentAuthority = new ExtensionTargetAuthority(
  targetChromeApi, async () => undefined, () => undefined,
);
await assert.rejects(
  physicallyAbsentAuthority.acquireJobBoundChatGptTarget(firstTargetRef),
  /BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT/u,
  "only a successful target enumeration with zero exact tab candidates proves physical absence",
);
assert.equal(nextCreatedTabId, 4, "physical absence proof itself must not create a replacement tab");
debuggerTargets = [{
  attached: true, id: "debug-target-3", tabId: 3, title: "ChatGPT", type: "page",
  url: "https://chatgpt.com/c/exact-recovery",
}];

await exerciseLocalBrowserDomIntent();

const navigateBeforeFreshReuse = debuggerMethods.filter((method) => method === "Page.navigate").length;
const secondAcquisition = targetAuthority.acquireJobBoundChatGptTarget();
await Promise.resolve();
await secondAcquisition;
assert.equal(debuggerMethods.filter((method) => method === "Page.navigate").length, navigateBeforeFreshReuse + 1,
  "a fresh job must navigate the fixed root even when the parked target is already on that URL");
assert.equal(attachedTabs.at(-1), 3, "every turn must reuse the one visible production tab");
assert.equal(nextCreatedTabId, 4, "single-Tab reuse must not create a second physical page");
assert.equal(targetFrames.at(-1)?.body.targetRef, firstTargetRef,
  "single-Tab reuse must preserve physical target identity");
assert.notEqual(targetFrames.at(-1)?.body.documentRef, firstDocumentRef,
  "a fresh job must publish a new Document instead of inheriting residual composer attachments");
assert.equal(targetFrames.at(-1)?.body.claimOrigin, "https://chatgpt.com",
  "the debugger-owned main frame may publish only the exact admitted origin");
const beforeForkClaim = targetFrames.at(-1)!;
const beforeForkNavigateCount = debuggerMethods.filter((method) => method === "Page.navigate").length;
forkTransitionClick = true;
const forkTarget = targetAuthority.resolve(
  String(beforeForkClaim.body.targetRef), String(beforeForkClaim.body.documentRef),
);
const forkReceipt = await targetAuthority.executeRegisteredCommand({
  kind: "dom-intent",
  intent: {
    kind: "click", selector: "[role='menuitem'][tabindex='0']", expectedTextEquals: "分支到新聊天",
    expectedMatches: 1,
    postClickTargetTransition: {
      kind: "gpt-fork-successor",
      sourceCheckpoint: {
        assistantTurnId: "conversation-turn-2",
        canonicalConversationUrl: "https://chatgpt.com/c/exact-recovery",
        promptHash: `sha256:${"6".repeat(64)}`,
        responseHash: `sha256:${"7".repeat(64)}`,
        turnMarker: "[GRASSEYE:fork]",
      },
      timeoutMs: 5_000,
    },
  },
}, forkTarget, "mutation") as Readonly<Record<string, unknown>>;
forkTransitionClick = false;
assert.equal(forkReceipt.postconditionVerified, true);
assert.equal(debuggerMethods.filter((method) => method === "Page.navigate").length,
  beforeForkNavigateCount, "fork takeover must not navigate the source production tab");
assert.ok((attachedTabs as readonly number[]).includes(4)
  && !(detachedTabs as readonly number[]).includes(4)
  && !(removedTabs as readonly number[]).includes(4),
  "the verified fork child must remain attached as the one production page");
assert.ok((detachedTabs as readonly number[]).includes(3)
  && (removedTabs as readonly number[]).includes(3),
  "the superseded source page must be detached and removed");
assert.equal(targetFrames.at(-1)?.body.targetRef, beforeForkClaim.body.targetRef,
  "fork normalization must retain the original targetRef");
assert.equal(Number(targetFrames.at(-1)?.body.navigationEpoch), Number(beforeForkClaim.body.navigationEpoch) + 1,
  "fork normalization must publish exactly one successor Document");
assert.deepEqual(debuggerTargets.map((candidate) => candidate.tabId), [4],
  "fork normalization must retain only the successor production tab before replying");
targetFailureOrder.length = 0;
debuggerDetach({ tabId: 4 }, "target_closed");
await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));
assert.deepEqual(targetFailureOrder, ["DIAGNOSTIC", "TARGET_REVOKE"]);
assert.deepEqual(targetFailures.at(-1), {
  targetRef: firstTargetRef, runtimeEventType: "debugger-detach",
  reasonCode: "BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT",
  nativeCauseCode: "CHROME_DEBUGGER_TARGET_CLOSED",
});
const replacementAcquisition = targetAuthority.acquireJobBoundChatGptTarget();
await Promise.resolve();
targetTabUpdated(4, { status: "complete" }, { id: 4, url: "https://chatgpt.com/", title: "ChatGPT" });
await replacementAcquisition;
assert.equal(targetFrames.at(-1)?.body.targetRef, "target-tab-4",
  "after authoritative physical loss, the existing acquisition path must create one replacement Target");
assert.deepEqual(createdTab, { active: false, url: "https://chatgpt.com/" },
  "replacement acquisition must remain inactive and must not touch an operator tab");
assert.equal(nextCreatedTabId, 5, "physical loss must create exactly one replacement production Tab");
debuggerDetach({ tabId: 4 }, "canceled_by_user");
await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));
assert.deepEqual(targetFailures.at(-1), {
  targetRef: "target-tab-4", runtimeEventType: "debugger-detach",
  reasonCode: "BROWSER_DEVTOOLS_CONFLICT",
  nativeCauseCode: "CHROME_DEBUGGER_CANCELED_BY_USER",
});

const rejectedOrigin = targetAuthority.acquireJobBoundChatGptTarget();
await Promise.resolve();
mainFrameUrlByTab.set(5, "https://example.com/");
targetTabUpdated(5, { status: "complete" }, { id: 5, url: "https://example.com/", title: "Wrong Origin" });
await assert.rejects(rejectedOrigin, /BROWSER_ORIGIN_REJECTED/u);
assert.equal(Number(attachedTabs.at(-1)), 5, "origin verification may attach only to the exact tab just created for this job");
assert.ok(removedTabs.includes(5), "a rejected task-owned page must be removed");

attachFailureTabId = 6;
const debuggerConflict = targetAuthority.acquireJobBoundChatGptTarget();
await Promise.resolve();
targetTabUpdated(6, { status: "complete" }, { id: 6, url: "https://chatgpt.com/", title: "ChatGPT" });
await assert.rejects(debuggerConflict, /BROWSER_DEVTOOLS_CONFLICT/u,
  "debugger conflict on the new task-owned tab must fail without touching another page");
assert.ok(removedTabs.includes(6), "a conflicted task-owned page must be removed");
attachFailureTabId = null;
assert.ok(debuggerEvent, "the exact target owner must observe main-frame navigation");

const issuer = new BrowserAuthorityIssuer();
Reflect.set(issuer, "slot", { kind: "PRESENT", authority: { authorityEpoch: 7, authorityRef: "authority-7" } });
const broker = new BrowserAuthorityBroker(
  issuer,
  () => undefined,
  () => { throw new Error("target lease factory is outside this claim-only acceptance"); },
);
const initialClaim = {
  authorityEpoch: 7, targetRef: "target-1", documentRef: "document-1", navigationEpoch: 0,
  claimOrigin: "https://chatgpt.com",
} as const;
broker.registerOperatorTargetClaim(initialClaim);
broker.registerOperatorTargetClaim({ ...initialClaim, documentRef: "document-2", navigationEpoch: 1 });
assert.throws(() => broker.registerOperatorTargetClaim({ ...initialClaim, targetRef: "target-2" }), /BROWSER_TARGET_INVALID/u,
  "an authenticated connection must not replace its claimed target without revoke");
assert.throws(() => broker.registerOperatorTargetClaim({ ...initialClaim, documentRef: "document-4", navigationEpoch: 3 }), /BROWSER_TARGET_INVALID/u,
  "Document claims must advance by exactly one navigation epoch");

process.stdout.write("LOCAL_BROWSER_AUTO_PAIRING_AND_EXACT_CHATGPT_CLAIM_ACCEPTANCE_PASS\n");
emitLocalBrowserAutoPairingProofs();
