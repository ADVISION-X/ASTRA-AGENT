import type {
  BrowserDomIneligibleCandidate,
  BrowserDomIneligibleReason,
  BrowserDomIntent,
} from "../exact-target/browser-dom-intent.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";
import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import { resolveCoherentMutationCandidate, resolveCoherentPointerAction,
  type BrowserPointerAction } from "./dom-coherent-candidate.js";
import { executeExactAssistantTurnRead } from "./dom-exact-assistant-turn.js";
import { executeCoherentObservation } from "./dom-coherent-observation.js";
import { attribute, describeNode,
  documentState, inspectNode, nodeForRead, nodeForSelector, nodeText, queryAll,
  queryCandidateSet, queryVisibleTextMatches, requireKeyboardActionTarget,
  selectorForLocator } from "./dom-query-runtime.js";
type FindIntent = Extract<BrowserDomIntent, { kind: "find" }>;
type ClickIntent = Extract<BrowserDomIntent, { kind: "click" }>;
type HoverIntent = Extract<BrowserDomIntent, { kind: "hover" }>;
type DoubleClickIntent = Extract<BrowserDomIntent, { kind: "doubleClick" }>;
type KeypressIntent = Extract<BrowserDomIntent, { kind: "keypress" }>;
type ValueIntent = Exclude<BrowserDomIntent, {
  kind: "document" | "observe" | "readExactAssistantTurn" | "find" | "click" | "hover" | "doubleClick" | "keypress";
}>;
type CurrentDocumentAssertion = () => void;

/** Executes the finite declarative DOM intent set without a script/eval surface. */
const executeFindIntent = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: FindIntent,
): Promise<unknown> => {
  const selector = intent.selector ?? selectorForLocator(intent.locator!);
  const deadline = intent.waitFor === undefined ? null : Date.now() + intent.waitFor.timeoutMs;
  let candidates = await queryCandidateSet(
    debuggerRuntime, target.tabId, selector, intent.maxMatches + 1, intent.scope,
    intent.textEquals !== undefined ? { value: intent.textEquals, exact: true }
      : intent.textContains !== undefined ? { value: intent.textContains, exact: false } : undefined,
  );
  do {
    if (intent.waitFor === undefined || candidates.eligibleCount >= intent.waitFor.minimumMatches
      || Date.now() >= deadline!) break;
    await waitForNextBoundedObservation(deadline!);
    candidates = await queryCandidateSet(
      debuggerRuntime, target.tabId, selector, intent.maxMatches + 1, intent.scope,
      intent.textEquals !== undefined ? { value: intent.textEquals, exact: true }
        : intent.textContains !== undefined ? { value: intent.textContains, exact: false } : undefined,
    );
  } while (Date.now() <= deadline!);
  if (candidates.eligibleCount > intent.maxMatches) throw new Error("BROWSER_DOM_CANDIDATE_AMBIGUOUS");
  const matches = intent.fields === undefined
    ? undefined
    : await Promise.all(candidates.eligibleNodeIds.map((nodeId) => inspectNode(
      debuggerRuntime,
      target.tabId,
      nodeId,
      intent.fields!,
    )));
  return {
    count: candidates.eligibleCount,
    rawCount: candidates.rawCount,
    eligibleCount: candidates.eligibleCount,
    nativeCauseCode: candidates.nativeCauseCode,
    nativeCauseCount: candidates.nativeCauseCount,
    nativeStage: candidates.nativeStage,
    ...(matches === undefined ? {} : { matches }),
  };
};

const waitForNextBoundedObservation = async (deadline: number): Promise<void> => {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return;
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, Math.min(50, remaining)));
};

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
): QualificationReceipt =>
  Object.freeze({ candidateCount, qualificationStage, identityRevalidated: false, mutationCount: 0,
    postconditionVerified: false, qualificationRejected: true,
    failureCode: qualificationStage === "actionability" ? "BROWSER_DOM_ACTION_NOT_QUALIFIED" : failureCode,
    nativeCauseCode: qualificationStage === "actionability" ? failureCode : null });

const qualifiedNode = async (
  readNode: () => Promise<number>,
): Promise<Readonly<{ nodeId: number }> | Readonly<{ receipt: QualificationReceipt }>> => {
  let nodeId: number;
  try { nodeId = await readNode(); }
  catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (!/^BROWSER_DOM_(?:CANDIDATE_MISSING|CANDIDATE_AMBIGUOUS|NODE_STALE|READ_INVALID)$/u.test(code)) throw error;
    return { receipt: qualificationReceipt(
      code === "BROWSER_DOM_CANDIDATE_AMBIGUOUS" ? 2 : 0, code, "candidate-set",
    ) };
  }
  return { nodeId };
};

