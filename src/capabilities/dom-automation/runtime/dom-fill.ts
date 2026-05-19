import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import { createId } from "../../../lib/local-runtime/ids.js";
import { DomActionResultSchema, DomElementRefSchema, FillDomElementInputSchema } from "../schema.js";
import type { DomActionResult, FillDomElementInput } from "../schema.js";
import { captureDomEvidenceRef } from "./dom-evidence.js";

function buildFillScript(selector: string, approvedText: string, clearBeforeType: boolean): string {
  return `
const selector = ${JSON.stringify(selector)};
const approvedText = ${JSON.stringify(approvedText)};
const matches = Array.from(document.querySelectorAll(selector));
if (matches.length === 0) return {status: "not_found", message: "element not found"};
if (matches.length > 1) return {status: "ambiguous", message: "selector matched multiple elements"};
const el = matches[0];
const style = window.getComputedStyle(el);
const rect = el.getBoundingClientRect();
if (style.display === "none" || style.visibility === "hidden" || rect.width === 0 || rect.height === 0) return {status: "review_required", message: "element is hidden"};
if (el.disabled || el.getAttribute("aria-disabled") === "true") return {status: "review_required", message: "element is disabled"};
if ((el.getAttribute("type") || "").toLowerCase() === "password") return {status: "review_required", message: "password input is forbidden"};
el.focus();
if (${clearBeforeType ? "true" : "false"}) el.value = "";
el.value = String(el.value || "") + approvedText;
el.dispatchEvent(new InputEvent("input", {bubbles: true, inputType: "insertText", data: approvedText}));
el.dispatchEvent(new Event("change", {bubbles: true}));
return {status: el.value === approvedText || String(el.value || "").endsWith(approvedText) ? "success" : "review_required", message: "fill attempted", valueLength: String(el.value || "").length};
`;
}

export async function fillDomElementOnce(
  browser: BrowserController,
  rawInput: FillDomElementInput,
): Promise<DomActionResult> {
  const input = FillDomElementInputSchema.parse(rawInput) as FillDomElementInput;
  const elementRef = DomElementRefSchema.parse(input.elementRef) as FillDomElementInput["elementRef"];
  if (input.approvedText.length === 0) {
    return DomActionResultSchema.parse({
      ok: false,
      status: "review_required",
      actionId: createId("dom"),
      message: "approvedText is empty",
      reviewRequiredReason: "DOM fill requires task-approved non-empty text.",
    });
  }

  const beforeEvidenceRef = await captureDomEvidenceRef(browser, "dom-fill-before");
  if (!beforeEvidenceRef) {
    return DomActionResultSchema.parse({
      ok: false,
      status: "review_required",
      actionId: createId("dom"),
      message: "before-action evidence capture failed",
      reviewRequiredReason: "DOM fill requires evidence before action.",
    });
  }
  const result = await browser.evaluateActiveTab<{ status: string; message: string }>({
    description: "fill approved text into located DOM element",
    script: buildFillScript(elementRef.selector, input.approvedText, input.clearBeforeType),
  });
  const afterEvidenceRef = await captureDomEvidenceRef(browser, "dom-fill-after");
  if (!afterEvidenceRef) {
    return DomActionResultSchema.parse({
      ok: false,
      status: "failed",
      actionId: createId("dom"),
      message: "after-action evidence capture failed",
      beforeEvidenceRef,
    });
  }
  const ok = result.status === "success";
  return DomActionResultSchema.parse({
    ok,
    status: ok ? "success" : result.status,
    actionId: createId("dom"),
    message: result.message,
    beforeEvidenceRef,
    afterEvidenceRef,
    ...(ok ? {} : { reviewRequiredReason: result.message }),
  });
}
