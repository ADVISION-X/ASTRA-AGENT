import type {
  BrowserDomIntent,
} from "../exact-target/browser-dom-intent.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";
import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import { resolveCoherentMutationCandidate } from "./dom-coherent-candidate.js";
import { candidateMissingStage } from "./dom-candidate-missing-stage.js";
import { executeExactAssistantTurnRead } from "./dom-exact-assistant-turn.js";
import { executeCoherentObservation } from "./dom-coherent-observation.js";
import {
  executeClickIntent,
  executeDoubleClickIntent,
  executeHoverIntent,
  executeKeypressIntent,
} from "./dom-pointer-intent-runtime.js";
import { attribute, describeNode,
  documentState, inspectNode, nodeForRead, nodeForSelector, nodeText,
  queryCandidateSet, requireKeyboardActionTarget,
  selectorForLocator } from "./dom-query-runtime.js";
import {
  currentGptPageIdentity,
  readWithTransientDomConfirmation,
  waitForNextChatGptObservation,
} from "./chatgpt-page-access-gate.js";
import { executeKnownGptRateLimitIntent } from "./gpt-rate-limit-dialog.js";
type FindIntent = Extract<BrowserDomIntent, { kind: "find" }>;
type ValueIntent = Exclude<BrowserDomIntent, {
  kind: "document" | "selectExactGptConversation" | "renameExactGptConversation"
    | "acknowledgeKnownGptRateLimit" | "readKnownGptRateLimitClearance"
    | "observe" | "readExactAssistantTurn" | "find"
    | "click" | "hover" | "doubleClick" | "keypress";
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
    if (!await waitForNextChatGptObservation(deadline!)) break;
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
  candidateSetCause: string | null = null,
): QualificationReceipt =>
  Object.freeze({ candidateCount, qualificationStage, identityRevalidated: false, mutationCount: 0,
    postconditionVerified: false, qualificationRejected: true,
    failureCode: qualificationStage === "actionability" ? "BROWSER_DOM_ACTION_NOT_QUALIFIED" : failureCode,
    nativeCauseCode: qualificationStage === "actionability" ? failureCode : candidateSetCause });

const qualifiedNode = async (
  readNode: () => Promise<number>,
): Promise<Readonly<{ nodeId: number }> | Readonly<{ receipt: QualificationReceipt }>> => {
  let nodeId: number;
  try { nodeId = await readNode(); }
  catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (!/^BROWSER_DOM_(?:CANDIDATE_MISSING|CANDIDATE_AMBIGUOUS|NODE_STALE|READ_INVALID)$/u.test(code)) throw error;
    return { receipt: qualificationReceipt(
      code === "BROWSER_DOM_CANDIDATE_AMBIGUOUS" ? 2 : 0, code, "candidate-set", candidateMissingStage(error),
    ) };
  }
  return { nodeId };
};

const mutationCandidate = (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: Extract<ValueIntent, { kind: "fill" }>,
): Promise<number> => resolveCoherentMutationCandidate(runtime, target, {
  selector: intent.selector,
  ...(intent.scope === undefined ? {} : { scope: intent.scope }),
});

const transientNodeReceipt = (value: Readonly<{ receipt: QualificationReceipt }>): boolean =>
  ["BROWSER_DOM_CANDIDATE_MISSING", "BROWSER_DOM_NODE_STALE"]
    .includes(value.receipt.failureCode);

const confirmedQualifiedNode = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  read: () => ReturnType<typeof qualifiedNode>,
  assertCurrent: CurrentDocumentAssertion,
  allowTransientDomConfirmation: boolean,
): ReturnType<typeof qualifiedNode> => allowTransientDomConfirmation
  ? readWithTransientDomConfirmation({
    read: async () => {
      assertCurrent();
      const value = await read();
      return { value, transient: "receipt" in value && transientNodeReceipt(value) };
    },
    continuity: async () => {
      assertCurrent();
      return currentGptPageIdentity(runtime, target.tabId);
    },
  }) : read();

const zeroActionReceipt = (assertCurrent: CurrentDocumentAssertion): Readonly<Record<string, unknown>> => {
  assertCurrent();
  return Object.freeze({ candidateCount: 1, identityRevalidated: true, mutationCount: 0,
    postconditionVerified: true, zeroActionSatisfied: true });
};


