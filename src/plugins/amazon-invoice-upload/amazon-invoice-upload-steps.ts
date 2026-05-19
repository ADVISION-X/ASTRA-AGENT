import type { DomElementRef } from "../../capabilities/dom-automation/index.js";
import {
  readDomSnapshotOnce,
  uploadApprovedFileOnce,
  waitForDomStateOnce,
} from "../../capabilities/dom-automation/index.js";
import type { BrowserController } from "../../lib/browser/browser-controller.js";
import { AMAZON_INVOICE_UPLOAD_DOM_HINTS } from "./amazon-dom-hints.js";
import {
  clickLocated,
  evidenceField,
  fillOrderSearch,
  locateFailureResult,
  locateOrStatus,
  taskResult,
} from "./amazon-invoice-upload-flow-support.js";
import type { AmazonInvoiceUploadMissionInput } from "./mission.schema.js";
import type { AmazonInvoiceUploadTaskResult } from "./amazon-invoice-upload.flow.js";

type StepResult<T> =
  | { ok: true; value: T }
  | { ok: false; failure: AmazonInvoiceUploadTaskResult };

const stepSuccess = <T>(value: T): StepResult<T> => ({ ok: true, value });

const stepFailure = <T>(failure: AmazonInvoiceUploadTaskResult): StepResult<T> => ({
  ok: false,
  failure,
});

export async function searchOrder(
  browser: BrowserController,
  mission: AmazonInvoiceUploadMissionInput,
  entrySnapshot: Awaited<ReturnType<typeof readDomSnapshotOnce>>,
): Promise<StepResult<void>> {
  const searchInput = locateOrStatus({
    snapshot: entrySnapshot,
    targetKind: "search-input",
    hints: [...AMAZON_INVOICE_UPLOAD_DOM_HINTS.orderSearch],
    notFoundStatus: "failed",
  });
  if (!searchInput.ok) {
    return stepFailure(locateFailureResult(mission, searchInput, "locate order search"));
  }
  const fillFailure = await fillOrderSearch(browser, searchInput.element, mission);
  if (fillFailure) return stepFailure(fillFailure);

  const searchButton = locateOrStatus({
    snapshot: await readDomSnapshotOnce(browser),
    targetKind: "button",
    hints: [...AMAZON_INVOICE_UPLOAD_DOM_HINTS.searchSubmit],
    notFoundStatus: "failed",
  });
  if (!searchButton.ok) {
    return stepFailure(locateFailureResult(mission, searchButton, "locate search submit"));
  }
  const clickFailure = await clickLocated({
    browser,
    element: searchButton.element,
    expectedKind: "search-submit",
    expectedText: "search",
    reachedStep: "submit order search",
    mission,
  });
  return clickFailure ? stepFailure(clickFailure) : stepSuccess(undefined);
}

