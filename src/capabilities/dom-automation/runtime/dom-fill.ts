import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import { DOM_SCHEMAS } from "../schema.js";
import type { DomActionResult } from "../../../types/dom-automation.js";
import type { FillDomElementInput } from "../../../types/dom-automation-inputs.js";
import {
  buildDomActionOutcome,
  buildDomFailureResult,
  buildDomReviewRequiredResult,
} from "./dom-action-result.js";
import { captureDomEvidenceRef } from "./dom-evidence.js";

type DomFillEvaluation = Pick<DomActionResult, "status" | "message">;

function buildFocusScript(selector: string): string {
  return `
const selector = ${JSON.stringify(selector)};
const matches = Array.from(document.querySelectorAll(selector));
if (matches.length === 0) return {status: "not_found", message: "element not found"};
if (matches.length > 1) return {status: "ambiguous", message: "selector matched multiple elements"};
const host = matches[0];
const el = host.shadowRoot?.querySelector("input, textarea") || host;
const style = window.getComputedStyle(el);
const rect = el.getBoundingClientRect();
if (style.display === "none" || style.visibility === "hidden" || rect.width === 0 || rect.height === 0) return {status: "review_required", message: "element is hidden"};
if (el.disabled || el.getAttribute("aria-disabled") === "true") return {status: "review_required", message: "element is disabled"};
if ((el.getAttribute("type") || "").toLowerCase() === "password") return {status: "review_required", message: "password input is forbidden"};
el.focus();
const focused = document.activeElement === el || document.activeElement === host || host.shadowRoot?.activeElement === el;
return {status: focused ? "success" : "review_required", message: "focused located DOM element"};
`;
}

function buildVerifyScript(selector: string, approvedText: string): string {
  return `
const selector = ${JSON.stringify(selector)};
const approvedText = ${JSON.stringify(approvedText)};
const matches = Array.from(document.querySelectorAll(selector));
if (matches.length === 0) return {status: "not_found", message: "element not found after fill"};
if (matches.length > 1) return {status: "ambiguous", message: "selector matched multiple elements after fill"};
const host = matches[0];
const el = host.shadowRoot?.querySelector("input, textarea") || host;
const actualValue = String(el.value || "");
const hostedName = host !== el ? el.getAttribute("name") || host.getAttribute("name") : "";
const hidden = hostedName ? host.querySelector("input[name='" + CSS.escape(hostedName) + "']") : null;
const hostedValue = host !== el ? String(host.getAttribute("value") || "") : "";
const hiddenValue = hidden && hidden !== el ? String(hidden.value || "") : "";
const values = [actualValue, hostedValue, hiddenValue].filter((value) => value.length > 0);
const verified = values.some((value) => value === approvedText || value.endsWith(approvedText));
return {status: verified ? "success" : "review_required", message: "fill verified", valueLength: actualValue.length};
`;
}

function buildDirectFillScript(selector: string, approvedText: string, clearBeforeType: boolean): string {
  return `
const selector = ${JSON.stringify(selector)};
const approvedText = ${JSON.stringify(approvedText)};
const matches = Array.from(document.querySelectorAll(selector));
if (matches.length !== 1) return {status: "review_required", message: "direct fill requires one matched element"};
const host = matches[0];
const el = host.shadowRoot?.querySelector("input, textarea") || host;
const prototype = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
const setNativeValue = (value) => {
  if (descriptor && typeof descriptor.set === "function") {
    descriptor.set.call(el, value);
    return;
  }
  el.value = value;
};
const dispatchTextInput = (target, inputType, data) => {
  target.dispatchEvent(new InputEvent("input", {bubbles: true, composed: true, inputType, data}));
  target.dispatchEvent(new Event("change", {bubbles: true, composed: true}));
};
const setInputLikeValue = (target, value, inputType, data) => {
  const targetPrototype = target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const targetDescriptor = Object.getOwnPropertyDescriptor(targetPrototype, "value");
  if (targetDescriptor && typeof targetDescriptor.set === "function") {
    targetDescriptor.set.call(target, value);
  } else {
    target.value = value;
  }
  dispatchTextInput(target, inputType, data);
};
el.focus();
if (${clearBeforeType ? "true" : "false"}) {
  setNativeValue("");
  dispatchTextInput(el, "deleteContentBackward", null);
}
if (typeof el.select === "function") el.select();
const inserted = document.execCommand("insertText", false, approvedText);
if (!inserted) {
  setNativeValue(String(el.value || "") + approvedText);
  dispatchTextInput(el, "insertText", approvedText);
}
el.dispatchEvent(new KeyboardEvent("keyup", {bubbles: true, composed: true, key: approvedText.slice(-1) || "Unidentified"}));
el.dispatchEvent(new Event("change", {bubbles: true}));
const hostedName = host !== el ? el.getAttribute("name") || host.getAttribute("name") : "";
const hidden = hostedName ? host.querySelector("input[name='" + CSS.escape(hostedName) + "']") : null;
if (host !== el) {
  host.setAttribute("value", approvedText);
  if (hidden && hidden !== el) {
    setInputLikeValue(hidden, approvedText, "insertText", approvedText);
  }
  host.dispatchEvent(new InputEvent("input", {bubbles: true, composed: true, inputType: "insertText", data: approvedText}));
  host.dispatchEvent(new Event("change", {bubbles: true, composed: true}));
}
const hiddenValue = host !== el && hidden && hidden !== el ? String(hidden.value || "") : "";
const hostedValue = host !== el ? String(host.getAttribute("value") || "") : "";
const values = [String(el.value || ""), hostedValue, hiddenValue].filter((value) => value.length > 0);
return {status: values.some((value) => value === approvedText || value.endsWith(approvedText)) ? "success" : "review_required", message: "fill attempted", valueLength: String(el.value || "").length};
`;
}

