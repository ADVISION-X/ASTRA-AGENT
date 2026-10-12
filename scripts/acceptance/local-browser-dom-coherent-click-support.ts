import { preflightReceiptObservationHash } from "../../src/lib/browser/exact-target/browser-special-mutation-receipt.js";
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
import { verifyClickPostcondition, observationReceiptEvidence } from "../../src/lib/browser/chrome-extension/dom-mutation-postcondition.js";
import { bindBrowserMutationObservation, browserObservationPacketRevisionBytes } from "../../src/lib/browser/exact-target/browser-observation-receipt.js";
import { createHash } from "node:crypto";

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
  const requiredClick = { kind: "click", selector: "[data-model-picker-power-slider]",
    expectedMatches: 1,
    requiredClickPointSelector: "[data-model-picker-power-slider] [role='slider']",
    postClickMatch: { selector: "[role='slider'][aria-valuenow='3']", expectedMatches: 1,
      readEligibility: "non-actionable-aria-state" } } as const;
  const requiredResult = await executeRegisteredDomIntent(alreadySelected.runtime, target,
    requiredClick, () => undefined) as Readonly<Record<string, unknown>>;
  assert.equal(alreadySelected.pointerEvents(), 3,
    "an already satisfied reasoning value must still dispatch one complete mouse click");
  assert.equal(requiredResult.mutationCount, 1);
  const requiredCommand = { kind: "dom-intent", intent: requiredClick } as never;
  const requiredReceipt = decodeBrowserMutationReceipt(requiredCommand, requiredResult, preflightReceiptObservationHash(requiredResult));
  assert.equal(requiredReceipt.mutationOutcome, "confirmed");
  assert.equal(requiredReceipt.physicalInputCount, 1);
  assert.throws(() => decodeBrowserMutationReceipt(requiredCommand, {
    candidateCount: 1, identityRevalidated: true, mutationCount: 0,
    postconditionVerified: true, zeroActionSatisfied: true,
    postconditionRawCount: 1, postconditionEligibleCount: 1, postconditionRejections: [],
  }, preflightReceiptObservationHash({
    candidateCount: 1, identityRevalidated: true, mutationCount: 0,
    postconditionVerified: true, zeroActionSatisfied: true,
    postconditionRawCount: 1, postconditionEligibleCount: 1, postconditionRejections: [],
  })), /BROWSER_AUTH_TRANSCRIPT_INVALID/u,
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
  await exerciseExactOutgoingPostcondition();
};