export async function openOrderDetail(
  browser: BrowserController,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<StepResult<void>> {
  const orderRow = locateOrStatus({
    snapshot: await readDomSnapshotOnce(browser),
    targetKind: "order-row",
    hints: [...AMAZON_INVOICE_UPLOAD_DOM_HINTS.orderRow],
    requiredText: mission.amazonOrderId,
    notFoundStatus: "order_not_found",
  });
  if (!orderRow.ok) {
    return stepFailure(locateFailureResult(mission, orderRow, "locate exact order row"));
  }
  const clickFailure = await clickLocated({
    browser,
    element: orderRow.element,
    expectedKind: "order-row",
    expectedText: mission.amazonOrderId,
    reachedStep: "open order detail",
    mission,
  });
  return clickFailure ? stepFailure(clickFailure) : stepSuccess(undefined);
}

export async function openUploadInvoiceEntry(
  browser: BrowserController,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<StepResult<void>> {
  const uploadEntry = locateOrStatus({
    snapshot: await readDomSnapshotOnce(browser),
    targetKind: "upload-invoice-entry",
    hints: [...AMAZON_INVOICE_UPLOAD_DOM_HINTS.uploadInvoiceEntry],
    notFoundStatus: "upload_entry_not_found",
  });
  if (!uploadEntry.ok) {
    return stepFailure(locateFailureResult(mission, uploadEntry, "locate upload invoice entry"));
  }
  const clickFailure = await clickLocated({
    browser,
    element: uploadEntry.element,
    expectedKind: "upload-invoice-entry",
    reachedStep: "open upload invoice entry",
    mission,
  });
  return clickFailure ? stepFailure(clickFailure) : stepSuccess(undefined);
}

const locateFileInput = async (
  browser: BrowserController,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<StepResult<DomElementRef>> => {
  const fileInput = locateOrStatus({
    snapshot: await readDomSnapshotOnce(browser),
    targetKind: "file-input",
    hints: [...AMAZON_INVOICE_UPLOAD_DOM_HINTS.chooseFile],
    notFoundStatus: "file_input_not_found",
  });
  return fileInput.ok
    ? stepSuccess(fileInput.element)
    : stepFailure(locateFailureResult(mission, fileInput, "locate file input"));
};

const uploadApprovedPdf = async (
  browser: BrowserController,
  mission: AmazonInvoiceUploadMissionInput,
  fileInput: DomElementRef,
): Promise<StepResult<void>> => {
  const uploaded = await uploadApprovedFileOnce(browser, {
    elementRef: fileInput,
    approvedFilePath: mission.invoicePdfPath,
    approvedTaskFilePath: mission.invoicePdfPath,
    allowedExtensions: [".pdf"],
    uploadPurpose: "approved-pdf-upload",
  });
  if (uploaded.ok) return stepSuccess(undefined);
  return stepFailure(taskResult({
    status: "failed",
    reason: uploaded.reviewRequiredReason ?? uploaded.message,
    reachedStep: "upload approved PDF",
    amazonOrderId: mission.amazonOrderId,
    invoiceNo: mission.invoiceNo,
    ...evidenceField(uploaded.afterEvidenceRef ?? uploaded.beforeEvidenceRef),
    reviewRequired: uploaded.status === "review_required",
  }));
};

const waitForAttachedInvoice = async (
  browser: BrowserController,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<StepResult<string | undefined>> => {
  const attached = await waitForDomStateOnce(browser, {
    expectedStates: ["file-attached"],
    successHints: ["file attached", "invoice attached", mission.invoiceNo],
    failureHints: ["failed", "invalid file", "error"],
    timeoutMs: 3000,
    pollIntervalMs: 300,
  });
  if (attached.status === "success") return stepSuccess(attached.evidenceRef);
  return stepFailure(taskResult({
    status: "review_required",
    reason: attached.reason,
    reachedStep: "verify file attached",
    amazonOrderId: mission.amazonOrderId,
    invoiceNo: mission.invoiceNo,
    evidenceRef: attached.evidenceRef,
    reviewRequired: true,
  }));
};

export async function uploadApprovedInvoice(
  browser: BrowserController,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<StepResult<string | undefined>> {
  const fileInput = await locateFileInput(browser, mission);
  if (!fileInput.ok) return fileInput;

  const uploadResult = await uploadApprovedPdf(browser, mission, fileInput.value);
  if (!uploadResult.ok) return uploadResult;

  return waitForAttachedInvoice(browser, mission);
}

export const normalizeSubmitFailure = (
  failure: AmazonInvoiceUploadTaskResult,
): AmazonInvoiceUploadTaskResult => ({
  ...failure,
  status: failure.status === "failed" ? "submit_failed" : failure.status,
});

export async function verifyUploadSuccess(
  browser: BrowserController,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<AmazonInvoiceUploadTaskResult> {
  const success = await waitForDomStateOnce(browser, {
    expectedStates: ["upload-success"],
    successHints: ["invoice uploaded successfully", "upload completed", "submitted successfully"],
    failureHints: ["failed", "invalid", "error"],
    timeoutMs: 5000,
    pollIntervalMs: 500,
  });
  if (success.status !== "success") {
    return taskResult({
      status: "review_required",
      reason: success.reason,
      reachedStep: "verify upload success",
      amazonOrderId: mission.amazonOrderId,
      invoiceNo: mission.invoiceNo,
      evidenceRef: success.evidenceRef,
      reviewRequired: true,
    });
  }
  return taskResult({
    status: "upload_success",
    reason: "Amazon Seller Central shows invoice uploaded successfully.",
    reachedStep: "upload success verified",
    amazonOrderId: mission.amazonOrderId,
    invoiceNo: mission.invoiceNo,
    evidenceRef: success.evidenceRef,
  });
}