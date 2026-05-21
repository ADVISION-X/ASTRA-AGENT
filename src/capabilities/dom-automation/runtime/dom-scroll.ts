import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import { ScrollToElementInputSchema } from "../schema.js";
import type { DomActionResult, ScrollToElementInput } from "../schema.js";
import {
  buildDomActionOutcome,
  buildDomFailureResult,
  buildDomReviewRequiredResult,
} from "./dom-action-result.js";
import { captureDomEvidenceRef } from "./dom-evidence.js";

type ScrollCheck = Pick<DomActionResult, "status" | "message"> & {
  remainingPixels?: number;
};

const buildScrollScript = (input: ScrollToElementInput): string => `
const selector = ${JSON.stringify(input.elementRef.selector)};
const budget = ${JSON.stringify(input.scrollBudget)};
const stickyHeaderOffset = ${JSON.stringify(input.stickyHeaderOffset ?? 0)};
const matches = Array.from(document.querySelectorAll(selector));
if (matches.length === 0) return {status: "not_found", message: "element not found"};
if (matches.length > 1) return {status: "ambiguous", message: "selector matched multiple elements"};
const el = matches[0];
const maxSteps = budget?.maxSteps ?? 20;
const maxPixels = budget?.maxPixels ?? 8000;
let moved = 0;
let steps = 0;
const visible = () => {
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  return style.display !== "none"
    && style.visibility !== "hidden"
    && rect.width > 0
    && rect.height > 0
    && rect.top >= stickyHeaderOffset
    && rect.left >= 0
    && rect.bottom <= window.innerHeight
    && rect.right <= window.innerWidth;
};
while (!visible() && steps < maxSteps && Math.abs(moved) < maxPixels) {
  const rect = el.getBoundingClientRect();
  const delta = rect.top - stickyHeaderOffset - Math.round(window.innerHeight / 2);
  const bounded = Math.max(-600, Math.min(600, delta));
  window.scrollBy({top: bounded, behavior: "instant"});
  moved += bounded;
  steps += 1;
}
return visible()
  ? {status: "success", message: "located element is visible in viewport after bounded scroll"}
  : {status: "review_required", message: "element-not-reachable-by-scroll", remainingPixels: maxPixels - Math.abs(moved)};
`;

export async function scrollToElementOnce(
  browser: BrowserController,
  rawInput: ScrollToElementInput,
): Promise<DomActionResult> {
  const input = ScrollToElementInputSchema.parse(rawInput) as ScrollToElementInput;
  if (!input.elementRef.elementRef.startsWith("dom:")) {
    return buildDomReviewRequiredResult(
      "scroll requires a located DOM element ref",
      "DOM scroll refuses raw selector targets.",
    );
  }
  const beforeEvidenceRef = await captureDomEvidenceRef(browser, "dom-scroll-before");
  if (!beforeEvidenceRef) {
    return buildDomReviewRequiredResult("before-scroll evidence capture failed", "DOM scroll requires before evidence.");
  }
  const result = await browser.evaluateActiveTab<ScrollCheck>({
    description: `bounded scroll for ${input.scrollPurpose}`,
    script: buildScrollScript(input),
  });
  const afterEvidenceRef = await captureDomEvidenceRef(browser, "dom-scroll-after");
  if (!afterEvidenceRef) return buildDomFailureResult("after-scroll evidence capture failed", { beforeEvidenceRef });
  return buildDomActionOutcome(result, beforeEvidenceRef, afterEvidenceRef);
}