export const exerciseExactOutgoingPostcondition = async (): Promise<void> => {
  const hash = `sha256:${"a".repeat(64)}` as const;
  const postClickObservation = { queries: [
    { queryId: "turn", selector: "[data-turn-key]", fields: ["turnKey", "exactGptUserPromptHash"] as const,
      maxMatches: 1, latestGptUserTurn: true as const, expectedEligibleCount: 1 },
    { queryId: "composer", selector: "composer[contenteditable='true']:has(> p[data-empty-paragraph='true'] > br.ProseMirror-trailingBreak)", fields: [] as const, maxMatches: 1, expectedEligibleCount: 1 }], timeoutMs: 1_500 };
  const intent = { kind: "click" as const, selector: "button", expectedMatches: 1, postClickObservation,
    preClickExactOutgoingTurn: { composerSelector: "composer", composerFormSelector: "form", attachmentSelector: "attachment",
      userTurnSelector: "[data-turn-key]", expectedPromptHash: hash, expectedAttachmentLabels: [] } };
  const command = { kind: "dom-intent" as const, intent };
  for (const [url, mismatch, promptHash, expectedCause] of [
    ["https://chatgpt.com/", -1, hash, "BROWSER_DOM_CANDIDATE_MISSING"],
    ["https://chatgpt.com/c/legal%20opaque", -1, hash, "BROWSER_DOM_CANDIDATE_MISSING"],
    ["https://chatgpt.com/c/exact", -1, hash, null],
    ["https://chatgpt.com/c/exact", -1, `sha256:${"b".repeat(64)}`, "BROWSER_DOM_CANDIDATE_MISSING"],
    ["https://chatgpt.com/", 0, hash, "BROWSER_POSTCONDITION_Q0__BROWSER_DOM_CANDIDATE_MISSING"],
    ["https://chatgpt.com/", 1, hash, "BROWSER_POSTCONDITION_Q1__BROWSER_DOM_CANDIDATE_MISSING"],
    ["https://chatgpt.com/", 2, hash, "BROWSER_POSTCONDITION_Q0__BROWSER_DOM_CANDIDATE_MISSING"],
  ] as const) {
    const packet = { currentUrl: url, observedAt: "2026-09-04T00:00:00.000Z", queries: postClickObservation.queries.map((query, index) => ({
      queryId: query.queryId, scopeRawCount: 1, scopeEligibleCount: 1, rawCount: (index === mismatch || mismatch === 2) ? 0 : 1,
      eligibleCount: (index === mismatch || mismatch === 2) ? 0 : 1, matches: (index === mismatch || mismatch === 2) ? [] : [{ candidateIndex: 0,
        ...(index === 0 ? { turnKey: "00000000-0000-4000-8000-000000000001", exactGptUserPromptHash: promptHash } : {}) }],
      scopeRejections: [], rejections: [], nativeCauseCode: null, nativeCauseCount: 0, nativeStage: "runtime-call-function-on" })) };
    const runtime = { awaitPageReadPermission: noPageReadBarrier, send: async (_tab: number, method: string, params?: Readonly<Record<string, unknown>>) =>
      method === "Runtime.callFunctionOn" ? { result: { value: packet } } : mutationInfrastructureReply(method, params) } as ExtensionDebuggerRuntime;
    const producer = await verifyClickPostcondition(runtime, { tabId: 125, targetRef: "target", documentRef: "document" } as never, intent, 0);
    assert.equal(producer.verified, expectedCause === null); assert.equal(producer.observation?.nativeCauseCode, expectedCause);
    const row = { clicked: true, candidateCount: 1, identityRevalidated: true, mutationCount: 1,
      postconditionVerified: producer.verified, ...observationReceiptEvidence(producer.observation!),
      ...(producer.verified ? {} : { failureCode: "BROWSER_POSTCONDITION_FAILED" }) };
    const observation = producer.observation!.observation;
    const bound = bindBrowserMutationObservation(command, row, { exactCallIdentityHash: hash,
      targetRefHash: observation.targetRefHash as typeof hash, documentRefHash: observation.documentRefHash as typeof hash,
      observationRevisionHash: observation.observationRevisionHash }) as Readonly<Record<string, unknown>>;
    const receipt = decodeBrowserMutationReceipt(command, bound, null);
    assert.equal(receipt.physicalInputCount, 1); assert.equal(receipt.nativeCauseCode, expectedCause);
    assert.equal(receipt.terminal, producer.verified ? "confirmed" : "rejected");
    for (const currentUrl of ["https://evil.example/", "https://chatgpt.com/c/exact?q=secret", "https://chatgpt.com/c/exact#fragment",
      "https://u:p@chatgpt.com/", "http://chatgpt.com/", "https://chatgpt.com/c/one/two", "https://chatgpt.com/c/", `https://chatgpt.com/c/${"x".repeat(257)}`]) {
      const badPacket = { ...observation, currentUrl };
      assert.throws(() => decodeBrowserMutationReceipt(command, { ...bound, postconditionObservation: {
        ...(bound.postconditionObservation as object), currentUrl } }, null), /BROWSER_AUTH_TRANSCRIPT_INVALID/u);
      const revision = `sha256:${createHash("sha256").update(browserObservationPacketRevisionBytes(badPacket)).digest("hex")}` as const;
      const badBound = bindBrowserMutationObservation(command, { ...row, postconditionObservation: { ...badPacket, observationRevisionHash: revision } },
        { exactCallIdentityHash: hash, targetRefHash: observation.targetRefHash as typeof hash,
          documentRefHash: observation.documentRefHash as typeof hash, observationRevisionHash: revision });
      assert.throws(() => decodeBrowserMutationReceipt(command, badBound, null), /BROWSER_AUTH_TRANSCRIPT_INVALID/u);
      const badRuntime = { ...runtime, send: async (_tab: number, method: string, params?: Readonly<Record<string, unknown>>) =>
        method === "Runtime.callFunctionOn" ? { result: { value: { ...packet, currentUrl } } } : mutationInfrastructureReply(method, params) } as ExtensionDebuggerRuntime;
      await assert.rejects(verifyClickPostcondition(badRuntime, { tabId: 125, targetRef: "target", documentRef: "document" } as never, intent, 0), /BROWSER_DOM_READ_INVALID/u);
    }
  }
};