const mutationCandidate = (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: ClickIntent | HoverIntent | DoubleClickIntent | KeypressIntent | Extract<ValueIntent, { kind: "fill" }>,
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
    });
  }
  catch (error) {
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

type MatchReadback = Readonly<{
  verified: boolean;
  rawCount: number;
  eligibleCount: number;
  rejections: readonly BrowserDomIneligibleCandidate[];
  nativeCauseCode: BrowserDomIneligibleReason | "BROWSER_DOM_CANDIDATE_MISSING"
    | "BROWSER_DOM_CANDIDATE_AMBIGUOUS" | null;
}>;

const matchReceiptEvidence = (readback: MatchReadback): Readonly<Record<string, unknown>> => ({
  postconditionRawCount: readback.rawCount,
  postconditionEligibleCount: readback.eligibleCount,
  postconditionRejections: readback.rejections,
  ...(readback.verified || readback.nativeCauseCode === null
    ? {} : { nativeCauseCode: readback.nativeCauseCode }),
});

const zeroActionMatchReceipt = (
  assertCurrent: CurrentDocumentAssertion,
  readback: MatchReadback,
): Readonly<Record<string, unknown>> => {
  assertCurrent();
  return Object.freeze({ candidateCount: 1, identityRevalidated: true, mutationCount: 0,
    postconditionVerified: true, zeroActionSatisfied: true, ...matchReceiptEvidence(readback) });
};

const dispatchPointerClickSequence = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  point: BrowserPointerAction,
  clickCounts: readonly (1 | 2)[],
  assertCurrent: CurrentDocumentAssertion,
): Promise<void> => {
  assertCurrent();
  await debuggerRuntime.send(target.tabId, "Input.dispatchMouseEvent", {
    type: "mouseMoved", x: point.x, y: point.y, button: "none", buttons: 0,
  });
  for (const clickCount of clickCounts) {
    assertCurrent();
    await debuggerRuntime.send(target.tabId, "Input.dispatchMouseEvent", {
      type: "mousePressed", x: point.x, y: point.y, button: "left", buttons: 1, clickCount,
    });
    assertCurrent();
    await debuggerRuntime.send(target.tabId, "Input.dispatchMouseEvent", {
      type: "mouseReleased", x: point.x, y: point.y, button: "left", buttons: 0, clickCount,
    });
  }
};

const executeClickIntent = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: ClickIntent,
  assertCurrent: CurrentDocumentAssertion,
): Promise<unknown> => {
  const precondition = await verifyClickPostcondition(debuggerRuntime, target, intent, 0);
  if (precondition.verified) return precondition.match === undefined
    ? zeroActionReceipt(assertCurrent) : zeroActionMatchReceipt(assertCurrent, precondition.match);
  const box = await pointerAction(debuggerRuntime, target, intent);
  if ("failureCode" in box) return box;
  await dispatchPointerClickSequence(debuggerRuntime, target, box, [1], assertCurrent);
  assertCurrent();
  const postcondition = await verifyClickPostcondition(debuggerRuntime, target, intent);
  return {
    clicked: true,
    candidateCount: 1,
    identityRevalidated: true,
    mutationCount: 1,
    postconditionVerified: postcondition.verified,
    ...(postcondition.match === undefined ? {} : matchReceiptEvidence(postcondition.match)),
    ...(postcondition.verified ? {} : { failureCode: "BROWSER_POSTCONDITION_FAILED" }),
  };
};

const executeDoubleClickIntent = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: DoubleClickIntent,
  assertCurrent: CurrentDocumentAssertion,
): Promise<unknown> => {
  const precondition = await waitForMatch(debuggerRuntime, target, intent.postDoubleClickMatch, 0);
  if (precondition.verified) return zeroActionMatchReceipt(assertCurrent, precondition);
  const box = await pointerAction(debuggerRuntime, target, intent);
  if ("failureCode" in box) return box;
  await dispatchPointerClickSequence(debuggerRuntime, target, box, [1, 2], assertCurrent);
  assertCurrent();
  const postcondition = await waitForMatch(
    debuggerRuntime, target, intent.postDoubleClickMatch,
  );
  return {
    doubleClicked: true,
    candidateCount: 1,
    identityRevalidated: true,
    mutationCount: 1,
    postconditionVerified: postcondition.verified,
    ...matchReceiptEvidence(postcondition),
    ...(postcondition.verified ? {} : { failureCode: "BROWSER_POSTCONDITION_FAILED" }),
  };
};

