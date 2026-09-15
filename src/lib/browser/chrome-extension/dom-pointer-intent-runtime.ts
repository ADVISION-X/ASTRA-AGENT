import type { BrowserDomIntent } from "../exact-target/browser-dom-intent.js";
import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import {
  resolveCoherentMutationCandidate,
  resolveCoherentObservationPointerAction,
  resolveCoherentPointerAction,
  resolveCoherentRetainedPointerAction,
  type BrowserPointerAction,
  type BrowserRetainedPointerAction,
  type CoherentObservationPointerPreparation,
} from "./dom-coherent-candidate.js";
import {
  matchReceiptEvidence,
  observationReceiptEvidence,
  verifyClickPostcondition,
  waitForInteractionAttribute,
  waitForMatch,
  waitForNextBoundedObservation,
  zeroActionMatchReceipt,
  zeroActionObservationReceipt,
} from "./dom-mutation-postcondition.js";
import { attribute, describeNode, requireKeyboardActionTarget } from "./dom-query-runtime.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";

type ClickIntent = Extract<BrowserDomIntent, { kind: "click" }>;
type HoverIntent = Extract<BrowserDomIntent, { kind: "hover" }>;
type DoubleClickIntent = Extract<BrowserDomIntent, { kind: "doubleClick" }>;
type KeypressIntent = Extract<BrowserDomIntent, { kind: "keypress" }>;
type CurrentDocumentAssertion = () => void;

type QualificationReceipt = Readonly<{
  candidateCount: number;
  qualificationStage: "candidate-set" | "actionability";
  identityRevalidated: false;
  mutationCount: 0;
  postconditionVerified: false;
  qualificationRejected: true;
  failureCode: string;
  nativeCauseCode: string | null;
}>;

const qualificationReceipt = (
  candidateCount: number,
  failureCode: string,
  qualificationStage: QualificationReceipt["qualificationStage"],
): QualificationReceipt => {
  const outgoingMismatch = /^BROWSER_DOM_ACTION_OUTGOING_(?:STRUCTURE|PROMPT_HASH|ATTACHMENT_SET)_MISMATCH$/u
    .test(failureCode);
  return Object.freeze({
    candidateCount, qualificationStage, identityRevalidated: false, mutationCount: 0,
    postconditionVerified: false, qualificationRejected: true,
    failureCode: qualificationStage === "actionability" && !outgoingMismatch
      ? "BROWSER_DOM_ACTION_NOT_QUALIFIED" : failureCode,
    nativeCauseCode: qualificationStage === "actionability" && !outgoingMismatch ? failureCode : null,
  });
};

const qualifiedNode = async (
  readNode: () => Promise<number>,
): Promise<Readonly<{ nodeId: number }> | Readonly<{ receipt: QualificationReceipt }>> => {
  try { return { nodeId: await readNode() }; }
  catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (!/^BROWSER_DOM_(?:CANDIDATE_MISSING|CANDIDATE_AMBIGUOUS|NODE_STALE|READ_INVALID)$/u.test(code)) throw error;
    return { receipt: qualificationReceipt(
      code === "BROWSER_DOM_CANDIDATE_AMBIGUOUS" ? 2 : 0, code, "candidate-set",
    ) };
  }
};

const mutationCandidate = (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: ClickIntent | HoverIntent | DoubleClickIntent | KeypressIntent,
): Promise<number> => resolveCoherentMutationCandidate(runtime, target, {
  selector: intent.selector,
  ...(intent.scope === undefined ? {} : { scope: intent.scope }),
  ...(intent.kind === "click" || intent.kind === "hover"
    ? intent.expectedTextEquals !== undefined
      ? { text: { value: intent.expectedTextEquals, exact: true } }
      : intent.expectedText !== undefined
        ? { text: { value: intent.expectedText, exact: false } } : {}
    : {}),
});

