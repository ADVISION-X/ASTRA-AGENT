import type { BrowserDomIntent } from "../exact-target/browser-dom-intent.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";
import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import {
  accessibilityValue,
  attribute,
  boxCenter,
  describeNode,
  documentState,
  inspectNode,
  nodeForRead,
  nodeForSelector,
  nodeText,
  queryAll,
  queryVisibleTextMatches,
  selectorForLocator,
  truncate,
} from "./dom-query-runtime.js";

type FindIntent = Extract<BrowserDomIntent, { kind: "find" }>;
type ClickIntent = Extract<BrowserDomIntent, { kind: "click" }>;
type HoverIntent = Extract<BrowserDomIntent, { kind: "hover" }>;
type DoubleClickIntent = Extract<BrowserDomIntent, { kind: "doubleClick" }>;
type KeypressIntent = Extract<BrowserDomIntent, { kind: "keypress" }>;
type ValueIntent = Exclude<BrowserDomIntent, {
  kind: "document" | "find" | "click" | "hover" | "doubleClick" | "keypress";
}>;

/** Executes the finite declarative DOM intent set without a script/eval surface. */
const executeFindIntent = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: FindIntent,
): Promise<unknown> => {
  const selector = intent.selector ?? selectorForLocator(intent.locator!);
  const deadline = intent.waitFor === undefined ? null : Date.now() + intent.waitFor.timeoutMs;
  let nodes: readonly number[] = [];
  do {
    nodes = intent.textEquals !== undefined
      ? await queryVisibleTextMatches(debuggerRuntime, target.tabId, selector, intent.textEquals, true, intent.maxMatches + 1, intent.scope)
      : intent.textContains !== undefined
        ? await queryVisibleTextMatches(debuggerRuntime, target.tabId, selector, intent.textContains, false, intent.maxMatches + 1, intent.scope)
        : await queryAll(debuggerRuntime, target.tabId, selector, intent.maxMatches + 1, intent.scope);
    if (intent.waitFor === undefined || nodes.length >= intent.waitFor.minimumMatches || Date.now() >= deadline!) break;
    await waitForNextBoundedObservation(deadline!);
  } while (Date.now() <= deadline!);
  if (nodes.length > intent.maxMatches) throw new Error("BROWSER_TARGET_INVALID");
  const matches = intent.fields === undefined
    ? undefined
    : await Promise.all(nodes.map((nodeId) => inspectNode(
      debuggerRuntime,
      target.tabId,
      nodeId,
      intent.fields!,
    )));
  return { count: nodes.length, ...(matches === undefined ? {} : { matches }) };
};

const waitForNextBoundedObservation = async (deadline: number): Promise<void> => {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return;
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, Math.min(50, remaining)));
};