const clearFocusedInput = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  tabId: number,
  assertCurrent: CurrentDocumentAssertion,
  onPhysicalInput?: () => void,
): Promise<void> => {
  assertCurrent();
  await debuggerRuntime.send(tabId, "Input.dispatchKeyEvent", {
    type: "rawKeyDown", key: "a", code: "KeyA", commands: ["selectAll"],
  });
  onPhysicalInput?.();
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

const executeReadValueIntent = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: Exclude<ValueIntent, { kind: "fill" }>,
): Promise<unknown> => {
  const nodeId = intent.kind === "readText" || intent.kind === "readAttribute"
    ? await nodeForRead(debuggerRuntime, target.tabId, intent)
    : await nodeForSelector(debuggerRuntime, target.tabId, intent.selector, 1, intent.scope);
  if (intent.kind === "inspect") return inspectNode(debuggerRuntime, target.tabId, nodeId, intent.fields);
  if (intent.kind === "readText") return nodeText(debuggerRuntime, target.tabId, nodeId);
  return attribute(await describeNode(debuggerRuntime, target.tabId, nodeId), intent.name) ?? "";
};

const readFilledValueReceipt = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: Extract<ValueIntent, { kind: "fill" }>,
  assertCurrent: CurrentDocumentAssertion,
  allowTransientDomConfirmation: boolean,
): Promise<unknown> => {
  const readbackNode = await confirmedQualifiedNode(
    debuggerRuntime, target,
    () => qualifiedNode(() => mutationCandidate(debuggerRuntime, target, intent)),
    assertCurrent, allowTransientDomConfirmation,
  );
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

const executeValueIntent = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: ValueIntent,
  assertCurrent: CurrentDocumentAssertion,
  onPhysicalInput?: () => void,
  allowTransientDomConfirmation = true,
): Promise<unknown> => {
  if (intent.kind !== "fill") return executeReadValueIntent(debuggerRuntime, target, intent);
  const node = await confirmedQualifiedNode(
    debuggerRuntime, target,
    () => qualifiedNode(() => mutationCandidate(debuggerRuntime, target, intent)),
    assertCurrent, allowTransientDomConfirmation,
  );
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
  let inputObserved = false;
  const markInput = (): void => {
    if (inputObserved) return;
    inputObserved = true;
    onPhysicalInput?.();
  };
  if (intent.clearBeforeType) {
    await clearFocusedInput(debuggerRuntime, target.tabId, assertCurrent, markInput);
  }
  assertCurrent();
  await debuggerRuntime.send(target.tabId, "Input.insertText", { text: intent.approvedText });
  markInput();
  assertCurrent();
  return readFilledValueReceipt(
    debuggerRuntime, target, intent, assertCurrent, allowTransientDomConfirmation,
  );
};

export const executeFillIntent = (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: Extract<BrowserDomIntent, { kind: "fill" }>,
  assertCurrent: CurrentDocumentAssertion,
  onPhysicalInput?: () => void,
  allowTransientDomConfirmation = true,
): Promise<unknown> => executeValueIntent(
  debuggerRuntime, target, intent, assertCurrent, onPhysicalInput, allowTransientDomConfirmation,
);
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
  expectedMainFrameLoaderId?: string,
): Promise<unknown> => {
  assertCurrent();
  if (intent.kind === "selectExactGptConversation") throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  if (intent.kind === "renameExactGptConversation") {
    const { executeGptConversationRename } = await import("./gpt-conversation-rename-runtime.js");
    return executeGptConversationRename(debuggerRuntime, target, intent, assertCurrent);
  }
  if (intent.kind === "acknowledgeKnownGptRateLimit"
    || intent.kind === "readKnownGptRateLimitClearance") {
    return executeKnownGptRateLimitIntent(debuggerRuntime, target, intent, assertCurrent);
  }
  if (intent.kind === "document" || intent.kind === "observe") {
    return executeDocumentReadIntent(debuggerRuntime, target, intent);
  }
  if (intent.kind === "readExactAssistantTurn") {
    if (!expectedMainFrameLoaderId) throw new Error("BROWSER_DOCUMENT_INVALID");
    return executeExactAssistantTurnRead(
      debuggerRuntime, target, intent, assertCurrent, expectedMainFrameLoaderId,
    );
  }
  let operation: Promise<unknown>;
  if (intent.kind === "find") operation = executeFindIntent(debuggerRuntime, target, intent);
  else if (intent.kind === "click") operation = executeClickIntent(debuggerRuntime, target, intent, assertCurrent);
  else if (intent.kind === "hover") operation = executeHoverIntent(debuggerRuntime, target, intent, assertCurrent);
  else if (intent.kind === "doubleClick") operation = executeDoubleClickIntent(debuggerRuntime, target, intent, assertCurrent);
  else if (intent.kind === "keypress") operation = executeKeypressIntent(debuggerRuntime, target, intent, assertCurrent);
  else operation = executeValueIntent(debuggerRuntime, target, intent, assertCurrent);
  return operation;
};
