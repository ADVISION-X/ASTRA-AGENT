import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";

import type { ExtensionDebuggerRuntime } from
  "../../src/lib/browser/chrome-extension/debugger-runtime.js";
import { executeRegisteredDomIntent } from
  "../../src/lib/browser/chrome-extension/dom-intent-runtime.js";
import { exerciseCapturedCandidateFunction } from "./local-browser-dom-function-support.js";

type PointerClickIntent = Extract<Parameters<typeof executeRegisteredDomIntent>[2], {
  kind: "click" | "doubleClick";
}>;

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
  if (method === "DOM.resolveNode") return { object: {
    objectId: parameters?.nodeId === 1 ? "candidate-root" : `node-${parameters?.nodeId}`,
  } };
  if (method === "Runtime.callFunctionOn" && parameters?.returnByValue === false) {
    return { result: { type: "object", subtype: "node", objectId: "candidate-node" } };
  }
  if (method === "Runtime.callFunctionOn" && parameters?.returnByValue === true
    && String(parameters.functionDeclaration).includes("spec.output")) {
    return { result: { value: { x: 5, y: 5 } } };
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
      if (method === "Runtime.callFunctionOn" && parameters?.objectId === "node-8") {
        return { result: { value: facts({ ariaHidden: true }) } };
      }
      const infrastructure = mutationInfrastructureReply(method, parameters);
      if (infrastructure !== undefined) return infrastructure;
      if (method === "DOM.querySelectorAll") {
        const selector = String(parameters?.selector ?? "");
        return { nodeIds: selector.includes("aria-valuenow") && events.length === 0 ? [] : [8] };
      }
      if (method === "DOM.focus") return {};
      if (method === "Input.dispatchKeyEvent") { events.push(parameters ?? {}); return {}; }
      throw new Error(`UNEXPECTED_REASONING_SLIDER_METHOD:${method}`);
    } } as ExtensionDebuggerRuntime;
    const result = await executeRegisteredDomIntent(runtime, { tabId: 102 } as never, {
      kind: "keypress", selector: "[role='menuitem'][aria-label='能力']:not([aria-disabled='true'])",
      key, repeat, expectedMatches: 1,
      postKeypressMatch: { selector: "[role='slider'][aria-valuenow='4']", expectedMatches: 1,
        readEligibility: "non-actionable-aria-state", timeoutMs: 5_000 },
    }, () => undefined) as Readonly<{ postconditionVerified: boolean; postconditionRawCount: number;
      postconditionEligibleCount: number; postconditionRejections: readonly unknown[] }>;
    assert.equal(result.postconditionVerified, true);
    assert.deepEqual({ raw: result.postconditionRawCount, eligible: result.postconditionEligibleCount,
      rejections: result.postconditionRejections }, { raw: 1, eligible: 1, rejections: [] });
    const expected = Array.from({ length: repeat }, () => [
      { type: "rawKeyDown", key, code: key, windowsVirtualKeyCode: virtualKeyCode, nativeVirtualKeyCode: virtualKeyCode },
      { type: "keyUp", key, code: key, windowsVirtualKeyCode: virtualKeyCode, nativeVirtualKeyCode: virtualKeyCode },
    ]).flat();
    assert.deepEqual(events.map((event) => ({ type: event.type, key: event.key, code: event.code,
      windowsVirtualKeyCode: event.windowsVirtualKeyCode, nativeVirtualKeyCode: event.nativeVirtualKeyCode })), expected);
  }
  const defaultEvents: Readonly<Record<string, unknown>>[] = [];
  const defaultRuntime = { async send(
    _tabId: number,
    method: string,
    parameters?: Readonly<Record<string, unknown>>,
  ) {
    if (method === "Runtime.callFunctionOn" && parameters?.objectId === "node-8") {
      return { result: { value: facts({ ariaHidden: true }) } };
    }
    const infrastructure = mutationInfrastructureReply(method, parameters);
    if (infrastructure !== undefined) return infrastructure;
    if (method === "DOM.querySelectorAll") {
      const selector = String(parameters?.selector ?? "");
      return { nodeIds: selector.includes("aria-valuenow") && defaultEvents.length === 0 ? [] : [8] };
    }
    if (method === "DOM.focus") return {};
    if (method === "Input.dispatchKeyEvent") { defaultEvents.push(parameters ?? {}); return {}; }
    throw new Error(`UNEXPECTED_DEFAULT_REASONING_METHOD:${method}`);
  } } as ExtensionDebuggerRuntime;
  const rejected = await executeRegisteredDomIntent(defaultRuntime, { tabId: 103 } as never, {
    kind: "keypress", selector: "[role='menuitem'][aria-label='能力']:not([aria-disabled='true'])",
    key: "ArrowRight", expectedMatches: 1,
    postKeypressMatch: { selector: "[role='slider'][aria-valuenow='4']", expectedMatches: 1, timeoutMs: 1 },
  }, () => undefined) as Readonly<Record<string, unknown>>;
  assert.deepEqual(rejected, {
    keyPressed: "ArrowRight", keypressCount: 1, candidateCount: 1, identityRevalidated: true,
    mutationCount: 1, postconditionVerified: false,
    postconditionRawCount: 1, postconditionEligibleCount: 0,
    postconditionRejections: [{ index: 0, reasons: ["ARIA_HIDDEN"] }],
    nativeCauseCode: "ARIA_HIDDEN", failureCode: "BROWSER_POSTCONDITION_FAILED",
  }, "ordinary postcondition matching must reject and preserve the aria-hidden cause");
};

