import type { BrowserTargetSession } from "../../../lib/browser/browser-controller.js";
import { DOM_SCHEMAS } from "../schema.js";
import type { DomActionResult } from "../../../types/dom-automation.js";
import type { FillDomElementInput } from "../../../types/dom-automation-inputs.js";
import {
  buildDomActionOutcome,
  buildDomFailureResult,
  buildDomReviewRequiredResult,
} from "./dom-action-result.js";
import { captureDomEvidenceRef } from "./dom-evidence.js";
import { assertDomTargetBinding } from "./dom-target-binding.js";

type DomFillObservation = Pick<DomActionResult, "status" | "message"> & {
  point?: { x: number; y: number };
};

function buildFillObservationScript(selector: string): string {
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
if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement) && !el.isContentEditable) return {status: "review_required", message: "element is not an editable input"};
const x = rect.left + rect.width / 2;
const y = rect.top + rect.height / 2;
if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return {status: "review_required", message: "element is outside the visible viewport"};
return {status: "success", message: "revalidated editable DOM element", point: {x, y}};
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
const actualValue = String(el.value || el.textContent || "");
const hostedName = host !== el ? el.getAttribute("name") || host.getAttribute("name") : "";
const hidden = hostedName ? host.querySelector("input[name='" + CSS.escape(hostedName) + "']") : null;
const hostedValue = host !== el ? String(host.getAttribute("value") || "") : "";
const hiddenValue = hidden && hidden !== el ? String(hidden.value || "") : "";
const values = [actualValue, hostedValue, hiddenValue].filter((value) => value.length > 0);
const verified = values.some((value) => value === approvedText || value.endsWith(approvedText));
return {status: verified ? "success" : "review_required", message: "fill verified", valueLength: actualValue.length};
`;
}

const captureRequiredFillEvidence = async (browser: BrowserTargetSession): Promise<DomActionResult | string> => {
  const beforeEvidenceRef = await captureDomEvidenceRef(browser, "dom-fill-before");
  return beforeEvidenceRef ?? buildDomReviewRequiredResult(
    "before-action evidence capture failed",
    "DOM fill requires evidence before action.",
  );
};

const captureFillFailure = async (
  browser: BrowserTargetSession,
  label: string,
  message: string,
  beforeEvidenceRef: string,
): Promise<DomActionResult> => {
  const afterEvidenceRef = await captureDomEvidenceRef(browser, label);
  return buildDomActionOutcome({ status: "failed", message }, beforeEvidenceRef, afterEvidenceRef ?? beforeEvidenceRef);
};

const executeExactTargetTextMutation = async (
  browser: BrowserTargetSession,
  input: FillDomElementInput,
  point: { x: number; y: number },
  beforeEvidenceRef: string,
): Promise<DomActionResult | null> => {
  const clicked = await browser.clickLocatedDomElement({ targetLabel: "approved DOM text input", point });
  if (!clicked.ok) return captureFillFailure(browser, "dom-fill-click-failed", clicked.message, beforeEvidenceRef);
  if (input.clearBeforeType) {
    const cleared = await browser.textInput({ targetLabel: "approved DOM text input", action: "clear-input" });
    if (!cleared.ok) return captureFillFailure(browser, "dom-fill-clear-failed", cleared.message, beforeEvidenceRef);
  }
  const typed = await browser.textInput({
    targetLabel: "approved DOM text input",
    action: "type-text",
    text: input.approvedText,
  });
  if (!typed.ok) return captureFillFailure(browser, "dom-fill-type-failed", typed.message, beforeEvidenceRef);
  const committed = await browser.textInput({
    targetLabel: "approved DOM text input",
    action: "press-key",
    key: "Tab",
  });
  return committed.ok ? null : captureFillFailure(browser, "dom-fill-commit-failed", committed.message, beforeEvidenceRef);
};

const verifyExactTargetFill = async (
  browser: BrowserTargetSession,
  selector: string,
  approvedText: string,
  beforeEvidenceRef: string,
): Promise<DomActionResult> => {
  await browser.wait(50);
  const verified = await browser.evaluate<Pick<DomActionResult, "status" | "message">>({
    description: "verify approved text in exact-target DOM element",
    script: buildVerifyScript(selector, approvedText),
  });
  const afterEvidenceRef = await captureDomEvidenceRef(browser, "dom-fill-after");
  return afterEvidenceRef
    ? buildDomActionOutcome(verified, beforeEvidenceRef, afterEvidenceRef)
    : buildDomFailureResult("after-action evidence capture failed", { beforeEvidenceRef });
};

export async function fillDomElementOnce(
  browser: BrowserTargetSession,
  rawInput: FillDomElementInput,
): Promise<DomActionResult> {
  const input = DOM_SCHEMAS.FillDomElementInput.parse(rawInput) as FillDomElementInput;
  const elementRef = DOM_SCHEMAS.DomElementRef.parse(input.elementRef) as FillDomElementInput["elementRef"];
  assertDomTargetBinding(browser, elementRef);
  if (input.approvedText.length === 0) {
    return buildDomReviewRequiredResult(
      "approvedText is empty",
      "DOM fill requires task-approved non-empty text.",
    );
  }

  const beforeEvidenceRef = await captureRequiredFillEvidence(browser);
  if (typeof beforeEvidenceRef !== "string") return beforeEvidenceRef;

  const observed = await browser.evaluate<DomFillObservation>({
    description: "revalidate editable DOM element for exact-target text input",
    script: buildFillObservationScript(elementRef.selector),
  });
  if (observed.status !== "success" || !observed.point) {
    const afterEvidenceRef = await captureDomEvidenceRef(browser, "dom-fill-not-executed");
    return buildDomActionOutcome(observed, beforeEvidenceRef, afterEvidenceRef ?? beforeEvidenceRef);
  }

  const mutationFailure = await executeExactTargetTextMutation(browser, input, observed.point, beforeEvidenceRef);
  return mutationFailure ?? verifyExactTargetFill(browser, elementRef.selector, input.approvedText, beforeEvidenceRef);
}
