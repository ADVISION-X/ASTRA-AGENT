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
import type { ExtensionChromeApi } from "../../src/lib/browser/chrome-extension/extension-runtime-types.js";

const secret = "a".repeat(64);
const currentBuild = "build-00000000-0000-4000-8000-000000000001";
const nextBuild = "build-00000000-0000-4000-8000-000000000002";

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
    sendCommand: async () => ({}),
    onDetach: { addListener: () => undefined },
  },
  tabs: {
    query: async () => [],
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

process.stdout.write("LOCAL_BROWSER_AUTO_PAIRING_AND_RELOAD_ACCEPTANCE_PASS\n");
