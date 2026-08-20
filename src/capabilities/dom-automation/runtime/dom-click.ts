import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import { DOM_SCHEMAS } from "../schema.js";
import type { DomActionResult } from "../../../types/dom-automation.js";
import type { ClickDomElementInput } from "../../../types/dom-automation-inputs.js";
import {
  buildDomActionOutcome,
  buildDomFailureResult,
  buildDomReviewRequiredResult,
} from "./dom-action-result.js";
import { captureDomEvidenceRef } from "./dom-evidence.js";
import {
  assertDomTargetBinding,
} from "./dom-target-binding.js";

const DANGEROUS_TEXT = /delete|refund|cancel|pay now|submit payment|remove/i;

export async function clickDomElementOnce(
  browser: BrowserTargetLease,
  rawInput: ClickDomElementInput,
): Promise<DomActionResult> {
  const input = DOM_SCHEMAS.ClickDomElementInput.parse(
    rawInput,
  ) as ClickDomElementInput;
  const elementRef = DOM_SCHEMAS.DomElementRef.parse(
    input.elementRef,
  ) as ClickDomElementInput["elementRef"];
  assertDomTargetBinding(browser, elementRef);
  if (DANGEROUS_TEXT.test(input.expectedText ?? input.expectedKind)) {
    return buildDomReviewRequiredResult(
      "dangerous DOM click requires human review",
      "Sensitive irreversible action text matched.",
    );
  }

  try {
    await browser.executeDomIntent({
      kind: "click",
      selector: elementRef.selector,
      ...(input.expectedText ? { expectedText: input.expectedText } : {}),
    });
  } catch (error) {
    const afterEvidenceRef = await captureDomEvidenceRef(
      browser,
      "dom-click-atomic-rejected",
    );
    return afterEvidenceRef
      ? buildDomActionOutcome(
          {
            status: "review_required",
            message: `atomic DOM click failed closed: ${error instanceof Error ? error.message : String(error)}`,
          },
          undefined,
          afterEvidenceRef,
        )
      : buildDomFailureResult(
          "atomic DOM click failed and evidence capture failed",
        );
  }
  if (input.waitAfterMs && input.waitAfterMs > 0) {
    await browser.wait({ durationMs: input.waitAfterMs });
  }
  const afterEvidenceRef = await captureDomEvidenceRef(
    browser,
    "dom-click-after",
  );
  if (!afterEvidenceRef)
    return buildDomFailureResult("after-action evidence capture failed");
  return buildDomActionOutcome(
    {
      status: "success",
      message: "clicked revalidated DOM element through exact-target command",
    },
    undefined,
    afterEvidenceRef,
  );
}