const pointerAction = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: ClickIntent | HoverIntent | DoubleClickIntent,
): Promise<BrowserPointerAction | QualificationReceipt> => {
  try {
    return await resolveCoherentPointerAction(runtime, target, {
      selector: intent.selector,
      ...(intent.scope === undefined ? {} : { scope: intent.scope }),
      ...(intent.kind === "click" || intent.kind === "hover"
        ? intent.expectedTextEquals !== undefined
          ? { text: { value: intent.expectedTextEquals, exact: true } }
          : intent.expectedText !== undefined
            ? { text: { value: intent.expectedText, exact: false } } : {}
        : {}),
      ...(intent.kind === "click" && intent.preClickExactOutgoingTurn !== undefined
        ? { exactOutgoingTurn: intent.preClickExactOutgoingTurn } : {}),
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (/^BROWSER_DOM_(?:CANDIDATE_MISSING|CANDIDATE_AMBIGUOUS|NODE_STALE|READ_INVALID)$/u.test(code)) {
      return qualificationReceipt(code === "BROWSER_DOM_CANDIDATE_AMBIGUOUS" ? 2 : 0, code, "candidate-set");
    }
    if (!/^BROWSER_DOM_ACTION_[A-Z_]+$/u.test(code)) throw error;
    return qualificationReceipt(1, code, "actionability");
  }
};

const retainedPointerAction = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: ClickIntent,
): Promise<BrowserRetainedPointerAction | QualificationReceipt> => {
  try {
    return await resolveCoherentRetainedPointerAction(runtime, target, {
      selector: intent.selector,
      ...(intent.scope === undefined ? {} : { scope: intent.scope }),
      ...(intent.expectedTextEquals !== undefined
        ? { text: { value: intent.expectedTextEquals, exact: true } }
        : intent.expectedText !== undefined
          ? { text: { value: intent.expectedText, exact: false } } : {}),
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (/^BROWSER_DOM_(?:CANDIDATE_MISSING|CANDIDATE_AMBIGUOUS|READ_INVALID)$/u.test(code)) {
      return qualificationReceipt(code === "BROWSER_DOM_CANDIDATE_AMBIGUOUS" ? 2 : 0, code, "candidate-set");
    }
    if (!/^BROWSER_DOM_ACTION_[A-Z_]+$/u.test(code)) throw error;
    return qualificationReceipt(1, code, "actionability");
  }
};

const observationPointerAction = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: ClickIntent & Readonly<{ postClickObservation: NonNullable<ClickIntent["postClickObservation"]> }>,
): Promise<CoherentObservationPointerPreparation | QualificationReceipt> => {
  try {
    return await resolveCoherentObservationPointerAction(runtime, target, {
      selector: intent.selector,
      ...(intent.scope === undefined ? {} : { scope: intent.scope }),
      ...(intent.expectedTextEquals !== undefined
        ? { text: { value: intent.expectedTextEquals, exact: true } }
        : intent.expectedText !== undefined
          ? { text: { value: intent.expectedText, exact: false } } : {}),
    }, intent.postClickObservation);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (/^BROWSER_DOM_(?:CANDIDATE_MISSING|CANDIDATE_AMBIGUOUS|READ_INVALID)$/u.test(code)) {
      return qualificationReceipt(code === "BROWSER_DOM_CANDIDATE_AMBIGUOUS" ? 2 : 0, code, "candidate-set");
    }
    if (!/^BROWSER_DOM_ACTION_[A-Z_]+$/u.test(code)) throw error;
    return qualificationReceipt(1, code, "actionability");
  }
};

const zeroActionReceipt = (assertCurrent: CurrentDocumentAssertion): Readonly<Record<string, unknown>> => {
  assertCurrent();
  return Object.freeze({ candidateCount: 1, identityRevalidated: true, mutationCount: 0,
    postconditionVerified: true, zeroActionSatisfied: true });
};

export const dispatchPointerClickSequence = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  point: BrowserPointerAction,
  clickCounts: readonly (1 | 2)[],
  assertCurrent: CurrentDocumentAssertion,
  onPhysicalInput?: () => void,
): Promise<void> => {
  assertCurrent();
  await debuggerRuntime.send(target.tabId, "Input.dispatchMouseEvent", {
    type: "mouseMoved", x: point.x, y: point.y, button: "none", buttons: 0,
  });
  let inputObserved = false;
  for (const clickCount of clickCounts) {
    assertCurrent();
    if (!inputObserved) {
      inputObserved = true;
      onPhysicalInput?.();
    }
    await debuggerRuntime.send(target.tabId, "Input.dispatchMouseEvent", {
      type: "mousePressed", x: point.x, y: point.y, button: "left", buttons: 1, clickCount,
    });
    assertCurrent();
    await debuggerRuntime.send(target.tabId, "Input.dispatchMouseEvent", {
      type: "mouseReleased", x: point.x, y: point.y, button: "left", buttons: 0, clickCount,
    });
  }
};

const zeroActionIfSatisfied = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: ClickIntent,
  assertCurrent: CurrentDocumentAssertion,
): Promise<Readonly<Record<string, unknown>> | null> => {
  const readback = await verifyClickPostcondition(runtime, target, intent, 0);
  if (!readback.verified) return null;
  if (readback.observation !== undefined) {
    return zeroActionObservationReceipt(assertCurrent, readback.observation);
  }
  return readback.match === undefined
    ? zeroActionReceipt(assertCurrent) : zeroActionMatchReceipt(assertCurrent, readback.match);
};

