import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";

type DevToolsRecord = Record<string, unknown>;
const DOM_NODE_STALE = "BROWSER_DOM_NODE_STALE";
const DOM_READ_INVALID = "BROWSER_DOM_READ_INVALID";

/**
 * One Browser-owned mechanical projection for the current contenteditable value.
 * The same source is injected by both fill readback and coherent observation.
 */
export const BROWSER_EXACT_EDITABLE_TEXT_READER_SOURCE = `const browserExactEditableBlockText = (node) => {
  const name = String(node.nodeName || "").toUpperCase();
  if (node.nodeType === 3 || name === "#TEXT") {
    return typeof node.nodeValue === "string" ? node.nodeValue.split("\\u00a0").join(" ") : "";
  }
  if (name === "BR") return "";
  const value = Array.from(node.childNodes || []).map((child) =>
    String(child.nodeName || "").toUpperCase() === "BR" ? "\\n" : browserExactEditableBlockText(child)
  ).join("");
  return value.replace(/\\n$/u, "");
};
const browserExactEditableText = (element) => {
  if (!(element instanceof Element) || element.getAttribute("contenteditable") !== "true") return null;
  const children = Array.from(element.childNodes || []);
  if (children.length === 0) return element.textContent || "";
  return children.map((child) => browserExactEditableBlockText(child)).join("\\n");
};`;

const EXACT_EDITABLE_TEXT_FUNCTION = `function () {
  ${BROWSER_EXACT_EDITABLE_TEXT_READER_SOURCE}
  return browserExactEditableText(this);
}`;

const record = (value: unknown): DevToolsRecord => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(DOM_READ_INVALID);
  return value as DevToolsRecord;
};

const staleNodeError = (error: unknown): boolean => error instanceof Error
  && /(?:could not find node|no node with given id|node.*(?:detached|does not exist|not found)|backend node.*not found)/iu.test(error.message);

const safeRead = async <T>(operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof Error && /^[A-Z][A-Z0-9_]+$/u.test(error.message)) throw error;
    throw new Error(staleNodeError(error) ? DOM_NODE_STALE : DOM_READ_INVALID, { cause: error });
  }
};

export const readExactEditableText = async (
  runtime: ExtensionDebuggerRuntime,
  tabId: number,
  nodeId: number,
): Promise<string> => {
  const resolved = record(await safeRead(() => runtime.send(tabId, "DOM.resolveNode", { nodeId })));
  const objectId = record(resolved.object).objectId;
  if (typeof objectId !== "string" || objectId.length === 0) throw new Error(DOM_READ_INVALID);
  let primaryFailure: unknown = null;
  try {
    const call = record(await safeRead(() => runtime.send(tabId, "Runtime.callFunctionOn", {
      objectId,
      functionDeclaration: EXACT_EDITABLE_TEXT_FUNCTION,
      returnByValue: true,
      awaitPromise: false,
      silent: true,
    })));
    if (call.exceptionDetails !== undefined) throw new Error(DOM_READ_INVALID);
    const value = record(call.result).value;
    if (typeof value !== "string") throw new Error(DOM_READ_INVALID);
    return value;
  } catch (error) {
    primaryFailure = error;
    throw error;
  } finally {
    try {
      await safeRead(() => runtime.send(tabId, "Runtime.releaseObject", { objectId }));
    } catch (error) {
      if (primaryFailure === null) throw error;
    }
  }
};
