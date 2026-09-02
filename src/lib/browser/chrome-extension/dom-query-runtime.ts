import type { BrowserDomIntent } from "../exact-target/browser-dom-intent.js";
import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";

type DevToolsRecord = Record<string, unknown>;
type BrowserBounds = Readonly<{ x: number; y: number; width: number; height: number }>;
type BrowserMechanicalFacts = Readonly<{
  connected: boolean; layout: boolean; visible: boolean;
  computedDisplay: string; computedVisibility: string; computedOpacity: string;
  hidden: boolean; ariaHidden: boolean; inert: boolean; disabled: boolean; ariaDisabled: boolean;
  role: string; name: string; testId: string; label: string; value: string;
  checked: boolean | null;
  type: string;
  bounds: BrowserBounds | null;
  viewport: boolean; hitTest: boolean;
  nativeCauseCode: "NO_LAYOUT_BOX" | null;
  nativeStage: "runtime-call-function-on";
}>;
export type BrowserDomCandidateSet = Readonly<{
  rawCount: number; eligibleCount: number;
  eligibleNodeIds: readonly number[];
  nativeCauseCode: "NO_LAYOUT_BOX" | null;
  nativeCauseCount: number;
  nativeStage: "runtime-call-function-on";
}>;

const DOM_CANDIDATE_MISSING = "BROWSER_DOM_CANDIDATE_MISSING";
const DOM_CANDIDATE_AMBIGUOUS = "BROWSER_DOM_CANDIDATE_AMBIGUOUS";
const DOM_NODE_STALE = "BROWSER_DOM_NODE_STALE";
const DOM_READ_INVALID = "BROWSER_DOM_READ_INVALID";
export const BROWSER_MECHANICAL_FACTS_READER_SOURCE = `const browserMechanicalFacts = (element) => {
  if (!(element instanceof Element)) return null;
  const style = globalThis.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  const layout = element.getClientRects().length > 0 && rect.width > 0 && rect.height > 0;
  const connected = element.isConnected === true; const hidden = element.closest("[hidden]") !== null;
  const ariaHidden = element.closest("[aria-hidden='true']") !== null; const inert = element.closest("[inert]") !== null;
  const disabled = element.hasAttribute("disabled") || element.matches(":disabled"); const ariaDisabled = element.closest("[aria-disabled='true']") !== null;
  const opacityNumber = Number.parseFloat(style.opacity);
  const visible = connected && layout && style.display !== "none"
    && style.visibility !== "hidden" && style.visibility !== "collapse"
    && Number.isFinite(opacityNumber) && opacityNumber > 0 && !hidden && !ariaHidden && !inert;
  const viewport = layout && rect.bottom > 0 && rect.right > 0
    && rect.top < globalThis.innerHeight && rect.left < globalThis.innerWidth;
  const centerX = rect.left + rect.width / 2; const centerY = rect.top + rect.height / 2;
  const top = visible && viewport && style.pointerEvents !== "none"
    ? document.elementFromPoint(centerX, centerY) : null;
  const labels = "labels" in element && element.labels
    ? Array.from(element.labels).map((label) => label.textContent || "").join(" ").trim() : "";
  return {
    connected, layout, visible, computedDisplay: style.display, computedVisibility: style.visibility,
    computedOpacity: style.opacity, hidden, ariaHidden, inert, disabled, ariaDisabled,
    role: element.getAttribute("role") || "", name: element.getAttribute("name") || "", testId: element.getAttribute("data-testid") || "",
    label: element.getAttribute("aria-label") || labels,
    value: "value" in element && typeof element.value === "string" ? element.value : "",
    checked: "checked" in element && typeof element.checked === "boolean" ? element.checked : null,
    type: element.getAttribute("type") || "",
    bounds: layout ? { x: rect.left, y: rect.top, width: rect.width, height: rect.height } : null,
    viewport, hitTest: top !== null && (top === element || element.contains(top)), nativeCauseCode: layout ? null : "NO_LAYOUT_BOX",
    nativeStage: "runtime-call-function-on"
  };
};`;
const MECHANICAL_FACTS_FUNCTION = `function () {
  ${BROWSER_MECHANICAL_FACTS_READER_SOURCE}
  return browserMechanicalFacts(this);
}`;

