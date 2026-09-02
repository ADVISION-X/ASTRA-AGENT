import assert from "../audit/shared/governance-exam-assert.js";

import type { ExtensionDebuggerRuntime } from
  "../../src/lib/browser/chrome-extension/debugger-runtime.js";
import { executeRegisteredDomIntent } from
  "../../src/lib/browser/chrome-extension/dom-intent-runtime.js";

const exerciseComposerReadiness = async (): Promise<void> => {
  let delayedQueries = 0;
  const delayed = { async send(_tabId: number, method: string) {
    if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
    if (method === "DOM.querySelectorAll") {
      delayedQueries += 1;
      return { nodeIds: delayedQueries < 3 ? [] : [7] };
    }
    if (method === "DOM.getBoxModel") return { model: { content: [0, 0, 10, 0, 10, 10, 0, 10] } };
    throw new Error(`UNEXPECTED_DELAYED_COMPOSER_METHOD:${method}`);
  } } as ExtensionDebuggerRuntime;
  const found = await executeRegisteredDomIntent(delayed, { tabId: 99 } as never, {
    kind: "find", selector: "#prompt-textarea", maxMatches: 2,
    waitFor: { minimumMatches: 1, timeoutMs: 500 },
  }) as Readonly<{ count: number }>;
  assert.equal(found.count, 1);
  assert.equal(delayedQueries, 3);
  const missing = { async send(_tabId: number, method: string) {
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
  const runtime = (failure: "missing" | "ambiguous" | "stale" | "box" | "malformed-box" | "invalid" | "target") => ({
    async send(_tabId: number, method: string) {
      if (method === "DOM.getDocument") {
        if (failure === "target") throw new Error("BROWSER_TARGET_INVALID");
        return { root: { nodeId: 1 } };
      }
      if (method === "DOM.querySelectorAll") {
        if (failure === "invalid") return { nodeIds: "not-an-array" };
        if (failure === "missing") return { nodeIds: [] };
        if (failure === "ambiguous") return { nodeIds: [7, 8] };
        return { nodeIds: [7] };
      }
      if (method === "DOM.getBoxModel") {
        if (failure === "stale") throw new Error("Could not find node with given id");
        if (failure === "box") throw new Error("Could not compute box model");
        if (failure === "malformed-box") return { model: { content: [0, "invalid"] } };
        return { model: { content: [0, 0, 10, 0, 10, 10, 0, 10] } };
      }
      throw new Error(`UNEXPECTED_DOM_FAILURE_METHOD:${method}`);
    },
  }) as ExtensionDebuggerRuntime;
  const noBox = await executeRegisteredDomIntent(runtime("box"), { tabId: 100 } as never, {
    kind: "find", selector: "[data-turn='user']", maxMatches: 1, fields: [],
  }) as Readonly<{ count: number }>;
  assert.equal(noBox.count, 0, "a recognized no-layout box is an invisible candidate, not a DOM read failure");
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
    if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
    if (method === "DOM.querySelectorAll") return { nodeIds: Array.from({ length: 25 }, (_, index) => index + 2) };
    if (method === "DOM.describeNode") {
      describeCalls += 1;
      const nodeId = Number(parameters?.nodeId);
      return { node: { nodeId, backendNodeId: nodeId + 100, nodeName: "BUTTON", attributes: [],
        children: [{ nodeValue: nodeId === 26 ? "GPT-5.6" : `unrelated-${nodeId}` }] } };
    }
    if (method === "DOM.getBoxModel") return { model: { content: [0, 0, 10, 0, 10, 10, 0, 10] } };
    throw new Error(`UNEXPECTED_LATE_TEXT_METHOD:${method}`);
  } } as ExtensionDebuggerRuntime;
  const match = await executeRegisteredDomIntent(runtime, { tabId: 101 } as never, {
    kind: "find", selector: "button", textContains: "GPT", maxMatches: 2, fields: ["text"],
  }) as Readonly<{ count: number; matches: readonly Readonly<{ text: string }>[] }>;
  assert.deepEqual(match, { count: 1, matches: [{ text: "GPT-5.6" }] });
  assert.ok(describeCalls > 20);
};

const exerciseReasoningSlider = async (): Promise<void> => {
  for (const [key, virtualKeyCode, repeat] of [["ArrowLeft", 37, 1], ["ArrowRight", 39, 4]] as const) {
    const events: Readonly<Record<string, unknown>>[] = [];
    const runtime = { async send(_tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>) {
      if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
      if (method === "DOM.querySelectorAll") return { nodeIds: [7] };
      if (method === "DOM.getBoxModel") return { model: { content: [0, 0, 10, 0, 10, 10, 0, 10] } };
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
    if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
    if (method === "DOM.querySelectorAll") return { nodeIds: [7] };
    if (method === "DOM.getBoxModel") return { model: { content: [0, 0, 10, 0, 10, 10, 0, 10] } };
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
  await exerciseReasoningSlider();
  await exerciseContentEditableFill();
};
