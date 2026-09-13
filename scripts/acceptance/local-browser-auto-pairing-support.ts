import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";

import {
  GRASSEYE_AUTO_PAIRING_ALARM,
  GRASSEYE_TOOL_EXTENSION_ID,
  PairingAutoBootstrap,
  type WorkbenchPairingState,
} from "../../src/lib/browser/chrome-extension/pairing-auto-bootstrap.js";
import type { ExtensionChromeApi } from
  "../../src/lib/browser/chrome-extension/extension-runtime-types.js";
import { exercisePairingReadback } from "./local-browser-pairing-readback-support.js";

type RuntimeStartupListener = () => void;
type TabUpdatedListener = Parameters<ExtensionChromeApi["tabs"]["onUpdated"]["addListener"]>[0];
type AlarmListener = Parameters<ExtensionChromeApi["alarms"]["onAlarm"]["addListener"]>[0];
type PairingListeners = { runtimeStartup?: RuntimeStartupListener; tabUpdated?: TabUpdatedListener; alarm?: AlarmListener };

const pairingFixture = () => {
  const listeners: PairingListeners = {};
  let createdAlarm: Readonly<{ name: string; periodInMinutes: number }> | null = null;
  let reloads = 0;
  const chromeApi: ExtensionChromeApi = {
    runtime: {
      id: GRASSEYE_TOOL_EXTENSION_ID, getManifest: () => ({ version: "1.0.0" }),
      getPlatformInfo: async () => ({}), reload: () => { reloads += 1; },
      onMessage: { addListener: () => undefined },
      onStartup: { addListener: (listener) => { listeners.runtimeStartup = listener; } },
    },
    debugger: {
      attach: async () => undefined, detach: async () => undefined,
      getTargets: async () => [], sendCommand: async () => ({}),
      onDetach: { addListener: () => undefined }, onEvent: { addListener: () => undefined },
    },
    tabs: {
      create: async () => ({ id: 1 }),
      get: async (tabId) => ({ active: true, discarded: false, id: tabId, status: "complete",
        title: "ChatGPT", windowId: 1 }),
      remove: async () => undefined,
      update: async (tabId) => ({ active: true, discarded: false, id: tabId, status: "complete",
        title: "ChatGPT", windowId: 1 }),
      onActivated: { addListener: () => undefined },
      onUpdated: { addListener: (listener) => { listeners.tabUpdated = listener; } },
    },
    alarms: {
      create: async (name, alarmInfo) => { createdAlarm = { name, periodInMinutes: alarmInfo.periodInMinutes }; },
      onAlarm: { addListener: (listener) => { listeners.alarm = listener; } },
    },
  };
  return { chromeApi, listeners, createdAlarm: () => createdAlarm, reloads: () => reloads };
};

const exerciseSingleFlight = async (
  chromeApi: ExtensionChromeApi,
  secret: string,
  currentBuild: string,
  nextBuild: string,
  reloads: () => number,
): Promise<void> => {
  let resolveRead: (value: WorkbenchPairingState) => void = () => {
    throw new Error("pairing read was not started");
  };
  let reads = 0;
  let pairs = 0;
  const singleFlight = new PairingAutoBootstrap(chromeApi,
    { canAttemptAutomaticPairing: () => true,
      pair: async (value) => { assert.equal(value, secret); pairs += 1; } }, currentBuild,
    () => { reads += 1;
      return new Promise<WorkbenchPairingState>((resolve) => { resolveRead = resolve; }); });
  const first = singleFlight.attempt();
  assert.equal(first, singleFlight.attempt(), "concurrent wake events must share one in-flight pairing attempt");
  assert.equal(reads, 1);
  resolveRead({ authority: "absent", pairingSecret: secret, releaseBuildId: currentBuild });
  await first;
  assert.equal(pairs, 1);
  const stale = new PairingAutoBootstrap(chromeApi,
    { canAttemptAutomaticPairing: () => true,
      pair: async () => { throw new Error("stale code must reload before pairing"); } }, currentBuild,
    async () => ({ authority: "absent", pairingSecret: secret, releaseBuildId: nextBuild }));
  await stale.attempt();
  assert.equal(reloads(), 1, "a different exact AGENT build identity must trigger one extension reload");
};

const exerciseWakeEvents = async (
  chromeApi: ExtensionChromeApi,
  listeners: PairingListeners,
  createdAlarm: () => Readonly<{ name: string; periodInMinutes: number }> | null,
  currentBuild: string,
): Promise<void> => {
  let reads = 0;
  const bootstrap = new PairingAutoBootstrap(chromeApi,
    { canAttemptAutomaticPairing: () => true, pair: async () => undefined }, currentBuild,
    async () => { reads += 1;
      return { authority: "present", pairingSecret: null, releaseBuildId: currentBuild }; });
  bootstrap.start();
  await bootstrap.attempt();
  assert.deepEqual(createdAlarm(), { name: GRASSEYE_AUTO_PAIRING_ALARM, periodInMinutes: 1 });
  assert.equal(reads, 1, "service-worker load must make one immediate attempt");
  listeners.runtimeStartup?.(); await bootstrap.attempt();
  assert.equal(reads, 2, "Chrome startup must wake automatic pairing");
  listeners.tabUpdated?.(1, { status: "complete" }, { id: 1, url: "http://127.0.0.1:4174/" });
  await Promise.resolve();
  assert.equal(reads, 2, "non-Workbench tabs must not wake pairing");
  listeners.tabUpdated?.(2, { status: "complete" }, { id: 2, url: "http://127.0.0.1:4173/" });
  await bootstrap.attempt();
  assert.equal(reads, 3, "the exact Workbench tab must wake automatic pairing");
  listeners.alarm?.({ name: "unrelated" }); await Promise.resolve();
  assert.equal(reads, 3, "unrelated alarms must not wake pairing");
  listeners.alarm?.({ name: GRASSEYE_AUTO_PAIRING_ALARM }); await bootstrap.attempt();
  assert.equal(reads, 4, "the sole fallback alarm must wake automatic pairing");
};

const exerciseClosedPairing = async (chromeApi: ExtensionChromeApi, currentBuild: string): Promise<void> => {
  const connected = new PairingAutoBootstrap(chromeApi,
    { canAttemptAutomaticPairing: () => false, pair: async () => { throw new Error("must not pair"); } },
    currentBuild, async () => { throw new Error("must not fetch"); });
  await connected.attempt();
  const rejected = new PairingAutoBootstrap(chromeApi,
    { canAttemptAutomaticPairing: () => true, pair: async () => { throw new Error("must not pair"); } },
    currentBuild, async () => { throw new Error("BROWSER_PAIRING_ORIGIN_REJECTED"); });
  await rejected.attempt();
  assert.equal(rejected.currentFailureCode(), "BROWSER_PAIRING_ORIGIN_REJECTED");
};

export const exerciseAutomaticPairing = async (): Promise<ExtensionChromeApi> => {
  const secret = "a".repeat(64);
  const currentBuild = "build-00000000-0000-4000-8000-000000000001";
  const nextBuild = "build-00000000-0000-4000-8000-000000000002";
  await exercisePairingReadback(secret, currentBuild);
  const fixture = pairingFixture();
  await exerciseSingleFlight(fixture.chromeApi, secret, currentBuild, nextBuild, fixture.reloads);
  await exerciseWakeEvents(fixture.chromeApi, fixture.listeners, fixture.createdAlarm, currentBuild);
  await exerciseClosedPairing(fixture.chromeApi, currentBuild);
  return fixture.chromeApi;
};