const machineCode = (value: string): boolean => /^[A-Z][A-Z0-9_]+$/u.test(value);
const staleNodeError = (error: unknown): boolean => error instanceof Error
  && /(?:could not find node|no node with given id|node.*(?:detached|does not exist|not found)|backend node.*not found)/iu.test(error.message);
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
): Promise<readonly number[]> => (await queryCandidateSet(runtime, tabId, selector, limit, scope)).eligibleNodeIds;

export const queryCandidateSet = async (
  runtime: ExtensionDebuggerRuntime,
  tabId: number,
  selector: string,
  limit: number,
  scope?: Readonly<{ selector: string }>,
  text?: Readonly<{ value: string; exact: boolean }>,
): Promise<BrowserDomCandidateSet> => {
  const rawNodeIds = await queryNodeIds(runtime, tabId, selector, scope);
  const eligibleNodeIds: number[] = [];
  let eligibleCount = 0;
  let noLayoutCount = 0;
  for (const nodeId of rawNodeIds) {
    const facts = await readMechanicalFacts(runtime, tabId, nodeId);
    if (facts.nativeCauseCode === "NO_LAYOUT_BOX") noLayoutCount += 1;
    if (!facts.visible) continue;
    if (text) {
      const actual = await nodeText(runtime, tabId, nodeId);
      const matched = text.exact ? actual.trim() === text.value.trim() : actual.includes(text.value);
      if (!matched) continue;
    }
    eligibleCount += 1;
    if (eligibleNodeIds.length < limit) eligibleNodeIds.push(nodeId);
  }
  return Object.freeze({
    rawCount: rawNodeIds.length, eligibleCount, eligibleNodeIds,
    nativeCauseCode: noLayoutCount > 0 ? "NO_LAYOUT_BOX" : null,
    nativeCauseCount: noLayoutCount,
    nativeStage: "runtime-call-function-on",
  });
};

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
    const eligibleScopes: number[] = [];
    for (const scopeId of scopeIds) {
      if ((await readMechanicalFacts(runtime, tabId, scopeId)).visible) eligibleScopes.push(scopeId);
    }
    requireExactCandidateCount(eligibleScopes, 1);
    queryRootId = eligibleScopes[0]!;
  }
  const result = record(await read(() => runtime.send(tabId, "DOM.querySelectorAll", { nodeId: queryRootId, selector })));
  if (!Array.isArray(result.nodeIds)) throw new Error(DOM_READ_INVALID);
  return result.nodeIds.map((value) => numberValue(value, DOM_READ_INVALID));
};

const booleanField = (value: unknown): boolean => {
  if (typeof value !== "boolean") throw new Error(DOM_READ_INVALID);
  return value;
};

const boundsField = (value: unknown): BrowserBounds | null => {
  if (value === null) return null;
  const bounds = record(value);
  return Object.freeze({
    x: numberValue(bounds.x, DOM_READ_INVALID),
    y: numberValue(bounds.y, DOM_READ_INVALID),
    width: numberValue(bounds.width, DOM_READ_INVALID),
    height: numberValue(bounds.height, DOM_READ_INVALID),
  });
};

const decodeMechanicalFacts = (value: unknown): BrowserMechanicalFacts => {
  const facts = record(value);
  const checked = facts.checked === null ? null : booleanField(facts.checked);
  const nativeCauseCode = facts.nativeCauseCode === null ? null
    : facts.nativeCauseCode === "NO_LAYOUT_BOX" ? "NO_LAYOUT_BOX" : (() => { throw new Error(DOM_READ_INVALID); })();
  if (facts.nativeStage !== "runtime-call-function-on") throw new Error(DOM_READ_INVALID);
  return Object.freeze({
    connected: booleanField(facts.connected), layout: booleanField(facts.layout),
    visible: booleanField(facts.visible), computedDisplay: stringValue(facts.computedDisplay, DOM_READ_INVALID),
    computedVisibility: stringValue(facts.computedVisibility, DOM_READ_INVALID),
    computedOpacity: stringValue(facts.computedOpacity, DOM_READ_INVALID),
    hidden: booleanField(facts.hidden), ariaHidden: booleanField(facts.ariaHidden),
    inert: booleanField(facts.inert), disabled: booleanField(facts.disabled),
    ariaDisabled: booleanField(facts.ariaDisabled), role: stringValue(facts.role, DOM_READ_INVALID),
    name: stringValue(facts.name, DOM_READ_INVALID), testId: stringValue(facts.testId, DOM_READ_INVALID),
    label: stringValue(facts.label, DOM_READ_INVALID), value: stringValue(facts.value, DOM_READ_INVALID),
    checked, type: stringValue(facts.type, DOM_READ_INVALID), bounds: boundsField(facts.bounds),
    viewport: booleanField(facts.viewport), hitTest: booleanField(facts.hitTest),
    nativeCauseCode, nativeStage: facts.nativeStage,
  });
};

