import assert from "../audit/shared/governance-exam-assert.js";

import type { ExtensionDebuggerRuntime } from
  "../../src/lib/browser/chrome-extension/debugger-runtime.js";
import { executeRegisteredDomIntent } from
  "../../src/lib/browser/chrome-extension/dom-intent-runtime.js";
import { exerciseCapturedCandidateFunction } from "./local-browser-dom-function-support.js";

const facts = (overrides: Readonly<Record<string, unknown>> = {}) => ({
  connected: true, layout: true, visible: true,
  computedDisplay: "block", computedVisibility: "visible", computedOpacity: "1", effectiveOpacity: "1",
  displayHidden: false, visibilityHidden: false, opacityHidden: false,
  hidden: false, ariaHidden: false, inert: false, disabled: false, ariaDisabled: false,
  role: "", name: "", testId: "", label: "", value: "", checked: null, type: "",
  bounds: { x: 0, y: 0, width: 10, height: 10 }, viewport: true, hitTest: true,
  nativeCauseCode: null, nativeStage: "runtime-call-function-on", ...overrides,
});

const mutationInfrastructureReply = (
  method: string,
  parameters?: Readonly<Record<string, unknown>>,
): unknown | undefined => {
  if (method === "Page.getFrameTree") return { frameTree: { frame: { loaderId: "loader-current" } } };
  if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
  if (method === "DOM.resolveNode") return { object: { objectId: "candidate-root" } };
  if (method === "Runtime.callFunctionOn" && parameters?.returnByValue === false) {
    return { result: { type: "object", subtype: "node", objectId: "candidate-node" } };
  }
  if (method === "Runtime.callFunctionOn") return { result: { value: facts() } };
  if (method === "DOM.requestNode") return { nodeId: 7 };
  if (method === "Runtime.releaseObject") return {};
  return undefined;
};

const exerciseReasoningSlider = async (): Promise<void> => {
  for (const [key, virtualKeyCode, repeat] of [["ArrowLeft", 37, 1], ["ArrowRight", 39, 4]] as const) {
    const events: Readonly<Record<string, unknown>>[] = [];
    const runtime = { async send(_tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>) {
      const infrastructure = mutationInfrastructureReply(method, parameters);
      if (infrastructure !== undefined) return infrastructure;
      if (method === "DOM.querySelectorAll") {
        const selector = String(parameters?.selector ?? "");
        return { nodeIds: selector.includes("aria-valuenow") && events.length === 0 ? [] : [7] };
      }
      if (method === "DOM.focus") return {};
      if (method === "Input.dispatchKeyEvent") { events.push(parameters ?? {}); return {}; }
      throw new Error(`UNEXPECTED_REASONING_SLIDER_METHOD:${method}`);
    } } as ExtensionDebuggerRuntime;
    const result = await executeRegisteredDomIntent(runtime, { tabId: 102 } as never, {
      kind: "keypress", selector: "[role='slider']", key, repeat, expectedMatches: 1,
      postKeypressMatch: { selector: "[role='slider'][aria-valuenow='4']", expectedMatches: 1, timeoutMs: 5_000 },
    }, () => undefined) as Readonly<{ postconditionVerified: boolean }>;
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
    const infrastructure = mutationInfrastructureReply(method, parameters);
    if (infrastructure !== undefined) return infrastructure;
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
  }, () => undefined);
  assert.deepEqual(cleared, { filled: true, candidateCount: 1, identityRevalidated: true,
    mutationCount: 1, retainedValueVerified: true, postconditionVerified: true });
  assert.deepEqual(events, [
    { type: "rawKeyDown", key: "a", code: "KeyA", commands: ["selectAll"] },
    { type: "keyUp", key: "a", code: "KeyA" },
    { type: "rawKeyDown", key: "Backspace", code: "Backspace" },
    { type: "keyUp", key: "Backspace", code: "Backspace" },
  ]);
};

