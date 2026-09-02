import assert from "../audit/shared/governance-exam-assert.js";

import type { ExtensionDebuggerRuntime } from
  "../../src/lib/browser/chrome-extension/debugger-runtime.js";
import { executeRegisteredDomIntent } from
  "../../src/lib/browser/chrome-extension/dom-intent-runtime.js";
import { assertBrowserDomIntent } from
  "../../src/lib/browser/exact-target/browser-dom-intent.js";

const mechanicalFacts = (overrides: Readonly<Record<string, unknown>> = {}) => ({
  connected: true, layout: true, visible: true,
  computedDisplay: "block", computedVisibility: "visible", computedOpacity: "1",
  hidden: false, ariaHidden: false, inert: false, disabled: false, ariaDisabled: false,
  role: "", name: "", testId: "", label: "", value: "", checked: null, type: "",
  bounds: { x: 0, y: 0, width: 10, height: 10 }, viewport: true, hitTest: true,
  nativeCauseCode: null, nativeStage: "runtime-call-function-on",
  ...overrides,
});

const mechanicalReply = (
  method: string,
  overrides: Readonly<Record<string, unknown>> = {},
): unknown | undefined => {
  if (method === "DOM.resolveNode") return { object: { objectId: "node-object" } };
  if (method === "Runtime.callFunctionOn") return { result: { value: mechanicalFacts(overrides) } };
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
    const mechanical = mechanicalReply(method);
    if (mechanical !== undefined) return mechanical;
    if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
    if (method === "DOM.querySelectorAll") {
      delayedQueries += 1;
      return { nodeIds: delayedQueries < 3 ? [] : [7] };
    }
    throw new Error(`UNEXPECTED_DELAYED_COMPOSER_METHOD:${method}`);
  } } as unknown as ExtensionDebuggerRuntime;
  const found = await executeRegisteredDomIntent(delayed, { tabId: 99 } as never, {
    kind: "find", selector: "#prompt-textarea", maxMatches: 2,
    waitFor: { minimumMatches: 1, timeoutMs: 500 },
  }) as Readonly<{ count: number }>;
  assert.equal(found.count, 1);
  assert.equal(delayedQueries, 3);
  const missing = { async send(_tabId: number, method: string) {
    const mechanical = mechanicalReply(method);
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
    async send(_tabId: number, method: string) {
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
    const mechanical = mechanicalReply(method);
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
      "computedOpacity", "hidden", "ariaHidden", "inert", "disabled", "ariaDisabled",
      "role", "name", "testId", "label", "value", "checked", "type", "bounds",
      "viewport", "hitTest",
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
    computedDisplay: "block", computedVisibility: "visible", computedOpacity: "1",
    hidden: false, ariaHidden: false, inert: false, disabled: false, ariaDisabled: true,
    role: "button", name: "model", testId: "model-button", label: "Model",
    value: "gpt-5.6", checked: true, type: "button",
    bounds: { x: 0, y: 0, width: 10, height: 10 }, viewport: true, hitTest: true,
    nativeCauseCode: null, nativeStage: "runtime-call-function-on",
  });
};

const exerciseCoherentObservation = async (): Promise<void> => {
  const observedAt = "2026-09-02T12:34:56.789Z";
  const queries = [
    { queryId: "model-entry", selector: "button", maxMatches: 1, fields: ["role", "visible"] as const },
    { queryId: "attachments", selector: "[data-file]", maxMatches: 2,
      fields: ["label", "disabled"] as const, scope: { selector: "main" } },
  ] as const;
  const rows = [
    { queryId: "model-entry", scopeRawCount: 1, scopeEligibleCount: 1, rawCount: 1,
      eligibleCount: 1, matches: [{ role: "button", visible: true }], nativeCauseCode: null,
      nativeCauseCount: 0, nativeStage: "runtime-call-function-on" },
    { queryId: "attachments", scopeRawCount: 1, scopeEligibleCount: 1, rawCount: 2,
      eligibleCount: 2, matches: [{ label: "a.pdf", disabled: false }, { label: "b.pdf", disabled: false }],
      nativeCauseCode: null, nativeCauseCount: 0, nativeStage: "runtime-call-function-on" },
  ] as const;
  let coherentCalls = 0;
  let releases = 0;
  const runtime = { async send(_tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>) {
    if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
    if (method === "DOM.resolveNode") return { object: { objectId: "document-object" } };
    if (method === "Runtime.releaseObject") { releases += 1; return {}; }
    if (method === "Runtime.callFunctionOn") {
      coherentCalls += 1;
      assert.equal(parameters?.objectId, "document-object");
      assert.deepEqual((parameters?.arguments as readonly Readonly<{ value: unknown }>[])?.[0]?.value, queries);
      assert.match(String(parameters?.functionDeclaration), /^function \(specs\)/u);
      return { result: { value: { observedAt, queries: rows } } };
    }
    throw new Error(`UNEXPECTED_COHERENT_OBSERVATION_METHOD:${method}`);
  } } as ExtensionDebuggerRuntime;
  const packet = await executeRegisteredDomIntent(runtime, {
    tabId: 105, targetRef: "target-105", documentRef: "document-9", navigationEpoch: 9,
  }, { kind: "observe", queries }) as Readonly<Record<string, unknown>>;
  assert.equal(coherentCalls, 1, "all query specs must execute in one Runtime.callFunctionOn");
  assert.equal(releases, 1);
  assert.equal(packet.schemaVersion, "grasseye.browser.dom-observation.v1");
  assert.equal(packet.observedAt, observedAt);
  assert.deepEqual(packet.queries, rows);
  for (const key of ["targetRefHash", "documentRefHash", "observationRevisionHash"]) {
    assert.match(String(packet[key]), /^sha256:[a-f0-9]{64}$/u);
  }
  assert.throws(() => assertBrowserDomIntent({ kind: "observe", queries: [{
    queryId: "forged", selector: "button", maxMatches: 1, fields: ["visible"], callerScript: "return true",
  } as never] }), /BROWSER_COMMAND_PERMIT_INVALID/u);
  const malformed = { ...runtime, async send(tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>) {
    if (method === "Runtime.callFunctionOn") return { result: { value: {
      observedAt, queries: [{ ...rows[0], matches: [{ visible: "yes", role: "button" }] }, rows[1]],
    } } };
    return runtime.send(tabId, method, parameters);
  } } as ExtensionDebuggerRuntime;
  await assert.rejects(executeRegisteredDomIntent(malformed, {
    tabId: 105, targetRef: "target-105", documentRef: "document-9", navigationEpoch: 9,
  }, { kind: "observe", queries }), /BROWSER_DOM_READ_INVALID/u);
  const changedDocument = { async send(_tabId: number, method: string) {
    if (method === "DOM.getDocument") throw new Error("BROWSER_DOCUMENT_INVALID");
    throw new Error(`UNEXPECTED_CHANGED_DOCUMENT_METHOD:${method}`);
  } } as unknown as ExtensionDebuggerRuntime;
  await assert.rejects(executeRegisteredDomIntent(changedDocument, {
    tabId: 105, targetRef: "target-105", documentRef: "document-10", navigationEpoch: 10,
  }, { kind: "observe", queries }), /BROWSER_DOCUMENT_INVALID/u);
};

