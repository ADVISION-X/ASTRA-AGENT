import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";

import { ExtensionDebuggerRuntime } from
  "../../src/lib/browser/chrome-extension/debugger-runtime.js";
import type { ExtensionChromeApi } from
  "../../src/lib/browser/chrome-extension/extension-runtime-types.js";
import { executeRegisteredDomIntent as executeDomIntent } from
  "../../src/lib/browser/chrome-extension/dom-intent-runtime.js";
import { BROWSER_MECHANICAL_FACTS_READER_SOURCE } from
  "../../src/lib/browser/chrome-extension/dom-mechanical-facts.js";
import { assertBrowserDomIntent } from
  "../../src/lib/browser/exact-target/browser-dom-intent.js";
import { exerciseDomMutations } from "./local-browser-dom-mutation-support.js";
import { exerciseExactAssistantTurnRead } from "./local-browser-exact-assistant-turn-support.js";
import { exerciseFileInput } from "./local-browser-file-input-support.js";
import { exerciseCapturedObservationFunction } from "./local-browser-dom-function-support.js";

const executeRegisteredDomIntent = (
  runtime: ExtensionDebuggerRuntime,
  target: Parameters<typeof executeDomIntent>[1],
  intent: Parameters<typeof executeDomIntent>[2],
  assertCurrent: () => void = () => undefined,
): Promise<unknown> => executeDomIntent(runtime, target, intent, assertCurrent);

