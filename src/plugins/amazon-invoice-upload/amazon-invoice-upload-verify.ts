import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import { taskResult, waitForState } from "./amazon-invoice-upload-flow-support.js";
import type { AmazonInvoiceUploadTaskResult } from "./amazon-invoice-upload.flow.js";
import type { AmazonInvoiceUploadMissionInput } from "./mission.schema.js";
import { recordAmazonDomStepTrace } from "./amazon-dom-step-trace.js";

const UPLOAD_SUCCESS_HINTS = [
  "invoice uploaded successfully",
  "file uploaded successfully",
  "upload completed",
  "submitted successfully",
  "上传成功",
  "感谢您上传文件",
  "客户可以直接从自己的账户下载文件",
  "管理发票",
  "上传其他发票或贷记单",
];
const UPLOAD_SUCCESS_TIMEOUT_MS = 15000;
const UPLOAD_SUCCESS_POLL_INTERVAL_MS = 250;

type VerifySuccessResult = Awaited<ReturnType<typeof waitForState>>;

export async function verifyUploadSuccess(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
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
  if (success.status !== "success") return buildUploadReviewResult(mission, success);
  const closeResult = await browser.closeActiveTab({
    reason: "Amazon invoice upload success verified",
  });
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "close uploaded order tab",
    status: closeResult.ok ? "success" : "review_required",
    reason: closeResult.ok ? "Active order tab closed." : closeResult.message,
  });
  if (!closeResult.ok) return buildCloseReviewResult(mission, success, closeResult.message);
  return buildUploadSuccessResult(mission, success, closeResult);
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
  closeResult: Awaited<ReturnType<BrowserController["closeActiveTab"]>>,
): AmazonInvoiceUploadTaskResult =>
  taskResult({
    status: "upload_success",
    reason: closeResult.ok
      ? "Amazon Seller Central shows invoice uploaded successfully; active order tab closed."
      : `Amazon Seller Central shows invoice uploaded successfully; active tab close needs review: ${closeResult.message}`,
    reachedStep: "upload success verified",
    amazonOrderId: mission.amazonOrderId,
    invoiceNo: mission.invoiceNo,
    evidenceRef: success.evidenceRef,
  });

const buildCloseReviewResult = (
  mission: AmazonInvoiceUploadMissionInput,
  success: VerifySuccessResult,
  closeMessage: string,
): AmazonInvoiceUploadTaskResult =>
  taskResult({
    status: "review_required",
    reason: `Amazon Seller Central shows invoice uploaded successfully, but active tab close needs review: ${closeMessage}`,
    reachedStep: "close uploaded order tab",
    amazonOrderId: mission.amazonOrderId,
    invoiceNo: mission.invoiceNo,
    evidenceRef: success.evidenceRef,
    reviewRequired: true,
  });