const executeClickIntent = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: ClickIntent,
): Promise<unknown> => {
  const expectedMatches = intent.expectedMatches ?? 1;
  const matchingNodes = intent.expectedTextEquals !== undefined
    ? await queryVisibleTextMatches(debuggerRuntime, target.tabId, intent.selector, intent.expectedTextEquals, true, expectedMatches + 1, intent.scope)
    : intent.expectedText !== undefined
      ? await queryVisibleTextMatches(debuggerRuntime, target.tabId, intent.selector, intent.expectedText, false, expectedMatches + 1, intent.scope)
      : await queryAll(debuggerRuntime, target.tabId, intent.selector, expectedMatches + 1, intent.scope);
  if (matchingNodes.length !== expectedMatches) throw new Error("BROWSER_TARGET_INVALID");
  const nodeId = matchingNodes[0];
  if (nodeId === undefined) throw new Error("BROWSER_TARGET_INVALID");
  const box = await boxCenter(debuggerRuntime, target.tabId, nodeId);
  await debuggerRuntime.send(target.tabId, "Input.dispatchMouseEvent", { type: "mousePressed", x: box.x, y: box.y, button: "left", clickCount: 1 });
  await debuggerRuntime.send(target.tabId, "Input.dispatchMouseEvent", { type: "mouseReleased", x: box.x, y: box.y, button: "left", clickCount: 1 });
  const postconditionVerified = intent.postClickAttribute !== undefined
    ? await waitForClickAttribute(debuggerRuntime, target, intent, expectedMatches, intent.postClickAttribute)
    : intent.postClickMatch !== undefined
      ? await waitForMatch(debuggerRuntime, target, intent.postClickMatch)
      : await waitForUrl(debuggerRuntime, target, intent.postClickUrl!);
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
  const expectedMatches = intent.expectedMatches ?? 1;
  const matchingNodes = await queryAll(
    debuggerRuntime, target.tabId, intent.selector, expectedMatches + 1, intent.scope,
  );
  if (matchingNodes.length !== expectedMatches) throw new Error("BROWSER_TARGET_INVALID");
  const nodeId = matchingNodes[0];
  if (nodeId === undefined) throw new Error("BROWSER_TARGET_INVALID");
  const box = await boxCenter(debuggerRuntime, target.tabId, nodeId);
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
  const expectedMatches = intent.expectedMatches ?? 1;
  const nodeId = await nodeForSelector(
    debuggerRuntime, target.tabId, intent.selector, expectedMatches, intent.scope,
  );
  await debuggerRuntime.send(target.tabId, "DOM.focus", { nodeId });
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
  const expectedMatches = intent.expectedMatches ?? 1;
  const matchingNodes = intent.expectedTextEquals !== undefined
    ? await queryVisibleTextMatches(debuggerRuntime, target.tabId, intent.selector, intent.expectedTextEquals, true, expectedMatches + 1, intent.scope)
    : intent.expectedText !== undefined
      ? await queryVisibleTextMatches(debuggerRuntime, target.tabId, intent.selector, intent.expectedText, false, expectedMatches + 1, intent.scope)
      : await queryAll(debuggerRuntime, target.tabId, intent.selector, expectedMatches + 1, intent.scope);
  if (matchingNodes.length !== expectedMatches) throw new Error("BROWSER_TARGET_INVALID");
  const nodeId = matchingNodes[0];
  if (nodeId === undefined) throw new Error("BROWSER_TARGET_INVALID");
  const box = await boxCenter(debuggerRuntime, target.tabId, nodeId);
  await debuggerRuntime.send(target.tabId, "Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x, y: box.y });
  const postconditionVerified = await waitForInteractionAttribute(
    debuggerRuntime, target, intent, expectedMatches, intent.postHoverAttribute,
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
): Promise<boolean> => {
  const deadline = Date.now() + (match.timeoutMs ?? 1);
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
  postcondition: Readonly<{ equals: string; timeoutMs?: number }>,
): Promise<boolean> => {
  const deadline = Date.now() + (postcondition.timeoutMs ?? 1);
  do {
    const document = await documentState(debuggerRuntime, target.tabId) as { url?: unknown };
    if (document.url === postcondition.equals) return true;
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
): Promise<boolean> => waitForInteractionAttribute(
  debuggerRuntime, target, intent, expectedMatches, postClickAttribute,
);

const waitForInteractionAttribute = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: ClickIntent | HoverIntent,
  expectedMatches: number,
  postAttribute: NonNullable<ClickIntent["postClickAttribute"]> | HoverIntent["postHoverAttribute"],
): Promise<boolean> => {
  const deadline = Date.now() + (postAttribute.timeoutMs ?? 1);
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

const executeValueIntent = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: ValueIntent,
): Promise<unknown> => {
  const nodeId = intent.kind === "readText" || intent.kind === "readAttribute"
    ? await nodeForRead(debuggerRuntime, target.tabId, intent)
    : await nodeForSelector(debuggerRuntime, target.tabId, intent.selector, intent.kind === "fill" ? intent.expectedMatches ?? 1 : 1, intent.scope);
  if (intent.kind === "inspect") return inspectNode(debuggerRuntime, target.tabId, nodeId, intent.fields);
  if (intent.kind === "readText") return truncate(await nodeText(debuggerRuntime, target.tabId, nodeId), intent.maxChars);
  if (intent.kind === "readAttribute") return truncate(attribute(await describeNode(debuggerRuntime, target.tabId, nodeId), intent.name) ?? "", intent.maxChars);
  await debuggerRuntime.send(target.tabId, "DOM.focus", { nodeId });
  if (intent.clearBeforeType) {
    await debuggerRuntime.send(target.tabId, "Input.dispatchKeyEvent", { type: "rawKeyDown", key: "a", code: "KeyA", modifiers: 2 });
    await debuggerRuntime.send(target.tabId, "Input.dispatchKeyEvent", { type: "keyDown", key: "Backspace", code: "Backspace" });
  }
  await debuggerRuntime.send(target.tabId, "Input.insertText", { text: intent.approvedText });
  const retainedValue = await accessibilityValue(debuggerRuntime, target.tabId, nodeId);
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
  if (intent.kind === "find") return executeFindIntent(debuggerRuntime, target, intent);
  if (intent.kind === "click") return executeClickIntent(debuggerRuntime, target, intent);
  if (intent.kind === "hover") return executeHoverIntent(debuggerRuntime, target, intent);
  if (intent.kind === "doubleClick") return executeDoubleClickIntent(debuggerRuntime, target, intent);
  if (intent.kind === "keypress") return executeKeypressIntent(debuggerRuntime, target, intent);
  return executeValueIntent(debuggerRuntime, target, intent);
};