const exerciseReasoningSlider = async (): Promise<void> => {
  for (const [key, virtualKeyCode, repeat] of [["ArrowLeft", 37, 1], ["ArrowRight", 39, 4]] as const) {
    const events: Readonly<Record<string, unknown>>[] = [];
    const runtime = { async send(_tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>) {
      const mechanical = mechanicalReply(method);
      if (mechanical !== undefined) return mechanical;
      if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
      if (method === "DOM.querySelectorAll") return { nodeIds: [7] };
      if (method === "DOM.focus") return {};
      if (method === "Input.dispatchKeyEvent") { events.push(parameters ?? {}); return {}; }
      throw new Error(`UNEXPECTED_REASONING_SLIDER_METHOD:${method}`);
    } } as ExtensionDebuggerRuntime;
    const result = await executeRegisteredDomIntent(runtime, { tabId: 102 } as never, {
      kind: "keypress", selector: "[role='slider']", key, repeat, expectedMatches: 1,
      postKeypressMatch: { selector: "[role='slider'][aria-valuenow='4']", expectedMatches: 1, timeoutMs: 5_000 },
    }) as Readonly<{ postconditionVerified: boolean }>;
    assert.equal(result.postconditionVerified, true);
    const expected = Array.from({ length: repeat }, () => [
      { type: "rawKeyDown", key, code: key, windowsVirtualKeyCode: virtualKeyCode, nativeVirtualKeyCode: virtualKeyCode },
      { type: "keyUp", key, code: key, windowsVirtualKeyCode: virtualKeyCode, nativeVirtualKeyCode: virtualKeyCode },
    ]).flat();
    assert.deepEqual(events.map((event) => ({ type: event.type, key: event.key, code: event.code,
      windowsVirtualKeyCode: event.windowsVirtualKeyCode, nativeVirtualKeyCode: event.nativeVirtualKeyCode })), expected);
  }
};

const exerciseContentEditableFill = async (): Promise<void> => {
  let text = "stale SEO prompt";
  const events: Readonly<Record<string, unknown>>[] = [];
  const runtime = { async send(_tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>) {
    const mechanical = mechanicalReply(method);
    if (mechanical !== undefined) return mechanical;
    if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
    if (method === "DOM.querySelectorAll") return { nodeIds: [7] };
    if (method === "DOM.focus") return {};
    if (method === "Input.dispatchKeyEvent") {
      events.push(parameters ?? {});
      if (parameters?.type === "rawKeyDown" && parameters.key === "Backspace") text = "";
      return {};
    }
    if (method === "Input.insertText") { text += String(parameters?.text ?? ""); return {}; }
    if (method === "DOM.describeNode") return { node: { nodeId: 7, backendNodeId: 107,
      nodeName: "DIV", attributes: ["contenteditable", "true"],
      children: text.length === 0 ? [] : [{ nodeName: "P", nodeValue: text }] } };
    throw new Error(`UNEXPECTED_CONTENTEDITABLE_FILL_METHOD:${method}`);
  } } as ExtensionDebuggerRuntime;
  const cleared = await executeRegisteredDomIntent(runtime, { tabId: 103 } as never, {
    kind: "fill", selector: "#prompt-textarea", approvedText: "", clearBeforeType: true, expectedMatches: 1,
  });
  assert.deepEqual(cleared, { filled: true, candidateCount: 1, identityRevalidated: true,
    mutationCount: 1, retainedValueVerified: true, postconditionVerified: true });
  assert.deepEqual(events, [
    { type: "rawKeyDown", key: "a", code: "KeyA", commands: ["selectAll"] },
    { type: "keyUp", key: "a", code: "KeyA" },
    { type: "rawKeyDown", key: "Backspace", code: "Backspace" },
    { type: "keyUp", key: "Backspace", code: "Backspace" },
  ]);
};

export const exerciseLocalBrowserDomIntent = async (): Promise<void> => {
  await exerciseComposerReadiness();
  await exerciseDomFailures();
  await exerciseLateTextMatch();
  await exerciseMechanicalFacts();
  await exerciseCoherentObservation();
  await exerciseReasoningSlider();
  await exerciseContentEditableFill();
};