const exerciseContentEditableFill = async (): Promise<void> => {
  let text = "stale SEO prompt";
  let candidateReads = 0;
  let finalReadNodeId: number | null = null;
  const events: Readonly<Record<string, unknown>>[] = [];
  const runtime = { async send(_tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>) {
    if (method === "DOM.requestNode") {
      candidateReads += 1;
      return { nodeId: candidateReads === 1 ? 7 : 8 };
    }
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
    if (method === "DOM.describeNode") {
      if (text.length === 0) finalReadNodeId = Number(parameters?.nodeId);
      return { node: { nodeId: parameters?.nodeId, backendNodeId: 107,
      nodeName: "DIV", attributes: ["contenteditable", "true"],
      children: text.length === 0 ? [] : [{ nodeName: "P", nodeValue: text }] } };
    }
    throw new Error(`UNEXPECTED_CONTENTEDITABLE_FILL_METHOD:${method}`);
  } } as ExtensionDebuggerRuntime;
  const cleared = await executeRegisteredDomIntent(runtime, { tabId: 103 } as never, {
    kind: "fill", selector: "#prompt-textarea", approvedText: "", clearBeforeType: true, expectedMatches: 1,
  }, () => undefined);
  assert.deepEqual(cleared, { filled: true, candidateCount: 1, identityRevalidated: true,
    mutationCount: 1, retainedValueVerified: true, postconditionVerified: true });
  assert.equal(candidateReads, 2, "fill postcondition must bind a fresh current candidate");
  assert.equal(finalReadNodeId, 8, "fill postcondition must not reuse the pre-action nodeId");
  assert.deepEqual(events, [
    { type: "rawKeyDown", key: "a", code: "KeyA", commands: ["selectAll"] },
    { type: "keyUp", key: "a", code: "KeyA" },
    { type: "rawKeyDown", key: "Backspace", code: "Backspace" },
    { type: "keyUp", key: "Backspace", code: "Backspace" },
  ]);
};

const exerciseFillReadbackRejection = async (): Promise<void> => {
  let candidateReads = 0;
  const runtime = { async send(_tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>) {
    if (method === "Runtime.callFunctionOn" && parameters?.returnByValue === false) {
      candidateReads += 1;
      return candidateReads === 1
        ? { result: { type: "object", subtype: "node", objectId: "candidate-node" } }
        : { result: { type: "string", value: "BROWSER_DOM_CANDIDATE_MISSING" } };
    }
    const infrastructure = mutationInfrastructureReply(method, parameters);
    if (infrastructure !== undefined) return infrastructure;
    if (method === "DOM.focus" || method === "Input.insertText") return {};
    if (method === "DOM.describeNode") return { node: { nodeId: 7, backendNodeId: 107,
      nodeName: "DIV", attributes: ["contenteditable", "true"],
      children: [{ nodeName: "P", nodeValue: "stale" }] } };
    throw new Error(`UNEXPECTED_FILL_READBACK_METHOD:${method}`);
  } } as ExtensionDebuggerRuntime;
  const rejected = await executeRegisteredDomIntent(runtime, { tabId: 117 } as never, {
    kind: "fill", selector: "#prompt-textarea", approvedText: "approved",
    clearBeforeType: false, expectedMatches: 1,
  }, () => undefined);
  assert.deepEqual(rejected, {
    filled: true, candidateCount: 0, identityRevalidated: false, mutationCount: 1,
    retainedValueVerified: false, postconditionVerified: false,
    failureCode: "BROWSER_POSTCONDITION_FAILED",
    nativeCauseCode: "BROWSER_DOM_CANDIDATE_MISSING",
  });
};

