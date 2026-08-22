import type { BrowserDomIntent } from "../exact-target/browser-dom-intent.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";
import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";

type DevToolsRecord = Record<string, unknown>;
type FindIntent = Extract<BrowserDomIntent, { kind: "find" }>;
type ClickIntent = Extract<BrowserDomIntent, { kind: "click" }>;
type ValueIntent = Exclude<BrowserDomIntent, { kind: "document" | "find" | "click" }>;

/** Executes the finite declarative DOM intent set without a script/eval surface. */
const executeFindIntent = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: FindIntent,
): Promise<unknown> => {
  const selector = intent.selector ?? selectorForLocator(intent.locator!);
  const candidates = await queryAll(debuggerRuntime, target.tabId, selector, intent.maxMatches + 1);
  const nodes = intent.textContains === undefined
    ? candidates
    : await nodesContainingText(debuggerRuntime, target.tabId, candidates, intent.textContains);
  if (nodes.length > intent.maxMatches) throw new Error("BROWSER_TARGET_INVALID");
  return { count: nodes.length };
};

const executeClickIntent = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: ClickIntent,
): Promise<unknown> => {
  const expectedMatches = intent.expectedMatches ?? 1;
  const nodes = await queryAll(debuggerRuntime, target.tabId, intent.selector, expectedMatches + 1);
  const matchingNodes = intent.expectedText === undefined
    ? nodes
    : await nodesContainingText(debuggerRuntime, target.tabId, nodes, intent.expectedText);
  if (matchingNodes.length !== expectedMatches) throw new Error("BROWSER_TARGET_INVALID");
  const nodeId = matchingNodes[0];
  if (nodeId === undefined) throw new Error("BROWSER_TARGET_INVALID");
  const box = await boxCenter(debuggerRuntime, target.tabId, nodeId);
  await debuggerRuntime.send(target.tabId, "Input.dispatchMouseEvent", { type: "mousePressed", x: box.x, y: box.y, button: "left", clickCount: 1 });
  await debuggerRuntime.send(target.tabId, "Input.dispatchMouseEvent", { type: "mouseReleased", x: box.x, y: box.y, button: "left", clickCount: 1 });
  return { clicked: true };
};

const executeValueIntent = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: ValueIntent,
): Promise<unknown> => {
  const nodeId = intent.kind === "readText" || intent.kind === "readAttribute"
    ? await nodeForRead(debuggerRuntime, target.tabId, intent)
    : await nodeForSelector(debuggerRuntime, target.tabId, intent.selector, intent.kind === "fill" ? intent.expectedMatches ?? 1 : 1);
  if (intent.kind === "inspect") return inspectNode(debuggerRuntime, target.tabId, nodeId, intent.fields);
  if (intent.kind === "readText") return truncate(await nodeText(debuggerRuntime, target.tabId, nodeId), intent.maxChars);
  if (intent.kind === "readAttribute") return truncate(attribute(await describeNode(debuggerRuntime, target.tabId, nodeId), intent.name) ?? "", intent.maxChars);
  await debuggerRuntime.send(target.tabId, "DOM.focus", { nodeId });
  if (intent.clearBeforeType) {
    await debuggerRuntime.send(target.tabId, "Input.dispatchKeyEvent", { type: "rawKeyDown", key: "a", code: "KeyA", modifiers: 2 });
    await debuggerRuntime.send(target.tabId, "Input.dispatchKeyEvent", { type: "keyDown", key: "Backspace", code: "Backspace" });
  }
  await debuggerRuntime.send(target.tabId, "Input.insertText", { text: intent.approvedText });
  return { filled: true };
};

export const executeRegisteredDomIntent = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: BrowserDomIntent,
): Promise<unknown> => {
  if (intent.kind === "document") return documentState(debuggerRuntime, target.tabId);
  if (intent.kind === "find") return executeFindIntent(debuggerRuntime, target, intent);
  if (intent.kind === "click") return executeClickIntent(debuggerRuntime, target, intent);
  return executeValueIntent(debuggerRuntime, target, intent);
};

const nodeForSelector = async (runtime: ExtensionDebuggerRuntime, tabId: number, selector: string, expectedMatches: number): Promise<number> => {
  const nodes = await queryAll(runtime, tabId, selector, expectedMatches + 1);
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
  const candidateNodes = await queryAll(runtime, tabId, intent.selector, maximum + 1);
  const nodes = intent.kind === "readAttribute" && intent.textContains !== undefined
    ? await nodesContainingText(runtime, tabId, candidateNodes, intent.textContains)
    : candidateNodes;
  if (intent.expectedMatches !== undefined ? nodes.length !== intent.expectedMatches : nodes.length > maximum) {
    throw new Error("BROWSER_TARGET_INVALID");
  }
  const index = intent.matchIndex ?? 0;
  const nodeId = nodes[index];
  if (nodeId === undefined) throw new Error("BROWSER_TARGET_INVALID");
  return nodeId;
};

const queryAll = async (runtime: ExtensionDebuggerRuntime, tabId: number, selector: string, limit: number): Promise<readonly number[]> => {
  const root = record(await runtime.send(tabId, "DOM.getDocument", { depth: 1, pierce: true }));
  const rootNode = record(root.root);
  const result = record(await runtime.send(tabId, "DOM.querySelectorAll", { nodeId: numberValue(rootNode.nodeId, "BROWSER_TARGET_INVALID"), selector }));
  const values = Array.isArray(result.nodeIds) ? result.nodeIds : [];
  return values.slice(0, limit).map((value) => numberValue(value, "BROWSER_TARGET_INVALID"));
};

const nodesContainingText = async (
  runtime: ExtensionDebuggerRuntime,
  tabId: number,
  nodeIds: readonly number[],
  expectedText: string,
): Promise<readonly number[]> => {
  const matches: number[] = [];
  for (const nodeId of nodeIds) if ((await nodeText(runtime, tabId, nodeId)).includes(expectedText)) matches.push(nodeId);
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
  tagName: (node) => stringValue(node.nodeName, "BROWSER_TARGET_INVALID"),
  type: (node) => attribute(node, "type") ?? "",
  role: (node) => attribute(node, "role") ?? "",
  ariaLabel: (node) => attribute(node, "aria-label") ?? "",
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
