import type { DomElementRef } from "../../capabilities/dom-automation/index.js";
import {
  fillDomElementOnce,
  readDomSnapshotOnce,
  uploadApprovedFileOnce,
  waitForDomStateOnce,
} from "../../capabilities/dom-automation/index.js";
import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import { recordAmazonDomStepTrace } from "./amazon-dom-step-trace.js";
import { AMAZON_INVOICE_UPLOAD_DOM_HINTS } from "./amazon-dom-hints.js";
import {
  evidenceField,
  locateFailureResult,
  locateOrStatus,
  taskResult,
} from "./amazon-invoice-upload-flow-support.js";
import type { AmazonInvoiceUploadTaskResult } from "./amazon-invoice-upload.flow.js";
import type { AmazonInvoiceUploadMissionInput } from "./mission.schema.js";

type StepResult<T> = { ok: true; value: T } | { ok: false; failure: AmazonInvoiceUploadTaskResult };
type LocateFailure = Extract<ReturnType<typeof locateOrStatus>, { ok: false }>;

const FILE_INPUT_READY_TIMEOUT_MS = 10000;
const FILE_INPUT_READY_POLL_INTERVAL_MS = 250;

const stepSuccess = <T>(value: T): StepResult<T> => ({ ok: true, value });
const stepFailure = <T>(failure: AmazonInvoiceUploadTaskResult): StepResult<T> => ({ ok: false, failure });

export async function uploadApprovedInvoice(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<StepResult<string | undefined>> {
  const fileInput = await locateFileInput(browser, runtimeLogger, mission);
  if (!fileInput.ok) return fileInput;
  const uploadResult = await uploadApprovedPdf(browser, runtimeLogger, mission, fileInput.value);
  if (!uploadResult.ok) return uploadResult;
  const attached = await waitForAttachedInvoice(browser, runtimeLogger, mission);
  if (!attached.ok) return attached;
  const invoiceNumber = await fillInvoiceNumber(browser, runtimeLogger, mission);
  return invoiceNumber.ok ? attached : invoiceNumber;
}

const locateFileInput = async (
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<StepResult<DomElementRef>> => {
  const latest = await pollForFileInput(browser, runtimeLogger, mission);
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "locate file input",
    status: latest.fileInput.ok ? "success" : "failed",
    snapshot: latest.snapshot,
    ...(latest.fileInput.ok ? { selectedElement: latest.fileInput.element, reason: latest.fileInput.element.reason } : { reason: latest.fileInput.reason }),
  });
  return latest.fileInput.ok
    ? stepSuccess(latest.fileInput.element)
    : stepFailure(locateFailureResult(mission, latest.fileInput, "locate file input"));
};

async function pollForFileInput(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
) {
  const startedAt = Date.now();
  let snapshot = await readDomSnapshotOnce(browser);
  traceFileInputInitialSnapshot(runtimeLogger, mission, snapshot);
  let fileInput = locateInvoiceFileInput(snapshot);
  while (!fileInput.ok && Date.now() - startedAt < FILE_INPUT_READY_TIMEOUT_MS) {
    await browser.wait(FILE_INPUT_READY_POLL_INTERVAL_MS);
    snapshot = await readDomSnapshotOnce(browser);
    fileInput = locateInvoiceFileInput(snapshot);
  }
  return { snapshot, fileInput };
}

function locateInvoiceFileInput(snapshot: Awaited<ReturnType<typeof readDomSnapshotOnce>>): ReturnType<typeof locateOrStatus> {
  return locateOrStatus({
    snapshot,
    targetKind: "file-input",
    hints: [...AMAZON_INVOICE_UPLOAD_DOM_HINTS.chooseFile],
    notFoundStatus: "file_input_not_found",
  });
}

function traceFileInputInitialSnapshot(
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  snapshot: Awaited<ReturnType<typeof readDomSnapshotOnce>>,
): void {
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "locate file input initial",
    status: "snapshot",
    snapshot,
  });
}

