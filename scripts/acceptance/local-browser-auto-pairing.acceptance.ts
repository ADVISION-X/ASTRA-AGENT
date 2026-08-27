import assert from "node:assert/strict";

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
import type { ExtensionChromeApi } from "../../src/lib/browser/chrome-extension/extension-runtime-types.js";
import { GPT_WEB_START_URL, requireGptWebPolicyForUrl } from "../../src/lib/browser/exact-target/browser-site-policy-registry.js";
import { BrowserAuthorityBroker } from "../../src/lib/browser/infrastructure/browser-authority-broker.js";
import { BrowserAuthorityIssuer } from "../../src/lib/browser/infrastructure/browser-authority-issuer.js";

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

type DebugTarget = Awaited<ReturnType<ExtensionChromeApi["debugger"]["getTargets"]>>[number];
let debugTargets: DebugTarget[] = [{
  attached: false, id: "debug-target-1", tabId: 1, title: "ChatGPT", type: "page", url: "https://chatgpt.com/",
}];
let createdTab: Readonly<{ active: false; url: string }> | null = null;
let debuggerEvent: Parameters<ExtensionChromeApi["debugger"]["onEvent"]["addListener"]>[0] | null = null;
const attachedTabs: number[] = [];
const targetFrames: Array<Readonly<{ kind: "TARGET_CLAIM" | "TARGET_REVOKE"; body: Record<string, unknown> }>> = [];
const targetChromeApi: ExtensionChromeApi = {
  runtime: chromeApi.runtime,
  debugger: {
    attach: async ({ tabId }) => { attachedTabs.push(tabId); },
    detach: async () => undefined,
    getTargets: async () => debugTargets,
    sendCommand: async ({ tabId }, method) => method === "Page.getFrameTree"
      ? { frameTree: { frame: { loaderId: `loader-${tabId}`, url: "https://chatgpt.com/" } } }
      : {},
    onDetach: { addListener: () => undefined },
    onEvent: { addListener: (listener) => { debuggerEvent = listener; } },
  },
  tabs: {
    create: async (input) => {
      createdTab = input;
      debugTargets = [{ attached: false, id: "debug-target-3", tabId: 3, title: "ChatGPT", type: "page", url: input.url }];
      return { id: 3 };
    },
    onUpdated: { addListener: () => undefined },
  },
  alarms: chromeApi.alarms,
};
const targetAuthority = new ExtensionTargetAuthority(
  targetChromeApi,
  async (kind, body) => { targetFrames.push({ kind, body }); },
  () => undefined,
);
targetAuthority.start();
await targetAuthority.acquireJobBoundChatGptTarget();
assert.deepEqual(attachedTabs, [1]);
assert.equal(targetFrames[0]?.kind, "TARGET_CLAIM");
assert.equal(targetFrames[0]?.body.url, "https://chatgpt.com/");
await targetAuthority.releaseActiveTarget(false);

debugTargets = [
  { attached: false, id: "debug-target-1", tabId: 1, title: "ChatGPT", type: "page", url: "https://chatgpt.com/" },
  { attached: false, id: "debug-target-2", tabId: 2, title: "ChatGPT", type: "page", url: "https://chatgpt.com/c/second" },
];
await assert.rejects(targetAuthority.acquireJobBoundChatGptTarget(), /BROWSER_TARGET_INVALID/u,
  "multiple exact ChatGPT targets must fail closed without guessing");

debugTargets = [{ attached: true, id: "debug-target-1", tabId: 1, title: "ChatGPT", type: "page", url: "https://chatgpt.com/" }];
await assert.rejects(targetAuthority.acquireJobBoundChatGptTarget(), /BROWSER_DEVTOOLS_CONFLICT/u,
  "an already attached exact target must not be stolen");

debugTargets = [];
await targetAuthority.acquireJobBoundChatGptTarget();
assert.deepEqual(createdTab, { active: false, url: "https://chatgpt.com/" },
  "zero exact targets must create one inactive fixed ChatGPT start URL");
assert.equal(attachedTabs.at(-1), 3);
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
