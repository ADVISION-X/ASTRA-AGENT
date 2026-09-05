import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";

import type { ExtensionDebuggerRuntime } from
  "../../src/lib/browser/chrome-extension/debugger-runtime.js";
import { executeRegisteredDomIntent } from
  "../../src/lib/browser/chrome-extension/dom-intent-runtime.js";
import { exerciseCapturedCandidateFunction, exerciseCapturedCoherentObservationPointerFunction } from
  "./local-browser-dom-function-support.js";
import { exerciseContentEditableFill, exerciseFillReadbackRejection } from
  "./local-browser-dom-fill-support.js";
import { browserDomFacts as facts, mutationInfrastructureReply } from
  "./local-browser-dom-runtime-fixture.js";

type PointerClickIntent = Extract<Parameters<typeof executeRegisteredDomIntent>[2], {
  kind: "click" | "doubleClick";
}>;

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

const redrawKeypressRuntime = (staleAfterResolve: boolean) => {
  let preconditionRead = false;
  let candidateNodeId = 0;
  const physicalEvents: string[] = [];
  const runtime = { async send(
    _tabId: number,
    method: string,
    parameters?: Readonly<Record<string, unknown>>,
  ) {
    if (method === "DOM.requestNode") {
      candidateNodeId = preconditionRead ? 8 : 7;
      return { nodeId: candidateNodeId };
    }
    if (method === "Runtime.callFunctionOn" && parameters?.objectId === `node-${candidateNodeId}`
      && (candidateNodeId === 7 || staleAfterResolve)) throw new Error("Could not find node with given id");
    const infrastructure = mutationInfrastructureReply(method, parameters);
    if (infrastructure !== undefined) return infrastructure;
    if (method === "DOM.querySelectorAll") {
      preconditionRead = true;
      return { nodeIds: physicalEvents.length === 0 ? [] : [9] };
    }
    if (method === "DOM.focus" || method === "Input.dispatchKeyEvent") {
      physicalEvents.push(method);
      return {};
    }
    throw new Error(`UNEXPECTED_REDRAW_KEYPRESS_METHOD:${method}`);
  } } as ExtensionDebuggerRuntime;
  return { runtime, candidateNodeId: () => candidateNodeId, physicalEvents };
};

