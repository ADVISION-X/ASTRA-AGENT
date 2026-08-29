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
import { executeRegisteredDomIntent } from "../../src/lib/browser/chrome-extension/dom-intent-runtime.js";
import type { ExtensionDebuggerRuntime } from "../../src/lib/browser/chrome-extension/debugger-runtime.js";
import type { ExtensionChromeApi } from "../../src/lib/browser/chrome-extension/extension-runtime-types.js";
import { GPT_WEB_START_URL, requireGptWebPolicyForUrl } from "../../src/lib/browser/exact-target/browser-site-policy-registry.js";
import { BrowserAuthorityBroker } from "../../src/lib/browser/infrastructure/browser-authority-broker.js";
import { BrowserAuthorityIssuer } from "../../src/lib/browser/infrastructure/browser-authority-issuer.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

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
let nextCreatedTabId = 3;
let getTargetsCalls = 0;
let attachFailureTabId: number | null = null;
const attachedTabs: number[] = [];
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
    detach: async () => undefined,
    getTargets: async () => { getTargetsCalls += 1; return []; },
    sendCommand: async ({ tabId }, method) => method === "Page.getFrameTree"
      ? { frameTree: { frame: { loaderId: `loader-${tabId}`, url: mainFrameUrlByTab.get(tabId) ?? "https://chatgpt.com/" } } }
      : {},
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
await targetAuthority.parkActiveTarget();
assert.equal(targetFrames.at(-1)?.kind, "TARGET_REVOKE");
await targetAuthority.acquireJobBoundChatGptTarget(firstTargetRef);
assert.deepEqual(attachedTabs, [3, 3],
  "same-job recovery must reattach the exact parked Target without creating or guessing another tab");
assert.equal(nextCreatedTabId, 4);
assert.equal(targetFrames.at(-1)?.body.targetRef, firstTargetRef);
await targetAuthority.releaseActiveTarget(false);

let delayedComposerQueries = 0;
const delayedComposerRuntime = {
  async send(_tabId: number, method: string) {
    if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
    if (method === "DOM.querySelectorAll") {
      delayedComposerQueries += 1;
      return { nodeIds: delayedComposerQueries < 3 ? [] : [7] };
    }
    if (method === "DOM.getBoxModel") return { model: { content: [0, 0, 10, 0, 10, 10, 0, 10] } };
    throw new Error(`UNEXPECTED_DELAYED_COMPOSER_METHOD:${method}`);
  },
} as ExtensionDebuggerRuntime;
const delayedComposer = await executeRegisteredDomIntent(
  delayedComposerRuntime,
  { tabId: 99 } as never,
  { kind: "find", selector: "#prompt-textarea", maxMatches: 2, waitFor: { minimumMatches: 1, timeoutMs: 500 } },
) as Readonly<{ count: number }>;
assert.equal(delayedComposer.count, 1, "one bounded find command must observe a composer that appears after ChatGPT hydration");
assert.equal(delayedComposerQueries, 3, "bounded readiness must stop immediately after its predicate is satisfied");

const missingComposerRuntime = {
  async send(_tabId: number, method: string) {
    if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
    if (method === "DOM.querySelectorAll") return { nodeIds: [] };
    throw new Error(`UNEXPECTED_MISSING_COMPOSER_METHOD:${method}`);
  },
} as ExtensionDebuggerRuntime;
const missingComposer = await executeRegisteredDomIntent(
  missingComposerRuntime,
  { tabId: 100 } as never,
  { kind: "find", selector: "#prompt-textarea", maxMatches: 2, waitFor: { minimumMatches: 1, timeoutMs: 1 } },
) as Readonly<{ count: number }>;
assert.equal(missingComposer.count, 0, "bounded readiness timeout must preserve a zero-candidate fail-closed result");

