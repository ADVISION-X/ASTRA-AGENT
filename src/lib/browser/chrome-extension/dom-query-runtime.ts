import type { BrowserDomExactText } from "../exact-target/browser-dom-intent.js";
import type {
  BrowserDomIneligibleCandidate,
  BrowserDomIneligibleReason,
  BrowserDomIntent,
  BrowserDomReadEligibility,
} from "../exact-target/browser-dom-intent.js";
import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import { readExactEditableText } from "./dom-exact-editable-text.js";
import { keyboardActionEligible, readMechanicalFacts, semanticEligible,
  type BrowserMechanicalFacts } from "./dom-mechanical-facts.js";

type DevToolsRecord = Record<string, unknown>;
export type BrowserDomCandidateSet = Readonly<{
  rawCount: number; eligibleCount: number;
  eligibleNodeIds: readonly number[];
  rejections: readonly BrowserDomIneligibleCandidate[];
  nativeCauseCode: "NO_LAYOUT_BOX" | null;
  nativeCauseCount: number;
  nativeStage: "runtime-call-function-on";
}>;

const DOM_CANDIDATE_MISSING = "BROWSER_DOM_CANDIDATE_MISSING";
const DOM_CANDIDATE_AMBIGUOUS = "BROWSER_DOM_CANDIDATE_AMBIGUOUS";
const DOM_NODE_STALE = "BROWSER_DOM_NODE_STALE";
const DOM_READ_INVALID = "BROWSER_DOM_READ_INVALID";

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
  readEligibility?: BrowserDomReadEligibility,
): Promise<readonly number[]> => (
  await queryCandidateSet(runtime, tabId, selector, limit, scope, undefined, readEligibility)
).eligibleNodeIds;

const eligibilityReasons = (
  facts: BrowserMechanicalFacts,
  readEligibility?: BrowserDomReadEligibility,
): BrowserDomIneligibleReason[] => {
  const reasons: BrowserDomIneligibleReason[] = [];
  if (!facts.connected) reasons.push("DISCONNECTED");
  if (!facts.layout) reasons.push("NO_LAYOUT_BOX");
  if (facts.displayHidden) reasons.push("DISPLAY_HIDDEN");
  if (facts.visibilityHidden) reasons.push("VISIBILITY_HIDDEN");
  if (facts.opacityHidden) reasons.push("OPACITY_HIDDEN");
  if (facts.hidden) reasons.push("HTML_HIDDEN");
  if (facts.ariaHidden && readEligibility !== "non-actionable-aria-state") reasons.push("ARIA_HIDDEN");
  if (facts.inert) reasons.push("INERT");
  return reasons;
};

export const queryCandidateSet = async (
  runtime: ExtensionDebuggerRuntime,
  tabId: number,
  selector: string,
  limit: number,
  scope?: Readonly<{ selector: string }>,
  text?: Readonly<{ value: BrowserDomExactText; exact: boolean }>,
  readEligibility?: BrowserDomReadEligibility,
): Promise<BrowserDomCandidateSet> => {
  const rawNodeIds = await queryNodeIds(runtime, tabId, selector, scope);
  const eligibleNodeIds: number[] = [];
  const rejections: BrowserDomIneligibleCandidate[] = [];
  let eligibleCount = 0;
  let noLayoutCount = 0;
  for (const [index, nodeId] of rawNodeIds.entries()) {
    const facts = await readMechanicalFacts(runtime, tabId, nodeId);
    if (facts.nativeCauseCode === "NO_LAYOUT_BOX") noLayoutCount += 1;
    const reasons = eligibilityReasons(facts, readEligibility);
    if (text) {
      const actual = await nodeText(runtime, tabId, nodeId);
      const matched = text.exact ? (Array.isArray(text.value) ? text.value : [text.value]).some((value) => actual.trim() === value.trim()) : typeof text.value === "string" && actual.includes(text.value);
      if (!matched) reasons.push("TEXT_MISMATCH");
    }
    if (reasons.length > 0) {
      rejections.push(Object.freeze({ index, reasons: Object.freeze(reasons) }));
      continue;
    }
    eligibleCount += 1;
    if (eligibleNodeIds.length < limit) eligibleNodeIds.push(nodeId);
  }
  return Object.freeze({
    rawCount: rawNodeIds.length, eligibleCount, eligibleNodeIds, rejections: Object.freeze(rejections),
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
      if (semanticEligible(await readMechanicalFacts(runtime, tabId, scopeId))) eligibleScopes.push(scopeId);
    }
    requireExactCandidateCount(eligibleScopes, 1);
    queryRootId = eligibleScopes[0]!;
  }
  const result = record(await read(() => runtime.send(tabId, "DOM.querySelectorAll", { nodeId: queryRootId, selector })));
  if (!Array.isArray(result.nodeIds)) throw new Error(DOM_READ_INVALID);
  return result.nodeIds.map((value) => numberValue(value, DOM_READ_INVALID));
};

