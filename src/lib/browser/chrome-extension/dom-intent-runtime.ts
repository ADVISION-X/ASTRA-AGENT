import type { BrowserDomIntent } from "../exact-target/browser-dom-intent.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";
import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import { executeCoherentObservation } from "./dom-coherent-observation.js";
import { attribute, boxCenter, describeNode,
  documentState, inspectNode, nodeForRead, nodeForSelector, nodeText, queryAll,
  queryCandidateSet, queryVisibleTextMatches, requireKeyboardActionTarget,
  selectorForLocator, truncate } from "./dom-query-runtime.js";
type FindIntent = Extract<BrowserDomIntent, { kind: "find" }>;
type ClickIntent = Extract<BrowserDomIntent, { kind: "click" }>;
type HoverIntent = Extract<BrowserDomIntent, { kind: "hover" }>;
type DoubleClickIntent = Extract<BrowserDomIntent, { kind: "doubleClick" }>;
type KeypressIntent = Extract<BrowserDomIntent, { kind: "keypress" }>;
type ValueIntent = Exclude<BrowserDomIntent, {
  kind: "document" | "observe" | "find" | "click" | "hover" | "doubleClick" | "keypress";
}>;
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
  identityRevalidated: false;
  mutationCount: 0;
  postconditionVerified: false;
  qualificationRejected: true;
  failureCode: string;
}>;

const qualificationReceipt = (candidateCount: number, failureCode: string): QualificationReceipt =>
  Object.freeze({ candidateCount, identityRevalidated: false, mutationCount: 0,
    postconditionVerified: false, qualificationRejected: true, failureCode });

const qualifiedNode = async (
  readNodes: () => Promise<readonly number[]>,
): Promise<Readonly<{ nodeId: number }> | Readonly<{ receipt: QualificationReceipt }>> => {
  let nodes: readonly number[];
  try { nodes = await readNodes(); }
  catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (!/^BROWSER_DOM_(?:CANDIDATE_MISSING|CANDIDATE_AMBIGUOUS|NODE_STALE|READ_INVALID)$/u.test(code)) throw error;
    return { receipt: qualificationReceipt(code === "BROWSER_DOM_CANDIDATE_AMBIGUOUS" ? 2 : 0, code) };
  }
  if (nodes.length !== 1) return { receipt: qualificationReceipt(
    nodes.length, nodes.length === 0 ? "BROWSER_DOM_CANDIDATE_MISSING" : "BROWSER_DOM_CANDIDATE_AMBIGUOUS",
  ) };
  return { nodeId: nodes[0]! };
};

const actionBox = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  nodeId: number,
): Promise<Readonly<{ x: number; y: number }> | QualificationReceipt> => {
  try { return await boxCenter(runtime, target.tabId, nodeId); }
  catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (!/^BROWSER_DOM_(?:CANDIDATE_MISSING|NODE_STALE|READ_INVALID)$/u.test(code)) throw error;
    return qualificationReceipt(1, code);
  }
};

const zeroActionReceipt = (): Readonly<Record<string, unknown>> => Object.freeze({
  candidateCount: 1, identityRevalidated: true, mutationCount: 0,
  postconditionVerified: true, zeroActionSatisfied: true,
});

const executeClickIntent = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: ClickIntent,
): Promise<unknown> => {
  const node = await qualifiedNode(() => intent.expectedTextEquals !== undefined
    ? queryVisibleTextMatches(debuggerRuntime, target.tabId, intent.selector, intent.expectedTextEquals, true, 2, intent.scope)
    : intent.expectedText !== undefined
      ? queryVisibleTextMatches(debuggerRuntime, target.tabId, intent.selector, intent.expectedText, false, 2, intent.scope)
      : queryAll(debuggerRuntime, target.tabId, intent.selector, 2, intent.scope));
  if ("receipt" in node) return node.receipt;
  if (await verifyClickPostcondition(debuggerRuntime, target, intent, 0)) return zeroActionReceipt();
  const box = await actionBox(debuggerRuntime, target, node.nodeId);
  if ("failureCode" in box) return box;
  await debuggerRuntime.send(target.tabId, "Input.dispatchMouseEvent", { type: "mousePressed", x: box.x, y: box.y, button: "left", clickCount: 1 });
  await debuggerRuntime.send(target.tabId, "Input.dispatchMouseEvent", { type: "mouseReleased", x: box.x, y: box.y, button: "left", clickCount: 1 });
  const postconditionVerified = await verifyClickPostcondition(debuggerRuntime, target, intent);
  return {
    clicked: true,
    candidateCount: 1,
    identityRevalidated: true,
    mutationCount: 1,
    postconditionVerified,
    ...(postconditionVerified ? {} : { failureCode: "BROWSER_POSTCONDITION_FAILED" }),
  };
};

