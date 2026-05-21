import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import { DismissOverlayInputSchema } from "../schema.js";
import type { DismissOverlayInput, DomActionResult } from "../schema.js";
import {
  buildDomActionOutcome,
  buildDomFailureResult,
  buildDomReviewRequiredResult,
} from "./dom-action-result.js";
import { captureDomEvidenceRef } from "./dom-evidence.js";

type DismissCheck = Pick<DomActionResult, "status" | "message">;

const SAFE_OVERLAY_TYPES = new Set([
  "cookie-consent-overlay",
  "promotional-overlay",
  "informational-banner",
  "gdpr-consent",
  "app-install-prompt",
]);

const DANGEROUS_DISMISSAL_TEXT = /password|login|sign in|oauth|2fa|captcha|payment|refund|delete|remove account|confirm payment/i;

const buildDismissScript = (input: DismissOverlayInput): string => `
const approvedText = ${JSON.stringify(input.approvedDismissalText)};
const dangerous = ${DANGEROUS_DISMISSAL_TEXT.toString()};
const norm = (value) => String(value || "").replace(/\\s+/g, " ").trim().toLowerCase();
const overlaySelector = "dialog, [role='dialog'], [aria-modal='true'], [class*='modal'], [class*='drawer'], [class*='cookie'], [class*='consent'], [class*='banner']";
const overlays = Array.from(document.querySelectorAll(overlaySelector)).filter((el) => {
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
});
if (overlays.length === 0) return {status: "not_found", message: "safe overlay is no longer present"};
const overlay = overlays[0];
if (dangerous.test(overlay.innerText || overlay.textContent || "")) {
  return {status: "review_required", message: "overlay text suggests authentication or confirmation"};
}
const controls = Array.from(overlay.querySelectorAll("button, a, [role='button'], input[type='button'], input[type='submit']"));
const matches = controls.filter((el) => norm(el.innerText || el.textContent || el.value || el.getAttribute("aria-label")) === norm(approvedText));
if (matches.length === 0) return {status: "not_found", message: "approved dismissal control was not found"};
if (matches.length > 1) return {status: "ambiguous", message: "approved dismissal text matched multiple controls"};
if (dangerous.test(matches[0].innerText || matches[0].textContent || matches[0].value || "")) {
  return {status: "review_required", message: "dismissal-button-contains-dangerous-text"};
}
matches[0].click();
const started = Date.now();
while (Date.now() - started < 5000) {
  await new Promise((resolve) => setTimeout(resolve, 200));
  if (!document.body.contains(overlay)) return {status: "success", message: "safe overlay dismissed"};
  const rect = overlay.getBoundingClientRect();
  const style = window.getComputedStyle(overlay);
  if (style.display === "none" || style.visibility === "hidden" || rect.width === 0 || rect.height === 0) {
    return {status: "success", message: "safe overlay dismissed"};
  }
}
return {status: "failed", message: "overlay-still-present"};
`;

export async function dismissOverlayOnce(
  browser: BrowserController,
  rawInput: DismissOverlayInput,
): Promise<DomActionResult> {
  const input = DismissOverlayInputSchema.parse(rawInput) as DismissOverlayInput;
  if (!SAFE_OVERLAY_TYPES.has(input.overlayType)) {
    return buildDomReviewRequiredResult(
      "overlay type is not safe for automatic dismissal",
      "overlay-type-not-in-safe-dismissal-allowlist",
    );
  }
  if (DANGEROUS_DISMISSAL_TEXT.test(input.approvedDismissalText)) {
    return buildDomReviewRequiredResult("dismissal text is sensitive", "dismissal-button-contains-dangerous-text");
  }
  const beforeEvidenceRef = await captureDomEvidenceRef(browser, "dom-dismiss-overlay-before");
  if (!beforeEvidenceRef) return buildDomReviewRequiredResult("before-dismiss evidence capture failed", "DOM dismissal requires before evidence.");
  const result = await browser.evaluateActiveTab<DismissCheck>({
    description: `dismiss safe overlay for ${input.dismissPurpose}`,
    script: `(async () => {${buildDismissScript(input)}})()`,
  });
  const afterEvidenceRef = await captureDomEvidenceRef(browser, "dom-dismiss-overlay-after");
  if (!afterEvidenceRef) return buildDomFailureResult("after-dismiss evidence capture failed", { beforeEvidenceRef });
  return buildDomActionOutcome(result, beforeEvidenceRef, afterEvidenceRef);
}
