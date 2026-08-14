import type { BrowserTargetSession } from "../../../lib/browser/browser-controller.js";
import { DOM_SCHEMAS } from "../schema.js";
import type { DomActionResult } from "../../../types/dom-automation.js";
import type { ClickDomElementInput } from "../../../types/dom-automation-inputs.js";
import {
  buildDomActionOutcome,
  buildDomFailureResult,
  buildDomReviewRequiredResult,
} from "./dom-action-result.js";
import { captureDomEvidenceRef } from "./dom-evidence.js";
import { assertDomTargetBinding } from "./dom-target-binding.js";

const DANGEROUS_TEXT = /delete|refund|cancel|pay now|submit payment|remove/i;

type ClickScriptResult = Pick<DomActionResult, "status" | "message">;

function buildClickScript(selector: string, expectedText: string | undefined): string {
  return `
const selector = ${JSON.stringify(selector)};
const expectedText = ${JSON.stringify(expectedText ?? "")};
const queryScoped = (root, css) => Array.from(root.querySelectorAll(css));
const matches = (() => {
  const parts = selector.split(">>>").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 1) return queryScoped(document, parts[0]);
  if (parts.length !== 2) return [];
  const hosts = queryScoped(document, parts[0]);
  if (hosts.length !== 1 || !hosts[0].shadowRoot) return [];
  return queryScoped(hosts[0].shadowRoot, parts[1]);
})();
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
el.click();
return {status: "success", message: "clicked revalidated DOM element"};
`;
}

export async function clickDomElementOnce(
  browser: BrowserTargetSession,
  rawInput: ClickDomElementInput,
): Promise<DomActionResult> {
  const input = DOM_SCHEMAS.ClickDomElementInput.parse(rawInput) as ClickDomElementInput;
  const elementRef = DOM_SCHEMAS.DomElementRef.parse(input.elementRef) as ClickDomElementInput["elementRef"];
  assertDomTargetBinding(browser, elementRef);
  if (DANGEROUS_TEXT.test(input.expectedText ?? input.expectedKind)) {
    return buildDomReviewRequiredResult(
      "dangerous DOM click requires human review",
      "Sensitive irreversible action text matched.",
    );
  }

  const result = await browser.evaluate<ClickScriptResult>({
    description: "revalidate and click located visible enabled DOM element",
    script: buildClickScript(elementRef.selector, input.expectedText),
  });
  if (input.waitAfterMs && input.waitAfterMs > 0) {
    await browser.wait(input.waitAfterMs);
  }
  const afterEvidenceRef = await captureDomEvidenceRef(browser, "dom-click-after");
  if (!afterEvidenceRef) {
    return buildDomFailureResult("after-action evidence capture failed");
  }
  return buildDomActionOutcome(result, undefined, afterEvidenceRef);
}
