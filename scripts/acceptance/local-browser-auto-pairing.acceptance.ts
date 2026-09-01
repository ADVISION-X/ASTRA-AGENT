import assert from "../audit/shared/governance-exam-assert.js";

import {
  GRASSEYE_AUTO_PAIRING_ALARM,
  GRASSEYE_PAIRING_URL,
  GRASSEYE_TOOL_EXTENSION_ID,
  GRASSEYE_TOOL_EXTENSION_ID_HEADER,
  PairingAutoBootstrap,
  readWorkbenchPairingState,
  type WorkbenchPairingState,
} from "../../src/lib/browser/chrome-extension/pairing-auto-bootstrap.js";
import { ExtensionTargetAuthority } from "../../src/lib/browser/chrome-extension/extension-target-authority.js";
import type { ExtensionChromeApi, ExtensionDebugTarget } from "../../src/lib/browser/chrome-extension/extension-runtime-types.js";
import { GPT_WEB_START_URL, requireGptWebPolicyForUrl } from "../../src/lib/browser/exact-target/browser-site-policy-registry.js";
import { BrowserAuthorityBroker } from "../../src/lib/browser/infrastructure/browser-authority-broker.js";
import { BrowserAuthorityIssuer } from "../../src/lib/browser/infrastructure/browser-authority-issuer.js";
import { exerciseAuthenticatedMedia } from "./local-browser-authenticated-media-support.js";
import { exerciseLocalBrowserDomIntent } from "./local-browser-dom-intent-support.js";
import { emitLocalBrowserAutoPairingProofs } from "./local-browser-proof-support.js";

const secret = "a".repeat(64);
const currentBuild = "build-00000000-0000-4000-8000-000000000001";
const nextBuild = "build-00000000-0000-4000-8000-000000000002";

assert.equal(GPT_WEB_START_URL, "https://chatgpt.com/");
assert.equal(requireGptWebPolicyForUrl("https://chatgpt.com/c/exact").siteId, "gpt-web");
for (const rejectedUrl of ["https://www.amazon.com/", "https://evil.chatgpt.com/", "http://chatgpt.com/"]) {
  assert.throws(() => requireGptWebPolicyForUrl(rejectedUrl), /BROWSER_ORIGIN_REJECTED/u,
    `job-bound target policy must reject ${rejectedUrl}`);
}