const readMechanicalFacts = async (
  runtime: ExtensionDebuggerRuntime,
  tabId: number,
  nodeId: number,
): Promise<BrowserMechanicalFacts> => {
  const resolved = record(await read(() => runtime.send(tabId, "DOM.resolveNode", { nodeId })));
  const objectId = stringValue(record(resolved.object).objectId, DOM_READ_INVALID);
  let primaryFailure: unknown = null;
  try {
    const call = record(await read(() => runtime.send(tabId, "Runtime.callFunctionOn", {
      objectId,
      functionDeclaration: MECHANICAL_FACTS_FUNCTION,
      returnByValue: true,
      awaitPromise: false,
      silent: true,
    })));
    if (call.exceptionDetails !== undefined) throw new Error(DOM_READ_INVALID);
    return decodeMechanicalFacts(record(call.result).value);
  } catch (error) {
    primaryFailure = error;
    throw error;
  } finally {
    try {
      await read(() => runtime.send(tabId, "Runtime.releaseObject", { objectId }));
    } catch (error) {
      if (primaryFailure === null) throw error;
    }
  }
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
  const candidates = await queryCandidateSet(
    runtime, tabId, selector, limit, scope, { value: expectedText, exact },
  );
  return candidates.eligibleNodeIds;
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
  dataTurn: (node) => attribute(node, "data-turn") ?? "",
  tagName: (node) => stringValue(node.nodeName, DOM_READ_INVALID),
  ariaLabel: (node) => attribute(node, "aria-label") ?? "",
  ariaExpanded: (node) => attribute(node, "aria-expanded") ?? "",
  ariaChecked: (node) => attribute(node, "aria-checked") ?? "",
  accept: (node) => attribute(node, "accept") ?? "",
  multiple: (node) => attribute(node, "multiple") !== undefined,
};

const mechanicalFieldNames = new Set([
  "testId", "type", "role", "name", "label", "value", "checked", "connected", "layout",
  "visible", "computedDisplay", "computedVisibility", "computedOpacity", "hidden", "ariaHidden",
  "inert", "disabled", "ariaDisabled", "bounds", "viewport", "hitTest",
]);

export const inspectNode = async (runtime: ExtensionDebuggerRuntime, tabId: number, nodeId: number, fields: readonly string[]): Promise<Readonly<Record<string, unknown>>> => {
  const node = await describeNode(runtime, tabId, nodeId);
  const result: Record<string, unknown> = {};
  const mechanicalFacts = fields.some((field) => mechanicalFieldNames.has(field))
    ? await readMechanicalFacts(runtime, tabId, nodeId) : null;
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
    if (mechanicalFacts && mechanicalFieldNames.has(field)) {
      result[field] = mechanicalFacts[field as keyof BrowserMechanicalFacts];
      continue;
    }
    const reader = staticFieldReaders[field];
    if (reader) {
      result[field] = reader(node);
      continue;
    }
  }
  if (mechanicalFacts) {
    result.nativeCauseCode = mechanicalFacts.nativeCauseCode;
    result.nativeStage = mechanicalFacts.nativeStage;
  }
  return result;
};

export const boxCenter = async (runtime: ExtensionDebuggerRuntime, tabId: number, nodeId: number): Promise<Readonly<{ x: number; y: number }>> => {
  const box = await optionalBoxCenter(runtime, tabId, nodeId);
  if (!box) throw new Error(DOM_CANDIDATE_MISSING);
  return box;
};

const optionalBoxCenter = async (runtime: ExtensionDebuggerRuntime, tabId: number, nodeId: number): Promise<Readonly<{ x: number; y: number }> | null> => {
  const facts = await readMechanicalFacts(runtime, tabId, nodeId);
  if (!facts.visible || !facts.viewport || !facts.hitTest || !facts.bounds) return null;
  return {
    x: facts.bounds.x + facts.bounds.width / 2,
    y: facts.bounds.y + facts.bounds.height / 2,
  };
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