const exerciseFreshKeypressCandidate = async (): Promise<void> => {
  const intent = { kind: "keypress", selector: "[role='menuitem'][aria-label='能力']",
    key: "ArrowRight", expectedMatches: 1,
    postKeypressMatch: { selector: "[role='slider'][aria-valuenow='2']", expectedMatches: 1,
      readEligibility: "non-actionable-aria-state" } } as const;
  const redrawn = redrawKeypressRuntime(false);
  const success = await executeRegisteredDomIntent(
    redrawn.runtime, { tabId: 104 } as never, intent, () => undefined,
  ) as Readonly<Record<string, unknown>>;
  assert.equal(redrawn.candidateNodeId(), 8,
    "keypress must resolve its candidate after the zero-action pre-read can redraw the Provider DOM");
  assert.equal(success.postconditionVerified, true);
  assert.deepEqual(redrawn.physicalEvents,
    ["DOM.focus", "Input.dispatchKeyEvent", "Input.dispatchKeyEvent"]);

  const stale = redrawKeypressRuntime(true);
  const rejected = await executeRegisteredDomIntent(
    stale.runtime, { tabId: 105 } as never, intent, () => undefined,
  );
  assert.deepEqual(rejected, { candidateCount: 1, qualificationStage: "actionability",
    identityRevalidated: false, mutationCount: 0, postconditionVerified: false,
    qualificationRejected: true, failureCode: "BROWSER_DOM_ACTION_NOT_QUALIFIED",
    nativeCauseCode: "BROWSER_DOM_NODE_STALE" });
  assert.equal(stale.candidateNodeId(), 8);
  assert.deepEqual(stale.physicalEvents, [],
    "a node that becomes stale after fresh resolution must fail closed without input or fallback");
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

const coherentPostconditionQueries = [
  { queryId: "entry", selector: "[role='menuitem']", maxMatches: 2, fields: [],
    expectedEligibleCount: 0 },
  { queryId: "advanced", selector: "[data-active='true']", maxMatches: 2,
    fields: ["ariaExpanded"],
    expectedEligibleCount: 1 },
] as const;

const coherentObservation = (open: boolean) => ({
  currentUrl: "https://chatgpt.com/", observedAt: "2026-09-04T00:00:00.000Z",
  queries: [
    { queryId: "entry", scopeRawCount: 1, scopeEligibleCount: 1, rawCount: 1,
      eligibleCount: open ? 0 : 1, matches: open ? [] : [{ candidateIndex: 0 }],
      scopeRejections: [], rejections: open ? [{ index: 0, reasons: ["ARIA_HIDDEN"] }] : [],
      nativeCauseCode: null, nativeCauseCount: 0, nativeStage: "runtime-call-function-on" },
    { queryId: "advanced", scopeRawCount: 1, scopeEligibleCount: 1, rawCount: open ? 1 : 0,
      eligibleCount: open ? 1 : 0,
      matches: open ? [{ candidateIndex: 0, ariaExpanded: "true" }] : [],
      scopeRejections: [], rejections: [], nativeCauseCode: null, nativeCauseCount: 0,
      nativeStage: "runtime-call-function-on" },
  ],
});

const coherentRuntimeFor = (settles: boolean, externallyOpensAtObservation?: number) => {
  let clicked = false;
  let coherentCalls = 0;
  let pointerEvents = 0;
  let atomicSource = "";
  const runtime = { async send(
    _tabId: number,
    method: string,
    parameters?: Readonly<Record<string, unknown>>,
  ) {
    const functionDeclaration = String(parameters?.functionDeclaration ?? "");
    if (method === "Runtime.callFunctionOn" && functionDeclaration.startsWith("function (request)")) {
      atomicSource = functionDeclaration;
      coherentCalls += 1;
      const open = clicked || (externallyOpensAtObservation !== undefined
        && coherentCalls >= externallyOpensAtObservation);
      return { result: { value: open
        ? { kind: "postcondition", observation: coherentObservation(true) }
        : { kind: "pointer", point: { x: 5, y: 5 } } } };
    }
    if (method === "Runtime.callFunctionOn" && functionDeclaration.startsWith("async function (specs)")) {
      coherentCalls += 1;
      const open = (clicked && settles)
        || (externallyOpensAtObservation !== undefined && coherentCalls >= externallyOpensAtObservation);
      return { result: { value: coherentObservation(open) } };
    }
    const infrastructure = mutationInfrastructureReply(method, parameters);
    if (infrastructure !== undefined) return infrastructure;
    if (method === "Input.dispatchMouseEvent") {
      pointerEvents += 1;
      if (parameters?.type === "mouseReleased") clicked = true;
      return {};
    }
    throw new Error(`UNEXPECTED_COHERENT_CLICK_METHOD:${method}`);
  } } as ExtensionDebuggerRuntime;
  return { runtime, coherentCalls: () => coherentCalls, pointerEvents: () => pointerEvents,
    atomicSource: () => atomicSource };
};

const exerciseCoherentClickPostcondition = async (): Promise<void> => {
  const target = {
    tabId: 125, targetRef: "target-125", documentRef: "document-125", navigationEpoch: 1,
  } as never;
  const settled = coherentRuntimeFor(true);
  const success = await executeRegisteredDomIntent(settled.runtime, target, {
    kind: "click", selector: "button", expectedMatches: 1,
    postClickObservation: { queries: coherentPostconditionQueries, timeoutMs: 10 },
  }, () => undefined) as Readonly<Record<string, unknown>>;
  assert.equal(success.postconditionVerified, true);
  assert.equal((success.postconditionObservation as Readonly<Record<string, unknown>>)
    .schemaVersion, "grasseye.browser.dom-observation.v2");
  assert.equal(((success.postconditionObservation as Readonly<Record<string, unknown>>)
    .queries as readonly Readonly<Record<string, unknown>>[])[0]?.rawCount, 1,
  "a retained but mechanically ineligible DOM node must satisfy expected eligible cardinality zero");
  assert.equal(((((success.postconditionObservation as Readonly<Record<string, unknown>>)
    .queries as readonly Readonly<Record<string, unknown>>[])[1]?.matches as
      readonly Readonly<Record<string, unknown>>[])[0])?.ariaExpanded, "true");

  const raced = coherentRuntimeFor(true, 1);
  const zeroAction = await executeRegisteredDomIntent(raced.runtime, target, {
    kind: "click", selector: "button", expectedMatches: 1,
    postClickObservation: { queries: coherentPostconditionQueries, timeoutMs: 10 },
  }, () => undefined) as Readonly<Record<string, unknown>>;
  assert.equal(zeroAction.mutationCount, 0);
  assert.equal(zeroAction.zeroActionSatisfied, true);
  assert.equal(zeroAction.postconditionVerified, true);
  assert.equal(raced.pointerEvents(), 0,
    "a postcondition already true in the atomic preparation snapshot must not be clicked");
  assert.match(raced.atomicSource(), /if \(postconditionSatisfied\) return \{ kind: "postcondition", observation \};[\s\S]*const scopeRaw = request\.candidate\.scope/u,
    "one Runtime.callFunctionOn snapshot must choose postcondition or a freshly qualified pointer before returning");
  exerciseCapturedCoherentObservationPointerFunction(raced.atomicSource());

  const stuck = coherentRuntimeFor(false);
  const rejected = await executeRegisteredDomIntent(stuck.runtime, target, {
    kind: "click", selector: "button", expectedMatches: 1,
    postClickObservation: { queries: coherentPostconditionQueries, timeoutMs: 10 },
  }, () => undefined) as Readonly<Record<string, unknown>>;
  assert.equal(rejected.postconditionVerified, false);
  assert.equal(rejected.failureCode, "BROWSER_POSTCONDITION_FAILED");
  assert.equal(rejected.nativeCauseCode, "BROWSER_DOM_CANDIDATE_AMBIGUOUS");
  assert.ok(stuck.coherentCalls() >= 3,
    "an ordinary deadline miss must return the final coherent negative readback instead of DOM_READ_INVALID");
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
    if (method === "Runtime.callFunctionOn"
      && String(parameters?.functionDeclaration ?? "").includes("browserExactEditableText")) {
      return { result: { value: events.length === 0 ? "stale" : "approved" } };
    }
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
  await exerciseFreshKeypressCandidate();
  await exerciseContentEditableFill();
  await exerciseFillReadbackRejection();
  await exerciseScopedExactCandidate();
  await exerciseNativePointerSequences();
  await exerciseCoherentClickPostcondition();
  await exerciseMutationDocumentGuard();
};