const executeDoubleClickIntent = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: DoubleClickIntent,
): Promise<unknown> => {
  const node = await qualifiedNode(() => queryAll(
    debuggerRuntime, target.tabId, intent.selector, 2, intent.scope,
  ));
  if ("receipt" in node) return node.receipt;
  if (await waitForMatch(debuggerRuntime, target, intent.postDoubleClickMatch, 0)) return zeroActionReceipt();
  const box = await actionBox(debuggerRuntime, target, node.nodeId);
  if ("failureCode" in box) return box;
  for (const clickCount of [1, 2] as const) {
    await debuggerRuntime.send(target.tabId, "Input.dispatchMouseEvent", {
      type: "mousePressed", x: box.x, y: box.y, button: "left", clickCount,
    });
    await debuggerRuntime.send(target.tabId, "Input.dispatchMouseEvent", {
      type: "mouseReleased", x: box.x, y: box.y, button: "left", clickCount,
    });
  }
  const postconditionVerified = await waitForMatch(
    debuggerRuntime, target, intent.postDoubleClickMatch,
  );
  return {
    doubleClicked: true,
    candidateCount: 1,
    identityRevalidated: true,
    mutationCount: 1,
    postconditionVerified,
    ...(postconditionVerified ? {} : { failureCode: "BROWSER_POSTCONDITION_FAILED" }),
  };
};

const executeKeypressIntent = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: KeypressIntent,
): Promise<unknown> => {
  const node = await qualifiedNode(() => queryAll(debuggerRuntime, target.tabId, intent.selector, 2, intent.scope));
  if ("receipt" in node) return node.receipt;
  if (await waitForMatch(debuggerRuntime, target, intent.postKeypressMatch, 0)) return zeroActionReceipt();
  try { await requireKeyboardActionTarget(debuggerRuntime, target.tabId, node.nodeId); }
  catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (!/^BROWSER_DOM_(?:CANDIDATE_MISSING|NODE_STALE|READ_INVALID)$/u.test(code)) throw error;
    return qualificationReceipt(1, code);
  }
  await debuggerRuntime.send(target.tabId, "DOM.focus", { nodeId: node.nodeId });
  const virtualKeyCode = intent.key === "Enter" ? 13 : intent.key === "ArrowLeft" ? 37 : 39;
  const keyEvent = {
    key: intent.key,
    code: intent.key,
    windowsVirtualKeyCode: virtualKeyCode,
    nativeVirtualKeyCode: virtualKeyCode,
  } as const;
  for (let index = 0; index < (intent.repeat ?? 1); index += 1) {
    await debuggerRuntime.send(target.tabId, "Input.dispatchKeyEvent", { type: "rawKeyDown", ...keyEvent });
    await debuggerRuntime.send(target.tabId, "Input.dispatchKeyEvent", { type: "keyUp", ...keyEvent });
  }
  const postconditionVerified = await waitForMatch(
    debuggerRuntime, target, intent.postKeypressMatch,
  );
  return {
    keyPressed: intent.key,
    keypressCount: intent.repeat ?? 1,
    candidateCount: 1,
    identityRevalidated: true,
    mutationCount: 1,
    postconditionVerified,
    ...(postconditionVerified ? {} : { failureCode: "BROWSER_POSTCONDITION_FAILED" }),
  };
};

