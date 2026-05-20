import type { BrowserController } from "../../lib/browser/browser-controller.js";
import { readDomSnapshotOnce } from "../../capabilities/dom-automation/index.js";
import { AmazonInvoiceUploadMissionInputSchema } from "./mission.schema.js";
import type { AmazonInvoiceUploadMissionInput } from "./mission.schema.js";
import { AMAZON_INVOICE_UPLOAD_DOM_HINTS } from "./amazon-dom-hints.js";
import type { AmazonInvoiceUploadStatus } from "./amazon-result-detector.js";
import {
  normalizeSubmitFailure,
  openOrderDetail,
  openUploadInvoiceEntry,
  searchOrder,
  uploadApprovedInvoice,
  verifyUploadSuccess,
} from "./amazon-invoice-upload-steps.js";
import {
  clickLocated,
  gatedResult,
  locateOrStatus,
  locateFailureResult,
  taskResult,
} from "./amazon-invoice-upload-flow-support.js";

export type AmazonInvoiceUploadTaskResult = {
  ok: boolean;
  status: AmazonInvoiceUploadStatus;
  reason: string;
  reachedStep: string;
  amazonOrderId: string;
  invoiceNo: string;
  evidenceRef?: string;
  reviewRequired?: boolean;
};

export type AmazonInvoiceUploadPhaseOneResult = {
  status: "review_required" | "failed";
  reason: string;
  reachedStep: string;
  phaseStatus: AmazonInvoiceUploadStatus;
};

export async function runAmazonInvoiceUpload(
  browser: BrowserController,
  rawMission: AmazonInvoiceUploadMissionInput,
): Promise<AmazonInvoiceUploadTaskResult> {
  const mission = AmazonInvoiceUploadMissionInputSchema.parse(rawMission);
  await browser.open({ url: mission.sellerCentralEntryUrl, title: "Amazon Seller Central invoice upload entry" });
  const entrySnapshot = await readDomSnapshotOnce(browser);
  const gate = gatedResult(entrySnapshot, mission, "open seller central");
  if (gate) {
    return gate;
  }

  const searchResult = await searchOrder(browser, mission, entrySnapshot);
  if (!searchResult.ok) return searchResult.failure;

  const orderDetailResult = await openOrderDetail(browser, mission);
  if (!orderDetailResult.ok) return orderDetailResult.failure;

  const uploadEntryResult = await openUploadInvoiceEntry(browser, mission);
  if (!uploadEntryResult.ok) return uploadEntryResult.failure;

  return uploadAndSubmitInvoice(browser, mission);
}

async function uploadAndSubmitInvoice(
  browser: BrowserController,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<AmazonInvoiceUploadTaskResult> {
  const uploadResult = await uploadApprovedInvoice(browser, mission);
  if (!uploadResult.ok) return uploadResult.failure;
  if (mission.requireHumanFinalSubmit === true) {
    return taskResult({
      status: "review_required",
      reason: "Approved PDF is attached; human final submit is required by mission payload.",
      reachedStep: "file attached before final submit",
      amazonOrderId: mission.amazonOrderId,
      invoiceNo: mission.invoiceNo,
      ...(uploadResult.value ? { evidenceRef: uploadResult.value } : {}),
      reviewRequired: true,
    });
  }

  return submitAndVerifyInvoice(browser, mission);
}

async function submitAndVerifyInvoice(
  browser: BrowserController,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<AmazonInvoiceUploadTaskResult> {
  const submitButton = locateOrStatus({
    snapshot: await readDomSnapshotOnce(browser),
    targetKind: "button",
    hints: [...AMAZON_INVOICE_UPLOAD_DOM_HINTS.submit],
    notFoundStatus: "submit_failed",
  });
  if (!submitButton.ok) {
    return locateFailureResult(mission, submitButton, "locate submit button");
  }
  const submitFailure = await clickLocated({
    browser,
    element: submitButton.element,
    expectedKind: "submit-invoice-upload",
    reachedStep: "submit invoice upload",
    mission,
  });
  if (submitFailure) return normalizeSubmitFailure(submitFailure);

  return verifyUploadSuccess(browser, mission);
}

async function runAmazonInvoiceUploadPhaseOne(
  browser: BrowserController,
  rawMission: AmazonInvoiceUploadMissionInput,
): Promise<AmazonInvoiceUploadPhaseOneResult> {
  const fullResult = await runAmazonInvoiceUpload(browser, { ...rawMission, requireHumanFinalSubmit: true });
  return {
    status: fullResult.status === "failed" ? "failed" : "review_required",
    reason: fullResult.reason,
    reachedStep: fullResult.reachedStep,
    phaseStatus: fullResult.status,
  };
}