type PreparedClick = Readonly<{
  point: BrowserPointerAction;
  retainedNodeId: number | null;
}> | Readonly<{ receipt: unknown }>;

const prepareExactOutgoingClick = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: ClickIntent,
  assertCurrent: CurrentDocumentAssertion,
): Promise<PreparedClick> => {
  const deadline = Date.now() + (intent.postClickObservation?.timeoutMs
    ?? intent.postClickMatch?.timeoutMs ?? intent.postClickAttribute?.timeoutMs
    ?? intent.postClickUrl?.timeoutMs ?? 1_500);
  while (true) {
    assertCurrent();
    const point = await pointerAction(runtime, target, intent);
    if (!("failureCode" in point)) return { point, retainedNodeId: null };
    const retryable = ["BROWSER_DOM_ACTION_DISABLED", "BROWSER_DOM_ACTION_ARIA_DISABLED"]
      .includes(point.nativeCauseCode ?? point.failureCode);
    if (!retryable || Date.now() >= deadline) return { receipt: point };
    if (!await waitForNextBoundedObservation(deadline)) return { receipt: point };
  }
};

const prepareClick = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: ClickIntent,
  assertCurrent: CurrentDocumentAssertion,
): Promise<PreparedClick> => {
  if (intent.preClickExactOutgoingTurn !== undefined) {
    return prepareExactOutgoingClick(runtime, target, intent, assertCurrent);
  }
  if (intent.postClickObservation?.clickedCandidateAttribute !== undefined) {
    const retained = await retainedPointerAction(runtime, target, intent);
    return "failureCode" in retained
      ? { receipt: retained } : { point: retained, retainedNodeId: retained.nodeId };
  }
  if (intent.postClickObservation !== undefined) {
    const preparation = await observationPointerAction(runtime, target, intent as ClickIntent & Readonly<{
      postClickObservation: NonNullable<ClickIntent["postClickObservation"]>;
    }>);
    if ("failureCode" in preparation) return { receipt: preparation };
    return preparation.kind === "postcondition"
      ? { receipt: zeroActionObservationReceipt(assertCurrent, {
        verified: true, observation: preparation.observation, nativeCauseCode: null,
      }) }
      : { point: preparation.point, retainedNodeId: null };
  }
  if (intent.preClickExactOutgoingTurn === undefined) {
    const preconditionReceipt = await zeroActionIfSatisfied(runtime, target, intent, assertCurrent);
    if (preconditionReceipt !== null) return { receipt: preconditionReceipt };
  }
  const point = await pointerAction(runtime, target, intent);
  return "failureCode" in point ? { receipt: point } : { point, retainedNodeId: null };
};

const clickMutationReceipt = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: ClickIntent,
  retainedNodeId: number | null,
  assertCurrent: CurrentDocumentAssertion,
): Promise<Readonly<Record<string, unknown>>> => {
  assertCurrent();
  if (intent.postClickMinimumDelayMs !== undefined) {
    await new Promise<void>((resolve) => globalThis.setTimeout(
      resolve, intent.postClickMinimumDelayMs,
    ));
    assertCurrent();
  }
  const clickedCandidateAttribute = intent.postClickObservation?.clickedCandidateAttribute;
  const clickedCandidateAttributeValue = clickedCandidateAttribute && retainedNodeId !== null
    ? attribute(await describeNode(runtime, target.tabId, retainedNodeId), clickedCandidateAttribute.name)
    : null;
  const postcondition = await verifyClickPostcondition(runtime, target, intent);
  const clickedCandidateAttributeVerified = clickedCandidateAttribute === undefined
    || clickedCandidateAttributeValue === clickedCandidateAttribute.equals;
  return {
    clicked: true, candidateCount: 1, identityRevalidated: true, mutationCount: 1,
    postconditionVerified: postcondition.verified && clickedCandidateAttributeVerified,
    ...(clickedCandidateAttribute === undefined ? {} : { clickedCandidateAttributeReadback: {
      name: clickedCandidateAttribute.name, value: clickedCandidateAttributeValue,
      verified: clickedCandidateAttributeVerified,
    } }),
    ...(postcondition.match === undefined ? {} : matchReceiptEvidence(postcondition.match)),
    ...(postcondition.observation === undefined ? {} : observationReceiptEvidence(postcondition.observation)),
    ...(postcondition.verified && clickedCandidateAttributeVerified
      ? {} : { failureCode: "BROWSER_POSTCONDITION_FAILED" }),
  };
};