const uploadApprovedPdf = async (
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
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
  traceUploadApprovedPdf(runtimeLogger, mission, fileInput, uploaded);
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

function traceUploadApprovedPdf(
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  fileInput: DomElementRef,
  uploaded: Awaited<ReturnType<typeof uploadApprovedFileOnce>>,
): void {
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "upload approved PDF",
    status: uploaded.ok ? "success" : uploaded.status === "review_required" ? "review_required" : "failed",
    selectedElement: fileInput,
    reason: uploaded.ok ? uploaded.message : uploaded.reviewRequiredReason ?? uploaded.message,
    evidenceRef: uploaded.afterEvidenceRef ?? uploaded.beforeEvidenceRef,
  });
}

const waitForAttachedInvoice = async (
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<StepResult<string | undefined>> => {
  const attached = await waitForDomStateOnce(browser, {
    expectedStates: ["file-selected"],
    successHints: ["file attached", "invoice attached", mission.invoiceNo],
    failureHints: ["failed", "invalid file", "error", "文件上传失败", "文件未上传"],
    timeoutMs: 1500,
    pollIntervalMs: 50,
  });
  traceAttachedInvoice(runtimeLogger, mission, attached);
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

function traceAttachedInvoice(
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  attached: Awaited<ReturnType<typeof waitForDomStateOnce>>,
): void {
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "verify file attached",
    status: attached.status === "success" ? "success" : "review_required",
    reason: attached.reason,
    evidenceRef: attached.evidenceRef,
  });
}

async function fillInvoiceNumber(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<StepResult<void>> {
  const invoiceNumber = locateOrStatus({
    snapshot: await readAndTraceInvoiceNumberSnapshot(browser, runtimeLogger, mission),
    targetKind: "text-input",
    hints: [...AMAZON_INVOICE_UPLOAD_DOM_HINTS.invoiceNumber],
    notFoundStatus: "review_required",
  });
  if (!invoiceNumber.ok) return invoiceNumberFailure(runtimeLogger, mission, invoiceNumber);
  traceInvoiceNumberLocated(runtimeLogger, mission, invoiceNumber.element);
  const filled = await fillDomElementOnce(browser, {
    elementRef: invoiceNumber.element,
    approvedText: mission.invoiceNo,
    clearBeforeType: true,
    inputPurpose: "approved-form-text",
  });
  return buildInvoiceNumberFillResult(runtimeLogger, mission, invoiceNumber.element, filled);
}

async function readAndTraceInvoiceNumberSnapshot(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<Awaited<ReturnType<typeof readDomSnapshotOnce>>> {
  const snapshot = await readDomSnapshotOnce(browser);
  recordAmazonDomStepTrace({ runtimeLogger, mission, stepName: "locate invoice number input", status: "snapshot", snapshot });
  return snapshot;
}

function invoiceNumberFailure(
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  invoiceNumber: LocateFailure,
): StepResult<void> {
  recordAmazonDomStepTrace({ runtimeLogger, mission, stepName: "locate invoice number input", status: "failed", reason: invoiceNumber.reason });
  return stepFailure(locateFailureResult(mission, invoiceNumber, "locate invoice number input"));
}

function traceInvoiceNumberLocated(
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  element: DomElementRef,
): void {
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "locate invoice number input",
    status: "success",
    selectedElement: element,
    reason: element.reason,
  });
}

function buildInvoiceNumberFillResult(
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  element: DomElementRef,
  filled: Awaited<ReturnType<typeof fillDomElementOnce>>,
): StepResult<void> {
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "fill invoice number",
    status: filled.ok ? "success" : filled.status === "review_required" ? "review_required" : "failed",
    selectedElement: element,
    reason: filled.ok ? filled.message : filled.reviewRequiredReason ?? filled.message,
    evidenceRef: filled.afterEvidenceRef ?? filled.beforeEvidenceRef,
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
