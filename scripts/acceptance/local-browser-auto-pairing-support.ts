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

export const exerciseAutomaticPairing = async (): Promise<ExtensionChromeApi> => {
  const secret = "a".repeat(64);
  const currentBuild = "build-00000000-0000-4000-8000-000000000001";
  const nextBuild = "build-00000000-0000-4000-8000-000000000002";
  await exercisePairingReadback(secret, currentBuild);

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
        title: "ChatGPT", windowId: 1 }),
      remove: async () => undefined,
      update: async (tabId) => ({ active: true, discarded: false, id: tabId, status: "complete",
        title: "ChatGPT", windowId: 1 }),
      onActivated: { addListener: () => undefined },
      onUpdated: { addListener: (listener) => { listeners.tabUpdated = listener; } },
    },
    alarms: {
      create: async (name, alarmInfo) => {
        createdAlarm = { name, periodInMinutes: alarmInfo.periodInMinutes };
      },
      onAlarm: { addListener: (listener) => { listeners.alarm = listener; } },
    },
  };

  let resolveRead: (value: WorkbenchPairingState) => void = () => {
    throw new Error("pairing read was not started");
  };
  let reads = 0;
  let pairs = 0;
  const singleFlight = new PairingAutoBootstrap(
    chromeApi,
    { canAttemptAutomaticPairing: () => true,
      pair: async (value) => { assert.equal(value, secret); pairs += 1; } },
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
    { canAttemptAutomaticPairing: () => true,
      pair: async () => { throw new Error("stale code must reload before pairing"); } },
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
    async () => {
      eventReads += 1;
      return { authority: "present", pairingSecret: null, releaseBuildId: currentBuild };
    },
  );
  eventBootstrap.start();
  await eventBootstrap.attempt();
  assert.deepEqual(createdAlarm, { name: GRASSEYE_AUTO_PAIRING_ALARM, periodInMinutes: 1 });
  assert.equal(eventReads, 1, "service-worker load must make one immediate attempt");

  listeners.runtimeStartup?.();
  await eventBootstrap.attempt();
  assert.equal(eventReads, 2, "Chrome startup must wake automatic pairing");
  listeners.tabUpdated?.(1, { status: "complete" }, { id: 1, url: "http://127.0.0.1:4174/" });
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
    { canAttemptAutomaticPairing: () => false,
      pair: async () => { throw new Error("must not pair"); } },
    currentBuild,
    async () => { throw new Error("must not fetch"); },
  );
  await connectedBootstrap.attempt();

  const rejectedBootstrap = new PairingAutoBootstrap(
    chromeApi,
    { canAttemptAutomaticPairing: () => true,
      pair: async () => { throw new Error("must not pair"); } },
    currentBuild,
    async () => { throw new Error("BROWSER_PAIRING_ORIGIN_REJECTED"); },
  );
  await rejectedBootstrap.attempt();
  assert.equal(rejectedBootstrap.currentFailureCode(), "BROWSER_PAIRING_ORIGIN_REJECTED");
  return chromeApi;
};