let lateTextDescribeCalls = 0;
const lateTextRuntime = {
  async send(_tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>) {
    if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
    if (method === "DOM.querySelectorAll") return { nodeIds: Array.from({ length: 25 }, (_, index) => index + 2) };
    if (method === "DOM.describeNode") {
      lateTextDescribeCalls += 1;
      const nodeId = Number(parameters?.nodeId);
      return { node: {
        nodeId,
        backendNodeId: nodeId + 100,
        nodeName: "BUTTON",
        attributes: [],
        children: [{ nodeValue: nodeId === 26 ? "GPT-5.6" : `unrelated-${nodeId}` }],
      } };
    }
    if (method === "DOM.getBoxModel") return { model: { content: [0, 0, 10, 0, 10, 10, 0, 10] } };
    throw new Error(`UNEXPECTED_LATE_TEXT_METHOD:${method}`);
  },
} as ExtensionDebuggerRuntime;
const lateTextMatch = await executeRegisteredDomIntent(
  lateTextRuntime,
  { tabId: 101 } as never,
  { kind: "find", selector: "button", textContains: "GPT", maxMatches: 2, fields: ["text"] },
) as Readonly<{ count: number; matches: readonly Readonly<{ text: string }>[] }>;
assert.deepEqual(lateTextMatch, { count: 1, matches: [{ text: "GPT-5.6" }] },
  "text identity must be filtered before the output cardinality bound so later exact controls are not hidden by unrelated DOM order");
assert.ok(lateTextDescribeCalls > 20, "the regression fixture must place the exact control beyond the old pre-filter cutoff");

for (const [key, virtualKeyCode, repeat] of [["ArrowLeft", 37, 1], ["ArrowRight", 39, 4]] as const) {
  const dispatchedKeyEvents: Readonly<Record<string, unknown>>[] = [];
  const reasoningSliderRuntime = {
    async send(_tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>) {
      if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
      if (method === "DOM.querySelectorAll") return { nodeIds: [7] };
      if (method === "DOM.getBoxModel") return { model: { content: [0, 0, 10, 0, 10, 10, 0, 10] } };
      if (method === "DOM.focus") return {};
      if (method === "Input.dispatchKeyEvent") {
        dispatchedKeyEvents.push(parameters ?? {});
        return {};
      }
      throw new Error(`UNEXPECTED_REASONING_SLIDER_METHOD:${method}`);
    },
  } as ExtensionDebuggerRuntime;
  const keypressResult = await executeRegisteredDomIntent(
    reasoningSliderRuntime,
    { tabId: 102 } as never,
    {
      kind: "keypress",
      selector: "[role='slider']",
      key,
      repeat,
      expectedMatches: 1,
      postKeypressMatch: { selector: "[role='slider'][aria-valuenow='4']", expectedMatches: 1, timeoutMs: 5_000 },
    },
  ) as Readonly<{ postconditionVerified: boolean }>;
  assert.equal(keypressResult.postconditionVerified, true);
  const expectedKeyEvents = Array.from({ length: repeat }, () => [
    { type: "rawKeyDown", key, code: key, windowsVirtualKeyCode: virtualKeyCode, nativeVirtualKeyCode: virtualKeyCode },
    { type: "keyUp", key, code: key, windowsVirtualKeyCode: virtualKeyCode, nativeVirtualKeyCode: virtualKeyCode },
  ]).flat();
  assert.deepEqual(dispatchedKeyEvents.map((event) => ({
    type: event.type,
    key: event.key,
    code: event.code,
    windowsVirtualKeyCode: event.windowsVirtualKeyCode,
    nativeVirtualKeyCode: event.nativeVirtualKeyCode,
  })), expectedKeyEvents);
}