export const executeClickIntent = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: ClickIntent,
  assertCurrent: CurrentDocumentAssertion,
  onPhysicalInput?: () => void,
): Promise<unknown> => {
  const prepared = await prepareClick(runtime, target, intent, assertCurrent);
  if ("receipt" in prepared) return prepared.receipt;
  await dispatchPointerClickSequence(
    runtime, target, prepared.point, [1], assertCurrent, onPhysicalInput,
  );
  return clickMutationReceipt(runtime, target, intent, prepared.retainedNodeId, assertCurrent);
};

export const executeDoubleClickIntent = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: DoubleClickIntent,
  assertCurrent: CurrentDocumentAssertion,
): Promise<unknown> => {
  const precondition = await waitForMatch(runtime, target, intent.postDoubleClickMatch, 0);
  if (precondition.verified) return zeroActionMatchReceipt(assertCurrent, precondition);
  const box = await pointerAction(runtime, target, intent);
  if ("failureCode" in box) return box;
  await dispatchPointerClickSequence(runtime, target, box, [1, 2], assertCurrent);
  assertCurrent();
  const postcondition = await waitForMatch(runtime, target, intent.postDoubleClickMatch);
  return { doubleClicked: true, candidateCount: 1, identityRevalidated: true, mutationCount: 1,
    postconditionVerified: postcondition.verified, ...matchReceiptEvidence(postcondition),
    ...(postcondition.verified ? {} : { failureCode: "BROWSER_POSTCONDITION_FAILED" }) };
};

export const executeKeypressIntent = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: KeypressIntent,
  assertCurrent: CurrentDocumentAssertion,
  onPhysicalInput?: () => void,
): Promise<unknown> => {
  const precondition = await waitForMatch(runtime, target, intent.postKeypressMatch, 0);
  if (precondition.verified) return zeroActionMatchReceipt(assertCurrent, precondition);
  const node = await qualifiedNode(() => mutationCandidate(runtime, target, intent));
  if ("receipt" in node) return node.receipt;
  try { await requireKeyboardActionTarget(runtime, target.tabId, node.nodeId); }
  catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (!/^BROWSER_DOM_(?:CANDIDATE_MISSING|NODE_STALE|READ_INVALID)$/u.test(code)) throw error;
    return qualificationReceipt(1, code, "actionability");
  }
  assertCurrent();
  await runtime.send(target.tabId, "DOM.focus", { nodeId: node.nodeId });
  const virtualKeyCode = intent.key === "Enter" ? 13 : intent.key === "ArrowLeft" ? 37 : 39;
  const keyEvent = { key: intent.key, code: intent.key,
    windowsVirtualKeyCode: virtualKeyCode, nativeVirtualKeyCode: virtualKeyCode } as const;
  for (let index = 0; index < (intent.repeat ?? 1); index += 1) {
    assertCurrent();
    await runtime.send(target.tabId, "Input.dispatchKeyEvent", { type: "rawKeyDown", ...keyEvent });
    if (index === 0) onPhysicalInput?.();
    assertCurrent();
    await runtime.send(target.tabId, "Input.dispatchKeyEvent", { type: "keyUp", ...keyEvent });
  }
  assertCurrent();
  const postcondition = await waitForMatch(runtime, target, intent.postKeypressMatch);
  return { keyPressed: intent.key, keypressCount: intent.repeat ?? 1, candidateCount: 1,
    identityRevalidated: true, mutationCount: 1, postconditionVerified: postcondition.verified,
    ...matchReceiptEvidence(postcondition),
    ...(postcondition.verified ? {} : { failureCode: "BROWSER_POSTCONDITION_FAILED" }) };
};

export const executeHoverIntent = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: HoverIntent,
  assertCurrent: CurrentDocumentAssertion,
): Promise<unknown> => {
  if (await waitForInteractionAttribute(runtime, target, intent, 1, intent.postHoverAttribute, 0)) {
    return zeroActionReceipt(assertCurrent);
  }
  const box = await pointerAction(runtime, target, intent);
  if ("failureCode" in box) return box;
  assertCurrent();
  await runtime.send(target.tabId, "Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x, y: box.y });
  assertCurrent();
  const postconditionVerified = await waitForInteractionAttribute(
    runtime, target, intent, 1, intent.postHoverAttribute,
  );
  return { hovered: true, candidateCount: 1, identityRevalidated: true, mutationCount: 1,
    postconditionVerified,
    ...(postconditionVerified ? {} : { failureCode: "BROWSER_POSTCONDITION_FAILED" }) };
};
