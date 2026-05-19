import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import { createId } from "../../../lib/local-runtime/ids.js";
import { ClickDomElementInputSchema, DomActionResultSchema, DomElementRefSchema } from "../schema.js";
import type { ClickDomElementInput, DomActionResult } from "../schema.js";
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
    return DomActionResultSchema.parse({
      ok: false,
      status: "review_required",
      actionId: createId("dom"),
      message: "dangerous DOM click requires human review",
      reviewRequiredReason: "Sensitive irreversible action text matched.",
    });
  }

  const beforeEvidenceRef = await captureDomEvidenceRef(browser, "dom-click-before");
  if (!beforeEvidenceRef) {
    return DomActionResultSchema.parse({
      ok: false,
      status: "review_required",
      actionId: createId("dom"),
      message: "before-action evidence capture failed",
      reviewRequiredReason: "DOM click requires evidence before action.",
    });
  }
  const result = await browser.evaluateActiveTab<{ status: string; message: string }>({
    description: "click located visible enabled DOM element",
    script: buildClickScript(elementRef.selector, input.expectedText),
  });
  if (input.waitAfterMs && input.waitAfterMs > 0) {
    await browser.wait(input.waitAfterMs);
  }
  const afterEvidenceRef = await captureDomEvidenceRef(browser, "dom-click-after");
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