const executeHoverIntent = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: HoverIntent,
): Promise<unknown> => {
  const node = await qualifiedNode(() => intent.expectedTextEquals !== undefined
    ? queryVisibleTextMatches(debuggerRuntime, target.tabId, intent.selector, intent.expectedTextEquals, true, 2, intent.scope)
    : intent.expectedText !== undefined
      ? queryVisibleTextMatches(debuggerRuntime, target.tabId, intent.selector, intent.expectedText, false, 2, intent.scope)
      : queryAll(debuggerRuntime, target.tabId, intent.selector, 2, intent.scope));
  if ("receipt" in node) return node.receipt;
  if (await waitForInteractionAttribute(debuggerRuntime, target, intent, 1, intent.postHoverAttribute, 0)) {
    return zeroActionReceipt();
  }
  const box = await actionBox(debuggerRuntime, target, node.nodeId);
  if ("failureCode" in box) return box;
  await debuggerRuntime.send(target.tabId, "Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x, y: box.y });
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
    textContains?: string;
    textEquals?: string;
    timeoutMs?: number;
  }>,
  timeoutMs?: number,
): Promise<boolean> => {
  const deadline = Date.now() + (timeoutMs ?? match.timeoutMs ?? 1);
  do {
    const nodes = match.textEquals !== undefined
      ? await queryVisibleTextMatches(debuggerRuntime, target.tabId, match.selector, match.textEquals, true, match.expectedMatches + 1)
      : match.textContains !== undefined
        ? await queryVisibleTextMatches(debuggerRuntime, target.tabId, match.selector, match.textContains, false, match.expectedMatches + 1)
        : await queryAll(debuggerRuntime, target.tabId, match.selector, match.expectedMatches + 1);
    if (nodes.length === match.expectedMatches) return true;
    if (Date.now() >= deadline) return false;
    await waitForNextBoundedObservation(deadline);
  } while (Date.now() <= deadline);
  return false;
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
): Promise<boolean> => intent.postClickAttribute !== undefined
  ? waitForClickAttribute(runtime, target, intent, 1, intent.postClickAttribute, timeoutMs)
  : intent.postClickMatch !== undefined
    ? waitForMatch(runtime, target, intent.postClickMatch, timeoutMs)
    : waitForUrl(runtime, target, intent.postClickUrl!, timeoutMs);

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
): Promise<void> => {
  await debuggerRuntime.send(tabId, "Input.dispatchKeyEvent", {
    type: "rawKeyDown", key: "a", code: "KeyA", commands: ["selectAll"],
  });
  await debuggerRuntime.send(tabId, "Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA" });
  await debuggerRuntime.send(tabId, "Input.dispatchKeyEvent", {
    type: "rawKeyDown", key: "Backspace", code: "Backspace",
  });
  await debuggerRuntime.send(tabId, "Input.dispatchKeyEvent", {
    type: "keyUp", key: "Backspace", code: "Backspace",
  });
};

const executeValueIntent = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: ValueIntent,
): Promise<unknown> => {
  if (intent.kind !== "fill") {
    const nodeId = intent.kind === "readText" || intent.kind === "readAttribute"
      ? await nodeForRead(debuggerRuntime, target.tabId, intent)
      : await nodeForSelector(debuggerRuntime, target.tabId, intent.selector, 1, intent.scope);
    if (intent.kind === "inspect") return inspectNode(debuggerRuntime, target.tabId, nodeId, intent.fields);
    if (intent.kind === "readText") return truncate(await nodeText(debuggerRuntime, target.tabId, nodeId), intent.maxChars);
    return truncate(attribute(await describeNode(debuggerRuntime, target.tabId, nodeId), intent.name) ?? "", intent.maxChars);
  }
  const node = await qualifiedNode(() => queryAll(debuggerRuntime, target.tabId, intent.selector, 2, intent.scope));
  if ("receipt" in node) return node.receipt;
  if (await nodeText(debuggerRuntime, target.tabId, node.nodeId) === intent.approvedText) return zeroActionReceipt();
  try { await requireKeyboardActionTarget(debuggerRuntime, target.tabId, node.nodeId); }
  catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (!/^BROWSER_DOM_(?:CANDIDATE_MISSING|NODE_STALE|READ_INVALID)$/u.test(code)) throw error;
    return qualificationReceipt(1, code);
  }
  await debuggerRuntime.send(target.tabId, "DOM.focus", { nodeId: node.nodeId });
  if (intent.clearBeforeType) await clearFocusedInput(debuggerRuntime, target.tabId);
  await debuggerRuntime.send(target.tabId, "Input.insertText", { text: intent.approvedText });
  const retainedValue = await nodeText(debuggerRuntime, target.tabId, node.nodeId);
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

export const executeRegisteredDomIntent = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: BrowserDomIntent,
): Promise<unknown> => {
  if (intent.kind === "document") return documentState(debuggerRuntime, target.tabId);
  if (intent.kind === "observe") return executeCoherentObservation(debuggerRuntime, target, intent.queries);
  if (intent.kind === "find") return executeFindIntent(debuggerRuntime, target, intent);
  if (intent.kind === "click") return executeClickIntent(debuggerRuntime, target, intent);
  if (intent.kind === "hover") return executeHoverIntent(debuggerRuntime, target, intent);
  if (intent.kind === "doubleClick") return executeDoubleClickIntent(debuggerRuntime, target, intent);
  if (intent.kind === "keypress") return executeKeypressIntent(debuggerRuntime, target, intent);
  return executeValueIntent(debuggerRuntime, target, intent);
};
