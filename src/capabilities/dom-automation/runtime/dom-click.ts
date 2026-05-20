import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import { ClickDomElementInputSchema, DomElementRefSchema } from "../schema.js";
import type { ClickDomElementInput, DomActionResult } from "../schema.js";
import {
  buildDomActionOutcome,
  buildDomFailureResult,
  buildDomReviewRequiredResult,
} from "./dom-action-result.js";
import { captureDomEvidenceRef } from "./dom-evidence.js";

const DANGEROUS_TEXT = /delete|refund|cancel|pay now|submit payment|remove/i;

function buildClickScript(selector: string, expectedText: string | undefined): string {
  return `
const selector = ${JSON.stringify(selector)};
const expectedText = ${JSON.stringify(expectedText ?? "")};
const matches = Array.from(document.querySelectorAll(selector));
if (matches.length === 0) return {status: "not_found", message: "element not found"};
if (matches.length > 1) return {status: "ambiguous", message: "selector matched multiple elements"};
const el = matches[0];
const text = String(el.innerText || el.textContent || el.getAttribute("aria-label") || "").trim();
const style = window.getComputedStyle(el);
const rect = el.getBoundingClientRect();
if (style.display === "none" || style.visibility === "hidden" || rect.width === 0 || rect.height === 0) return {status: "review_required", message: "element is hidden"};
if (el.disabled || el.getAttribute("aria-disabled") === "true") return {status: "review_required", message: "element is disabled"};
if (expectedText && !text.toLowerCase().includes(expectedText.toLowerCase())) return {status: "review_required", message: "expected text did not match"};
el.click();
return {status: "success", message: "clicked located DOM element"};
`;
}

export async function clickDomElementOnce(
  browser: BrowserController,
  rawInput: ClickDomElementInput,
): Promise<DomActionResult> {
  const input = ClickDomElementInputSchema.parse(rawInput) as ClickDomElementInput;
  const elementRef = DomElementRefSchema.parse(input.elementRef) as ClickDomElementInput["elementRef"];
  if (DANGEROUS_TEXT.test(input.expectedText ?? input.expectedKind)) {
    return buildDomReviewRequiredResult(
      "dangerous DOM click requires human review",
      "Sensitive irreversible action text matched.",
    );
  }

  const beforeEvidenceRef = await captureDomEvidenceRef(browser, "dom-click-before");
  if (!beforeEvidenceRef) {
    return buildDomReviewRequiredResult(
      "before-action evidence capture failed",
      "DOM click requires evidence before action.",
    );
  }
  const result = await browser.evaluateActiveTab<Pick<DomActionResult, "status" | "message">>({
    description: "click located visible enabled DOM element",
    script: buildClickScript(elementRef.selector, input.expectedText),
  });
  if (input.waitAfterMs && input.waitAfterMs > 0) {
    await browser.wait(input.waitAfterMs);
  }
  const afterEvidenceRef = await captureDomEvidenceRef(browser, "dom-click-after");
  if (!afterEvidenceRef) {
    return buildDomFailureResult("after-action evidence capture failed", {
      beforeEvidenceRef,
    });
  }
  return buildDomActionOutcome(result, beforeEvidenceRef, afterEvidenceRef);
}