const executeKeypressIntent = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: KeypressIntent,
  assertCurrent: CurrentDocumentAssertion,
): Promise<unknown> => {
  const node = await qualifiedNode(() => mutationCandidate(debuggerRuntime, target, intent));
  if ("receipt" in node) return node.receipt;
  const precondition = await waitForMatch(debuggerRuntime, target, intent.postKeypressMatch, 0);
  if (precondition.verified) return zeroActionMatchReceipt(assertCurrent, precondition);
  try { await requireKeyboardActionTarget(debuggerRuntime, target.tabId, node.nodeId); }
  catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (!/^BROWSER_DOM_(?:CANDIDATE_MISSING|NODE_STALE|READ_INVALID)$/u.test(code)) throw error;
    return qualificationReceipt(1, code, "actionability");
  }
  assertCurrent();
  await debuggerRuntime.send(target.tabId, "DOM.focus", { nodeId: node.nodeId });
  const virtualKeyCode = intent.key === "Enter" ? 13 : intent.key === "ArrowLeft" ? 37 : 39;
  const keyEvent = {
    key: intent.key,
    code: intent.key,
    windowsVirtualKeyCode: virtualKeyCode,
    nativeVirtualKeyCode: virtualKeyCode,
  } as const;
  assertCurrent();
  for (let index = 0; index < (intent.repeat ?? 1); index += 1) {
    assertCurrent();
    await debuggerRuntime.send(target.tabId, "Input.dispatchKeyEvent", { type: "rawKeyDown", ...keyEvent });
    assertCurrent();
    await debuggerRuntime.send(target.tabId, "Input.dispatchKeyEvent", { type: "keyUp", ...keyEvent });
  }
  assertCurrent();
  const postcondition = await waitForMatch(
    debuggerRuntime, target, intent.postKeypressMatch,
  );
  return {
    keyPressed: intent.key,
    keypressCount: intent.repeat ?? 1,
    candidateCount: 1,
    identityRevalidated: true,
    mutationCount: 1,
    postconditionVerified: postcondition.verified,
    ...matchReceiptEvidence(postcondition),
    ...(postcondition.verified ? {} : { failureCode: "BROWSER_POSTCONDITION_FAILED" }),
  };
};

const executeHoverIntent = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: HoverIntent,
  assertCurrent: CurrentDocumentAssertion,
): Promise<unknown> => {
  if (await waitForInteractionAttribute(debuggerRuntime, target, intent, 1, intent.postHoverAttribute, 0)) {
    return zeroActionReceipt(assertCurrent);
  }
  const box = await pointerAction(debuggerRuntime, target, intent);
  if ("failureCode" in box) return box;
  assertCurrent();
  await debuggerRuntime.send(target.tabId, "Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x, y: box.y });
  assertCurrent();
  const postconditionVerified = await waitForInteractionAttribute(
    debuggerRuntime, target, intent, 1, intent.postHoverAttribute,
  );
  return {
    hovered: true,
    candidateCount: 1,
    identityRevalidated: true,
    mutationCount: 1,
    postconditionVerified,
    ...(postconditionVerified ? {} : { failureCode: "BROWSER_POSTCONDITION_FAILED" }),
  };
};

const waitForMatch = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  match: Readonly<{
    selector: string;
    expectedMatches: number;
    readEligibility?: "non-actionable-aria-state";
    textContains?: string;
    textEquals?: string;
    timeoutMs?: number;
  }>,
  timeoutMs?: number,
): Promise<MatchReadback> => {
  const deadline = Date.now() + (timeoutMs ?? match.timeoutMs ?? 1);
  do {
    const candidates = await queryCandidateSet(
      debuggerRuntime, target.tabId, match.selector, match.expectedMatches + 1, undefined,
      match.textEquals !== undefined ? { value: match.textEquals, exact: true }
        : match.textContains !== undefined ? { value: match.textContains, exact: false } : undefined,
      match.readEligibility,
    );
    const verified = candidates.eligibleCount === match.expectedMatches;
    const firstRejection = candidates.rejections[0]?.reasons[0];
    const nativeCauseCode = verified ? null
      : candidates.eligibleCount > match.expectedMatches ? "BROWSER_DOM_CANDIDATE_AMBIGUOUS" as const
        : firstRejection ?? "BROWSER_DOM_CANDIDATE_MISSING";
    const readback = Object.freeze({
      verified, rawCount: candidates.rawCount, eligibleCount: candidates.eligibleCount,
      rejections: candidates.rejections, nativeCauseCode,
    });
    if (verified || Date.now() >= deadline) return readback;
    await waitForNextBoundedObservation(deadline);
  } while (Date.now() <= deadline);
  throw new Error("BROWSER_DOM_READ_INVALID");
};

