import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";

import type { ExtensionDebuggerRuntime } from
  "../../src/lib/browser/chrome-extension/debugger-runtime.js";
import { executeRegisteredDomIntent } from
  "../../src/lib/browser/chrome-extension/dom-intent-runtime.js";
import { exerciseCapturedCandidateFunction } from "./local-browser-dom-candidate-support.js";
import { exerciseNativePointerSequences } from "./local-browser-dom-candidate-support.js";
import { coherentPostconditionQueries, exerciseCoherentClickPostcondition } from
  "./local-browser-dom-coherent-click-support.js";
import { exerciseContentEditableFill, exerciseFillReadbackRejection } from
  "./local-browser-dom-fill-support.js";
import { browserDomFacts as facts, mutationInfrastructureReply } from
  "./local-browser-dom-runtime-fixture.js";

const noPageReadBarrier = async (): Promise<void> => undefined;

type PointerClickIntent = Extract<Parameters<typeof executeRegisteredDomIntent>[2], {
  kind: "click" | "doubleClick";
}>;

const exerciseReasoningSlider = async (): Promise<void> => {
  for (const [key, virtualKeyCode, repeat] of [["ArrowLeft", 37, 1], ["ArrowRight", 39, 4]] as const) {
    const events: Readonly<Record<string, unknown>>[] = [];
    const runtime = { awaitPageReadPermission: noPageReadBarrier,
      async send(_tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>) {
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
  const defaultRuntime = { awaitPageReadPermission: noPageReadBarrier, async send(
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
  const runtime = { awaitPageReadPermission: noPageReadBarrier, async send(
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
  const runtime = { awaitPageReadPermission: noPageReadBarrier,
    async send(_tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>) {
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
  await exerciseCapturedCandidateFunction(candidateSource);
};

const exerciseExactOutgoingMismatchReadback = async (): Promise<void> => {
  const codes = [
    "BROWSER_DOM_ACTION_OUTGOING_STRUCTURE_MISMATCH",
    "BROWSER_DOM_ACTION_OUTGOING_PROMPT_HASH_MISMATCH",
    "BROWSER_DOM_ACTION_OUTGOING_ATTACHMENT_SET_MISMATCH",
  ] as const;
  for (const [index, failureCode] of codes.entries()) {
    const physicalEvents: string[] = [];
    const runtime = { awaitPageReadPermission: noPageReadBarrier, async send(
      _tabId: number,
      method: string,
      parameters?: Readonly<Record<string, unknown>>,
    ) {
      if (method === "Runtime.callFunctionOn" && parameters?.returnByValue === true
        && String(parameters.functionDeclaration).includes("spec.output")) {
        return { result: { value: failureCode } };
      }
      const infrastructure = mutationInfrastructureReply(method, parameters);
      if (infrastructure !== undefined) return infrastructure;
      if (method === "Input.dispatchMouseEvent") { physicalEvents.push(method); return {}; }
      throw new Error(`UNEXPECTED_OUTGOING_MISMATCH_METHOD:${method}`);
    } } as ExtensionDebuggerRuntime;
    const result = await executeRegisteredDomIntent(runtime, { tabId: 108 + index } as never, {
      kind: "click", selector: "button", expectedMatches: 1,
      preClickExactOutgoingTurn: {
        composerSelector: "composer", composerFormSelector: "form", attachmentSelector: "attachment",
        userTurnSelector: "user-turn",
        expectedPromptHash: `sha256:${"a".repeat(64)}`, expectedAttachmentLabels: [],
      },
      postClickMatch: { selector: "submitted", expectedMatches: 1 },
    }, () => undefined);
    assert.deepEqual(result, {
      candidateCount: 1, qualificationStage: "actionability", identityRevalidated: false,
      mutationCount: 0, postconditionVerified: false, qualificationRejected: true,
      failureCode, nativeCauseCode: null,
    });
    assert.deepEqual(physicalEvents, [], `${failureCode} must reject before physical input`);
  }
};

const exerciseExactOutgoingActionabilityWait = async (): Promise<void> => {
  const run = async (readyAt:number,timeoutMs:number) => {let qualifications=0;const physicalEvents:string[]=[];
    const runtime={awaitPageReadPermission:noPageReadBarrier,async send(_tabId:number,method:string,
      parameters?:Readonly<Record<string,unknown>>){if(method==="Runtime.callFunctionOn"
      &&parameters?.returnByValue===true&&String(parameters.functionDeclaration).includes("spec.output")){
        qualifications+=1;return{result:{value:qualifications<readyAt
          ?"BROWSER_DOM_ACTION_ARIA_DISABLED":{x:5,y:5}}};}
      const infrastructure=mutationInfrastructureReply(method,parameters);
      if(infrastructure!==undefined)return infrastructure;
      if(method==="DOM.querySelectorAll")return{nodeIds:parameters?.selector==="submitted"
        &&physicalEvents.length>0?[7]:[]};
      if(method==="Input.dispatchMouseEvent"){physicalEvents.push(method);return{};}
      throw new Error(`UNEXPECTED_OUTGOING_WAIT_METHOD:${method}`);}} as ExtensionDebuggerRuntime;
    const result=await executeRegisteredDomIntent(runtime,{tabId:120} as never,{
      kind:"click",selector:"button",expectedMatches:1,preClickExactOutgoingTurn:{
        composerSelector:"composer",composerFormSelector:"form",attachmentSelector:"attachment",
        userTurnSelector:"user-turn",expectedPromptHash:`sha256:${"a".repeat(64)}`,expectedAttachmentLabels:[]},
      postClickMatch:{selector:"submitted",expectedMatches:1,timeoutMs}},()=>undefined) as Readonly<Record<string,unknown>>;
    return{result,qualifications,physicalEvents};};
  const delayed = await run(3, 200);
  assert.equal(delayed.qualifications, 3);
  assert.equal(delayed.result.postconditionVerified, true);
  assert.deepEqual(delayed.physicalEvents,
    ["Input.dispatchMouseEvent", "Input.dispatchMouseEvent", "Input.dispatchMouseEvent"],
    "a transient disabled send button must recover inside one command and click exactly once");
  const stuck = await run(Number.POSITIVE_INFINITY, 5);
  assert.equal(stuck.result.nativeCauseCode, "BROWSER_DOM_ACTION_ARIA_DISABLED");
  assert.equal(stuck.result.mutationCount, 0);
  assert.deepEqual(stuck.physicalEvents, [],
    "a send button that stays disabled must time out with zero physical input");
};

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

const exerciseExactOutgoingNeverUsesZeroActionPostcondition = async (): Promise<void> => {
  let pointerEvents = 0;
  let candidateCalls = 0;
  let emptyComposerEligible = 1;
  const runtime = { awaitPageReadPermission: noPageReadBarrier, async send(
    _tabId: number,
    method: string,
    parameters?: Readonly<Record<string, unknown>>,
  ) {
    const source = String(parameters?.functionDeclaration ?? "");
    if (method === "Runtime.callFunctionOn" && source.includes("spec.output")) {
      candidateCalls += 1;
      return { result: { value: { x: 5, y: 5 } } };
    }
    if (method === "Runtime.callFunctionOn" && source.startsWith("async function (specs)")) {
      const observation = coherentObservation(true);
      return { result: { value: { ...observation, queries: [{
        ...observation.queries[0], queryId: "submitted-user-turn", rawCount: 1, eligibleCount: 1,
        matches: [{ candidateIndex: 0, testId: "conversation-turn-7",
          exactGptUserPromptHash: `sha256:${"a".repeat(64)}` }],
        rejections: [],
      }, {
        ...observation.queries[0], queryId: "empty-composer", rawCount: 1,
        eligibleCount: emptyComposerEligible,
        matches: emptyComposerEligible === 1 ? [{ candidateIndex: 0 }] : [],
        rejections: emptyComposerEligible === 1 ? [] : [{ index: 0, reasons: ["TEXT_MISMATCH"] }],
      }] } } };
    }
    const infrastructure = mutationInfrastructureReply(method, parameters);
    if (infrastructure !== undefined) return infrastructure;
    if (method === "Input.dispatchMouseEvent") { pointerEvents += 1; return {}; }
    throw new Error(`UNEXPECTED_EXACT_OUTGOING_CLICK_METHOD:${method}`);
  } } as ExtensionDebuggerRuntime;
  const target = {
    tabId: 126, targetRef: "target-126", documentRef: "document-126", navigationEpoch: 1,
  } as never;
  const intent: PointerClickIntent = {
    kind: "click", selector: "button", expectedMatches: 1,
    preClickExactOutgoingTurn: {
      composerSelector: "composer", composerFormSelector: "form", attachmentSelector: "attachment",
      userTurnSelector: "user-turn",
      expectedPromptHash: `sha256:${"a".repeat(64)}`, expectedAttachmentLabels: [],
    },
    postClickObservation: { queries: [{ queryId: "submitted-user-turn", selector: "user-turn",
      maxMatches: 1, fields: ["testId", "exactGptUserPromptHash"], expectedEligibleCount: 1,
      latestGptUserTurn: true }, { queryId: "empty-composer",
      selector: "composer[contenteditable='true']:has(> p[data-empty-paragraph='true'] > br.ProseMirror-trailingBreak)",
      maxMatches: 1, fields: [], expectedEligibleCount: 1 }],
    timeoutMs: 10 },
  };
  const result = await executeRegisteredDomIntent(runtime, target, intent,
    () => undefined) as Readonly<Record<string, unknown>>;
  assert.equal(result.postconditionVerified, true);
  assert.equal(candidateCalls, 1);
  assert.equal(pointerEvents, 3,
    "an exact outgoing turn must click once even when a historical DOM state already satisfies the postcondition");
  emptyComposerEligible = 0;
  const rejected = await executeRegisteredDomIntent(runtime, target, {
    ...intent, postClickObservation: {
      queries: intent.postClickObservation!.queries, timeoutMs: 1,
    },
  }, () => undefined) as Readonly<Record<string, unknown>>;
  assert.equal(rejected.postconditionVerified, false,
    "a matching latest user turn cannot confirm submission while the Composer remains populated");
};

const exerciseRetainedClickedCandidatePostcondition = async (): Promise<void> => {
  const run = async (selectedAfterClick: boolean) => {
    let clicked = false;
    const runtime = { awaitPageReadPermission: noPageReadBarrier, async send(
      _tabId: number,
      method: string,
      parameters?: Readonly<Record<string, unknown>>,
    ) {
      const source = String(parameters?.functionDeclaration ?? "");
      if (method === "Runtime.callFunctionOn" && source.startsWith("function ()")) {
        return { result: { value: { x: 5, y: 5 } } };
      }
      if (method === "Runtime.callFunctionOn" && source.startsWith("async function (specs)")) {
        return { result: { value: coherentObservation(clicked) } };
      }
      if (method === "DOM.describeNode") return { node: {
        nodeId: 7, backendNodeId: 107, nodeName: "DIV",
        attributes: ["aria-checked", clicked && selectedAfterClick ? "true" : "false"],
      } };
      if (method === "Input.dispatchMouseEvent") {
        if (parameters?.type === "mouseReleased") clicked = true;
        return {};
      }
      const infrastructure = mutationInfrastructureReply(method, parameters);
      if (infrastructure !== undefined) return infrastructure;
      throw new Error(`UNEXPECTED_RETAINED_CANDIDATE_METHOD:${method}`);
    } } as ExtensionDebuggerRuntime;
    return executeRegisteredDomIntent(runtime, {
      tabId: 126, targetRef: "target-126", documentRef: "document-126", navigationEpoch: 1,
    } as never, {
      kind: "click", selector: "[role='menuitemradio']", expectedTextEquals: "GPT-5.6 Sol",
      expectedMatches: 1,
      postClickObservation: {
        queries: coherentPostconditionQueries,
        timeoutMs: 10,
        clickedCandidateAttribute: { name: "aria-checked", equals: "true" },
      },
    }, () => undefined) as Promise<Readonly<Record<string, unknown>>>;
  };
  const selected = await run(true);
  assert.equal(selected.postconditionVerified, true);
  assert.deepEqual(selected.clickedCandidateAttributeReadback,
    { name: "aria-checked", value: "true", verified: true });
  const ignored = await run(false);
  assert.equal(ignored.postconditionVerified, false);
  assert.equal(ignored.failureCode, "BROWSER_POSTCONDITION_FAILED");
  assert.deepEqual(ignored.clickedCandidateAttributeReadback,
    { name: "aria-checked", value: "false", verified: false },
  "a collapsed panel cannot hide that the exact clicked radio never became selected");
};

const guardRuntime = (events: string[], guardState: { current: boolean }): ExtensionDebuggerRuntime => ({
  awaitPageReadPermission: noPageReadBarrier,
  async send(_tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>) {
    if (method.startsWith("Input.") || method === "DOM.focus") {
      assert.equal(guardState.current, true, `${method} must be immediately preceded by current Document proof`);
      guardState.current = false;
      events.push(method);
      return {};
    }
    guardState.current = false;
    if (method === "Runtime.callFunctionOn"
      && String(parameters?.functionDeclaration ?? "").includes("browserExactEditableText(this)")) {
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
  await exerciseDomMutationPreparation();
  await exerciseDomMutationSettlement();
};

const exerciseDomMutationPreparation = async (): Promise<void> => {
  await exerciseReasoningSlider();
  await exerciseFreshKeypressCandidate();
  await exerciseContentEditableFill();
  await exerciseFillReadbackRejection();
  await exerciseScopedExactCandidate();
  await exerciseExactOutgoingMismatchReadback();
  await exerciseExactOutgoingActionabilityWait();
};

const exerciseDomMutationSettlement = async (): Promise<void> => {
  await exerciseNativePointerSequences();
  await exerciseCoherentClickPostcondition();
  await exerciseExactOutgoingNeverUsesZeroActionPostcondition();
  await exerciseRetainedClickedCandidatePostcondition();
  await exerciseMutationDocumentGuard();
};
