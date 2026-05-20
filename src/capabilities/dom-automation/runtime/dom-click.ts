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

type ClickScriptResult = Pick<DomActionResult, "status" | "message"> & {
  nativeClickPoint?: { x: number; y: number };
};

function buildClickScript(selector: string, expectedText: string | undefined): string {
  return `
const selector = ${JSON.stringify(selector)};
const expectedText = ${JSON.stringify(expectedText ?? "")};
const browserChromeTopInset = Math.max(0, window.outerHeight - window.innerHeight);
const matches = Array.from(document.querySelectorAll(selector));
if (matches.length === 0) return {status: "not_found", message: "element not found"};
if (matches.length > 1) return {status: "ambiguous", message: "selector matched multiple elements"};
const el = matches[0];
const text = String(el.innerText || el.textContent || el.getAttribute("aria-label") || el.getAttribute("label") || el.value || "").trim();
const style = window.getComputedStyle(el);
const rect = el.getBoundingClientRect();
if (style.display === "none" || style.visibility === "hidden" || rect.width === 0 || rect.height === 0) return {status: "review_required", message: "element is hidden"};
if (el.disabled || el.getAttribute("aria-disabled") === "true") return {status: "review_required", message: "element is disabled"};
if (expectedText && !text.toLowerCase().includes(expectedText.toLowerCase())) return {status: "review_required", message: "expected text did not match"};
el.scrollIntoView({block: "center", inline: "center"});
const afterScrollRect = el.getBoundingClientRect();
return {
  status: "success",
  message: "located DOM element is ready for governed native click",
  nativeClickPoint: {
    x: Math.round(window.screenX + afterScrollRect.x + afterScrollRect.width / 2),
    y: Math.round(window.screenY + browserChromeTopInset + afterScrollRect.y + afterScrollRect.height / 2),
  },
};
`;
}

async function clickLocatedDomPoint(
  browser: BrowserController,
  result: ClickScriptResult,
  targetLabel: string,
): Promise<Pick<DomActionResult, "status" | "message">> {
  if (!result.nativeClickPoint || result.status !== "success") return result;
  const nativeClick = await browser.clickLocatedDomElement({
    targetLabel,
    point: result.nativeClickPoint,
  });
  return {
    status: nativeClick.ok ? "success" : "failed",
    message: nativeClick.ok ? "clicked located DOM element" : nativeClick.message,
  };
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
  const clickPlan = await browser.evaluateActiveTab<ClickScriptResult>({
    description: "click located visible enabled DOM element",
    script: buildClickScript(elementRef.selector, input.expectedText),
  });
  const result = await clickLocatedDomPoint(browser, clickPlan, input.expectedKind);
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
