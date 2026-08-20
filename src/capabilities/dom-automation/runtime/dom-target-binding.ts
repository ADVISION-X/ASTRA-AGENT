import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import type {
  DomElementRef,
  DomSnapshot,
} from "../../../types/dom-automation.js";

export const assertDomTargetBinding = (
  browser: BrowserTargetLease,
  value:
    | Pick<DomElementRef, "targetRef" | "documentRef">
    | Pick<DomSnapshot, "targetRef" | "documentRef">,
): void => {
  if (browser.target.targetRef !== value.targetRef) {
    throw new Error("BROWSER_TARGET_INVALID");
  }
  if (browser.document.documentRef !== value.documentRef) {
    throw new Error("BROWSER_DOCUMENT_INVALID");
  }
};
