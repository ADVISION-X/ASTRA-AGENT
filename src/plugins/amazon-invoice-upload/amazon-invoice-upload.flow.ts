import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import {
  readDomSnapshotOnce,
} from "../../capabilities/dom-automation/index.js";
import type { DomElementRef, DomSnapshot } from "../../types/dom-automation.js";
import { AmazonInvoiceUploadMissionInputSchema } from "./mission.schema.js";
import type { AmazonInvoiceUploadMissionInput } from "./mission.schema.js";
import { AMAZON_INVOICE_UPLOAD_DOM_HINTS } from "./amazon-dom-hints.js";
import type { AmazonInvoiceUploadStatus } from "./amazon-result-detector.js";
import {
  normalizeSubmitFailure,
  openOrderDetail,
  openUploadInvoiceEntry,
  uploadApprovedInvoice,
} from "./amazon-invoice-upload-steps.js";
import { verifyAlreadyUploadedInvoice } from "./amazon-invoice-upload-existing.js";
import { verifyUploadSuccess } from "./amazon-invoice-upload-verify.js";
import {
  clickLocated,
  gatedResult,
  locateOrStatus,
  locateFailureResult,
  taskResult,
} from "./amazon-invoice-upload-flow-support.js";
import { recordAmazonDomStepTrace } from "./amazon-dom-step-trace.js";

export type AmazonInvoiceUploadTaskResult = {
  ok: boolean;
  status: AmazonInvoiceUploadStatus;
  reason: string;
  reachedStep: string;
  amazonOrderId: string;
  invoiceNo: string;
  evidenceRef?: string;
  domTraceRef?: string;
  reviewRequired?: boolean;
};

type LocateFailure = Extract<ReturnType<typeof locateOrStatus>, { ok: false }>;

const ENTRY_READY_TIMEOUT_MS = 10000;
const ENTRY_READY_POLL_INTERVAL_MS = 500;

export async function runAmazonInvoiceUpload(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  rawMission: AmazonInvoiceUploadMissionInput,
): Promise<AmazonInvoiceUploadTaskResult> {
  const mission = AmazonInvoiceUploadMissionInputSchema.parse(rawMission);
  const entryResult = await openSellerCentralEntry(browser, runtimeLogger, mission);
  if (entryResult) return entryResult;
  return continueInvoiceUpload(browser, runtimeLogger, mission);
}

async function continueInvoiceUpload(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<AmazonInvoiceUploadTaskResult> {
  const orderDetailResult = await openOrderDetail(browser, runtimeLogger, mission);
  if (!orderDetailResult.ok) return orderDetailResult.failure;

  const alreadyUploaded = await verifyAlreadyUploadedInvoice(browser, runtimeLogger, mission);
  if (alreadyUploaded) return alreadyUploaded;

  const uploadEntryResult = await openUploadInvoiceEntry(browser, runtimeLogger, mission);
  if (!uploadEntryResult.ok) return uploadEntryResult.failure;

  return uploadAndSubmitInvoice(browser, runtimeLogger, mission);
}

async function openSellerCentralEntry(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<AmazonInvoiceUploadTaskResult | null> {
  await browser.open({ url: mission.sellerCentralEntryUrl, title: "Amazon Seller Central invoice upload entry" });
  const entryReady = await waitForSellerCentralEntry(browser, mission);
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "wait seller central entry",
    status: entryReady.ready ? "success" : "failed",
    snapshot: entryReady.snapshot,
    reason: entryReady.ready ? "Seller Central entry is ready." : entryReady.reason,
  });
  const gate = gatedResult(entryReady.snapshot, mission, "open seller central");
  if (gate) return gate;
  return entryReady.ready ? null : sellerCentralEntryNotReadyResult(mission, entryReady.reason);
}

const sellerCentralEntryNotReadyResult = (
  mission: AmazonInvoiceUploadMissionInput,
  reason: string,
): AmazonInvoiceUploadTaskResult =>
  taskResult({
    status: "review_required",
    reason,
    reachedStep: "wait for seller central order search",
    amazonOrderId: mission.amazonOrderId,
    invoiceNo: mission.invoiceNo,
    reviewRequired: true,
  });

async function waitForSellerCentralEntry(
  browser: BrowserController,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<{ ready: true; snapshot: DomSnapshot } | { ready: false; snapshot: DomSnapshot; reason: string }> {
  const startedAt = Date.now();
  let lastSnapshot = await readDomSnapshotOnce(browser);
  while (Date.now() - startedAt <= ENTRY_READY_TIMEOUT_MS) {
    const gate = gatedResult(lastSnapshot, mission, "open seller central");
    if (gate) {
      return { ready: true, snapshot: lastSnapshot };
    }
    const searchInput = locateOrStatus({
      snapshot: lastSnapshot,
      targetKind: "search-input",
      hints: [...AMAZON_INVOICE_UPLOAD_DOM_HINTS.orderSearch],
      notFoundStatus: "failed",
    });
    if (searchInput.ok) {
      return { ready: true, snapshot: lastSnapshot };
    }
    await browser.wait(ENTRY_READY_POLL_INTERVAL_MS);
    lastSnapshot = await readDomSnapshotOnce(browser);
  }
  return {
    ready: false,
    snapshot: lastSnapshot,
    reason: "Seller Central order search did not become available before timeout.",
  };
}

async function uploadAndSubmitInvoice(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<AmazonInvoiceUploadTaskResult> {
  const uploadResult = await uploadApprovedInvoice(browser, runtimeLogger, mission);
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

  return submitAndVerifyInvoice(browser, runtimeLogger, mission);
}

async function submitAndVerifyInvoice(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<AmazonInvoiceUploadTaskResult> {
  const submitButton = locateOrStatus({
    snapshot: await readAndTraceSubmitSnapshot(browser, runtimeLogger, mission),
    targetKind: "button",
    hints: [...AMAZON_INVOICE_UPLOAD_DOM_HINTS.submit],
    notFoundStatus: "submit_failed",
  });
  if (!submitButton.ok) return submitButtonFailure(runtimeLogger, mission, submitButton);
  traceSubmitButtonLocated(runtimeLogger, mission, submitButton.element);
  const submitFailure = await clickSubmitButton(browser, runtimeLogger, mission, submitButton.element);
  if (submitFailure) return normalizeSubmitFailure(submitFailure);
  return verifyUploadSuccess(browser, runtimeLogger, mission);
}

function submitButtonFailure(
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  submitButton: LocateFailure,
): AmazonInvoiceUploadTaskResult {
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "locate submit button",
    status: "failed",
    reason: submitButton.reason,
  });
  return locateFailureResult(mission, submitButton, "locate submit button");
}

function traceSubmitButtonLocated(
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  element: DomElementRef,
): void {
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "locate submit button",
    status: "success",
    selectedElement: element,
    reason: element.reason,
  });
}

async function clickSubmitButton(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  element: DomElementRef,
): Promise<AmazonInvoiceUploadTaskResult | null> {
  const submitFailure = await clickLocated({
    browser,
    runtimeLogger,
    element,
    expectedKind: "submit-invoice-upload",
    reachedStep: "submit invoice upload",
    mission,
    expectedText: "上传",
  });
  if (submitFailure) return submitFailure;
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "click submit upload",
    status: "success",
    selectedElement: element,
  });
  return null;
}

async function readAndTraceSubmitSnapshot(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<DomSnapshot> {
  const snapshot = await readDomSnapshotOnce(browser);
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "locate submit button",
    status: "snapshot",
    snapshot,
  });
  return snapshot;
}

