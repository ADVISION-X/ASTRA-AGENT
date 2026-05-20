import type { BrowserController } from "../../lib/browser/browser-controller.js";
import {
  readDomSnapshotOnce,
  type DomSnapshot,
} from "../../capabilities/dom-automation/index.js";
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
import { verifyUploadSuccess } from "./amazon-invoice-upload-verify.js";
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

const ENTRY_READY_TIMEOUT_MS = 10000;
const ENTRY_READY_POLL_INTERVAL_MS = 500;

export async function runAmazonInvoiceUpload(
  browser: BrowserController,
  rawMission: AmazonInvoiceUploadMissionInput,
): Promise<AmazonInvoiceUploadTaskResult> {
  const mission = AmazonInvoiceUploadMissionInputSchema.parse(rawMission);
  await browser.open({ url: mission.sellerCentralEntryUrl, title: "Amazon Seller Central invoice upload entry" });
  const entryReady = await waitForSellerCentralEntry(browser, mission);
  const gate = gatedResult(entryReady.snapshot, mission, "open seller central");
  if (gate) {
    return gate;
  }
  if (!entryReady.ready) {
    return taskResult({
      status: "review_required",
      reason: entryReady.reason,
      reachedStep: "wait for seller central order search",
      amazonOrderId: mission.amazonOrderId,
      invoiceNo: mission.invoiceNo,
      reviewRequired: true,
    });
  }

  const orderDetailResult = await openOrderDetail(browser, mission);
  if (!orderDetailResult.ok) return orderDetailResult.failure;

  const uploadEntryResult = await openUploadInvoiceEntry(browser, mission);
  if (!uploadEntryResult.ok) return uploadEntryResult.failure;

  return uploadAndSubmitInvoice(browser, mission);
}

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
    expectedText: "上传",
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
