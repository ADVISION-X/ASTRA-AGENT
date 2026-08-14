import type { BrowserTargetSession } from "../../../lib/browser/browser-controller.js";
import { BrowserTerminalError } from "../../../lib/browser/exact-target/browser-command-contract.js";
import type { DomElementRef, DomSnapshot } from "../../../types/dom-automation.js";

export const assertDomTargetBinding = (
  browser: BrowserTargetSession,
  value: Pick<DomElementRef, "targetRef" | "documentRef"> | Pick<DomSnapshot, "targetRef" | "documentRef">,
): void => {
  const target = browser.getTarget?.();
  if (!target || target.targetRef !== value.targetRef) {
    throw new BrowserTerminalError("TARGET_FOREIGN_SESSION", "DOM reference belongs to another exact target");
  }
  if (target.documentRef !== value.documentRef) {
    throw new BrowserTerminalError("DOCUMENT_STALE", "DOM reference belongs to a stale document generation");
  }
};