const waitForUrl = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  postcondition: Readonly<{ equals?: string; notEquals?: string; timeoutMs?: number }>,
  timeoutMs?: number,
): Promise<boolean> => {
  const deadline = Date.now() + (timeoutMs ?? postcondition.timeoutMs ?? 1);
  do {
    const document = await documentState(debuggerRuntime, target.tabId) as { url?: unknown };
    if (postcondition.equals !== undefined && document.url === postcondition.equals) return true;
    if (postcondition.notEquals !== undefined && document.url !== postcondition.notEquals) return true;
    if (Date.now() >= deadline) return false;
    await waitForNextBoundedObservation(deadline);
  } while (Date.now() <= deadline);
  return false;
};

const waitForClickAttribute = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: ClickIntent,
  expectedMatches: number,
  postClickAttribute: NonNullable<ClickIntent["postClickAttribute"]>,
  timeoutMs?: number,
): Promise<boolean> => waitForInteractionAttribute(
  debuggerRuntime, target, intent, expectedMatches, postClickAttribute, timeoutMs,
);

const verifyClickPostcondition = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: ClickIntent,
  timeoutMs?: number,
): Promise<Readonly<{ verified: boolean; match?: MatchReadback }>> => intent.postClickAttribute !== undefined
  ? { verified: await waitForClickAttribute(runtime, target, intent, 1, intent.postClickAttribute, timeoutMs) }
  : intent.postClickMatch !== undefined
    ? waitForMatch(runtime, target, intent.postClickMatch, timeoutMs).then((match) => ({
      verified: match.verified, match,
    }))
    : { verified: await waitForUrl(runtime, target, intent.postClickUrl!, timeoutMs) };

const waitForInteractionAttribute = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: ClickIntent | HoverIntent,
  expectedMatches: number,
  postAttribute: NonNullable<ClickIntent["postClickAttribute"]> | HoverIntent["postHoverAttribute"],
  timeoutMs?: number,
): Promise<boolean> => {
  const deadline = Date.now() + (timeoutMs ?? postAttribute.timeoutMs ?? 1);
  do {
    const nodes = intent.expectedTextEquals !== undefined
      ? await queryVisibleTextMatches(debuggerRuntime, target.tabId, intent.selector, intent.expectedTextEquals, true, expectedMatches + 1, intent.scope)
      : intent.expectedText !== undefined
        ? await queryVisibleTextMatches(debuggerRuntime, target.tabId, intent.selector, intent.expectedText, false, expectedMatches + 1, intent.scope)
        : await queryAll(debuggerRuntime, target.tabId, intent.selector, expectedMatches + 1, intent.scope);
    if (nodes.length === expectedMatches) {
      const currentNodeId = nodes[0];
      if (currentNodeId !== undefined
        && attribute(await describeNode(debuggerRuntime, target.tabId, currentNodeId), postAttribute.name)
          === postAttribute.equals) return true;
    }
    if (Date.now() >= deadline) return false;
    await waitForNextBoundedObservation(deadline);
  } while (Date.now() <= deadline);
  return false;
};

const clearFocusedInput = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  tabId: number,
  assertCurrent: CurrentDocumentAssertion,
): Promise<void> => {
  assertCurrent();
  await debuggerRuntime.send(tabId, "Input.dispatchKeyEvent", {
    type: "rawKeyDown", key: "a", code: "KeyA", commands: ["selectAll"],
  });
  assertCurrent();
  await debuggerRuntime.send(tabId, "Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA" });
  assertCurrent();
  await debuggerRuntime.send(tabId, "Input.dispatchKeyEvent", {
    type: "rawKeyDown", key: "Backspace", code: "Backspace",
  });
  assertCurrent();
  await debuggerRuntime.send(tabId, "Input.dispatchKeyEvent", {
    type: "keyUp", key: "Backspace", code: "Backspace",
  });
};

