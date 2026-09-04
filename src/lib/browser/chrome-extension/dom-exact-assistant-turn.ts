import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import { BROWSER_MECHANICAL_FACTS_READER_SOURCE } from "./dom-mechanical-facts.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";

type BrowserRecord = Record<string, unknown>;
type ExactAssistantObservation = Readonly<{
  rawCount: number;
  eligibleCount: number;
  rawDomHtml: string;
  semanticText: string;
  observedAt: string;
  nativeCauseCode: "NO_LAYOUT_BOX" | null;
  nativeStage: "runtime-call-function-on";
}>;

const EXACT_ASSISTANT_TURN_FUNCTION = `function (assistantTurnId) {
  ${BROWSER_MECHANICAL_FACTS_READER_SOURCE}
  const blockNames = new Set(["ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DD", "DIV", "DL", "DT",
    "FIGCAPTION", "FIGURE", "FOOTER", "FORM", "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HR",
    "MAIN", "NAV", "OL", "P", "PRE", "SECTION", "TABLE", "TBODY", "TD", "TFOOT", "TH", "THEAD", "TR", "UL"]);
  const inlineCode = (value) => {
    const runs = Array.from(value.matchAll(/\x60+/g), (match) => match[0].length);
    const fence = "\x60".repeat(Math.max(0, ...runs) + 1);
    return fence + value + fence;
  };
  const semanticNode = (node, parent) => {
    const name = String(node.nodeName || "").toUpperCase();
    if (node.nodeType === 3 || name === "#TEXT") return typeof node.nodeValue === "string" ? node.nodeValue : "";
    if (["#COMMENT", "SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "SVG", "PATH"].includes(name)
      || (node instanceof Element && (node.hasAttribute("hidden") || node.getAttribute("aria-hidden") === "true"))) return "";
    if (name === "BR") return "\\n";
    const body = Array.from(node.childNodes || []).map((child) => semanticNode(child, node)).join("");
    if (name === "STRONG" || name === "B") return "**" + body + "**";
    if (name === "EM" || name === "I") return "*" + body + "*";
    if (name === "CODE") return inlineCode(body);
    if (name === "LI") return ((parent && String(parent.nodeName).toUpperCase() === "OL") ? "1. " : "- ") + body + "\\n";
    return blockNames.has(name) ? body + "\\n" : body;
  };
  const codeBlocks = (node) => Array.from(node.querySelectorAll("pre code"));
  const semanticText = (node) => {
    const codes = codeBlocks(node);
    return codes.length === 1 ? (codes[0].textContent || "")
      : Array.from(node.childNodes || []).map((child) => semanticNode(child, node)).join("");
  };
  if (!/^conversation-turn-[1-9][0-9]*$/.test(assistantTurnId)) throw new Error("BROWSER_DOM_READ_INVALID");
  const selector = '[data-testid="' + assistantTurnId
    + '"][data-turn="assistant"] [data-message-author-role="assistant"]';
  const raw = Array.from(document.querySelectorAll(selector));
  const observedAt = new Date().toISOString();
  if (raw.length !== 1) return { rawCount: raw.length, eligibleCount: 0,
    rawDomHtml: "", semanticText: "", observedAt, nativeCauseCode: null,
    nativeStage: "runtime-call-function-on" };
  const node = raw[0];
  const facts = browserMechanicalFacts(node, false);
  const eligible = facts !== null && facts.visible && !facts.ariaHidden && !facts.inert;
  return { rawCount: 1, eligibleCount: eligible ? 1 : 0,
    rawDomHtml: eligible ? node.outerHTML : "", semanticText: eligible ? semanticText(node) : "",
    observedAt, nativeCauseCode: facts === null ? null : facts.nativeCauseCode,
    nativeStage: "runtime-call-function-on" };
}`;

const sha256Text = async (value: string): Promise<`sha256:${string}`> => {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
};

const record = (value: unknown): BrowserRecord => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("BROWSER_DOM_READ_INVALID");
  return value as BrowserRecord;
};

const count = (value: unknown): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error("BROWSER_DOM_READ_INVALID");
  return value as number;
};