let composerText = "stale SEO prompt";
const fillKeyEvents: Readonly<Record<string, unknown>>[] = [];
const contentEditableFillRuntime = {
  async send(_tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>) {
    if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
    if (method === "DOM.querySelectorAll") return { nodeIds: [7] };
    if (method === "DOM.getBoxModel") return { model: { content: [0, 0, 10, 0, 10, 10, 0, 10] } };
    if (method === "DOM.focus") return {};
    if (method === "Input.dispatchKeyEvent") {
      fillKeyEvents.push(parameters ?? {});
      if (parameters?.type === "rawKeyDown" && parameters.key === "Backspace") composerText = "";
      return {};
    }
    if (method === "Input.insertText") {
      composerText += String(parameters?.text ?? "");
      return {};
    }
    if (method === "DOM.describeNode") return {
      node: {
        nodeId: 7,
        backendNodeId: 107,
        nodeName: "DIV",
        attributes: ["contenteditable", "true"],
        children: composerText.length === 0 ? [] : [{ nodeName: "P", nodeValue: composerText }],
      },
    };
    throw new Error(`UNEXPECTED_CONTENTEDITABLE_FILL_METHOD:${method}`);
  },
} as ExtensionDebuggerRuntime;
const clearedComposer = await executeRegisteredDomIntent(
  contentEditableFillRuntime,
  { tabId: 103 } as never,
  {
    kind: "fill",
    selector: "#prompt-textarea",
    approvedText: "",
    clearBeforeType: true,
    expectedMatches: 1,
  },
) as Readonly<{ retainedValueVerified: boolean; postconditionVerified: boolean }>;
assert.deepEqual(clearedComposer, {
  filled: true,
  candidateCount: 1,
  identityRevalidated: true,
  mutationCount: 1,
  retainedValueVerified: true,
  postconditionVerified: true,
});
assert.deepEqual(fillKeyEvents, [
  { type: "rawKeyDown", key: "a", code: "KeyA", commands: ["selectAll"] },
  { type: "keyUp", key: "a", code: "KeyA" },
  { type: "rawKeyDown", key: "Backspace", code: "Backspace" },
  { type: "keyUp", key: "Backspace", code: "Backspace" },
], "fill clear must use the platform-independent Blink selectAll command before deleting stale content");

const secondAcquisition = targetAuthority.acquireJobBoundChatGptTarget();
await Promise.resolve();
targetTabUpdated(4, { status: "complete" }, { id: 4, title: "ChatGPT" });
await secondAcquisition;
assert.equal(attachedTabs.at(-1), 4, "every turn must create and attach its own new task tab");
assert.equal(targetFrames.at(-1)?.body.url, "https://chatgpt.com/",
  "the debugger-owned main frame must prove the exact origin when Chrome redacts tab.url without tabs permission");
await targetAuthority.releaseActiveTarget(false);

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
emitQualityProofObservation({
  passed: true,
  findings: [],
  lawId: "LAW-LOCAL-BROWSER-SESSION-002-V6",
  evidenceMode: "exam.golden",
  clauses: ["forbidden:0", "forbidden:6", "forbidden:7", "forbidden:8", "summary"],
  locator: "acceptance:local-browser-terminal:auto-pairing-golden",
  observedValue: "fixed extension retrieves one in-memory pairing secret only from the exact loopback route, rejects invalid origin responses, stays single-flight, and reloads before pairing when releaseBuildId differs",
});
emitQualityProofObservation({
  passed: true,
  findings: [],
  lawId: "LAW-LOCAL-BROWSER-SESSION-003-V14",
  evidenceMode: "exam.golden",
  clauses: ["forbidden:1", "forbidden:13", "forbidden:2", "forbidden:3", "summary"],
  locator: "acceptance:local-browser-terminal:job-target-golden",
  observedValue: "each accepted acquisition creates one background ChatGPT page, tolerates Chrome-redacted tab metadata, verifies the debugger-owned main-frame exact origin before claim, never enumerates operator tabs, and removes rejected or conflicted task pages",
});
emitQualityProofObservation({
  passed: true,
  findings: [],
  lawId: "LAW-LOCAL-BROWSER-SESSION-005-V6",
  evidenceMode: "exam.golden",
  clauses: ["forbidden:5", "summary"],
  locator: "acceptance:local-browser-terminal:release-reload-golden",
  observedValue: "the fixed unpacked extension compares the exact governed releaseBuildId and performs one self-reload before any pairing attempt when the build differs",
});
