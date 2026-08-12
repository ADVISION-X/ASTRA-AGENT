import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import type { ForensicsPersistenceAbilityGroup } from "../../capabilities/forensics-persistence/index.js";
import type { DomElementRef, DomSnapshot } from "../../types/dom-automation.js";
import { AmazonInvoiceUploadMissionInputSchema } from "./mission.schema.js";
import type { AmazonInvoiceUploadMissionInput } from "./mission.schema.js";
import type { AmazonInvoiceUploadStatus } from "./amazon-result-detector.js";
import {
  normalizeSubmitFailure,
  openOrderDetail,
  openUploadInvoiceEntry,
  uploadApprovedInvoice,
} from "./amazon-invoice-upload-steps.js";
import type { AmazonInvoiceAmountCheck } from "./amazon-invoice-upload-amount-check.js";
import { verifyInvoiceAmountBeforeUpload } from "./amazon-invoice-upload-amount-check.js";
import { verifyAlreadyUploadedInvoice } from "./amazon-invoice-upload-existing.js";
import { verifyUploadSuccess } from "./amazon-invoice-upload-verify.js";
import {
  clickLocated,
  locateOrStatus,
  locateFailureResult,
  readSnapshot,
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
  runtimeLogRef?: string;
  orderNavigationProof?: AmazonOrderNavigationProof;
  reviewRequired?: boolean;
  amountCheck?: AmazonInvoiceAmountCheck;
};

export type AmazonOrderNavigationProof = {
  executionId: string;
  taskId?: string;
  browserActionId: string;
  actionResult: "success" | "failed";
  requestedHost: string;
  reusePolicy: string;
  navigationMode: string;
  observedUrlMatchesRequest: boolean;
  beforeHash: string;
  afterHash: string;
  startedAt: string;
  durationMs: number;
  evidenceRef: string;
  storageRef: string;
  integrityHash: string;
};

export type AmazonInvoiceUploadExecutionContext = {
  executionId: string;
  taskId?: string;
  abortSignal: AbortSignal;
  evidenceStore: ForensicsPersistenceAbilityGroup;
  runtimeLogRef: string;
};

type LocateFailure = Extract<ReturnType<typeof locateOrStatus>, { ok: false }>;
type SubmitButtonLocateResult =
  | { ok: true; element: DomElementRef; expectedText: string }
  | LocateFailure;

const UPLOAD_STEP_RETRY_LIMIT = 2;
const UPLOAD_STEP_RETRY_SETTLE_MS = 500;

type UploadStepResult<T> = { ok: true; value: T } | { ok: false; failure: AmazonInvoiceUploadTaskResult };

export async function runAmazonInvoiceUpload(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  rawMission: AmazonInvoiceUploadMissionInput,
  execution: AmazonInvoiceUploadExecutionContext,
): Promise<AmazonInvoiceUploadTaskResult> {
  const mission = AmazonInvoiceUploadMissionInputSchema.parse(rawMission);
  return continueInvoiceUpload(browser, runtimeLogger, mission, execution);
}

async function continueInvoiceUpload(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  execution: AmazonInvoiceUploadExecutionContext,
): Promise<AmazonInvoiceUploadTaskResult> {
  const orderDetailResult = await openOrderDetail(browser, runtimeLogger, mission, execution);
  if (!orderDetailResult.ok) return orderDetailResult.failure;
  const navigationProof = orderDetailResult.value;

  const alreadyUploaded = await verifyAlreadyUploadedInvoice(browser, runtimeLogger, mission, execution.abortSignal);
  if (alreadyUploaded) return { ...alreadyUploaded, runtimeLogRef: execution.runtimeLogRef, orderNavigationProof: navigationProof };

  const amountGate = await verifyInvoiceAmountBeforeUpload(browser, runtimeLogger, mission);
  if (amountGate) return { ...amountGate, runtimeLogRef: execution.runtimeLogRef, orderNavigationProof: navigationProof };

  const uploadEntryResult = await runUploadStepWithRetries({
    browser,
    runtimeLogger,
    mission,
    stepName: "open upload invoice entry",
    action: () => openUploadInvoiceEntry(browser, runtimeLogger, mission),
  });
  if (!uploadEntryResult.ok) return { ...uploadEntryResult.failure, runtimeLogRef: execution.runtimeLogRef, orderNavigationProof: navigationProof };

  const result = await uploadAndSubmitInvoice(browser, runtimeLogger, mission, execution.abortSignal);
  return { ...result, runtimeLogRef: execution.runtimeLogRef, orderNavigationProof: navigationProof };
}