const executeValueIntent = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: ValueIntent,
  assertCurrent: CurrentDocumentAssertion,
): Promise<unknown> => {
  if (intent.kind !== "fill") {
    const nodeId = intent.kind === "readText" || intent.kind === "readAttribute"
      ? await nodeForRead(debuggerRuntime, target.tabId, intent)
      : await nodeForSelector(debuggerRuntime, target.tabId, intent.selector, 1, intent.scope);
    if (intent.kind === "inspect") return inspectNode(debuggerRuntime, target.tabId, nodeId, intent.fields);
    if (intent.kind === "readText") return nodeText(debuggerRuntime, target.tabId, nodeId);
    return attribute(await describeNode(debuggerRuntime, target.tabId, nodeId), intent.name) ?? "";
  }
  const node = await qualifiedNode(() => mutationCandidate(debuggerRuntime, target, intent));
  if ("receipt" in node) return node.receipt;
  if (await nodeText(debuggerRuntime, target.tabId, node.nodeId) === intent.approvedText) {
    return zeroActionReceipt(assertCurrent);
  }
  try { await requireKeyboardActionTarget(debuggerRuntime, target.tabId, node.nodeId); }
  catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (!/^BROWSER_DOM_(?:CANDIDATE_MISSING|NODE_STALE|READ_INVALID)$/u.test(code)) throw error;
    return qualificationReceipt(1, code, "actionability");
  }
  assertCurrent();
  await debuggerRuntime.send(target.tabId, "DOM.focus", { nodeId: node.nodeId });
  if (intent.clearBeforeType) await clearFocusedInput(debuggerRuntime, target.tabId, assertCurrent);
  assertCurrent();
  await debuggerRuntime.send(target.tabId, "Input.insertText", { text: intent.approvedText });
  assertCurrent();
  const readbackNode = await qualifiedNode(() => mutationCandidate(debuggerRuntime, target, intent));
  if ("receipt" in readbackNode) return {
    filled: true,
    candidateCount: readbackNode.receipt.candidateCount,
    identityRevalidated: false,
    mutationCount: 1,
    retainedValueVerified: false,
    postconditionVerified: false,
    failureCode: "BROWSER_POSTCONDITION_FAILED",
    nativeCauseCode: readbackNode.receipt.failureCode,
  };
  assertCurrent();
  let retainedValue: string;
  try { retainedValue = await nodeText(debuggerRuntime, target.tabId, readbackNode.nodeId); }
  catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (!/^BROWSER_DOM_(?:CANDIDATE_MISSING|NODE_STALE|READ_INVALID)$/u.test(code)) throw error;
    return {
      filled: true, candidateCount: 1, identityRevalidated: false, mutationCount: 1,
      retainedValueVerified: false, postconditionVerified: false,
      failureCode: "BROWSER_POSTCONDITION_FAILED",
      nativeCauseCode: code,
    };
  }
  assertCurrent();
  const postconditionVerified = retainedValue === intent.approvedText;
  return {
    filled: true,
    candidateCount: 1,
    identityRevalidated: true,
    mutationCount: 1,
    retainedValueVerified: postconditionVerified,
    postconditionVerified,
    ...(postconditionVerified ? {} : { failureCode: "BROWSER_POSTCONDITION_FAILED" }),
  };
};
const executeDocumentReadIntent = (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: Extract<BrowserDomIntent, { kind: "document" | "observe" }>,
): Promise<unknown> => intent.kind === "document"
  ? documentState(debuggerRuntime, target.tabId)
  : executeCoherentObservation(debuggerRuntime, target, intent.queries);

export const executeRegisteredDomIntent = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: BrowserDomIntent,
  assertCurrent: CurrentDocumentAssertion,
): Promise<unknown> => {
  assertCurrent();
  if (intent.kind === "document" || intent.kind === "observe") {
    return executeDocumentReadIntent(debuggerRuntime, target, intent);
  }
  if (intent.kind === "readExactAssistantTurn") {
    return executeExactAssistantTurnRead(
      debuggerRuntime, target, intent.assistantTurnId, assertCurrent,
    );
  }
  if (intent.kind === "find") return executeFindIntent(debuggerRuntime, target, intent);
  if (intent.kind === "click") return executeClickIntent(debuggerRuntime, target, intent, assertCurrent);
  if (intent.kind === "hover") return executeHoverIntent(debuggerRuntime, target, intent, assertCurrent);
  if (intent.kind === "doubleClick") return executeDoubleClickIntent(debuggerRuntime, target, intent, assertCurrent);
  if (intent.kind === "keypress") return executeKeypressIntent(debuggerRuntime, target, intent, assertCurrent);
  return executeValueIntent(debuggerRuntime, target, intent, assertCurrent);
};
