import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import type { ExtensionDebuggerRuntime } from
  "../../src/lib/browser/chrome-extension/debugger-runtime.js";
import { executeRegisteredDomIntent } from
  "../../src/lib/browser/chrome-extension/dom-intent-runtime.js";
import { decodeBrowserMutationReceipt } from
  "../../src/lib/browser/exact-target/browser-mutation-receipt.js";
import { exerciseCapturedCoherentObservationPointerFunction } from
  "./local-browser-dom-function-support.js";
import { mutationInfrastructureReply } from "./local-browser-dom-runtime-fixture.js";
import { exactConversationFixtureUrl } from "./local-browser-exact-assistant-turn-support.js";

const noPageReadBarrier = async (): Promise<void> => undefined;
export const coherentPostconditionQueries = [
  { queryId: "entry", selector: "[role='menuitem']", maxMatches: 2, fields: [],
    expectedEligibleCount: 0 },
  { queryId: "advanced", selector: "[data-active='true']", maxMatches: 2,
    fields: ["ariaExpanded"], expectedEligibleCount: 1 },
] as const;
const coherentObservation = (open: boolean) => ({
  currentUrl: new URL("/", exactConversationFixtureUrl).href,
  observedAt: "2026-09-04T00:00:00.000Z",
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
const coherentRuntimeFor = (
  settles: boolean,
  externallyOpensAtObservation?: number,
  driftAtHistoryCall?: number,
  transientWhenClosed = false,
) => {
  let clicked = false, coherentCalls = 0, pointerEvents = 0, atomicSource = "", historyCalls = 0;
  const runtimeCallReply = (declaration: string): unknown | undefined => {
    if (declaration.startsWith("function (request)")) {
      atomicSource = declaration;
      coherentCalls += 1;
      const open = clicked || (externallyOpensAtObservation !== undefined
        && coherentCalls >= externallyOpensAtObservation);
      return { result: { value: open
        ? { kind: "postcondition", observation: coherentObservation(true) }
        : { kind: "pointer", point: { x: 5, y: 5 } } } };
    }
    if (!declaration.startsWith("async function (specs)")) return undefined;
    coherentCalls += 1;
    const open = (clicked && settles)
      || (externallyOpensAtObservation !== undefined && coherentCalls >= externallyOpensAtObservation);
    const observation = coherentObservation(open);
    return { result: { value: !open && transientWhenClosed ? { ...observation,
      queries: observation.queries.map((query) => ({ ...query,
        rawCount: 0, eligibleCount: 0, matches: [], rejections: [] })) } : observation } };
  };
  const navigationHistoryReply = () => {
    historyCalls += 1;
    return { currentIndex: 0, entries: [{ title: "ChatGPT",
      url: historyCalls < (driftAtHistoryCall ?? Number.POSITIVE_INFINITY)
        ? "https://chatgpt.com/" : "https://chatgpt.com/c/different-conversation" }] };
  };
  const runtime = { awaitPageReadPermission: noPageReadBarrier, async send(
    _tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>,
  ) {
    const declaration = String(parameters?.functionDeclaration ?? "");
    if (method === "Runtime.callFunctionOn") {
      const reply = runtimeCallReply(declaration);
      if (reply !== undefined) return reply;
    }
    if (method === "Page.getNavigationHistory" && driftAtHistoryCall !== undefined) {
      return navigationHistoryReply();
    }
    if (method === "DOM.querySelectorAll") return { nodeIds: [7] };
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

const exerciseRequiredSliderClick = async (target: never): Promise<void> => {
  const alreadySelected = coherentRuntimeFor(true, 1);
  const requiredClick = { kind: "click", selector: "[data-model-reasoning-effort-slider]",
    expectedMatches: 1,
    requiredClickPointSelector: "[data-model-reasoning-effort-slider-thumb]",
    postClickMatch: { selector: "[role='slider'][aria-valuenow='3']", expectedMatches: 1,
      readEligibility: "non-actionable-aria-state" } } as const;
  const requiredResult = await executeRegisteredDomIntent(alreadySelected.runtime, target,
    requiredClick, () => undefined) as Readonly<Record<string, unknown>>;
  assert.equal(alreadySelected.pointerEvents(), 3,
    "an already satisfied reasoning value must still dispatch one complete mouse click");
  assert.equal(requiredResult.mutationCount, 1);
  const requiredCommand = { kind: "dom-intent", intent: requiredClick } as never;
  const requiredReceipt = decodeBrowserMutationReceipt(requiredCommand, requiredResult);
  assert.equal(requiredReceipt.mutationOutcome, "confirmed");
  assert.equal(requiredReceipt.physicalInputCount, 1);
  assert.throws(() => decodeBrowserMutationReceipt(requiredCommand, {
    candidateCount: 1, identityRevalidated: true, mutationCount: 0,
    postconditionVerified: true, zeroActionSatisfied: true,
    postconditionRawCount: 1, postconditionEligibleCount: 1, postconditionRejections: [],
  }), /BROWSER_AUTH_TRANSCRIPT_INVALID/u,
  "a required physical click cannot settle from a zero-input receipt");
};

export const exerciseCoherentClickPostcondition = async (): Promise<void> => {
  const target = {
    tabId: 125, targetRef: "target-125", documentRef: "document-125", navigationEpoch: 1,
  } as never;
  const settled = coherentRuntimeFor(true);
  const success = await executeRegisteredDomIntent(settled.runtime, target, {
    kind: "click", selector: "button", expectedMatches: 1,
    postClickObservation: { queries: coherentPostconditionQueries, timeoutMs: 4_500 },
  }, () => undefined) as Readonly<Record<string, unknown>>;
  assert.equal(success.postconditionVerified, true);
  const observation = success.postconditionObservation as Readonly<Record<string, unknown>>;
  const queries = observation.queries as readonly Readonly<Record<string, unknown>>[];
  assert.equal(observation.schemaVersion, "grasseye.browser.dom-observation.v2");
  assert.equal(queries[0]?.rawCount, 1,
    "a retained but mechanically ineligible DOM node must satisfy expected eligible cardinality zero");
  assert.equal(((queries[1]?.matches as readonly Readonly<Record<string, unknown>>[])[0])?.ariaExpanded, "true");
  const raced = coherentRuntimeFor(true, 1);
  const zeroAction = await executeRegisteredDomIntent(raced.runtime, target, {
    kind: "click", selector: "button", expectedMatches: 1,
    postClickObservation: { queries: coherentPostconditionQueries, timeoutMs: 4_500 },
  }, () => undefined) as Readonly<Record<string, unknown>>;
  assert.equal(zeroAction.mutationCount, 0);
  assert.equal(zeroAction.zeroActionSatisfied, true);
  assert.equal(zeroAction.postconditionVerified, true);
  assert.equal(raced.pointerEvents(), 0,
    "a postcondition already true in the atomic preparation snapshot must not be clicked");
  assert.match(raced.atomicSource(), /if \(postconditionSatisfied\) return \{ kind: "postcondition", observation \};[\s\S]*const scopeRaw = request\.candidate\.scope/u,
    "one Runtime.callFunctionOn snapshot must choose postcondition or a freshly qualified pointer before returning");
  exerciseCapturedCoherentObservationPointerFunction(raced.atomicSource());
  await exerciseRequiredSliderClick(target);
  const stuck = coherentRuntimeFor(false);
  const rejected = await executeRegisteredDomIntent(stuck.runtime, target, {
    kind: "click", selector: "button", expectedMatches: 1,
    postClickObservation: { queries: coherentPostconditionQueries, timeoutMs: 4_500 },
  }, () => undefined) as Readonly<Record<string, unknown>>;
  assert.equal(rejected.postconditionVerified, false);
  assert.equal(rejected.failureCode, "BROWSER_POSTCONDITION_FAILED");
  assert.equal(rejected.nativeCauseCode, "BROWSER_POSTCONDITION_Q0__BROWSER_DOM_CANDIDATE_AMBIGUOUS");
  assert.ok(stuck.coherentCalls() >= 3,
    "an ordinary deadline miss must return the final coherent negative readback instead of DOM_READ_INVALID");
  const drifted = coherentRuntimeFor(false, undefined, 4, true);
  await assert.rejects(executeRegisteredDomIntent(drifted.runtime, target, {
    kind: "click", selector: "button", expectedMatches: 1,
    postClickObservation: { queries: coherentPostconditionQueries, timeoutMs: 4_500 },
  }, () => undefined), /BROWSER_DOCUMENT_INVALID/u,
  "an SPA URL change during transient readback must terminate the old action");
  assert.equal(drifted.pointerEvents(), 3,
    "URL drift after one click must never replay the physical action");
  const driftedDuringO1 = coherentRuntimeFor(false, 3, 6, true);
  await assert.rejects(executeRegisteredDomIntent(driftedDuringO1.runtime, target, {
    kind: "click", selector: "button", expectedMatches: 1,
    postClickObservation: { queries: coherentPostconditionQueries, timeoutMs: 4_500 },
  }, () => undefined), /BROWSER_DOCUMENT_INVALID/u,
  "a URL change after a stable O1 DOM read must not return the new conversation result");
  assert.equal(driftedDuringO1.pointerEvents(), 3,
    "an O1 identity race must preserve the single already-dispatched click");
};