async function runUploadStepWithRetries<T>(input: {
  browser: BrowserController;
  runtimeLogger: RuntimeLogger;
  mission: AmazonInvoiceUploadMissionInput;
  stepName: string;
  action: () => Promise<UploadStepResult<T>>;
  attempt?: number;
}): Promise<UploadStepResult<T>> {
  const attempt = input.attempt ?? 0;
  const result = await input.action();
  if (result.ok || attempt >= UPLOAD_STEP_RETRY_LIMIT || !isRetryableUploadStepFailure(result.failure)) {
    return result;
  }
  const nextAttempt = attempt + 1;
  recordAmazonDomStepTrace({
    runtimeLogger: input.runtimeLogger,
    mission: input.mission,
    stepName: `${input.stepName} retry ${nextAttempt}`,
    status: "failed",
    reason: `Retrying transient upload step failure ${nextAttempt}/${UPLOAD_STEP_RETRY_LIMIT}: ${result.failure.status} ${result.failure.reason}`,
  });
  await input.browser.wait(UPLOAD_STEP_RETRY_SETTLE_MS);
  return runUploadStepWithRetries({ ...input, attempt: nextAttempt });
}

function isRetryableUploadStepFailure(failure: AmazonInvoiceUploadTaskResult): boolean {
  return failure.status !== "login_required"
    && failure.status !== "captcha_or_2fa_required"
    && failure.reachedStep !== "verify upload success";
}

async function uploadAndSubmitInvoice(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  abortSignal: AbortSignal,
): Promise<AmazonInvoiceUploadTaskResult> {
  const uploadResult = await runUploadStepWithRetries({
    browser,
    runtimeLogger,
    mission,
    stepName: "upload approved invoice",
    action: () => uploadApprovedInvoice(browser, runtimeLogger, mission),
  });
  if (!uploadResult.ok) return uploadResult.failure;
  return submitAndVerifyInvoice(browser, runtimeLogger, mission, abortSignal);
}

async function submitAndVerifyInvoice(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  abortSignal: AbortSignal,
): Promise<AmazonInvoiceUploadTaskResult> {
  const submitButton = locateSubmitButton(await readAndTraceSubmitSnapshot(browser, runtimeLogger, mission));
  if (!submitButton.ok) return submitButtonFailure(runtimeLogger, mission, submitButton);
  traceSubmitButtonLocated(runtimeLogger, mission, submitButton.element);
  const submitFailure = await clickSubmitButton(browser, runtimeLogger, mission, submitButton.element, submitButton.expectedText);
  if (submitFailure) return normalizeSubmitFailure(submitFailure);
  return verifyUploadSuccess(browser, runtimeLogger, mission, abortSignal);
}

function locateSubmitButton(snapshot: DomSnapshot): SubmitButtonLocateResult {
  const zhButton = locateOrStatus({
    snapshot,
    targetKind: "button",
    hints: ["上传"],
    requiredText: "上传",
    proximityAnchorText: "请上传您的发票或贷记单",
    notFoundStatus: "submit_failed",
  });
  if (zhButton.ok) return { ...zhButton, expectedText: "上传" };
  const enButton = locateOrStatus({
    snapshot,
    targetKind: "button",
    hints: ["Upload"],
    requiredText: "Upload",
    proximityAnchorText: "Please upload your invoice or credit note",
    notFoundStatus: "submit_failed",
  });
  return enButton.ok ? { ...enButton, expectedText: "Upload" } : enButton;
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
  expectedText: string,
): Promise<AmazonInvoiceUploadTaskResult | null> {
  const submitFailure = await clickLocated({
    browser,
    runtimeLogger,
    element,
    expectedKind: "submit-invoice-upload",
    reachedStep: "submit invoice upload",
    mission,
    expectedText,
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
  const snapshot = await readSnapshot(browser);
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "locate submit button",
    status: "snapshot",
    snapshot,
  });
  return snapshot;
}
