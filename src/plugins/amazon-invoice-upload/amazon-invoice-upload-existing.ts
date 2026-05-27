import type { DomElementRef } from "../../types/dom-automation.js";
import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import type { AmazonInvoiceUploadTaskResult } from "./amazon-invoice-upload.flow.js";
import {
  clickLocated,
  evidenceField,
  readSnapshot,
  taskResult,
} from "./amazon-invoice-upload-flow-support.js";
import type { AmazonInvoiceUploadMissionInput } from "./mission.schema.js";
import { recordAmazonDomStepTrace } from "./amazon-dom-step-trace.js";
import {
  hasExistingInvoiceEvidence,
  locateManageInvoiceEntry,
} from "./amazon-existing-invoice-evidence.js";

type CloseAlreadyUploadedTabInput = {
  browser: BrowserController;
  runtimeLogger: RuntimeLogger;
  mission: AmazonInvoiceUploadMissionInput;
  reason: string;
  evidenceRef: string | undefined;
};

export async function verifyAlreadyUploadedInvoice(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<AmazonInvoiceUploadTaskResult | null> {
  const snapshot = await readSnapshot(browser);
  if (hasExistingInvoiceEvidence(snapshot, mission)) {
    traceAlreadyUploaded(runtimeLogger, mission, snapshot);
    return closeAlreadyUploadedTab({
      browser,
      runtimeLogger,
      mission,
      reason: "order detail already showed uploaded invoice state",
      evidenceRef: undefined,
    });
  }

  const manageEntry = await openManageInvoiceList(browser, runtimeLogger, mission, snapshot);
  if (manageEntry !== null) return manageEntry === "not-found" ? null : manageEntry;

  const evidenceRef = await waitForExistingInvoiceEvidence(browser, runtimeLogger, mission);
  return evidenceRef
    ? closeAlreadyUploadedTab({
      browser,
      runtimeLogger,
      mission,
      reason: "existing invoice verified from Amazon invoice list",
      evidenceRef,
    })
    : existingInvoiceNeedsReview(mission);
}

function traceAlreadyUploaded(
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  snapshot: Awaited<ReturnType<typeof readSnapshot>>,
): void {
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "verify already uploaded invoice",
    status: "success",
    snapshot,
    reason: "Order detail already exposed uploaded invoice evidence.",
  });
}

async function openManageInvoiceList(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  snapshot: Awaited<ReturnType<typeof readSnapshot>>,
): Promise<AmazonInvoiceUploadTaskResult | "not-found" | null> {
  const manageEntry = locateManageInvoiceEntry(snapshot);
  if (!manageEntry.ok) return "not-found";
  traceManageInvoiceEntry(runtimeLogger, mission, snapshot, manageEntry.element);
  const clickFailure = await clickLocated({
    browser,
    runtimeLogger,
    element: manageEntry.element,
    expectedKind: "manage-invoice-entry",
    reachedStep: "open existing invoice list",
    mission,
  });
  if (clickFailure) return clickFailure;
  traceManageInvoiceClick(runtimeLogger, mission, manageEntry.element);
  return null;
}

function traceManageInvoiceEntry(
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  snapshot: Awaited<ReturnType<typeof readSnapshot>>,
  element: DomElementRef,
): void {
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "locate manage invoice entry",
    status: "success",
    snapshot,
    selectedElement: element,
    reason: element.reason,
  });
}

function traceManageInvoiceClick(
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  element: DomElementRef,
): void {
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "click manage invoice entry",
    status: "success",
    selectedElement: element,
  });
}

function existingInvoiceNeedsReview(mission: AmazonInvoiceUploadMissionInput): AmazonInvoiceUploadTaskResult {
  return taskResult({
    status: "review_required",
    reason: "Amazon exposes a manage-invoice entry, but the invoice list did not confirm the expected invoice.",
    reachedStep: "verify existing invoice",
    amazonOrderId: mission.amazonOrderId,
    invoiceNo: mission.invoiceNo,
    reviewRequired: true,
  });
}

async function waitForExistingInvoiceEvidence(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<string | undefined> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 2500) {
    const snapshot = await readSnapshot(browser);
    if (hasExistingInvoiceEvidence(snapshot, mission)) {
      const evidenceRef = `amazon-existing-invoice:${mission.amazonOrderId}:${Date.now()}`;
      recordAmazonDomStepTrace({
        runtimeLogger,
        mission,
        stepName: "verify existing invoice",
        status: "success",
        snapshot,
        evidenceRef,
        reason: "Amazon invoice list confirmed the expected invoice.",
      });
      return evidenceRef;
    }
    await browser.wait(200);
  }
  return undefined;
}

async function closeAlreadyUploadedTab(input: CloseAlreadyUploadedTabInput): Promise<AmazonInvoiceUploadTaskResult> {
  const closeResult = await input.browser.closeActiveTab({
    reason: "Amazon invoice already uploaded state verified",
  });
  traceAlreadyUploadedClose(input.runtimeLogger, input.mission, closeResult, input.evidenceRef);
  if (!closeResult.ok) return alreadyUploadedCloseReview(input.mission, input.reason, closeResult.message, input.evidenceRef);
  return alreadyUploadedSuccess(input.mission, input.reason, input.evidenceRef);
}

function traceAlreadyUploadedClose(
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  closeResult: Awaited<ReturnType<BrowserController["closeActiveTab"]>>,
  evidenceRef: string | undefined,
): void {
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "close already uploaded order tab",
    status: closeResult.ok ? "success" : "review_required",
    reason: closeResult.ok ? "Active order tab closed." : closeResult.message,
    evidenceRef,
  });
}

function alreadyUploadedCloseReview(
  mission: AmazonInvoiceUploadMissionInput,
  reason: string,
  closeMessage: string,
  evidenceRef: string | undefined,
): AmazonInvoiceUploadTaskResult {
  return taskResult({
    status: "review_required",
    reason: `Amazon Seller Central shows this invoice is already uploaded; ${reason}; active tab close needs review: ${closeMessage}`,
    reachedStep: "close already uploaded order tab",
    amazonOrderId: mission.amazonOrderId,
    invoiceNo: mission.invoiceNo,
    ...evidenceField(evidenceRef),
    reviewRequired: true,
  });
}

function alreadyUploadedSuccess(
  mission: AmazonInvoiceUploadMissionInput,
  reason: string,
  evidenceRef: string | undefined,
): AmazonInvoiceUploadTaskResult {
  return taskResult({
    status: "upload_success",
    reason: `Amazon Seller Central shows this invoice is already uploaded; ${reason}; active order tab closed.`,
    reachedStep: "already uploaded verified",
    amazonOrderId: mission.amazonOrderId,
    invoiceNo: mission.invoiceNo,
    ...evidenceField(evidenceRef),
  });
}
