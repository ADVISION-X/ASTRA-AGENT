import type { BrowserDomIntent } from "../exact-target/browser-dom-intent.js";
import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";

type DevToolsRecord = Record<string, unknown>;

const DOM_CANDIDATE_MISSING = "BROWSER_DOM_CANDIDATE_MISSING";
const DOM_CANDIDATE_AMBIGUOUS = "BROWSER_DOM_CANDIDATE_AMBIGUOUS";
const DOM_NODE_STALE = "BROWSER_DOM_NODE_STALE";
const DOM_READ_INVALID = "BROWSER_DOM_READ_INVALID";

const machineCode = (value: string): boolean => /^[A-Z][A-Z0-9_]+$/u.test(value);
const staleNodeError = (error: unknown): boolean => error instanceof Error
  && /(?:could not find node|no node with given id|node.*(?:detached|does not exist|not found)|backend node.*not found)/iu.test(error.message);
const invisibleBoxError = (error: unknown): boolean => error instanceof Error
  && /could not compute box model/iu.test(error.message);

const domReadError = (error: unknown): Error => {
  if (error instanceof Error && machineCode(error.message)) return error;
  return new Error(staleNodeError(error) ? DOM_NODE_STALE : DOM_READ_INVALID, { cause: error });
};

const read = async <T>(operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    throw domReadError(error);
  }
};

export const requireExactCandidateCount = (
  nodes: readonly number[],
  expectedMatches: number,
): void => {
  if (nodes.length < expectedMatches) throw new Error(DOM_CANDIDATE_MISSING);
  if (nodes.length > expectedMatches) throw new Error(DOM_CANDIDATE_AMBIGUOUS);
};

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
  const root = record(await read(() => runtime.send(tabId, "DOM.getDocument", { depth: 1, pierce: true })));
  const rootNode = record(root.root);
  let queryRootId = numberValue(rootNode.nodeId, DOM_READ_INVALID);
  if (scope) {
    const scopeResult = record(await read(() => runtime.send(tabId, "DOM.querySelectorAll", { nodeId: queryRootId, selector: scope.selector })));
    if (!Array.isArray(scopeResult.nodeIds)) throw new Error(DOM_READ_INVALID);
    const scopeIds = scopeResult.nodeIds.map((value) => numberValue(value, DOM_READ_INVALID));
    const visibleScopes = await visibleNodes(runtime, tabId, scopeIds);
    requireExactCandidateCount(visibleScopes, 1);
    queryRootId = visibleScopes[0]!;
  }
  const result = record(await read(() => runtime.send(tabId, "DOM.querySelectorAll", { nodeId: queryRootId, selector })));
  if (!Array.isArray(result.nodeIds)) throw new Error(DOM_READ_INVALID);
  return result.nodeIds.map((value) => numberValue(value, DOM_READ_INVALID));
};

