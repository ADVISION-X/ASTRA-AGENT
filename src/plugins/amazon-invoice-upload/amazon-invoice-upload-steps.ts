import type { DomElementRef } from "../../types/dom-automation.js";
import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import { AMAZON_INVOICE_UPLOAD_DOM_HINTS } from "./amazon-dom-hints.js";
import {
  clickLocated,
  locateFailureResult,
  locateOrStatus,
  readSnapshot,
  taskResult,
} from "./amazon-invoice-upload-flow-support.js";
import type { AmazonInvoiceUploadMissionInput } from "./mission.schema.js";
import type { AmazonInvoiceUploadExecutionContext, AmazonInvoiceUploadTaskResult, AmazonOrderNavigationProof } from "./amazon-invoice-upload.flow.js";
import { openApprovedOrderDetail } from "./amazon-invoice-upload-order-detail.js";
import { recordAmazonDomStepTrace } from "./amazon-dom-step-trace.js";
export { uploadApprovedInvoice } from "./amazon-invoice-upload-file-attachment.js";
type StepResult<T> = { ok: true; value: T } | { ok: false; failure: AmazonInvoiceUploadTaskResult };
type LocateFailure = Extract<ReturnType<typeof locateOrStatus>, { ok: false }>;
const UPLOAD_DIALOG_NOT_READY_REASON =
  "Upload invoice entry was clicked, but the upload dialog did not expose a file upload control";
const UPLOAD_DIALOG_READY_TIMEOUT_MS = 2_000;
const UPLOAD_DIALOG_READY_POLL_INTERVAL_MS = 250;

const stepSuccess = <T>(value: T): StepResult<T> => ({ ok: true, value });

const stepFailure = <T>(failure: AmazonInvoiceUploadTaskResult): StepResult<T> => ({
  ok: false,
  failure,
});

export async function openOrderDetail(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  execution: AmazonInvoiceUploadExecutionContext,
): Promise<StepResult<AmazonOrderNavigationProof>> {
  const detail = await openApprovedOrderDetail(browser, runtimeLogger, mission, execution);
  return detail.ok ? stepSuccess(detail.proof) : stepFailure(detail.failure);
}

export async function openUploadInvoiceEntry(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<StepResult<void>> {
  await browser.wait(50);
  const snapshot = await readSnapshot(browser);
  traceUploadInvoiceEntrySnapshot(runtimeLogger, mission, snapshot);
  const uploadEntry = locateUploadInvoiceButton(snapshot);
  if (!uploadEntry.ok) return uploadInvoiceEntryFailure(runtimeLogger, mission, snapshot, uploadEntry);
  traceUploadInvoiceEntryLocated(runtimeLogger, mission, snapshot, uploadEntry.element);
  const clickFailure = await clickUploadInvoiceEntry(browser, runtimeLogger, mission, uploadEntry.element);
  if (clickFailure) return stepFailure(clickFailure);
  const modalReady = await waitForUploadDialog(browser, runtimeLogger, mission);
  return modalReady ? stepSuccess(undefined) : uploadDialogNotReady(mission);
}

function traceUploadInvoiceEntrySnapshot(
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  snapshot: Awaited<ReturnType<typeof readSnapshot>>,
): void {
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "locate upload invoice entry",
    status: "snapshot",
    snapshot,
  });
}

function uploadInvoiceEntryFailure(
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  snapshot: Awaited<ReturnType<typeof readSnapshot>>,
  uploadEntry: LocateFailure,
): StepResult<void> {
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "locate upload invoice entry",
    status: "failed",
    snapshot,
    reason: uploadEntry.reason,
  });
  return stepFailure(locateFailureResult(mission, uploadEntry, "locate upload invoice entry"));
}

function traceUploadInvoiceEntryLocated(
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  snapshot: Awaited<ReturnType<typeof readSnapshot>>,
  element: DomElementRef,
): void {
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "locate upload invoice entry",
    status: "success",
    snapshot,
    selectedElement: element,
    reason: element.reason,
  });
}

async function clickUploadInvoiceEntry(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  element: DomElementRef,
): Promise<AmazonInvoiceUploadTaskResult | null> {
  const clickFailure = await clickLocated({
    browser,
    runtimeLogger,
    element,
    expectedKind: "upload-invoice-entry",
    reachedStep: "open upload invoice entry",
    mission,
  });
  if (clickFailure) return clickFailure;
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "click upload invoice entry",
    status: "success",
    selectedElement: element,
  });
  return null;
}

function uploadDialogNotReady(mission: AmazonInvoiceUploadMissionInput): StepResult<void> {
  return stepFailure(taskResult({
    status: "upload_entry_not_found",
    reason: `${UPLOAD_DIALOG_NOT_READY_REASON} within ${UPLOAD_DIALOG_READY_TIMEOUT_MS}ms.`,
    reachedStep: "open upload invoice entry",
    amazonOrderId: mission.amazonOrderId,
    invoiceNo: mission.invoiceNo,
    reviewRequired: true,
  }));
}

function locateUploadInvoiceButton(snapshot: Awaited<ReturnType<typeof readSnapshot>>): ReturnType<typeof locateOrStatus> {
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
    targetKind: "clickable",
    hints: [...AMAZON_INVOICE_UPLOAD_DOM_HINTS.uploadInvoiceEntry],
    notFoundStatus: "upload_entry_not_found",
  });
}

async function waitForUploadDialog(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<boolean> {
  const startedAt = Date.now();
  let lastSnapshot: Awaited<ReturnType<typeof readSnapshot>> | null = null;
  while (Date.now() - startedAt < UPLOAD_DIALOG_READY_TIMEOUT_MS) {
    const snapshot = await readSnapshot(browser);
    lastSnapshot = snapshot;
    if (snapshot.fileInputs.length > 0 || snapshotHasUploadDialogCopy(snapshot)) {
      recordAmazonDomStepTrace({
        runtimeLogger,
        mission,
        stepName: "wait upload dialog",
        status: "success",
        snapshot,
        reason: "Upload dialog exposed upload copy or file input.",
      });
      return true;
    }
    await browser.wait(UPLOAD_DIALOG_READY_POLL_INTERVAL_MS);
  }
  if (lastSnapshot) {
    recordAmazonDomStepTrace({
      runtimeLogger,
      mission,
      stepName: "wait upload dialog",
      status: "failed",
      snapshot: lastSnapshot,
      reason: UPLOAD_DIALOG_NOT_READY_REASON,
    });
  }
  return false;
}

function snapshotHasUploadDialogCopy(snapshot: Awaited<ReturnType<typeof readSnapshot>>): boolean {
  const dialogText = [
    ...snapshot.dialogs,
    ...snapshot.textBlocks,
    ...snapshot.buttons,
    ...snapshot.genericClickableElements,
  ].map((item) =>
    `${item.visibleText ?? ""} ${item.ariaLabel ?? ""} ${item.nearbyText ?? ""}`,
  ).join(" ").toLowerCase();
  return ["请上传", "请上传您的发票或贷记单", "choose file", "select file", "please upload your invoice or credit note", "select file type", "upload invoice", "invoice file"].some((hint) =>
    dialogText.includes(hint));
}

export const normalizeSubmitFailure = (
  failure: AmazonInvoiceUploadTaskResult,
): AmazonInvoiceUploadTaskResult => ({
  ...failure,
  status: failure.status === "failed" ? "submit_failed" : failure.status,
});
