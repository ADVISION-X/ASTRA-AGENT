import type { DomElementRef } from "../../capabilities/dom-automation/index.js";
import {
  fillDomElementOnce,
  readDomSnapshotOnce,
  uploadApprovedFileOnce,
  waitForDomStateOnce,
} from "../../capabilities/dom-automation/index.js";
import type { BrowserController } from "../../lib/browser/browser-controller.js";
import { AMAZON_INVOICE_UPLOAD_DOM_HINTS } from "./amazon-dom-hints.js";
import {
  clickLocated,
  evidenceField,
  locateFailureResult,
  locateOrStatus,
  taskResult,
} from "./amazon-invoice-upload-flow-support.js";
import type { AmazonInvoiceUploadMissionInput } from "./mission.schema.js";
import type { AmazonInvoiceUploadTaskResult } from "./amazon-invoice-upload.flow.js";
import { openApprovedOrderDetail } from "./amazon-invoice-upload-order-detail.js";
type StepResult<T> = { ok: true; value: T } | { ok: false; failure: AmazonInvoiceUploadTaskResult };

const stepSuccess = <T>(value: T): StepResult<T> => ({ ok: true, value });

const stepFailure = <T>(failure: AmazonInvoiceUploadTaskResult): StepResult<T> => ({
  ok: false,
  failure,
});

export async function openOrderDetail(
  browser: BrowserController,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<StepResult<void>> {
  const detailFailure = await openApprovedOrderDetail(browser, mission);
  return detailFailure ? stepFailure(detailFailure) : stepSuccess(undefined);
}

export async function openUploadInvoiceEntry(
  browser: BrowserController,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<StepResult<void>> {
  await browser.wait(50);
  const snapshot = await readDomSnapshotOnce(browser);
  const uploadEntry = locateUploadInvoiceButton(snapshot);
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
  if (clickFailure) return stepFailure(clickFailure);
  const modalReady = await waitForUploadDialog(browser);
  if (modalReady) return stepSuccess(undefined);
  return stepFailure(taskResult({
    status: "upload_entry_not_found",
    reason: "Upload invoice entry was clicked, but the upload dialog did not expose a file upload control.",
    reachedStep: "open upload invoice entry",
    amazonOrderId: mission.amazonOrderId,
    invoiceNo: mission.invoiceNo,
    reviewRequired: true,
  }));
}

function locateUploadInvoiceButton(snapshot: Awaited<ReturnType<typeof readDomSnapshotOnce>>): ReturnType<typeof locateOrStatus> {
  const zhButton = locateOrStatus({
    snapshot,
    targetKind: "button",
    hints: ["上传发票"],
    requiredText: "上传发票",
    notFoundStatus: "upload_entry_not_found",
  });
  if (zhButton.ok) return zhButton;
  const enButton = locateOrStatus({
    snapshot,
    targetKind: "button",
    hints: ["upload invoice"],
    requiredText: "upload invoice",
    notFoundStatus: "upload_entry_not_found",
  });
  if (enButton.ok) return enButton;
  return locateOrStatus({
    snapshot,
    targetKind: "upload-invoice-entry",
    hints: [...AMAZON_INVOICE_UPLOAD_DOM_HINTS.uploadInvoiceEntry],
    notFoundStatus: "upload_entry_not_found",
  });
}

async function waitForUploadDialog(browser: BrowserController): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 2500) {
    const snapshot = await readDomSnapshotOnce(browser);
    if (snapshot.fileInputs.length > 0 || snapshot.textBlocks.some((item) => String(item.visibleText ?? "").includes("请上传"))) {
      return true;
    }
    await browser.wait(50);
  }
  return false;
}

const locateFileInput = async (
  browser: BrowserController,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<StepResult<DomElementRef>> => {
  const startedAt = Date.now();
  let fileInput = locateOrStatus({
    snapshot: await readDomSnapshotOnce(browser),
    targetKind: "file-input",
    hints: [...AMAZON_INVOICE_UPLOAD_DOM_HINTS.chooseFile],
    notFoundStatus: "file_input_not_found",
  });
  while (!fileInput.ok && Date.now() - startedAt < 3000) {
    await browser.wait(50);
    fileInput = locateOrStatus({
      snapshot: await readDomSnapshotOnce(browser),
      targetKind: "file-input",
      hints: [...AMAZON_INVOICE_UPLOAD_DOM_HINTS.chooseFile],
      notFoundStatus: "file_input_not_found",
    });
  }
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
    failureHints: ["failed", "invalid file", "error", "文件上传失败", "文件未上传"],
    timeoutMs: 1500,
    pollIntervalMs: 50,
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

  const attached = await waitForAttachedInvoice(browser, mission);
  if (!attached.ok) return attached;

  const invoiceNumber = await fillInvoiceNumber(browser, mission);
  if (!invoiceNumber.ok) return invoiceNumber;

  return attached;
}

async function fillInvoiceNumber(
  browser: BrowserController,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<StepResult<void>> {
  const invoiceNumber = locateOrStatus({
    snapshot: await readDomSnapshotOnce(browser),
    targetKind: "invoice-number",
    hints: [...AMAZON_INVOICE_UPLOAD_DOM_HINTS.invoiceNumber],
    notFoundStatus: "review_required",
  });
  if (!invoiceNumber.ok) {
    return stepFailure(locateFailureResult(mission, invoiceNumber, "locate invoice number input"));
  }
  const filled = await fillDomElementOnce(browser, {
    elementRef: invoiceNumber.element,
    approvedText: mission.invoiceNo,
    clearBeforeType: true,
    inputPurpose: "invoice-number",
  });
  if (filled.ok) return stepSuccess(undefined);
  return stepFailure(taskResult({
    status: "failed",
    reason: filled.reviewRequiredReason ?? filled.message,
    reachedStep: "fill invoice number",
    amazonOrderId: mission.amazonOrderId,
    invoiceNo: mission.invoiceNo,
    ...evidenceField(filled.afterEvidenceRef ?? filled.beforeEvidenceRef),
  }));
}

export const normalizeSubmitFailure = (
  failure: AmazonInvoiceUploadTaskResult,
): AmazonInvoiceUploadTaskResult => ({
  ...failure,
  status: failure.status === "failed" ? "submit_failed" : failure.status,
});