const decodeObservation = (value: unknown): ExactAssistantObservation => {
  const observed = record(value);
  const keys = ["rawCount", "eligibleCount", "rawDomHtml", "semanticText", "observedAt",
    "nativeCauseCode", "nativeStage"];
  const rawCount = count(observed.rawCount);
  const eligibleCount = count(observed.eligibleCount);
  if (Object.keys(observed).length !== keys.length || keys.some((key) => !Object.hasOwn(observed, key))
    || eligibleCount > rawCount || eligibleCount > 1
    || typeof observed.rawDomHtml !== "string" || typeof observed.semanticText !== "string"
    || typeof observed.observedAt !== "string" || new Date(observed.observedAt).toISOString() !== observed.observedAt
    || (observed.nativeCauseCode !== null && observed.nativeCauseCode !== "NO_LAYOUT_BOX")
    || observed.nativeStage !== "runtime-call-function-on") {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  if (rawCount > 1) throw new Error("BROWSER_DOM_CANDIDATE_AMBIGUOUS");
  if (rawCount === 0 || eligibleCount === 0) throw new Error("BROWSER_DOM_CANDIDATE_MISSING");
  if (eligibleCount !== 1) throw new Error("BROWSER_DOM_CANDIDATE_AMBIGUOUS");
  if (observed.rawDomHtml.length === 0) throw new Error("BROWSER_DOM_READ_INVALID");
  return Object.freeze({
    rawCount, eligibleCount, rawDomHtml: observed.rawDomHtml, semanticText: observed.semanticText,
    observedAt: observed.observedAt, nativeCauseCode: observed.nativeCauseCode, nativeStage: observed.nativeStage,
  }) as ExactAssistantObservation;
};

const mainFrameLoaderId = async (runtime: ExtensionDebuggerRuntime, tabId: number): Promise<string> => {
  const tree = record(await runtime.send(tabId, "Page.getFrameTree"));
  const frame = record(record(tree.frameTree).frame);
  if (typeof frame.loaderId !== "string" || frame.loaderId.length === 0) {
    throw new Error("BROWSER_DOCUMENT_INVALID");
  }
  return frame.loaderId;
};

const observeExactAssistantTurn = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  assistantTurnId: string,
  expectedMainFrameLoaderId: string,
): Promise<ExactAssistantObservation> => {
  let objectId: string | null = null;
  let primaryFailure: unknown = null;
  try {
    const loaderBefore = await mainFrameLoaderId(runtime, target.tabId);
    if (loaderBefore !== expectedMainFrameLoaderId) throw new Error("BROWSER_DOCUMENT_INVALID");
    const document = record(await runtime.send(target.tabId, "DOM.getDocument", { depth: 0, pierce: true }));
    const root = record(document.root);
    if (!Number.isSafeInteger(root.nodeId)) throw new Error("BROWSER_DOM_READ_INVALID");
    const resolved = record(await runtime.send(target.tabId, "DOM.resolveNode", { nodeId: root.nodeId }));
    objectId = record(resolved.object).objectId as string;
    if (typeof objectId !== "string" || objectId.length === 0) throw new Error("BROWSER_DOM_READ_INVALID");
    const call = record(await runtime.send(target.tabId, "Runtime.callFunctionOn", {
      objectId, functionDeclaration: EXACT_ASSISTANT_TURN_FUNCTION,
      arguments: [{ value: assistantTurnId }], returnByValue: true, awaitPromise: false, silent: true,
    }));
    if (call.exceptionDetails !== undefined) throw new Error("BROWSER_DOM_READ_INVALID");
    const loaderAfter = await mainFrameLoaderId(runtime, target.tabId);
    if (loaderAfter !== expectedMainFrameLoaderId) throw new Error("BROWSER_DOCUMENT_INVALID");
    return decodeObservation(record(call.result).value);
  } catch (error) {
    primaryFailure = error;
    if (error instanceof Error && /^BROWSER_[A-Z_]+$/u.test(error.message)) throw error;
    throw new Error("BROWSER_DOM_READ_INVALID", { cause: error });
  } finally {
    if (objectId !== null) try { await runtime.send(target.tabId, "Runtime.releaseObject", { objectId }); }
    catch (error) { if (primaryFailure === null) throw new Error("BROWSER_DOM_READ_INVALID", { cause: error }); }
  }
};

export const executeExactAssistantTurnRead = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  assistantTurnId: string,
  assertCurrent: () => void,
  expectedMainFrameLoaderId: string,
): Promise<unknown> => {
  assertCurrent();
  const observed = await observeExactAssistantTurn(
    debuggerRuntime, target, assistantTurnId, expectedMainFrameLoaderId,
  );
  assertCurrent();
  return Object.freeze({
    schemaVersion: "grasseye.browser.exact-assistant-turn.v1" as const,
    targetRefHash: await sha256Text(target.targetRef),
    documentRefHash: await sha256Text(target.documentRef),
    assistantTurnId,
    rawDomHtml: observed.rawDomHtml,
    rawDomHash: await sha256Text(observed.rawDomHtml),
    semanticText: observed.semanticText,
    semanticTextHash: await sha256Text(observed.semanticText),
    observedAt: observed.observedAt,
  });
};