const exerciseScopedExactCandidate = async (): Promise<void> => {
  let candidateSource = "";
  let candidateRequest: unknown;
  const runtime = { async send(_tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>) {
    if (method === "Runtime.callFunctionOn" && parameters?.returnByValue === false) {
      candidateSource = String(parameters.functionDeclaration ?? "");
      candidateRequest = (parameters.arguments as readonly Readonly<{ value: unknown }>[])?.[0]?.value;
      return { result: { type: "object", subtype: "node", objectId: "candidate-node" } };
    }
    const infrastructure = mutationInfrastructureReply(method, parameters);
    if (infrastructure !== undefined) return infrastructure;
    if (method === "DOM.querySelectorAll") return { nodeIds: [7] };
    throw new Error(`UNEXPECTED_SCOPED_CANDIDATE_METHOD:${method}`);
  } } as ExtensionDebuggerRuntime;
  await executeRegisteredDomIntent(runtime, { tabId: 107 } as never, {
    kind: "click", selector: "button", scope: { selector: "main" }, expectedMatches: 1,
    expectedTextEquals: "Run", postClickMatch: { selector: "done", expectedMatches: 1 },
  }, () => undefined);
  assert.deepEqual(candidateRequest, {
    selector: "button", scope: { selector: "main" }, text: { value: "Run", exact: true },
  });
  assert.match(candidateSource, /scopeRaw\.filter\(mechanicallyEligible\)/u,
    "scope qualification must not apply the target text predicate");
  assert.match(candidateSource, /raw\.filter\(targetEligible\)/u,
    "target exact text must apply only to target candidates");
  assert.match(candidateSource, /scopeRaw\.length \+ raw\.length > 256/u,
    "scope and target candidates must share one whole-call budget");
  exerciseCapturedCandidateFunction(candidateSource);
};

const guardRuntime = (events: string[], guardState: { current: boolean }): ExtensionDebuggerRuntime => ({
  async send(_tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>) {
    if (method.startsWith("Input.") || method === "DOM.focus") {
      assert.equal(guardState.current, true, `${method} must be immediately preceded by current Document proof`);
      guardState.current = false;
      events.push(method);
      return {};
    }
    guardState.current = false;
    const infrastructure = mutationInfrastructureReply(method, parameters);
    if (infrastructure !== undefined) return infrastructure;
    if (method === "DOM.querySelectorAll") return { nodeIds: events.length === 0 ? [] : [7] };
    if (method === "DOM.describeNode") return { node: {
      nodeId: 7, backendNodeId: 107, nodeName: "DIV",
      attributes: ["contenteditable", "true", "aria-expanded", "true"],
      children: [{ nodeName: "P", nodeValue: events.length === 0 ? "stale" : "approved" }],
    } };
    throw new Error(`UNEXPECTED_GUARD_METHOD:${method}`);
  },
}) as ExtensionDebuggerRuntime;

const exerciseMutationDocumentGuard = async (): Promise<void> => {
  const intents = [
    { kind: "click", selector: "button", expectedMatches: 1,
      postClickMatch: { selector: "done", expectedMatches: 1 } },
    { kind: "hover", selector: "button", expectedMatches: 1,
      postHoverAttribute: { name: "aria-expanded", equals: "true", timeoutMs: 10 } },
    { kind: "doubleClick", selector: "button", expectedMatches: 1,
      postDoubleClickMatch: { selector: "done", expectedMatches: 1 } },
    { kind: "keypress", selector: "button", key: "Enter", expectedMatches: 1,
      postKeypressMatch: { selector: "done", expectedMatches: 1 } },
    { kind: "fill", selector: "#prompt-textarea", approvedText: "approved",
      clearBeforeType: false, expectedMatches: 1 },
  ] as const;
  for (const [index, intent] of intents.entries()) {
    const events: string[] = [];
    const guardState = { current: false };
    await executeRegisteredDomIntent(
      guardRuntime(events, guardState), { tabId: 108 + index } as never, intent,
      () => { guardState.current = true; },
    );
    assert.ok(events.length > 0, `${intent.kind} must exercise its physical input path`);

    const rejectedEvents: string[] = [];
    let assertions = 0;
    await assert.rejects(executeRegisteredDomIntent(
      guardRuntime(rejectedEvents, { current: false }), { tabId: 118 + index } as never, intent,
      () => { assertions += 1; if (assertions === 2) throw new Error("BROWSER_DOCUMENT_INVALID"); },
    ), /BROWSER_DOCUMENT_INVALID/u);
    assert.deepEqual(rejectedEvents, [],
      `${intent.kind} Document drift before the first physical event must produce zero input`);
  }
};

export const exerciseDomMutations = async (): Promise<void> => {
  await exerciseReasoningSlider();
  await exerciseContentEditableFill();
  await exerciseScopedExactCandidate();
  await exerciseMutationDocumentGuard();
};