const exerciseScopedExactCandidate = async (): Promise<void> => {
  let candidateSource = "";
  let candidateRequest: unknown;
  const runtime = { async send(_tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>) {
    if (method === "Runtime.callFunctionOn" && parameters?.returnByValue === true
      && String(parameters.functionDeclaration).includes("spec.output")) {
      candidateSource = String(parameters.functionDeclaration ?? "");
      candidateRequest = (parameters.arguments as readonly Readonly<{ value: unknown }>[])?.[0]?.value;
      return { result: { value: { x: 5, y: 5 } } };
    }
    const infrastructure = mutationInfrastructureReply(method, parameters);
    if (infrastructure !== undefined) return infrastructure;
    if (method === "DOM.querySelectorAll") {
      return { nodeIds: parameters?.selector === "done" ? [] : [7] };
    }
    if (method === "Input.dispatchMouseEvent") return {};
    throw new Error(`UNEXPECTED_SCOPED_CANDIDATE_METHOD:${method}`);
  } } as ExtensionDebuggerRuntime;
  await executeRegisteredDomIntent(runtime, { tabId: 107 } as never, {
    kind: "click", selector: "button", scope: { selector: "main" }, expectedMatches: 1,
    expectedTextEquals: "Run", postClickMatch: { selector: "done", expectedMatches: 1 },
  }, () => undefined);
  assert.deepEqual(candidateRequest, {
    selector: "button", scope: { selector: "main" }, text: { value: "Run", exact: true }, output: "pointer",
  });
  assert.match(candidateSource, /scopeRaw\.filter\(mechanicallyEligible\)/u,
    "scope qualification must not apply the target text predicate");
  assert.match(candidateSource, /raw\.filter\(targetEligible\)/u,
    "target exact text must apply only to target candidates");
  assert.match(candidateSource, /scopeRaw\.length \+ raw\.length > 256/u,
    "scope and target candidates must share one whole-call budget");
  exerciseCapturedCandidateFunction(candidateSource);
};

const exerciseNativePointerSequences = async (): Promise<void> => {
  const run = async (intent: PointerClickIntent): Promise<readonly Readonly<Record<string, unknown>>[]> => {
    const events: Readonly<Record<string, unknown>>[] = [];
    let postconditionReads = 0;
    const runtime = { async send(_tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>) {
      const infrastructure = mutationInfrastructureReply(method, parameters);
      if (infrastructure !== undefined) return infrastructure;
      if (method === "DOM.querySelectorAll") {
        if (parameters?.selector !== "hydrated") return { nodeIds: [7] };
        if (events.length === 0) return { nodeIds: [] };
        postconditionReads += 1;
        return { nodeIds: postconditionReads < 2 ? [] : [7] };
      }
      if (method === "Input.dispatchMouseEvent") { events.push(parameters ?? {}); return {}; }
      throw new Error(`UNEXPECTED_POINTER_SEQUENCE_METHOD:${method}`);
    } } as ExtensionDebuggerRuntime;
    const result = await executeRegisteredDomIntent(runtime, { tabId: 121 } as never, intent,
      () => undefined) as Readonly<{ postconditionVerified: boolean }>;
    assert.equal(result.postconditionVerified, true,
      "pointer mutation must wait through shell-only rendering until its direct postcondition is ready");
    assert.equal(postconditionReads, 2);
    return events;
  };

  const point = { x: 5, y: 5 };
  const move = { type: "mouseMoved", ...point, button: "none", buttons: 0 };
  const press = (clickCount: 1 | 2) =>
    ({ type: "mousePressed", ...point, button: "left", buttons: 1, clickCount });
  const release = (clickCount: 1 | 2) =>
    ({ type: "mouseReleased", ...point, button: "left", buttons: 0, clickCount });
  assert.deepEqual(await run({ kind: "click", selector: "button", expectedMatches: 1,
    postClickMatch: { selector: "hydrated", expectedMatches: 1, timeoutMs: 200 } }),
  [move, press(1), release(1)]);
  assert.deepEqual(await run({ kind: "doubleClick", selector: "button", expectedMatches: 1,
    postDoubleClickMatch: { selector: "hydrated", expectedMatches: 1, timeoutMs: 200 } }),
  [move, press(1), release(1), press(2), release(2)]);
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
  await exerciseFillReadbackRejection();
  await exerciseScopedExactCandidate();
  await exerciseNativePointerSequences();
  await exerciseMutationDocumentGuard();
};
