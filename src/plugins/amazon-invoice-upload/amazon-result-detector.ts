import { verifyDomStateOnce } from "../../capabilities/dom-automation/index.js";
import type { DomSnapshot } from "../../capabilities/dom-automation/index.js";
import type { AmazonInvoiceUploadMissionInput } from "./mission.schema.js";

export const AMAZON_INVOICE_UPLOAD_STATUS_VALUES = [
  "pending",
  "opened_amazon",
  "login_required",
  "captcha_or_2fa_required",
  "search_input_found",
  "order_search_submitted",
  "order_found",
  "order_detail_opened",
  "upload_entry_found",
  "file_attached",
  "upload_submitted",
  "upload_success",
  "review_required",
  "failed",
] as const;

export type AmazonInvoiceUploadStatus = (typeof AMAZON_INVOICE_UPLOAD_STATUS_VALUES)[number];

export type AmazonInvoiceUploadDetectedState = {
  status: AmazonInvoiceUploadStatus;
  reason: string;
};

export function detectAmazonInvoiceUploadState(input: {
  snapshot: DomSnapshot;
  mission: Pick<AmazonInvoiceUploadMissionInput, "amazonOrderId">;
  hasSearchInput?: boolean;
  hasOrderRow?: boolean;
  hasUploadEntry?: boolean;
}): AmazonInvoiceUploadDetectedState {
  const gate = verifyDomStateOnce({
    snapshot: input.snapshot,
    expectedStates: ["login-required", "captcha-or-2fa-required"],
    successHints: [],
    failureHints: [],
  });
  if (gate.status === "login_required") {
    return { status: "login_required", reason: gate.reason };
  }
  if (gate.status === "captcha_or_2fa_required") {
    return { status: "captcha_or_2fa_required", reason: gate.reason };
  }
  if (input.hasUploadEntry) {
    return {
      status: "upload_entry_found",
      reason: `upload entry located for order ${input.mission.amazonOrderId}`,
    };
  }
  if (input.hasOrderRow) {
    return {
      status: "order_found",
      reason: `order row located for ${input.mission.amazonOrderId}`,
    };
  }
  if (input.hasSearchInput) {
    return {
      status: "search_input_found",
      reason: "order search input located on the seller central entry page",
    };
  }
  return {
    status: "opened_amazon",
    reason: "seller central entry page opened and awaiting governed next step",
  };
}