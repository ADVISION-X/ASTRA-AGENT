import type { BrowserDomIntent } from "../exact-target/browser-dom-intent.js";
import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";

type DevToolsRecord = Record<string, unknown>;

export const queryAll = async (
  runtime: ExtensionDebuggerRuntime,
  tabId: number,
  selector: string,
  limit: number,
  scope?: Readonly<{ selector: string }>,
): Promise<readonly number[]> => visibleNodes(runtime, tabId, await queryNodeIds(runtime, tabId, selector, scope), limit);

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

export const queryVisibleTextMatches = async (
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

export const nodeForSelector = async (runtime: ExtensionDebuggerRuntime, tabId: number, selector: string, expectedMatches: number, scope?: Readonly<{ selector: string }>): Promise<number> => {
  const nodes = await queryAll(runtime, tabId, selector, expectedMatches + 1, scope);
  if (nodes.length !== expectedMatches) throw new Error("BROWSER_TARGET_INVALID");
  const nodeId = nodes[0];
  if (nodeId === undefined) throw new Error("BROWSER_TARGET_INVALID");
  return nodeId;
};

export const nodeForRead = async (
  runtime: ExtensionDebuggerRuntime,
  tabId: number,
  intent: Extract<BrowserDomIntent, { kind: "readText" | "readAttribute" }>,
): Promise<number> => {
  const maximum = intent.expectedMatches ?? intent.maxMatches ?? 1;
  const nodes = intent.kind === "readAttribute" && intent.textContains !== undefined
    ? await queryVisibleTextMatches(runtime, tabId, intent.selector, intent.textContains, false, maximum + 1, intent.scope)
    : await queryAll(runtime, tabId, intent.selector, maximum + 1, intent.scope);
  if (intent.expectedMatches !== undefined ? nodes.length !== intent.expectedMatches : nodes.length > maximum) throw new Error("BROWSER_TARGET_INVALID");
  const nodeId = nodes[intent.matchIndex ?? 0];
  if (nodeId === undefined) throw new Error("BROWSER_TARGET_INVALID");
  return nodeId;
};

export const documentState = async (runtime: ExtensionDebuggerRuntime, tabId: number): Promise<Readonly<{ url: string; title: string }>> => {
  const history = record(await runtime.send(tabId, "Page.getNavigationHistory"));
  const entries = Array.isArray(history.entries) ? history.entries : [];
  const entry = record(entries[numberValue(history.currentIndex, "BROWSER_TARGET_INVALID")]);
  const url = stringValue(entry.url, "BROWSER_TARGET_INVALID");
  const title = stringValue(entry.title, "BROWSER_TARGET_INVALID");
  if (!url.startsWith("https://")) throw new Error("BROWSER_ORIGIN_REJECTED");
  return { url, title };
};

export const describeNode = async (runtime: ExtensionDebuggerRuntime, tabId: number, nodeId: number): Promise<DevToolsRecord> =>
  record(record(await runtime.send(tabId, "DOM.describeNode", { nodeId, depth: 0 })).node);

export const accessibilityValue = async (runtime: ExtensionDebuggerRuntime, tabId: number, nodeId: number): Promise<string> => {
  const node = await describeNode(runtime, tabId, nodeId);
  const backendNodeId = numberValue(node.backendNodeId, "BROWSER_TARGET_INVALID");
  const tree = record(await runtime.send(tabId, "Accessibility.getPartialAXTree", { backendNodeId, fetchRelatives: false }));
  const target = (Array.isArray(tree.nodes) ? tree.nodes.map(record) : [])
    .find((candidate) => candidate.backendDOMNodeId === backendNodeId);
  const value = target && typeof target.value === "object" && target.value !== null ? record(target.value) : null;
  return value && typeof value.value === "string" ? value.value : "";
};

export const nodeText = async (runtime: ExtensionDebuggerRuntime, tabId: number, nodeId: number): Promise<string> => {
  const described = record(await runtime.send(tabId, "DOM.describeNode", { nodeId, depth: -1, pierce: true }));
  const node = record(described.node);
  return attribute(node, "contenteditable") === "true"
    ? collectContentEditableText(node)
    : collectNodeText(node);
};

const collectContentEditableText = (node: DevToolsRecord): string => {
  const children = Array.isArray(node.children) ? node.children.map(record) : [];
  if (children.length === 0) return collectNodeText(node);
  return children.map((child) => collectEditableBlockText(child)).join("\n");
};

const collectEditableBlockText = (node: DevToolsRecord): string => {
  if (node.nodeName === "BR") return "";
  const own = typeof node.nodeValue === "string" ? node.nodeValue : "";
  const children = Array.isArray(node.children)
    ? node.children.map((child) => {
      const value = record(child);
      return value.nodeName === "BR" ? "\n" : collectEditableBlockText(value);
    }).join("")
    : "";
  return `${own}${children}`.replace(/\n$/u, "");
};

const collectNodeText = (node: DevToolsRecord): string => {
  const own = typeof node.nodeValue === "string" ? node.nodeValue : "";
  const children = Array.isArray(node.children) ? node.children.map((child) => collectNodeText(record(child))).join("") : "";
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

export const inspectNode = async (runtime: ExtensionDebuggerRuntime, tabId: number, nodeId: number, fields: readonly string[]): Promise<Readonly<Record<string, unknown>>> => {
  const node = await describeNode(runtime, tabId, nodeId);
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (field === "text") {
      result.text = await nodeText(runtime, tabId, nodeId);
      continue;
    }
    const reader = staticFieldReaders[field];
    if (reader) {
      result[field] = reader(node);
      continue;
    }
    if (field !== "visible" && field !== "bounds") continue;
    const box = await boxCenter(runtime, tabId, nodeId).catch(() => null);
    if (field === "visible") result.visible = box !== null;
    if (field === "bounds") result.bounds = box;
  }
  return result;
};

export const boxCenter = async (runtime: ExtensionDebuggerRuntime, tabId: number, nodeId: number): Promise<Readonly<{ x: number; y: number }>> => {
  const model = record(record(await runtime.send(tabId, "DOM.getBoxModel", { nodeId })).model);
  const content = Array.isArray(model.content) ? model.content : [];
  if (content.length < 8) throw new Error("BROWSER_TARGET_INVALID");
  const x = (numberValue(content[0], "BROWSER_TARGET_INVALID") + numberValue(content[2], "BROWSER_TARGET_INVALID")) / 2;
  const y = (numberValue(content[1], "BROWSER_TARGET_INVALID") + numberValue(content[5], "BROWSER_TARGET_INVALID")) / 2;
  return { x, y };
};

export const selectorForLocator = (locator: Readonly<{ role?: string; name?: string; testId?: string; label?: string }>): string => {
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

export const attribute = (node: DevToolsRecord, name: string): string | undefined => {
  const attributes = Array.isArray(node.attributes) ? node.attributes : [];
  for (let index = 0; index + 1 < attributes.length; index += 2) {
    if (attributes[index] === name && typeof attributes[index + 1] === "string") return attributes[index + 1] as string;
  }
  return undefined;
};

export const truncate = (value: string, maxChars: number): string => value.slice(0, maxChars);
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