const visibleNodes = async (
  runtime: ExtensionDebuggerRuntime,
  tabId: number,
  nodeIds: readonly number[],
  limit = nodeIds.length,
): Promise<readonly number[]> => {
  const visible: number[] = [];
  for (const nodeId of nodeIds) {
    if (await optionalBoxCenter(runtime, tabId, nodeId)) visible.push(nodeId);
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
  requireExactCandidateCount(nodes, expectedMatches);
  const nodeId = nodes[0];
  if (nodeId === undefined) throw new Error(DOM_CANDIDATE_MISSING);
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
  if (intent.expectedMatches !== undefined) requireExactCandidateCount(nodes, intent.expectedMatches);
  else if (nodes.length > maximum) throw new Error(DOM_CANDIDATE_AMBIGUOUS);
  const nodeId = nodes[intent.matchIndex ?? 0];
  if (nodeId === undefined) throw new Error(DOM_CANDIDATE_MISSING);
  return nodeId;
};

export const documentState = async (runtime: ExtensionDebuggerRuntime, tabId: number): Promise<Readonly<{ url: string; title: string }>> => {
  const history = record(await read(() => runtime.send(tabId, "Page.getNavigationHistory")));
  if (!Array.isArray(history.entries)) throw new Error(DOM_READ_INVALID);
  const entry = record(history.entries[numberValue(history.currentIndex, DOM_READ_INVALID)]);
  const url = stringValue(entry.url, DOM_READ_INVALID);
  const title = stringValue(entry.title, DOM_READ_INVALID);
  if (!url.startsWith("https://")) throw new Error("BROWSER_ORIGIN_REJECTED");
  return { url, title };
};

export const describeNode = async (runtime: ExtensionDebuggerRuntime, tabId: number, nodeId: number): Promise<DevToolsRecord> =>
  record(record(await read(() => runtime.send(tabId, "DOM.describeNode", { nodeId, depth: 0 }))).node);

export const nodeText = async (runtime: ExtensionDebuggerRuntime, tabId: number, nodeId: number): Promise<string> => {
  const node = await describeNodeTree(runtime, tabId, nodeId);
  return attribute(node, "contenteditable") === "true"
    ? collectContentEditableText(node)
    : collectNodeText(node);
};

const describeNodeTree = async (
  runtime: ExtensionDebuggerRuntime,
  tabId: number,
  nodeId: number,
): Promise<DevToolsRecord> => record(record(await read(() => runtime.send(
  tabId, "DOM.describeNode", { nodeId, depth: -1, pierce: true },
))).node);

const codeBlocks = (node: DevToolsRecord, insidePre = false): readonly DevToolsRecord[] => {
  const name = typeof node.nodeName === "string" ? node.nodeName.toUpperCase() : "";
  const nestedPre = insidePre || name === "PRE";
  const own = name === "CODE" && nestedPre ? [node] : [];
  const children = Array.isArray(node.children)
    ? node.children.flatMap((child) => codeBlocks(record(child), nestedPre)) : [];
  return [...own, ...children];
};

const semanticChildren = (node: DevToolsRecord): string => Array.isArray(node.children)
  ? node.children.map((child) => semanticNode(record(child), node)).join("") : "";

const inlineCode = (value: string): string => {
  const longestRun = Math.max(0, ...[...value.matchAll(/`+/gu)].map((match) => match[0].length));
  const fence = "`".repeat(longestRun + 1);
  return `${fence}${value}${fence}`;
};

const BLOCK_NODE_NAMES = new Set([
  "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DD", "DIV", "DL", "DT", "FIGCAPTION",
  "FIGURE", "FOOTER", "FORM", "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HR",
  "MAIN", "NAV", "OL", "P", "PRE", "SECTION", "TABLE", "TBODY", "TD", "TFOOT", "TH",
  "THEAD", "TR", "UL",
]);

const isHiddenSemanticNode = (node: DevToolsRecord, name: string): boolean =>
  ["#COMMENT", "SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "SVG", "PATH"].includes(name)
  || attribute(node, "hidden") !== undefined
  || attribute(node, "aria-hidden") === "true";

const semanticInline = (name: string, body: string): string | null => {
  if (name === "STRONG" || name === "B") return `**${body}**`;
  if (name === "EM" || name === "I") return `*${body}*`;
  if (name === "CODE") return inlineCode(body);
  return null;
};

const semanticNode = (node: DevToolsRecord, parent?: DevToolsRecord): string => {
  const name = typeof node.nodeName === "string" ? node.nodeName.toUpperCase() : "";
  if (name === "#TEXT") return typeof node.nodeValue === "string" ? node.nodeValue : "";
  if (isHiddenSemanticNode(node, name)) return "";
  if (name === "BR") return "\n";
  const body = semanticChildren(node);
  const inline = semanticInline(name, body);
  if (inline !== null) return inline;
  if (name === "LI") {
    const parentName = typeof parent?.nodeName === "string" ? parent.nodeName.toUpperCase() : "";
    return `${parentName === "OL" ? "1. " : "- "}${body}\n`;
  }
  return BLOCK_NODE_NAMES.has(name) ? `${body}\n` : body;
};

export const nodeSemanticText = async (
  runtime: ExtensionDebuggerRuntime,
  tabId: number,
  nodeId: number,
): Promise<string> => semanticTextFromTree(await describeNodeTree(runtime, tabId, nodeId));

const semanticTextFromTree = (node: DevToolsRecord): string => {
  const candidates = codeBlocks(node);
  return candidates.length === 1 ? collectNodeText(candidates[0]!) : semanticChildren(node);
};

export const nodeOuterHtml = async (
  runtime: ExtensionDebuggerRuntime,
  tabId: number,
  nodeId: number,
): Promise<string> => stringValue(
  record(await read(() => runtime.send(tabId, "DOM.getOuterHTML", { nodeId }))).outerHTML,
  DOM_READ_INVALID,
);

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
  tagName: (node) => stringValue(node.nodeName, DOM_READ_INVALID),
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
  let stableOuterHtml: string | undefined;
  let semanticText: string | undefined;
  if (fields.includes("outerHtml") && fields.includes("semanticText")) {
    const before = await nodeOuterHtml(runtime, tabId, nodeId);
    semanticText = await nodeSemanticText(runtime, tabId, nodeId);
    const after = await nodeOuterHtml(runtime, tabId, nodeId);
    if (before !== after) throw new Error(DOM_NODE_STALE);
    stableOuterHtml = before;
  }
  for (const field of fields) {
    if (field === "text") {
      result.text = await nodeText(runtime, tabId, nodeId);
      continue;
    }
    if (field === "outerHtml") {
      result.outerHtml = stableOuterHtml ?? await nodeOuterHtml(runtime, tabId, nodeId);
      continue;
    }
    if (field === "semanticText") {
      result.semanticText = semanticText ?? await nodeSemanticText(runtime, tabId, nodeId);
      continue;
    }
    const reader = staticFieldReaders[field];
    if (reader) {
      result[field] = reader(node);
      continue;
    }
    if (field !== "visible" && field !== "bounds") continue;
    const box = await optionalBoxCenter(runtime, tabId, nodeId);
    if (field === "visible") result.visible = box !== null;
    if (field === "bounds") result.bounds = box;
  }
  return result;
};

export const boxCenter = async (runtime: ExtensionDebuggerRuntime, tabId: number, nodeId: number): Promise<Readonly<{ x: number; y: number }>> => {
  const box = await optionalBoxCenter(runtime, tabId, nodeId);
  if (!box) throw new Error(DOM_CANDIDATE_MISSING);
  return box;
};

const optionalBoxCenter = async (runtime: ExtensionDebuggerRuntime, tabId: number, nodeId: number): Promise<Readonly<{ x: number; y: number }> | null> => {
  let raw: unknown;
  try {
    raw = await runtime.send(tabId, "DOM.getBoxModel", { nodeId });
  } catch (error) {
    if (invisibleBoxError(error)) return null;
    throw domReadError(error);
  }
  const model = record(record(raw).model);
  const content = Array.isArray(model.content) ? model.content : [];
  if (content.length < 8) throw new Error(DOM_READ_INVALID);
  const x = (numberValue(content[0], DOM_READ_INVALID) + numberValue(content[2], DOM_READ_INVALID)) / 2;
  const y = (numberValue(content[1], DOM_READ_INVALID) + numberValue(content[5], DOM_READ_INVALID)) / 2;
  return { x, y };
};

export const selectorForLocator = (locator: Readonly<{ role?: string; name?: string; testId?: string; label?: string }>): string => {
  const clauses = [
    locator.role ? `[role="${escapeSelectorValue(locator.role)}"]` : "",
    locator.testId ? `[data-testid="${escapeSelectorValue(locator.testId)}"]` : "",
    locator.label ? `[aria-label="${escapeSelectorValue(locator.label)}"]` : "",
    locator.name ? `[name="${escapeSelectorValue(locator.name)}"]` : "",
  ].filter((value) => value.length > 0);
  if (clauses.length === 0) throw new Error("BROWSER_CAPABILITY_REJECTED");
  return clauses.join("");
};

const escapeSelectorValue = (value: string): string => {
  if (value.length === 0 || value.length > 512 || /[\u0000-\u001f"\\\\]/u.test(value)) throw new Error("BROWSER_CAPABILITY_REJECTED");
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
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(DOM_READ_INVALID);
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
