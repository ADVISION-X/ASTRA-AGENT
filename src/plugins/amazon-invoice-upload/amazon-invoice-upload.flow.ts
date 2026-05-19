import type { BrowserController } from "../../lib/browser/browser-controller.js";
import {
  clickDomElementOnce,
  fillDomElementOnce,
  locateDomElementOnce,
  readDomSnapshotOnce,
  verifyDomStateOnce,
} from "../../capabilities/dom-automation/index.js";
import { AmazonInvoiceUploadMissionInputSchema } from "./mission.schema.js";
import type { AmazonInvoiceUploadMissionInput } from "./mission.schema.js";
import { AMAZON_INVOICE_UPLOAD_DOM_HINTS } from "./amazon-dom-hints.js";

export type AmazonInvoiceUploadPhaseOneResult = {
  status: "review_required" | "failed";
  reason: string;
  reachedStep: string;
};

export async function runAmazonInvoiceUploadPhaseOne(
  browser: BrowserController,
  rawMission: AmazonInvoiceUploadMissionInput,
): Promise<AmazonInvoiceUploadPhaseOneResult> {
  const mission = AmazonInvoiceUploadMissionInputSchema.parse(rawMission);
  await browser.open({ url: mission.sellerCentralEntryUrl, title: "Amazon Seller Central invoice upload entry" });
  const entrySnapshot = await readDomSnapshotOnce(browser);
  const gate = verifyDomStateOnce({
    snapshot: entrySnapshot,
    expectedStates: ["login-required", "captcha-or-2fa-required"],
    successHints: [],
    failureHints: [],
  });
  if (gate.status === "login_required" || gate.status === "captcha_or_2fa_required") {
    return { status: "review_required", reason: gate.reason, reachedStep: "open seller central entry" };
  }

  const searchInput = locateDomElementOnce({
    snapshot: entrySnapshot,
    targetKind: "search-input",
    hints: [...AMAZON_INVOICE_UPLOAD_DOM_HINTS.orderSearch],
  });
  await fillDomElementOnce(browser, {
    elementRef: searchInput,
    approvedText: mission.amazonOrderId,
    clearBeforeType: true,
    inputPurpose: "order-search",
  });

  const searchButton = locateDomElementOnce({
    snapshot: await readDomSnapshotOnce(browser),
    targetKind: "button",
    hints: [...AMAZON_INVOICE_UPLOAD_DOM_HINTS.searchSubmit],
  });
  await clickDomElementOnce(browser, {
    elementRef: searchButton,
    expectedKind: "search-submit",
    expectedText: "search",
    waitAfterMs: 1000,
  });

  const resultSnapshot = await readDomSnapshotOnce(browser);
  locateDomElementOnce({
    snapshot: resultSnapshot,
    targetKind: "order-row",
    hints: [...AMAZON_INVOICE_UPLOAD_DOM_HINTS.orderRow],
    requiredText: mission.amazonOrderId,
  });
  locateDomElementOnce({
    snapshot: resultSnapshot,
    targetKind: "upload-invoice-entry",
    hints: [...AMAZON_INVOICE_UPLOAD_DOM_HINTS.uploadInvoiceEntry],
  });

  return {
    status: "review_required",
    reason: "Phase one stops after locating the invoice upload entry; human review is required before upload.",
    reachedStep: "upload invoice entry located",
  };
}
