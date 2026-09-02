import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";

type DevToolsRecord = Record<string, unknown>;
export type BrowserBounds = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type BrowserMechanicalFacts = Readonly<{
  connected: boolean;
  layout: boolean;
  visible: boolean;
  computedDisplay: string;
  computedVisibility: string;
  computedOpacity: string;
  effectiveOpacity: string;
  hidden: boolean;
  ariaHidden: boolean;
  inert: boolean;
  disabled: boolean;
  ariaDisabled: boolean;
  role: string;
  name: string;
  testId: string;
  label: string;
  value: string;
  checked: boolean | null;
  type: string;
  bounds: BrowserBounds | null;
  viewport: boolean;
  hitTest: boolean;
  nativeCauseCode: "NO_LAYOUT_BOX" | null;
  nativeStage: "runtime-call-function-on";
}>;

const DOM_NODE_STALE = "BROWSER_DOM_NODE_STALE";
const DOM_READ_INVALID = "BROWSER_DOM_READ_INVALID";

export const BROWSER_MECHANICAL_FACTS_READER_SOURCE = `const browserMechanicalFacts = (element) => {
  if (!(element instanceof Element)) return null;
  const style = globalThis.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  const connected = element.isConnected === true;
  const layout = element.getClientRects().length > 0 && rect.width > 0 && rect.height > 0;
  let ancestorRendered = true; let effectiveOpacityNumber = 1;
  for (let current = element; current instanceof Element; current = current.parentElement) {
    const currentStyle = globalThis.getComputedStyle(current);
    const currentOpacity = Number.parseFloat(currentStyle.opacity);
    if (currentStyle.display === "none" || currentStyle.visibility === "hidden"
      || currentStyle.visibility === "collapse" || !Number.isFinite(currentOpacity)) ancestorRendered = false;
    else effectiveOpacityNumber *= currentOpacity;
  }
  const hidden = element.closest("[hidden]") !== null;
  const ariaHidden = element.closest("[aria-hidden='true']") !== null;
  const inert = element.closest("[inert]") !== null;
  const disabled = element.hasAttribute("disabled") || element.matches(":disabled");
  const ariaDisabled = element.closest("[aria-disabled='true']") !== null;
  const visible = connected && layout && ancestorRendered && effectiveOpacityNumber > 0 && !hidden;
  const viewport = layout && rect.bottom > 0 && rect.right > 0
    && rect.top < globalThis.innerHeight && rect.left < globalThis.innerWidth;
  const centerX = rect.left + rect.width / 2; const centerY = rect.top + rect.height / 2;
  const pointerQualified = visible && !ariaHidden && !inert && !disabled && !ariaDisabled
    && viewport && style.pointerEvents !== "none";
  const top = pointerQualified ? document.elementFromPoint(centerX, centerY) : null;
  const labels = "labels" in element && element.labels
    ? Array.from(element.labels).map((label) => label.textContent || "").join(" ").trim() : "";
  return {
    connected, layout, visible, computedDisplay: style.display, computedVisibility: style.visibility,
    computedOpacity: style.opacity, effectiveOpacity: String(effectiveOpacityNumber), hidden, ariaHidden,
    inert, disabled, ariaDisabled, role: element.getAttribute("role") || "",
    name: element.getAttribute("name") || "", testId: element.getAttribute("data-testid") || "",
    label: element.getAttribute("aria-label") || labels,
    value: "value" in element && typeof element.value === "string" ? element.value : "",
    checked: "checked" in element && typeof element.checked === "boolean" ? element.checked : null,
    type: element.getAttribute("type") || "",
    bounds: layout ? { x: rect.left, y: rect.top, width: rect.width, height: rect.height } : null,
    viewport, hitTest: top !== null && (top === element || element.contains(top)),
    nativeCauseCode: layout ? null : "NO_LAYOUT_BOX", nativeStage: "runtime-call-function-on"
  };
};`;

const MECHANICAL_FACTS_FUNCTION = `function () {
  ${BROWSER_MECHANICAL_FACTS_READER_SOURCE}
  return browserMechanicalFacts(this);
}`;

const record = (value: unknown): DevToolsRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(DOM_READ_INVALID);
  return value as DevToolsRecord;
};

const stringField = (value: unknown): string => {
  if (typeof value !== "string") throw new Error(DOM_READ_INVALID);
  return value;
};

const booleanField = (value: unknown): boolean => {
  if (typeof value !== "boolean") throw new Error(DOM_READ_INVALID);
  return value;
};

const finiteNumber = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(DOM_READ_INVALID);
  return value;
};

const boundsField = (value: unknown): BrowserBounds | null => {
  if (value === null) return null;
  const bounds = record(value);
  return Object.freeze({
    x: finiteNumber(bounds.x),
    y: finiteNumber(bounds.y),
    width: finiteNumber(bounds.width),
    height: finiteNumber(bounds.height),
  });
};

const decodeMechanicalFacts = (value: unknown): BrowserMechanicalFacts => {
  const facts = record(value);
  const nativeCauseCode = facts.nativeCauseCode === null ? null
    : facts.nativeCauseCode === "NO_LAYOUT_BOX" ? "NO_LAYOUT_BOX"
      : (() => { throw new Error(DOM_READ_INVALID); })();
  if (facts.nativeStage !== "runtime-call-function-on") throw new Error(DOM_READ_INVALID);
  return Object.freeze({
    connected: booleanField(facts.connected),
    layout: booleanField(facts.layout),
    visible: booleanField(facts.visible),
    computedDisplay: stringField(facts.computedDisplay),
    computedVisibility: stringField(facts.computedVisibility),
    computedOpacity: stringField(facts.computedOpacity),
    effectiveOpacity: stringField(facts.effectiveOpacity),
    hidden: booleanField(facts.hidden),
    ariaHidden: booleanField(facts.ariaHidden),
    inert: booleanField(facts.inert),
    disabled: booleanField(facts.disabled),
    ariaDisabled: booleanField(facts.ariaDisabled),
    role: stringField(facts.role),
    name: stringField(facts.name),
    testId: stringField(facts.testId),
    label: stringField(facts.label),
    value: stringField(facts.value),
    checked: facts.checked === null ? null : booleanField(facts.checked),
    type: stringField(facts.type),
    bounds: boundsField(facts.bounds),
    viewport: booleanField(facts.viewport),
    hitTest: booleanField(facts.hitTest),
    nativeCauseCode,
    nativeStage: facts.nativeStage,
  });
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

export const readMechanicalFacts = async (
  runtime: ExtensionDebuggerRuntime,
  tabId: number,
  nodeId: number,
): Promise<BrowserMechanicalFacts> => {
  const resolved = record(await safeRead(() => runtime.send(tabId, "DOM.resolveNode", { nodeId })));
  const objectId = stringField(record(resolved.object).objectId);
  let primaryFailure: unknown = null;
  try {
    const call = record(await safeRead(() => runtime.send(tabId, "Runtime.callFunctionOn", {
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
      await safeRead(() => runtime.send(tabId, "Runtime.releaseObject", { objectId }));
    } catch (error) {
      if (primaryFailure === null) throw error;
    }
  }
};

export const semanticEligible = (facts: BrowserMechanicalFacts): boolean => facts.visible
  && !facts.ariaHidden && !facts.inert;

export const keyboardActionEligible = (facts: BrowserMechanicalFacts): boolean => semanticEligible(facts)
  && !facts.disabled && !facts.ariaDisabled;

export const pointerActionEligible = (facts: BrowserMechanicalFacts): boolean => keyboardActionEligible(facts)
  && facts.viewport && facts.hitTest && facts.bounds !== null;
