import type { BrowserDomIntent } from "../exact-target/browser-dom-intent.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";
import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";

type DevToolsRecord = Record<string, unknown>;
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
      : undefined;
  if (postconditionVerified === false) throw new Error("BROWSER_TARGET_INVALID");
  return {
    clicked: true,
    candidateCount: 1,
    identityRevalidated: true,
    mutationCount: 1,
    ...(postconditionVerified === undefined ? {} : { postconditionVerified }),
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
  if (!postconditionVerified) throw new Error("BROWSER_TARGET_INVALID");
  return {
    doubleClicked: true,
    candidateCount: 1,
    identityRevalidated: true,
    mutationCount: 1,
    postconditionVerified: true,
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
  const keyEvent = {
    key: intent.key,
    code: intent.key,
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13,
  } as const;
  await debuggerRuntime.send(target.tabId, "Input.dispatchKeyEvent", { type: "rawKeyDown", ...keyEvent });
  await debuggerRuntime.send(target.tabId, "Input.dispatchKeyEvent", { type: "keyUp", ...keyEvent });
  const postconditionVerified = await waitForMatch(
    debuggerRuntime, target, intent.postKeypressMatch,
  );
  if (!postconditionVerified) throw new Error("BROWSER_TARGET_INVALID");
  return {
    keyPressed: intent.key,
    candidateCount: 1,
    identityRevalidated: true,
    mutationCount: 1,
    postconditionVerified: true,
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
  if (!postconditionVerified) throw new Error("BROWSER_TARGET_INVALID");
  return {
    hovered: true,
    candidateCount: 1,
    identityRevalidated: true,
    mutationCount: 1,
    postconditionVerified: true,
  };
};

const waitForMatch = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  match: Readonly<{ selector: string; expectedMatches: number; timeoutMs?: number }>,
): Promise<boolean> => {
  const deadline = Date.now() + (match.timeoutMs ?? 1);
  do {
    const nodes = await queryAll(
      debuggerRuntime,
      target.tabId,
      match.selector,
      match.expectedMatches + 1,
    );
    if (nodes.length === match.expectedMatches) return true;
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
  if (retainedValue !== intent.approvedText) throw new Error("BROWSER_TARGET_INVALID");
  return {
    filled: true,
    candidateCount: 1,
    identityRevalidated: true,
    mutationCount: 1,
    retainedValueVerified: true,
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

const nodeForSelector = async (runtime: ExtensionDebuggerRuntime, tabId: number, selector: string, expectedMatches: number, scope?: Readonly<{ selector: string }>): Promise<number> => {
  const nodes = await queryAll(runtime, tabId, selector, expectedMatches + 1, scope);
  if (nodes.length !== expectedMatches) throw new Error("BROWSER_TARGET_INVALID");
  const nodeId = nodes[0];
  if (nodeId === undefined) throw new Error("BROWSER_TARGET_INVALID");
  return nodeId;
};

const nodeForRead = async (
  runtime: ExtensionDebuggerRuntime,
  tabId: number,
  intent: Extract<BrowserDomIntent, { kind: "readText" | "readAttribute" }>,
): Promise<number> => {
  const maximum = intent.expectedMatches ?? intent.maxMatches ?? 1;
  const nodes = intent.kind === "readAttribute" && intent.textContains !== undefined
    ? await queryVisibleTextMatches(runtime, tabId, intent.selector, intent.textContains, false, maximum + 1, intent.scope)
    : await queryAll(runtime, tabId, intent.selector, maximum + 1, intent.scope);
  if (intent.expectedMatches !== undefined ? nodes.length !== intent.expectedMatches : nodes.length > maximum) {
    throw new Error("BROWSER_TARGET_INVALID");
  }
  const index = intent.matchIndex ?? 0;
  const nodeId = nodes[index];
  if (nodeId === undefined) throw new Error("BROWSER_TARGET_INVALID");
  return nodeId;
};

const queryAll = async (
  runtime: ExtensionDebuggerRuntime,
  tabId: number,
  selector: string,
  limit: number,
  scope?: Readonly<{ selector: string }>,
): Promise<readonly number[]> => {
  const nodeIds = await queryNodeIds(runtime, tabId, selector, scope);
  return visibleNodes(runtime, tabId, nodeIds, limit);
};

const queryNodeIds = async (
  runtime: ExtensionDebuggerRuntime,
  tabId: number,
  selector: string,
  scope?: Readonly<{ selector: string }>,
): Promise<readonly number[]> => {
  const root = record(await runtime.send(tabId, "DOM.getDocument", { depth: 1, pierce: true }));
  const rootNode = record(root.root);
  let queryRootId = numberValue(rootNode.nodeId, "BROWSER_TARGET_INVALID");
  if (scope) {
    const scopeResult = record(await runtime.send(tabId, "DOM.querySelectorAll", { nodeId: queryRootId, selector: scope.selector }));
    const scopeIds = Array.isArray(scopeResult.nodeIds) ? scopeResult.nodeIds.map((value) => numberValue(value, "BROWSER_TARGET_INVALID")) : [];
    const visibleScopes = await visibleNodes(runtime, tabId, scopeIds);
    if (visibleScopes.length !== 1) throw new Error("BROWSER_TARGET_INVALID");
    queryRootId = visibleScopes[0]!;
  }
  const result = record(await runtime.send(tabId, "DOM.querySelectorAll", { nodeId: queryRootId, selector }));
  const values = Array.isArray(result.nodeIds) ? result.nodeIds : [];
  return values.map((value) => numberValue(value, "BROWSER_TARGET_INVALID"));
};

const visibleNodes = async (
  runtime: ExtensionDebuggerRuntime,
  tabId: number,
  nodeIds: readonly number[],
  limit = nodeIds.length,
): Promise<readonly number[]> => {
  const visible: number[] = [];
  for (const nodeId of nodeIds) {
    if (await boxCenter(runtime, tabId, nodeId).then(() => true).catch(() => false)) visible.push(nodeId);
    if (visible.length >= limit) break;
  }
  return visible;
};

const queryVisibleTextMatches = async (
  runtime: ExtensionDebuggerRuntime,
  tabId: number,
  selector: string,
  expectedText: string,
  exact: boolean,
  limit: number,
  scope?: Readonly<{ selector: string }>,
): Promise<readonly number[]> => {
  const expected = exact ? expectedText.trim() : expectedText;
  const matches: number[] = [];
  for (const nodeId of await queryNodeIds(runtime, tabId, selector, scope)) {
    const actual = await nodeText(runtime, tabId, nodeId);
    if (exact ? actual.trim() !== expected : !actual.includes(expected)) continue;
    if (!await boxCenter(runtime, tabId, nodeId).then(() => true).catch(() => false)) continue;
    matches.push(nodeId);
    if (matches.length >= limit) break;
  }
  return matches;
};

const documentState = async (runtime: ExtensionDebuggerRuntime, tabId: number): Promise<Readonly<{ url: string; title: string }>> => {
  const history = record(await runtime.send(tabId, "Page.getNavigationHistory"));
  const entries = Array.isArray(history.entries) ? history.entries : [];
  const currentIndex = numberValue(history.currentIndex, "BROWSER_TARGET_INVALID");
  const entry = record(entries[currentIndex]);
  const url = stringValue(entry.url, "BROWSER_TARGET_INVALID");
  const title = stringValue(entry.title, "BROWSER_TARGET_INVALID");
  if (!url.startsWith("https://")) throw new Error("BROWSER_ORIGIN_REJECTED");
  return { url, title };
};

const describeNode = async (runtime: ExtensionDebuggerRuntime, tabId: number, nodeId: number): Promise<DevToolsRecord> => record(record(await runtime.send(tabId, "DOM.describeNode", { nodeId, depth: 0 })).node);

const accessibilityValue = async (
  runtime: ExtensionDebuggerRuntime,
  tabId: number,
  nodeId: number,
): Promise<string> => {
  const node = await describeNode(runtime, tabId, nodeId);
  const backendNodeId = numberValue(node.backendNodeId, "BROWSER_TARGET_INVALID");
  const tree = record(await runtime.send(tabId, "Accessibility.getPartialAXTree", {
    backendNodeId,
    fetchRelatives: false,
  }));
  const nodes = Array.isArray(tree.nodes) ? tree.nodes.map(record) : [];
  const target = nodes.find((candidate) => candidate.backendDOMNodeId === backendNodeId);
  const value = target && typeof target.value === "object" && target.value !== null
    ? record(target.value)
    : null;
  return value && typeof value.value === "string" ? value.value : "";
};

const nodeText = async (runtime: ExtensionDebuggerRuntime, tabId: number, nodeId: number): Promise<string> => {
  const described = record(await runtime.send(tabId, "DOM.describeNode", {
    nodeId,
    depth: -1,
    pierce: true,
  }));
  return collectNodeText(record(described.node));
};

const collectNodeText = (node: DevToolsRecord): string => {
  const own = typeof node.nodeValue === "string" ? node.nodeValue : "";
  const children = Array.isArray(node.children)
    ? node.children.map((child) => collectNodeText(record(child))).join("")
    : "";
  return `${own}${children}`;
};

const staticFieldReaders: Readonly<Record<string, (node: DevToolsRecord) => unknown>> = {
  id: (node) => attribute(node, "id") ?? "",
  testId: (node) => attribute(node, "data-testid") ?? "",
  dataTurn: (node) => attribute(node, "data-turn") ?? "",
  tagName: (node) => stringValue(node.nodeName, "BROWSER_TARGET_INVALID"),
  type: (node) => attribute(node, "type") ?? "",
  role: (node) => attribute(node, "role") ?? "",
  ariaLabel: (node) => attribute(node, "aria-label") ?? "",
  ariaExpanded: (node) => attribute(node, "aria-expanded") ?? "",
  ariaChecked: (node) => attribute(node, "aria-checked") ?? "",
  value: (node) => attribute(node, "value") ?? "",
  accept: (node) => attribute(node, "accept") ?? "",
  multiple: (node) => attribute(node, "multiple") !== undefined,
  connected: () => true,
  disabled: (node) => attribute(node, "disabled") !== undefined,
};

const inspectStaticField = (
  node: DevToolsRecord,
  field: string,
  result: Record<string, unknown>,
): boolean => {
  const reader = staticFieldReaders[field];
  if (!reader) return false;
  result[field] = reader(node);
  return true;
};

const inspectGeometryField = async (
  runtime: ExtensionDebuggerRuntime,
  tabId: number,
  nodeId: number,
  field: string,
  result: Record<string, unknown>,
): Promise<boolean> => {
  if (field !== "visible" && field !== "bounds") return false;
  const box = await boxCenter(runtime, tabId, nodeId).catch(() => null);
  if (field === "visible") result.visible = box !== null;
  if (field === "bounds") result.bounds = box;
  return true;
};

const inspectNode = async (runtime: ExtensionDebuggerRuntime, tabId: number, nodeId: number, fields: readonly string[]): Promise<Readonly<Record<string, unknown>>> => {
  const node = await describeNode(runtime, tabId, nodeId);
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (field === "text") {
      result.text = await nodeText(runtime, tabId, nodeId);
      continue;
    }
    if (inspectStaticField(node, field, result)) continue;
    await inspectGeometryField(runtime, tabId, nodeId, field, result);
  }
  return result;
};

const boxCenter = async (runtime: ExtensionDebuggerRuntime, tabId: number, nodeId: number): Promise<Readonly<{ x: number; y: number }>> => {
  const boxModel = record(await runtime.send(tabId, "DOM.getBoxModel", { nodeId }));
  const model = record(boxModel.model);
  const content = Array.isArray(model.content) ? model.content : [];
  if (content.length < 8) throw new Error("BROWSER_TARGET_INVALID");
  const x = (numberValue(content[0], "BROWSER_TARGET_INVALID") + numberValue(content[2], "BROWSER_TARGET_INVALID")) / 2;
  const y = (numberValue(content[1], "BROWSER_TARGET_INVALID") + numberValue(content[5], "BROWSER_TARGET_INVALID")) / 2;
  return { x, y };
};

const selectorForLocator = (locator: Readonly<{ role?: string; name?: string; testId?: string; label?: string }>): string => {
  const clauses = [
    locator.role ? `[role="${escapeSelectorValue(locator.role)}"]` : "",
    locator.testId ? `[data-testid="${escapeSelectorValue(locator.testId)}"]` : "",
    locator.label ? `[aria-label="${escapeSelectorValue(locator.label)}"]` : "",
    locator.name ? `[name="${escapeSelectorValue(locator.name)}"]` : "",
  ].filter((value) => value.length > 0);
  if (clauses.length === 0) throw new Error("BROWSER_TARGET_INVALID");
  return clauses.join("");
};

const escapeSelectorValue = (value: string): string => {
  if (value.length === 0 || value.length > 512 || /[\u0000-\u001f"\\\\]/u.test(value)) throw new Error("BROWSER_TARGET_INVALID");
  return value;
};
const attribute = (node: DevToolsRecord, name: string): string | undefined => {
  const attributes = Array.isArray(node.attributes) ? node.attributes : [];
  for (let index = 0; index + 1 < attributes.length; index += 2) if (attributes[index] === name && typeof attributes[index + 1] === "string") return attributes[index + 1] as string;
  return undefined;
};
const truncate = (value: string, maxChars: number): string => value.slice(0, maxChars);
const record = (value: unknown): DevToolsRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("BROWSER_TARGET_INVALID");
  return value as DevToolsRecord;
};
const numberValue = (value: unknown, errorCode: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(errorCode);
  return value;
};
const stringValue = (value: unknown, errorCode: string): string => {
  if (typeof value !== "string") throw new Error(errorCode);
  return value;
};
