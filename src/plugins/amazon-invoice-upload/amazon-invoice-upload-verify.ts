import type { BrowserTargetSession } from "../../lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import { taskResult, waitForState } from "./amazon-invoice-upload-flow-support.js";
import type { AmazonInvoiceUploadTaskResult } from "./amazon-invoice-upload.flow.js";
import type { AmazonInvoiceUploadMissionInput } from "./mission.schema.js";
import { recordAmazonDomStepTrace } from "./amazon-dom-step-trace.js";
import { verifyAlreadyUploadedInvoice } from "./amazon-invoice-upload-existing.js";

const UPLOAD_SUCCESS_HINTS = [
  "invoice uploaded successfully",
  "file uploaded successfully",
  "upload completed",
  "submitted successfully",
  "Thank you for uploading the file",
  "Thank you for uploading the document",
  "The customer can download the file directly from their account",
  "The customer will be able to download it directly from their account",
  "Upload another invoice or credit note",
  "上传成功",
  "感谢您上传文件",
  "客户可以直接从自己的账户下载文件",
  "上传其他发票或贷记单",
];
const UPLOAD_SUCCESS_TIMEOUT_MS = 2_000;
const UPLOAD_SUCCESS_POLL_INTERVAL_MS = 250;

type VerifySuccessResult = Awaited<ReturnType<typeof waitForState>>;

export async function verifyUploadSuccess(
  browser: BrowserTargetSession,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  abortSignal: AbortSignal,
): Promise<AmazonInvoiceUploadTaskResult> {
  const success = await waitForState(browser, {
    expectedStates: ["success-message"],
    successHints: UPLOAD_SUCCESS_HINTS,
    failureHints: ["failed", "invalid", "error", "文件上传失败", "无法上传"],
    timeoutMs: UPLOAD_SUCCESS_TIMEOUT_MS,
    pollIntervalMs: UPLOAD_SUCCESS_POLL_INTERVAL_MS,
  });
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "verify upload success",
    status: success.status === "success" ? "success" : "review_required",
    reason: success.reason,
    evidenceRef: success.evidenceRef,
  });
  if (success.status !== "success") {
    const existing = await verifyAlreadyUploadedInvoice(browser, runtimeLogger, mission, abortSignal);
    if (existing?.status === "already_uploaded") return existing;
    return buildUploadReviewResult(mission, success);
  }
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "retain uploaded order tab",
    status: "success",
    reason: "Active Seller Central order worker tab retained for next invoice navigation.",
  });
  return buildUploadSuccessResult(mission, success);
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
    reason: "Amazon Seller Central shows invoice uploaded successfully; active order tab retained for next invoice navigation.",
    reachedStep: "upload success verified",
    amazonOrderId: mission.amazonOrderId,
    invoiceNo: mission.invoiceNo,
    evidenceRef: success.evidenceRef,
  });