const captureRequiredFillEvidence = async (browser: BrowserController): Promise<DomActionResult | string> => {
  const beforeEvidenceRef = await captureDomEvidenceRef(browser, "dom-fill-before");
  return beforeEvidenceRef ?? buildDomReviewRequiredResult(
    "before-action evidence capture failed",
    "DOM fill requires evidence before action.",
  );
};

const evaluateFillScript = (
  browser: BrowserController,
  description: string,
  script: string,
): Promise<DomFillEvaluation> =>
  browser.evaluateActiveTab<DomFillEvaluation>({ description, script });

const buildIntermediateFillOutcome = async (
  browser: BrowserController,
  result: DomFillEvaluation,
  beforeEvidenceRef: string,
): Promise<DomActionResult> => {
  const afterEvidenceRef = await captureDomEvidenceRef(browser, "dom-fill-after");
  return buildDomActionOutcome(result, beforeEvidenceRef, afterEvidenceRef ?? beforeEvidenceRef);
};

const buildFinalFillOutcome = async (
  browser: BrowserController,
  result: DomFillEvaluation,
  beforeEvidenceRef: string,
): Promise<DomActionResult> => {
  const afterEvidenceRef = await captureDomEvidenceRef(browser, "dom-fill-after");
  return afterEvidenceRef
    ? buildDomActionOutcome(result, beforeEvidenceRef, afterEvidenceRef)
    : buildDomFailureResult("after-action evidence capture failed", { beforeEvidenceRef });
};

export async function fillDomElementOnce(
  browser: BrowserController,
  rawInput: FillDomElementInput,
): Promise<DomActionResult> {
  const input = DOM_SCHEMAS.FillDomElementInput.parse(rawInput) as FillDomElementInput;
  const elementRef = DOM_SCHEMAS.DomElementRef.parse(input.elementRef) as FillDomElementInput["elementRef"];
  if (input.approvedText.length === 0) {
    return buildDomReviewRequiredResult(
      "approvedText is empty",
      "DOM fill requires task-approved non-empty text.",
    );
  }
  const beforeEvidenceRef = await captureRequiredFillEvidence(browser);
  if (typeof beforeEvidenceRef !== "string") return beforeEvidenceRef;
  const focusResult = await evaluateFillScript(browser, "focus located DOM element for approved text fill", buildFocusScript(elementRef.selector));
  if (focusResult.status !== "success") {
    return buildIntermediateFillOutcome(browser, focusResult, beforeEvidenceRef);
  }
  const directFillResult = await evaluateFillScript(browser, "insert approved text into DOM-controlled input", buildDirectFillScript(elementRef.selector, input.approvedText, input.clearBeforeType));
  if (directFillResult.status !== "success") {
    return buildIntermediateFillOutcome(browser, directFillResult, beforeEvidenceRef);
  }
  await browser.wait(50);
  const result = await evaluateFillScript(browser, "verify approved text in located DOM element", buildVerifyScript(elementRef.selector, input.approvedText));
  return buildFinalFillOutcome(browser, result, beforeEvidenceRef);
}