const exerciseUniversalPostActionReadGate = async (): Promise<void> => {
  const mutationMethods = [
    "DOM.focus", "DOM.setFileInputFiles", "Input.dispatchKeyEvent",
    "Input.dispatchMouseEvent", "Input.insertText", "Page.close", "Page.navigate",
  ] as const;
  const after2499 = (): Promise<void> =>
    new Promise((resolve) => globalThis.setTimeout(resolve, 2499));
  const createRuntime = (input: Readonly<{ expectedMethod?: string; rejectMethod?: string }> = {}) => {
    let actionCount = 0;
    let pageReadCount = 0;
    let tabReadCount = 0;
    let chooserListener: Parameters<ExtensionChromeApi["debugger"]["onEvent"]["addListener"]>[0]
      = () => undefined;
    const runtime = new ExtensionDebuggerRuntime({
      debugger: {
        onEvent: { addListener(listener: Parameters<ExtensionChromeApi["debugger"]["onEvent"]["addListener"]>[0]) {
          chooserListener = listener;
        } },
        async sendCommand(_target: Readonly<{ tabId: number }>, method: string) {
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
        get: async (tabId: number) => { tabReadCount += 1; return {
          id: tabId, status: "complete" as const, url: "https://chatgpt.com/", title: "ChatGPT",
        }; },
        remove: async () => { actionCount += 1; },
        onUpdated: { addListener() {} },
      },
    } as unknown as ExtensionChromeApi);
    runtime.adoptAttached(106);
    return { runtime, chooserListener: () => chooserListener,
      actionCount: () => actionCount, pageReadCount: () => pageReadCount,
      tabReadCount: () => tabReadCount };
  };

  await Promise.all([
    ...mutationMethods.map(async (method) => {
      const harness = createRuntime({ expectedMethod: method });
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
    }),
    (async () => {
      const harness = createRuntime();
      await harness.runtime.createBackgroundTab("https://chatgpt.com/");
      const freshTab = harness.runtime.readTab(706);
      await after2499();
      assert.equal(harness.tabReadCount(), 0, "tabs.create must gate the first fresh tabs.get read");
      await freshTab;
      assert.equal(harness.actionCount(), 1);
    })(),
    (async () => {
      const harness = createRuntime();
      let removalObserved = false;
      const removal = harness.runtime.removeTab(706).then(() => { removalObserved = true; });
      await after2499();
      assert.equal(removalObserved, false, "tabs.remove success must not settle before 2500ms");
      await removal;
      assert.equal(harness.actionCount(), 1);
    })(),
    (async () => {
      const harness = createRuntime({ expectedMethod: "Input.insertText", rejectMethod: "Input.insertText" });
      let failureObserved = false;
      const rejectedAction = harness.runtime.send(106, "Input.insertText", {})
        .then(() => null, (error: unknown) => { failureObserved = true; return error; });
      await after2499();
      assert.equal(failureObserved, false,
        "even a native action failure must not become observable before the full 2500ms gate");
      assert.match(String(await rejectedAction), /PHYSICAL_ACTION_REJECTED/u);
      assert.equal(harness.actionCount(), 1, "a delayed action failure must never replay the action");
    })(),
    (async () => {
      const harness = createRuntime({ expectedMethod: "Input.dispatchMouseEvent" });
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
    })(),
  ]);

  const unknown = createRuntime();
  await assert.rejects(unknown.runtime.send(106, "Future.unclassifiedMethod"),
    /BROWSER_UNREGISTERED_DEVTOOLS_METHOD/u,
    "a future unclassified DevTools method must fail closed instead of bypassing the gate");
};

const mechanicalFacts = (overrides: Readonly<Record<string, unknown>> = {}) => ({
  connected: true, layout: true, visible: true,
  computedDisplay: "block", computedVisibility: "visible", computedOpacity: "1", effectiveOpacity: "1",
  displayHidden: false, visibilityHidden: false, opacityHidden: false,
  hidden: false, ariaHidden: false, inert: false, disabled: false, ariaDisabled: false,
  role: "", name: "", testId: "", label: "", value: "", checked: null, type: "",
  bounds: { x: 0, y: 0, width: 10, height: 10 }, viewport: true, hitTest: true,
  nativeCauseCode: null, nativeStage: "runtime-call-function-on",
  ...overrides,
});

const mechanicalReply = (
  method: string,
  overrides: Readonly<Record<string, unknown>> = {},
  parameters?: Readonly<Record<string, unknown>>,
): unknown | undefined => {
  if (method === "DOM.resolveNode") return { object: { objectId: "node-object" } };
  if (method === "Runtime.callFunctionOn" && parameters?.returnByValue !== false) {
    return { result: { value: mechanicalFacts(overrides) } };
  }
  if (method === "Runtime.releaseObject") return {};
  return undefined;
};

const coherentCandidateReply = (
  method: string,
  parameters?: Readonly<Record<string, unknown>>,
  overrides: Readonly<Record<string, unknown>> = {},
): unknown | undefined => {
  if (method === "Page.getFrameTree") return { frameTree: { frame: { loaderId: "loader-current" } } };
  if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
  if (method === "DOM.resolveNode") return { object: { objectId: "candidate-root" } };
  if (method === "Runtime.callFunctionOn" && parameters?.returnByValue === false) {
    return { result: { type: "object", subtype: "node", objectId: "candidate-node" } };
  }
  if (method === "Runtime.callFunctionOn" && parameters?.returnByValue === true
    && String(parameters.functionDeclaration).includes("spec.output")) {
    const cause = overrides.disabled === true ? "BROWSER_DOM_ACTION_DISABLED"
      : overrides.hitTest === false ? "BROWSER_DOM_ACTION_HIT_TEST_FAILED"
        : overrides.viewport === false ? "BROWSER_DOM_ACTION_OUTSIDE_VIEWPORT" : null;
    return { result: { value: cause ?? { x: 5, y: 5 } } };
  }
  if (method === "DOM.requestNode") return { nodeId: 7 };
  if (method === "Runtime.releaseObject") return {};
  return undefined;
};

type DomFailure = "missing" | "ambiguous" | "stale" | "box" | "malformed-box" | "invalid" | "target";

const failureMechanicalReply = (failure: DomFailure): unknown => {
  if (failure === "box") return { result: { value: mechanicalFacts({
    layout: false, visible: false, bounds: null, viewport: false, hitTest: false,
    nativeCauseCode: "NO_LAYOUT_BOX",
  }) } };
  if (failure === "malformed-box") {
    return { result: { value: mechanicalFacts({ bounds: { x: 0 } }) } };
  }
  return { result: { value: mechanicalFacts() } };
};

const failureQueryReply = (failure: DomFailure): unknown => {
  if (failure === "invalid") return { nodeIds: "not-an-array" };
  if (failure === "missing") return { nodeIds: [] };
  if (failure === "ambiguous") return { nodeIds: [7, 8] };
  return { nodeIds: [7] };
};

const exerciseComposerReadiness = async (): Promise<void> => {
  let delayedQueries = 0;
  const delayed = { async send(_tabId: number, method: string) {
    const mechanical = mechanicalReply(method, {}, undefined);
    if (mechanical !== undefined) return mechanical;
    if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
    if (method === "DOM.querySelectorAll") {
      delayedQueries += 1;
      return { nodeIds: delayedQueries < 3 ? [] : [7] };
    }
    throw new Error(`UNEXPECTED_DELAYED_COMPOSER_METHOD:${method}`);
  } } as ExtensionDebuggerRuntime;
  const found = await executeRegisteredDomIntent(delayed, { tabId: 99 } as never, {
    kind: "find", selector: "#prompt-textarea", maxMatches: 2,
    waitFor: { minimumMatches: 1, timeoutMs: 500 },
  }) as Readonly<{ count: number }>;
  assert.equal(found.count, 1);
  assert.equal(delayedQueries, 3);
  const missing = { async send(_tabId: number, method: string) {
    const mechanical = mechanicalReply(method, {}, undefined);
    if (mechanical !== undefined) return mechanical;
    if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
    if (method === "DOM.querySelectorAll") return { nodeIds: [] };
    throw new Error(`UNEXPECTED_MISSING_COMPOSER_METHOD:${method}`);
  } } as ExtensionDebuggerRuntime;
  const absent = await executeRegisteredDomIntent(missing, { tabId: 100 } as never, {
    kind: "find", selector: "#prompt-textarea", maxMatches: 2,
    waitFor: { minimumMatches: 1, timeoutMs: 1 },
  }) as Readonly<{ count: number }>;
  assert.equal(absent.count, 0);
};

const exerciseDomFailures = async (): Promise<void> => {
  const runtime = (failure: DomFailure) => ({
    async send(_tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>) {
      let response: unknown;
      if (method === "DOM.resolveNode") {
        if (failure === "stale") throw new Error("Could not find node with given id");
        response = { object: { objectId: "node-object" } };
      } else if (method === "Runtime.callFunctionOn") {
        response = failureMechanicalReply(failure);
      } else if (method === "Runtime.releaseObject") {
        response = {};
      } else if (method === "DOM.getDocument") {
        if (failure === "target") throw new Error("BROWSER_TARGET_INVALID");
        response = { root: { nodeId: 1 } };
      } else if (method === "DOM.querySelectorAll") {
        response = failureQueryReply(failure);
      } else {
        throw new Error(`UNEXPECTED_DOM_FAILURE_METHOD:${method}`);
      }
      return response;
    },
  }) as ExtensionDebuggerRuntime;
  const noBox = await executeRegisteredDomIntent(runtime("box"), { tabId: 100 } as never, {
    kind: "find", selector: "[data-turn='user']", maxMatches: 1, fields: [],
  }) as Readonly<{ count: number; rawCount: number; eligibleCount: number;
    nativeCauseCode: string | null; nativeCauseCount: number; nativeStage: string }>;
  assert.equal(noBox.count, 0, "a recognized no-layout box is an invisible candidate, not a DOM read failure");
  assert.deepEqual(noBox, {
    count: 0, rawCount: 1, eligibleCount: 0, nativeCauseCode: "NO_LAYOUT_BOX",
    nativeCauseCount: 1, nativeStage: "runtime-call-function-on", matches: [],
  });
  for (const [failure, code] of [
    ["missing", "BROWSER_DOM_CANDIDATE_MISSING"], ["ambiguous", "BROWSER_DOM_CANDIDATE_AMBIGUOUS"],
    ["stale", "BROWSER_DOM_NODE_STALE"], ["malformed-box", "BROWSER_DOM_READ_INVALID"],
    ["invalid", "BROWSER_DOM_READ_INVALID"], ["target", "BROWSER_TARGET_INVALID"],
  ] as const) await assert.rejects(executeRegisteredDomIntent(runtime(failure), { tabId: 100 } as never, {
    kind: "readText", selector: "[data-turn='user']", expectedMatches: 1, maxChars: 100,
  }), new RegExp(code, "u"));
};

const exerciseLateTextMatch = async (): Promise<void> => {
  let describeCalls = 0;
  const runtime = { async send(_tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>) {
    const mechanical = mechanicalReply(method, {}, parameters);
    if (mechanical !== undefined) return mechanical;
    if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
    if (method === "DOM.querySelectorAll") return { nodeIds: Array.from({ length: 25 }, (_, index) => index + 2) };
    if (method === "DOM.describeNode") {
      describeCalls += 1;
      const nodeId = Number(parameters?.nodeId);
      return { node: { nodeId, backendNodeId: nodeId + 100, nodeName: "BUTTON", attributes: [],
        children: [{ nodeValue: nodeId === 26 ? "GPT-5.6" : `unrelated-${nodeId}` }] } };
    }
    throw new Error(`UNEXPECTED_LATE_TEXT_METHOD:${method}`);
  } } as ExtensionDebuggerRuntime;
  const match = await executeRegisteredDomIntent(runtime, { tabId: 101 } as never, {
    kind: "find", selector: "button", textContains: "GPT", maxMatches: 2, fields: ["text"],
  }) as Readonly<{ count: number; matches: readonly Readonly<{ text: string }>[] }>;
  assert.deepEqual(match, {
    count: 1, rawCount: 25, eligibleCount: 1, nativeCauseCode: null,
    nativeCauseCount: 0, nativeStage: "runtime-call-function-on", matches: [{ text: "GPT-5.6" }],
  });
  assert.ok(describeCalls > 20);
};

const exerciseUntruncatedRead = async (): Promise<void> => {
  const completeText = `prefix-${"x".repeat(2_048)}-suffix`;
  const runtime = { async send(_tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>) {
    const mechanical = mechanicalReply(method, {}, parameters);
    if (mechanical !== undefined) return mechanical;
    if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
    if (method === "DOM.querySelectorAll") return { nodeIds: [7] };
    if (method === "DOM.describeNode") return { node: { nodeId: 7, nodeName: "DIV", attributes: [],
      children: [{ nodeName: "#text", nodeValue: completeText }] } };
    throw new Error(`UNEXPECTED_COMPLETE_READ_METHOD:${method}`);
  } } as ExtensionDebuggerRuntime;
  const result = await executeRegisteredDomIntent(runtime, { tabId: 110 } as never, {
    kind: "readText", selector: "article", expectedMatches: 1, maxChars: 8,
  });
  assert.equal(result, completeText, "maxChars must never silently truncate authenticated DOM content");
};

const exerciseMechanicalFacts = async (): Promise<void> => {
  const runtime = { async send(
    _tabId: number,
    method: string,
    parameters?: Readonly<Record<string, unknown>>,
  ) {
    if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
    if (method === "DOM.querySelectorAll") return { nodeIds: [7, 8] };
    if (method === "DOM.resolveNode") return { object: { objectId: `node-${parameters?.nodeId}` } };
    if (method === "Runtime.releaseObject") return {};
    if (method === "Runtime.callFunctionOn") {
      const disconnected = parameters?.objectId === "node-8";
      return { result: { value: mechanicalFacts(disconnected ? {
        connected: false, visible: false,
      } : {
        role: "button", name: "model", testId: "model-button", label: "Model",
        value: "gpt-5.6", checked: true, type: "button", ariaDisabled: true,
      }) } };
    }
    if (method === "DOM.describeNode") {
      return { node: { nodeId: parameters?.nodeId, nodeName: "BUTTON", attributes: [] } };
    }
    throw new Error(`UNEXPECTED_MECHANICAL_FACT_METHOD:${method}`);
  } } as ExtensionDebuggerRuntime;
  const observed = await executeRegisteredDomIntent(runtime, { tabId: 104 } as never, {
    kind: "find", selector: "button", maxMatches: 2,
    fields: [
      "connected", "layout", "visible", "computedDisplay", "computedVisibility",
      "computedOpacity", "effectiveOpacity", "hidden", "ariaHidden", "inert", "disabled", "ariaDisabled",
      "role", "name", "testId", "label", "value", "checked", "type",
    ],
  }) as Readonly<{
    count: number;
    rawCount: number;
    eligibleCount: number;
    matches: readonly Readonly<Record<string, unknown>>[];
  }>;
  assert.equal(observed.rawCount, 2);
  assert.equal(observed.eligibleCount, 1);
  assert.equal(observed.count, 1);
  assert.deepEqual(observed.matches[0], {
    connected: true, layout: true, visible: true,
    computedDisplay: "block", computedVisibility: "visible", computedOpacity: "1", effectiveOpacity: "1",
    hidden: false, ariaHidden: false, inert: false, disabled: false, ariaDisabled: true,
    role: "button", name: "model", testId: "model-button", label: "Model",
    value: "gpt-5.6", checked: true, type: "button",
    nativeCauseCode: null, nativeStage: "runtime-call-function-on",
  });
};

const exerciseSeparatedMechanicalEligibility = async (): Promise<void> => {
  assert.match(BROWSER_MECHANICAL_FACTS_READER_SOURCE, /current = current\.parentElement/u);
  assert.match(BROWSER_MECHANICAL_FACTS_READER_SOURCE, /effectiveOpacityNumber \*= currentOpacity/u);
  const visibleAssignment = BROWSER_MECHANICAL_FACTS_READER_SOURCE.match(/const visible = ([\s\S]*?);/u)?.[1] ?? "";
  assert.doesNotMatch(visibleAssignment, /ariaHidden|inert|disabled/u,
    "rendered visibility must remain separate from semantic and action eligibility");

  const runtimeFor = (overrides: Readonly<Record<string, unknown>>) => ({
    async awaitPageReadPermission() {},
    async send(_tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>) {
      const coherent = coherentCandidateReply(method, parameters, overrides);
      if (coherent !== undefined) return coherent;
      const mechanical = mechanicalReply(method, overrides, parameters);
      if (mechanical !== undefined) return mechanical;
      if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
      if (method === "DOM.querySelectorAll") return { nodeIds: parameters?.selector === "done" ? [] : [7] };
      throw new Error(`UNEXPECTED_SEPARATED_FACT_METHOD:${method}`);
    },
  }) as ExtensionDebuggerRuntime;

  for (const facts of [{ ariaHidden: true }, { inert: true }] as const) {
    const result = await executeRegisteredDomIntent(runtimeFor(facts), { tabId: 106 } as never, {
      kind: "find", selector: "button", maxMatches: 1,
    }) as Readonly<{ rawCount: number; eligibleCount: number }>;
    assert.equal(result.rawCount, 1);
    assert.equal(result.eligibleCount, 0, "semantic-hidden nodes must stay raw facts but not generic eligible nodes");
  }

  for (const [kind, facts] of [["click", { disabled: true, hitTest: false }],
    ["keypress", { ariaDisabled: true }], ["keypress", { ariaHidden: true }]] as const) {
    const intent = kind === "click"
      ? { kind, selector: "button", expectedMatches: 1,
        postClickMatch: { selector: "done", expectedMatches: 1 } } as const
      : { kind, selector: "button", key: "Enter", expectedMatches: 1,
        postKeypressMatch: { selector: "done", expectedMatches: 1 } } as const;
    const rejected = await executeRegisteredDomIntent(runtimeFor(facts), { tabId: 107 } as never, intent);
    assert.deepEqual(rejected, { candidateCount: 1, qualificationStage: "actionability",
      identityRevalidated: false, mutationCount: 0,
      postconditionVerified: false, qualificationRejected: true,
      failureCode: "BROWSER_DOM_ACTION_NOT_QUALIFIED",
      nativeCauseCode: kind === "click" ? "BROWSER_DOM_ACTION_DISABLED" : "BROWSER_DOM_CANDIDATE_MISSING" });
  }
};

const assertObservationContractRejectsCallerControl = (): void => {
  assert.throws(() => assertBrowserDomIntent({ kind: "observe", queries: [{
    queryId: "forged", selector: "button", maxMatches: 1, fields: ["visible"], callerScript: "return true",
  } as never] }), /BROWSER_COMMAND_PERMIT_INVALID/u);
  assert.throws(() => assertBrowserDomIntent({ kind: "observe", queries: [{
    queryId: "raw-text", selector: "button", maxMatches: 1, fields: ["text"],
  } as never] }), /BROWSER_COMMAND_PERMIT_INVALID/u);
  assert.throws(() => assertBrowserDomIntent({ kind: "observe", queries: [{
    queryId: "forged-eligibility", selector: "button", maxMatches: 1, fields: ["visible"],
    readEligibility: "actionable-hidden-node",
  } as never] }), /BROWSER_COMMAND_PERMIT_INVALID/u);
  assert.throws(() => assertBrowserDomIntent({ kind: "observe", queries: Array.from({ length: 20 }, (_, index) => ({
    queryId: `oversized-${index}`, selector: "button", maxMatches: 20,
    fields: ["connected", "layout", "visible", "role"],
  })) as never }), /BROWSER_COMMAND_PERMIT_INVALID/u);
};

const exerciseCoherentObservationFailures = async (
  runtime: ExtensionDebuggerRuntime,
  command: Extract<Parameters<typeof executeRegisteredDomIntent>[2], { kind: "observe" }>,
  observedAt: string,
  rows: readonly Readonly<Record<string, unknown>>[],
): Promise<void> => {
  assertObservationContractRejectsCallerControl();
  const malformed = { ...runtime, async send(tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>) {
    if (method === "Runtime.callFunctionOn") return { result: { value: {
      observedAt, queries: [{ ...rows[0], matches: [{ visible: "yes", role: "button" }] }, rows[1]],
    } } };
    return runtime.send(tabId, method, parameters);
  } } as ExtensionDebuggerRuntime;
  await assert.rejects(executeRegisteredDomIntent(malformed, {
    tabId: 105, targetRef: "target-105", documentRef: "document-9", navigationEpoch: 9,
  }, command), /BROWSER_DOM_READ_INVALID/u);
  const missingReasons = { ...runtime, async send(tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>) {
    if (method === "Runtime.callFunctionOn") return { result: { value: {
      observedAt, queries: [rows[0], { ...rows[1], rejections: [] }],
    } } };
    return runtime.send(tabId, method, parameters);
  } } as ExtensionDebuggerRuntime;
  await assert.rejects(executeRegisteredDomIntent(missingReasons, {
    tabId: 105, targetRef: "target-105", documentRef: "document-9", navigationEpoch: 9,
  }, command), /BROWSER_DOM_READ_INVALID/u);
  const overBudgetScopes = Array.from({ length: 251 }, (_, index) => ({
    index: index + 1, reasons: ["NO_LAYOUT_BOX"] as const,
  }));
  const overBudget = { ...runtime, async send(tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>) {
    if (method === "Runtime.callFunctionOn") return { result: { value: {
      observedAt, queries: [{ ...rows[0], scopeRawCount: 252, scopeRejections: overBudgetScopes }, rows[1]],
    } } };
    return runtime.send(tabId, method, parameters);
  } } as ExtensionDebuggerRuntime;
  await assert.rejects(executeRegisteredDomIntent(overBudget, {
    tabId: 105, targetRef: "target-105", documentRef: "document-9", navigationEpoch: 9,
  }, command), /BROWSER_DOM_READ_INVALID/u,
  "the receiver must independently reject an observation whose whole-call candidate budget exceeds 256");
  for (const invalidMatches of [
    [{ candidateIndex: 4, role: "button", visible: true },
      { candidateIndex: 4, role: "button", visible: true }],
    [{ candidateIndex: 0, role: "button", visible: true }],
  ]) {
    const invalidIdentity = {
      ...runtime,
      async send(tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>) {
        if (method === "Runtime.callFunctionOn") return { result: { value: {
          observedAt,
          queries: [{ ...rows[0], eligibleCount: invalidMatches.length, matches: invalidMatches }, rows[1]],
        } } };
        return runtime.send(tabId, method, parameters);
      },
    } as ExtensionDebuggerRuntime;
    await assert.rejects(executeRegisteredDomIntent(invalidIdentity, {
      tabId: 105, targetRef: "target-105", documentRef: "document-9", navigationEpoch: 9,
    }, command), /BROWSER_DOM_READ_INVALID/u,
    "duplicate or eligible/rejected candidate indices must fail the whole observation");
  }
  let changedLoaderReads = 0;
  const changedDocument = { async send(_tabId: number, method: string) {
    if (method === "Page.getFrameTree") {
      changedLoaderReads += 1;
      return { frameTree: { frame: { loaderId: changedLoaderReads === 1 ? "loader-a" : "loader-b" } } };
    }
    if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
    if (method === "DOM.resolveNode") return { object: { objectId: "document-object" } };
    if (method === "Runtime.callFunctionOn") return { result: { value: { observedAt, queries: rows } } };
    if (method === "Runtime.releaseObject") return {};
    throw new Error(`UNEXPECTED_CHANGED_DOCUMENT_METHOD:${method}`);
  } } as ExtensionDebuggerRuntime;
  await assert.rejects(executeRegisteredDomIntent(changedDocument, {
    tabId: 105, targetRef: "target-105", documentRef: "document-10", navigationEpoch: 10,
  }, command), /BROWSER_DOCUMENT_INVALID/u);
};

const exerciseCoherentObservation = async (): Promise<void> => {
  const observedAt = "2026-09-02T12:34:56.789Z";
  const queries = [
    { queryId: "model-entry", selector: "button", maxMatches: 1, fields: ["role", "visible"] as const },
    { queryId: "attachments", selector: "[data-file]", maxMatches: 2,
      fields: ["label", "disabled"] as const, scope: { selector: "main" } },
  ] as const;
  const rows = [
    { queryId: "model-entry", scopeRawCount: 1, scopeEligibleCount: 1, rawCount: 5,
      eligibleCount: 1, matches: [{ candidateIndex: 4, role: "button", visible: true }], nativeCauseCode: null,
      nativeCauseCount: 0, nativeStage: "runtime-call-function-on", scopeRejections: [], rejections: [
        { index: 0, reasons: ["DISPLAY_HIDDEN"] }, { index: 1, reasons: ["VISIBILITY_HIDDEN"] },
        { index: 2, reasons: ["OPACITY_HIDDEN"] }, { index: 3, reasons: ["INERT"] },
      ] },
    { queryId: "attachments", scopeRawCount: 1, scopeEligibleCount: 1, rawCount: 3,
      eligibleCount: 2, matches: [{ candidateIndex: 0, label: "a.pdf", disabled: false },
        { candidateIndex: 1, label: "b.pdf", disabled: false }],
      nativeCauseCode: "NO_LAYOUT_BOX", nativeCauseCount: 1, nativeStage: "runtime-call-function-on",
      scopeRejections: [], rejections: [{ index: 2, reasons: ["NO_LAYOUT_BOX", "ARIA_HIDDEN"] }] },
  ] as const;
  let coherentCalls = 0;
  let releases = 0;
  let loaderReads = 0;
  let observationSource = "";
  const runtime = { async send(_tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>) {
    if (method === "Page.getFrameTree") { loaderReads += 1; return { frameTree: { frame: { loaderId: "loader-a" } } }; }
    if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
    if (method === "DOM.resolveNode") return { object: { objectId: "document-object" } };
    if (method === "Runtime.releaseObject") { releases += 1; return {}; }
    if (method === "Runtime.callFunctionOn") {
      coherentCalls += 1;
      observationSource = String(parameters?.functionDeclaration ?? "");
      assert.equal(parameters?.objectId, "document-object");
      assert.deepEqual((parameters?.arguments as readonly Readonly<{ value: unknown }>[])?.[0]?.value, queries);
      assert.match(String(parameters?.functionDeclaration), /^async function \(specs\)/u);
      assert.equal(parameters?.awaitPromise, true);
      assert.match(String(parameters?.functionDeclaration), /eligibilityReasons\(node, facts, spec, true\)\.length === 0/u,
        "coherent observation eligibility must be derived from the same bounded rejection reasons");
      for (const reason of ["DISCONNECTED", "NO_LAYOUT_BOX", "DISPLAY_HIDDEN", "VISIBILITY_HIDDEN",
        "OPACITY_HIDDEN", "HTML_HIDDEN", "ARIA_HIDDEN", "INERT", "TEXT_MISMATCH"]) {
        assert.match(String(parameters?.functionDeclaration), new RegExp(reason, "u"),
          `coherent observation must preserve the bounded ${reason} rejection reason`);
      }
      return { result: { value: { currentUrl: "https://chatgpt.com/", observedAt, queries: rows } } };
    }
    throw new Error(`UNEXPECTED_COHERENT_OBSERVATION_METHOD:${method}`);
  } } as ExtensionDebuggerRuntime;
  const command = { kind: "observe" as const, queries };
  const packet = await executeRegisteredDomIntent(runtime, {
    tabId: 105, targetRef: "target-105", documentRef: "document-9", navigationEpoch: 9,
  }, command) as Readonly<Record<string, unknown>>;
  assert.equal(coherentCalls, 1, "all query specs must execute in one Runtime.callFunctionOn");
  await exerciseCapturedObservationFunction(observationSource);
  assert.equal(loaderReads, 2, "the exact main-frame loader must remain unchanged around the one DOM call");
  assert.equal(releases, 1);
  assert.equal(packet.schemaVersion, "grasseye.browser.dom-observation.v2");
  assert.equal(packet.currentUrl, "https://chatgpt.com/");
  assert.equal(packet.observedAt, observedAt);
  const packetQueries = packet.queries as readonly Readonly<Record<string, unknown>>[];
  assert.equal((packetQueries[0]?.matches as readonly unknown[]).length, 1);
  for (const query of packetQueries) for (const match of query.matches as readonly Readonly<Record<string, unknown>>[]) {
    assert.match(String(match.observationIdentityHash), /^sha256:[a-f0-9]{64}$/u);
  }
  assert.deepEqual(packetQueries[1]?.rejections,
    [{ index: 2, reasons: ["NO_LAYOUT_BOX", "ARIA_HIDDEN"] }]);
  assert.equal((packetQueries[0]?.rejections as readonly unknown[]).length, 4,
    "all rejection reasons must survive even when they exceed maxMatches + 1");
  for (const key of ["targetRefHash", "documentRefHash", "observationRevisionHash"]) {
    assert.match(String(packet[key]), /^sha256:[a-f0-9]{64}$/u);
  }
  await exerciseCoherentObservationFailures(runtime, command, observedAt, rows);
};

export const exerciseLocalBrowserDomIntent = async (): Promise<void> => {
  await exerciseUniversalPostActionReadGate();
  await exerciseComposerReadiness();
  await exerciseDomFailures();
  await exerciseLateTextMatch();
  await exerciseUntruncatedRead();
  await exerciseMechanicalFacts();
  await exerciseSeparatedMechanicalEligibility();
  await exerciseCoherentObservation();
  await exerciseExactAssistantTurnRead();
  await exerciseDomMutations();
  await exerciseFileInput();
};
