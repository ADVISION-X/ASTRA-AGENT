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

const captureRequiredFillEvidence = async (browser: BrowserTargetSession): Promise<DomActionResult | string> => {
  const beforeEvidenceRef = await captureDomEvidenceRef(browser, "dom-fill-before");
  return beforeEvidenceRef ?? buildDomReviewRequiredResult(
    "before-action evidence capture failed",
    "DOM fill requires evidence before action.",
  );
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

  if (!browser.fillLocatedDomElement) {
    return buildDomReviewRequiredResult(
      "atomic DOM fill command is unavailable",
      "DOM fill refuses to fall back to split click and text commands.",
    );
  }

  let filled: Awaited<ReturnType<NonNullable<BrowserTargetSession["fillLocatedDomElement"]>>>;
  try {
    filled = await browser.fillLocatedDomElement({
      targetLabel: input.inputPurpose,
      element: { selector: elementRef.selector, identity: elementRef.identity },
      approvedText: input.approvedText,
      clearBeforeType: input.clearBeforeType,
    });
  } catch (error) {
    const afterEvidenceRef = await captureDomEvidenceRef(browser, "dom-fill-atomic-rejected");
    return buildDomActionOutcome({
      status: "review_required",
      message: `atomic DOM fill failed closed: ${error instanceof Error ? error.message : String(error)}`,
    }, beforeEvidenceRef, afterEvidenceRef ?? beforeEvidenceRef);
  }
  const afterEvidenceRef = await captureDomEvidenceRef(browser, "dom-fill-after");
  if (!afterEvidenceRef) return buildDomFailureResult("after-action evidence capture failed", { beforeEvidenceRef });
  return buildDomActionOutcome({
    status: filled.ok ? "success" : "failed",
    message: filled.ok ? "atomically revalidated and filled the exact DOM element" : filled.message,
  }, beforeEvidenceRef, afterEvidenceRef);
}
