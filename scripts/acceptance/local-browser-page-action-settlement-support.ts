import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";

import { ExtensionDebuggerRuntime } from
  "../../src/lib/browser/chrome-extension/debugger-runtime.js";
import type { ExtensionChromeApi } from
  "../../src/lib/browser/chrome-extension/extension-runtime-types.js";

const mutationMethods = [
  "DOM.focus", "DOM.setFileInputFiles", "Input.dispatchKeyEvent",
  "Input.dispatchMouseEvent", "Input.insertText", "Page.close", "Page.navigate",
] as const;

const after2499 = (): Promise<void> =>
  new Promise((resolve) => globalThis.setTimeout(resolve, 2499));

const createGateHarness = (input: Readonly<{ expectedMethod?: string; rejectMethod?: string }> = {}) => {
  let actionCount = 0;
  let pageReadCount = 0;
  let tabReadCount = 0;
  let chooserListener: Parameters<ExtensionChromeApi["debugger"]["onEvent"]["addListener"]>[0]
    = () => undefined;
  const chromeApi: ExtensionChromeApi = {
    runtime: {
      id: "gate-acceptance",
      getManifest: () => ({ version: "1.0.0" }),
      getPlatformInfo: async () => ({}),
      reload() {},
      onMessage: { addListener() {} },
      onStartup: { addListener() {} },
    },
    debugger: {
      attach: async () => undefined,
      detach: async () => undefined,
      getTargets: async () => [],
      onDetach: { addListener() {} },
      onEvent: { addListener(listener) { chooserListener = listener; } },
      async sendCommand(_target, method) {
        if (method === "DOM.getDocument") {
          pageReadCount += 1;
          return { root: { nodeId: 1 } };
        }
        if (method !== input.expectedMethod) throw new Error(`UNEXPECTED_GATE_METHOD:${method}`);
        actionCount += 1;
        if (method === input.rejectMethod) throw new Error("PHYSICAL_ACTION_REJECTED");
        return {};
      },
    },
    tabs: {
      create: async () => { actionCount += 1; return { id: 706 }; },
      get: async (tabId) => {
        tabReadCount += 1;
        return { active: true, discarded: false, id: tabId, status: "complete",
          url: "https://chatgpt.com/", title: "ChatGPT", windowId: 1 };
      },
      remove: async () => { actionCount += 1; },
      update: async (tabId) => ({ active: true, discarded: false, id: tabId,
        status: "complete", url: "https://chatgpt.com/", title: "ChatGPT", windowId: 1 }),
      onActivated: { addListener() {} },
      onUpdated: { addListener() {} },
    },
    alarms: { create: async () => undefined, onAlarm: { addListener() {} } },
  };
  const runtime = new ExtensionDebuggerRuntime(chromeApi);
  runtime.adoptAttached(106);
  return {
    runtime,
    chooserListener: () => chooserListener,
    actionCount: () => actionCount,
    pageReadCount: () => pageReadCount,
    tabReadCount: () => tabReadCount,
  };
};

const exerciseMutationMethod = async (method: string): Promise<void> => {
  const harness = createGateHarness({ expectedMethod: method });
  await harness.runtime.send(106, method, {});
  const completedAt = globalThis.performance.now();
  const freshRead = harness.runtime.send(106, "DOM.getDocument", { depth: 0 });
  await after2499();
  assert.equal(harness.pageReadCount(), 0,
    `${method} must perform zero post-action reads at 2499ms and earlier`);
  await freshRead;
  assert.equal(harness.actionCount(), 1, `${method} must execute exactly once`);
  assert.equal(harness.pageReadCount(), 1, `${method} must permit one first fresh read`);
  assert.ok(globalThis.performance.now() - completedAt >= 2500,
    `${method} must hold the full hard-coded 2500ms gate`);
};

const exerciseTabCreation = async (): Promise<void> => {
  const harness = createGateHarness();
  await harness.runtime.createBackgroundTab("https://chatgpt.com/");
  const freshTab = harness.runtime.readTab(706);
  await after2499();
  assert.equal(harness.tabReadCount(), 0, "tabs.create must gate the first fresh tabs.get read");
  await freshTab;
  assert.equal(harness.actionCount(), 1);
};

const exerciseTabRemoval = async (): Promise<void> => {
  const harness = createGateHarness();
  let removalObserved = false;
  const removal = harness.runtime.removeTab(706).then(() => { removalObserved = true; });
  await after2499();
  assert.equal(removalObserved, false, "tabs.remove success must not settle before 2500ms");
  await removal;
  assert.equal(harness.actionCount(), 1);
};

const exerciseRejectedMutation = async (): Promise<void> => {
  const harness = createGateHarness({ expectedMethod: "Input.insertText", rejectMethod: "Input.insertText" });
  let failureObserved = false;
  const rejectedAction = harness.runtime.send(106, "Input.insertText", {})
    .then(() => null, (error: unknown) => { failureObserved = true; return error; });
  await after2499();
  assert.equal(failureObserved, false,
    "even a native action failure must not become observable before the full 2500ms gate");
  assert.match(String(await rejectedAction), /PHYSICAL_ACTION_REJECTED/u);
  assert.equal(harness.actionCount(), 1, "a delayed action failure must never replay the action");
};

const exerciseChooserMismatch = async (): Promise<void> => {
  const harness = createGateHarness({ expectedMethod: "Input.dispatchMouseEvent" });
  let mismatchObserved = false;
  const mismatch = harness.runtime.captureFileChooserOpened(106, 5_000, async () => {
    await harness.runtime.send(106, "Input.dispatchMouseEvent", { type: "mouseReleased" });
    harness.chooserListener()({ tabId: 106 }, "Page.fileChooserOpened", { backendNodeId: "invalid" });
  }, async () => undefined).then(() => null, (error: unknown) => {
    mismatchObserved = true;
    return error;
  });
  await after2499();
  assert.equal(mismatchObserved, false,
    "a chooser mismatch after the click must not become observable before 2500ms");
  assert.match(String(await mismatch), /BROWSER_FILE_CHOOSER_MISMATCH/u);
  assert.equal(harness.actionCount(), 1, "a chooser mismatch must never replay the click");
};

export const exerciseUniversalPostActionReadGate = async (): Promise<void> => {
  await Promise.all([
    ...mutationMethods.map(exerciseMutationMethod),
    exerciseTabCreation(),
    exerciseTabRemoval(),
    exerciseRejectedMutation(),
    exerciseChooserMismatch(),
  ]);
  const unknown = createGateHarness();
  await assert.rejects(unknown.runtime.send(106, "Future.unclassifiedMethod"),
    /BROWSER_UNREGISTERED_DEVTOOLS_METHOD/u,
    "a future unclassified DevTools method must fail closed instead of bypassing the gate");
};
