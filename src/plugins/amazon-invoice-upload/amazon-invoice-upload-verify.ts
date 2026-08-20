import type { BrowserTargetLease } from "../../lib/browser/browser-authority-api.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import {
  readSnapshot,
  taskResult,
} from "./amazon-invoice-upload-flow-support.js";
import type { AmazonInvoiceUploadTaskResult } from "./amazon-invoice-upload.flow.js";
import type { AmazonInvoiceUploadMissionInput } from "./mission.schema.js";
import { recordAmazonDomStepTrace } from "./amazon-dom-step-trace.js";
import { observeExistingInvoiceConfirmation } from "./amazon-existing-invoice-evidence.js";

const UPLOAD_SUCCESS_OBSERVATION_LIMIT = 40;
const UPLOAD_SUCCESS_POLL_INTERVAL_MS = 250;

type VerifySuccessResult = {
  status: "success" | "rejected" | "not_confirmed";
  reason: string;
  evidenceRef: string;
};

export async function verifyUploadSuccess(
  browser: BrowserTargetLease,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  abortSignal: AbortSignal,
): Promise<AmazonInvoiceUploadTaskResult> {
  const success = await waitForUploadSuccessBoundary(
    browser,
    mission,
    abortSignal,
  );
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "verify upload success",
    status: success.status === "success" ? "success" : "review_required",
    reason: success.reason,
    evidenceRef: success.evidenceRef,
  });
  if (success.status !== "success") {
    return buildUploadReviewResult(mission, success);
  }
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "retain uploaded order tab",
    status: "success",
    reason:
      "Active Seller Central order worker tab retained for next invoice navigation.",
  });
  return buildUploadSuccessResult(mission, success);
}

async function waitForUploadSuccessBoundary(
  browser: BrowserTargetLease,
  mission: AmazonInvoiceUploadMissionInput,
  abortSignal: AbortSignal,
): Promise<VerifySuccessResult> {
  for (
    let observation = 1;
    observation <= UPLOAD_SUCCESS_OBSERVATION_LIMIT;
    observation += 1
  ) {
    const snapshot = await readSnapshot(
      browser,
      { maxTextLengthPerNode: 240 },
      abortSignal,
    );
    const boundary = observeExistingInvoiceConfirmation(snapshot, mission);
    if (boundary.status === "confirmed") {
      return {
        status: "success",
        reason: boundary.reason,
        evidenceRef: await captureFinalBoundaryEvidence(
          browser,
          mission,
          observation,
          boundary.reason,
          abortSignal,
        ),
      };
    }
    if (boundary.status === "rejected") {
      return {
        status: "rejected",
        reason: boundary.reason,
        evidenceRef: await captureFinalBoundaryEvidence(
          browser,
          mission,
          observation,
          boundary.reason,
          abortSignal,
        ),
      };
    }
    if (observation < UPLOAD_SUCCESS_OBSERVATION_LIMIT) {
      await browser.wait(UPLOAD_SUCCESS_POLL_INTERVAL_MS, abortSignal);
    }
  }
  return {
    status: "not_confirmed",
    reason: `Amazon upload did not expose one unique current-order dialog and one unique expected invoice row without a failure state within ${UPLOAD_SUCCESS_OBSERVATION_LIMIT} bounded observations.`,
    evidenceRef: await captureFinalBoundaryEvidence(
      browser,
      mission,
      UPLOAD_SUCCESS_OBSERVATION_LIMIT,
      "bounded final receipt observations exhausted",
      abortSignal,
    ),
  };
}

async function captureFinalBoundaryEvidence(
  browser: BrowserTargetLease,
  mission: AmazonInvoiceUploadMissionInput,
  observation: number,
  reason: string,
  abortSignal: AbortSignal,
): Promise<string> {
  const capture = await browser.screenshotRegion({
    regionLabel: `amazon-final-receipt-${mission.amazonOrderId}`,
    contentLines: [
      `invoiceNo=${mission.invoiceNo}`,
      `observation=${observation}`,
      reason,
    ],
    captureProfile: "observation_lightweight",
    abortSignal,
  });
  return capture.sourceFilePath;
}

const buildUploadReviewResult = (
  mission: AmazonInvoiceUploadMissionInput,
  success: VerifySuccessResult,
): AmazonInvoiceUploadTaskResult =>
  taskResult({
    status: "review_required",
    reason: success.reason,
    reachedStep: "verify upload success",
    amazonOrderId: mission.amazonOrderId,
    invoiceNo: mission.invoiceNo,
    evidenceRef: success.evidenceRef,
    reviewRequired: true,
  });

const buildUploadSuccessResult = (
  mission: AmazonInvoiceUploadMissionInput,
  success: VerifySuccessResult,
): AmazonInvoiceUploadTaskResult =>
  taskResult({
    status: "upload_success",
    reason:
      "Amazon Seller Central shows invoice uploaded successfully; active order tab retained for next invoice navigation.",
    reachedStep: "upload success verified",
    amazonOrderId: mission.amazonOrderId,
    invoiceNo: mission.invoiceNo,
    evidenceRef: success.evidenceRef,
  });