export const queryVisibleTextMatches = async (
  input: Readonly<{
    runtime: ExtensionDebuggerRuntime;
    tabId: number;
    selector: string;
    expectedText: BrowserDomExactText;
    exact: boolean;
    limit: number;
    scope?: Readonly<{ selector: string }>;
    readEligibility?: BrowserDomReadEligibility;
  }>,
): Promise<readonly number[]> => {
  const candidates = await queryCandidateSet(
    input.runtime, input.tabId, input.selector, input.limit, input.scope,
    { value: input.expectedText, exact: input.exact }, input.readEligibility,
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
    ? await queryVisibleTextMatches({ runtime, tabId, selector: intent.selector,
      expectedText: intent.textContains, exact: false, limit: maximum + 1,
      ...(intent.scope ? { scope: intent.scope } : {}) })
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
  if (attribute(node, "contenteditable") === "true") {
    return readExactEditableText(runtime, tabId, nodeId);
  }
  const name = typeof node.nodeName === "string" ? node.nodeName.toUpperCase() : "";
  if (name === "INPUT" || name === "TEXTAREA") {
    return (await readMechanicalFacts(runtime, tabId, nodeId)).value;
  }
  return collectNodeText(node);
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

const collectNodeText = (node: DevToolsRecord): string => {
  const own = typeof node.nodeValue === "string" ? node.nodeValue : "";
  const children = Array.isArray(node.children) ? node.children.map((child) => collectNodeText(record(child))).join("") : "";
  return `${own}${children}`;
};

const staticFieldReaders: Readonly<Record<string, (node: DevToolsRecord) => unknown>> = {
  id: (node) => attribute(node, "id") ?? "",
  turnKey: (node) => attribute(node, "data-turn-key") ?? "",
  tagName: (node) => stringValue(node.nodeName, DOM_READ_INVALID),
  ariaLabel: (node) => attribute(node, "aria-label") ?? "",
  ariaExpanded: (node) => attribute(node, "aria-expanded") ?? "",
  ariaLabelledBy: (node) => attribute(node, "aria-labelledby") ?? "",
  ariaControls: (node) => attribute(node, "aria-controls") ?? "",
  ariaChecked: (node) => attribute(node, "aria-checked") ?? "",
  ariaPressed: (node) => attribute(node, "aria-pressed") ?? "",
  accept: (node) => attribute(node, "accept") ?? "",
  multiple: (node) => attribute(node, "multiple") !== undefined,
};

const mechanicalFieldNames = new Set([
  "testId", "type", "role", "name", "label", "value", "checked", "connected", "layout",
  "visible", "computedDisplay", "computedVisibility", "computedOpacity", "effectiveOpacity", "hidden", "ariaHidden",
  "inert", "disabled", "ariaDisabled",
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

export const requireKeyboardActionTarget = async (
  runtime: ExtensionDebuggerRuntime,
  tabId: number,
  nodeId: number,
): Promise<void> => {
  if (!keyboardActionEligible(await readMechanicalFacts(runtime, tabId, nodeId))) {
    throw new Error(DOM_CANDIDATE_MISSING);
  }
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