let observedInput = "";
let observedInit: RequestInit | undefined;
const state = await readWorkbenchPairingState((async (input: string | URL | Request, init?: RequestInit) => {
  observedInput = String(input);
  observedInit = init;
  return new Response(JSON.stringify({ authority: "absent", pairingSecret: secret, releaseBuildId: currentBuild }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}) as typeof globalThis.fetch);
assert.deepEqual(state, { authority: "absent", pairingSecret: secret, releaseBuildId: currentBuild });
assert.equal(observedInput, GRASSEYE_PAIRING_URL);
assert.deepEqual(observedInit, {
  method: "GET",
  cache: "no-store",
  credentials: "omit",
  headers: { [GRASSEYE_TOOL_EXTENSION_ID_HEADER]: GRASSEYE_TOOL_EXTENSION_ID },
  redirect: "error",
  referrerPolicy: "no-referrer",
});

await assert.rejects(
  readWorkbenchPairingState((async () => new Response(JSON.stringify({ authority: "absent", pairingSecret: "invalid", releaseBuildId: currentBuild }), { status: 200 })) as typeof globalThis.fetch),
  /BROWSER_PAIRING_RESPONSE_INVALID/u,
);
await assert.rejects(
  readWorkbenchPairingState((async () => new Response(JSON.stringify({ authority: "absent", pairingSecret: secret, releaseBuildId: "invalid" }), { status: 200 })) as typeof globalThis.fetch),
  /BROWSER_PAIRING_RESPONSE_INVALID/u,
);
await assert.rejects(
  readWorkbenchPairingState((async () => new Response("{}", { status: 403 })) as typeof globalThis.fetch),
  /BROWSER_PAIRING_ORIGIN_REJECTED/u,
);

type RuntimeStartupListener = () => void;
type TabUpdatedListener = Parameters<ExtensionChromeApi["tabs"]["onUpdated"]["addListener"]>[0];
type TabRemovedListener = NonNullable<ExtensionChromeApi["tabs"]["onRemoved"]>["addListener"] extends (
  listener: infer T,
) => void ? T : never;
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
    remove: async () => undefined,
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
let targetTabUpdated: TabUpdatedListener = () => { throw new Error("target tab listener was not installed"); };
let targetTabRemoved: TabRemovedListener = () => { throw new Error("target tab removal listener was not installed"); };
let nextCreatedTabId = 3;
let getTargetsCalls = 0;
let debuggerTargets: readonly ExtensionDebugTarget[] = [];
let getTargetsFailure: Error | null = null;
let frameTreeFailureTabId: number | null = null;
let attachFailureTabId: number | null = null;
let evaluateRuntime: ((expression: string) => Promise<unknown>) | null = null;
const attachedTabs: number[] = [];
const detachedTabs: number[] = [];
const debuggerMethods: string[] = [];
const removedTabs: number[] = [];
const mainFrameUrlByTab = new Map<number, string>();
const targetFrames: Array<Readonly<{ kind: "TARGET_CLAIM" | "TARGET_REVOKE"; body: Record<string, unknown> }>> = [];
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
    sendCommand: async ({ tabId }, method, parameters) => {
      debuggerMethods.push(method);
      if (method === "Runtime.evaluate" && evaluateRuntime) {
        return { result: { value: await evaluateRuntime(String(parameters?.expression)) } };
      }
      if (method === "Page.getFrameTree" && tabId === frameTreeFailureTabId) {
        throw new Error("temporary frame tree read failure");
      }
      if (method === "Page.navigate" && typeof parameters?.url === "string") {
        mainFrameUrlByTab.set(tabId, parameters.url);
        return { loaderId: `loader-${tabId}-navigate` };
      }
      return method === "Page.getFrameTree"
        ? { frameTree: { frame: { loaderId: `loader-${tabId}`, url: mainFrameUrlByTab.get(tabId) ?? "https://chatgpt.com/" } } }
        : {};
    },
    onDetach: { addListener: () => undefined },
    onEvent: { addListener: (listener) => { debuggerEvent = listener; } },
  },
  tabs: {
    create: async (input) => {
      createdTab = input;
      return { id: nextCreatedTabId++ };
    },
    remove: async (tabId) => { removedTabs.push(tabId); },
    onUpdated: { addListener: (listener) => { targetTabUpdated = listener; } },
    onRemoved: { addListener: (listener) => { targetTabRemoved = listener; } },
  },
  alarms: chromeApi.alarms,
};
const targetAuthority = new ExtensionTargetAuthority(
  targetChromeApi,
  async (kind, body) => { targetFrames.push({ kind, body }); },
  () => undefined,
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
assert.equal(targetFrames[0]?.body.url, "https://chatgpt.com/");
const firstTargetRef = String(targetFrames[0]?.body.targetRef);
const firstDocumentRef = String(targetFrames[0]?.body.documentRef);
await exerciseAuthenticatedMedia({
  authority: targetAuthority,
  targetRef: firstTargetRef,
  documentRef: firstDocumentRef,
  setRuntime: (runtime) => { evaluateRuntime = runtime; },
});
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

const secondAcquisition = targetAuthority.acquireJobBoundChatGptTarget();
await Promise.resolve();
await secondAcquisition;
assert.equal(attachedTabs.at(-1), 3, "every turn must reuse the one visible production tab");
assert.equal(nextCreatedTabId, 4, "single-Tab reuse must not create a second physical page");
assert.equal(targetFrames.at(-1)?.body.targetRef, firstTargetRef,
  "single-Tab reuse must preserve physical target identity");
assert.equal(targetFrames.at(-1)?.body.url, "https://chatgpt.com/",
  "the debugger-owned main frame must prove the exact origin when Chrome redacts tab.url without tabs permission");
await targetAuthority.releaseActiveTarget();
targetTabRemoved(3);
const replacementAcquisition = targetAuthority.acquireJobBoundChatGptTarget();
await Promise.resolve();
targetTabUpdated(4, { status: "complete" }, { id: 4, url: "https://chatgpt.com/", title: "ChatGPT" });
await replacementAcquisition;
assert.equal(targetFrames.at(-1)?.body.targetRef, "target-tab-4",
  "after authoritative physical loss, the existing acquisition path must create one replacement Target");
assert.deepEqual(createdTab, { active: false, url: "https://chatgpt.com/" },
  "replacement acquisition must remain inactive and must not touch an operator tab");
assert.equal(nextCreatedTabId, 5, "physical loss must create exactly one replacement production Tab");
await targetAuthority.releaseActiveTarget();
targetTabRemoved(4);

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
Reflect.set(issuer, "slot", { kind: "PRESENT", authority: { authorityEpoch: 7 } });
const broker = new BrowserAuthorityBroker(
  issuer,
  () => undefined,
  () => { throw new Error("target lease factory is outside this claim-only acceptance"); },
  {
    registerArtifact: async () => undefined,
    resolveArtifact: async () => { throw new Error("artifact resolution is outside this claim-only acceptance"); },
  },
);
const initialClaim = {
  authorityEpoch: 7, targetRef: "target-1", documentRef: "document-1", navigationEpoch: 0,
  url: "https://chatgpt.com/", title: "ChatGPT",
};
broker.registerOperatorTargetClaim(initialClaim);
broker.registerOperatorTargetClaim({ ...initialClaim, documentRef: "document-2", navigationEpoch: 1 });
assert.throws(() => broker.registerOperatorTargetClaim({ ...initialClaim, targetRef: "target-2" }), /BROWSER_TARGET_INVALID/u,
  "an authenticated connection must not replace its claimed target without revoke");
assert.throws(() => broker.registerOperatorTargetClaim({ ...initialClaim, documentRef: "document-4", navigationEpoch: 3 }), /BROWSER_TARGET_INVALID/u,
  "Document claims must advance by exactly one navigation epoch");

process.stdout.write("LOCAL_BROWSER_AUTO_PAIRING_AND_EXACT_CHATGPT_CLAIM_ACCEPTANCE_PASS\n");
emitLocalBrowserAutoPairingProofs();
