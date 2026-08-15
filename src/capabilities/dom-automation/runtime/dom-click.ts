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

type ClickObservation = Pick<DomActionResult, "status" | "message"> & {
  point?: { x: number; y: number };
};

function buildClickObservationScript(selector: string, expectedText: string | undefined): string {
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
const x = rect.left + rect.width / 2;
const y = rect.top + rect.height / 2;
if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return {status: "review_required", message: "element is outside the visible viewport"};
return {status: "success", message: "revalidated visible enabled DOM element", point: {x, y}};
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

  const observed = await browser.evaluate<ClickObservation>({
    description: "revalidate located visible enabled DOM element for exact-target click",
    script: buildClickObservationScript(elementRef.selector, input.expectedText),
  });
  if (observed.status !== "success" || !observed.point) {
    const evidenceRef = await captureDomEvidenceRef(browser, "dom-click-not-executed");
    return evidenceRef
      ? buildDomActionOutcome(observed, undefined, evidenceRef)
      : buildDomFailureResult("non-action evidence capture failed");
  }

  const clicked = await browser.clickLocatedDomElement({
    targetLabel: input.expectedText ?? input.expectedKind,
    point: observed.point,
  });
  if (input.waitAfterMs && input.waitAfterMs > 0) {
    await browser.wait(input.waitAfterMs);
  }
  const afterEvidenceRef = await captureDomEvidenceRef(browser, "dom-click-after");
  if (!afterEvidenceRef) return buildDomFailureResult("after-action evidence capture failed");
  return buildDomActionOutcome({
    status: clicked.ok ? "success" : "failed",
    message: clicked.ok ? "clicked revalidated DOM element through exact-target command" : clicked.message,
  }, undefined, afterEvidenceRef);
}
