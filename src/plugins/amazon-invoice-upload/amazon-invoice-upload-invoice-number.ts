import type { DomElementRef } from "../../types/dom-automation.js";
import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import { recordAmazonDomStepTrace } from "./amazon-dom-step-trace.js";
import { AMAZON_INVOICE_UPLOAD_DOM_HINTS } from "./amazon-dom-hints.js";
import {
  evidenceField,
  fillElement,
  locateFailureResult,
  locateOrStatus,
  readSnapshot,
  taskResult,
} from "./amazon-invoice-upload-flow-support.js";
import type { AmazonInvoiceUploadTaskResult } from "./amazon-invoice-upload.flow.js";
import type { AmazonInvoiceUploadMissionInput } from "./mission.schema.js";

type StepResult<T> = { ok: true; value: T } | { ok: false; failure: AmazonInvoiceUploadTaskResult };
type LocateFailure = Extract<ReturnType<typeof locateOrStatus>, { ok: false }>;

const stepSuccess = <T>(value: T): StepResult<T> => ({ ok: true, value });
const stepFailure = <T>(failure: AmazonInvoiceUploadTaskResult): StepResult<T> => ({ ok: false, failure });

export async function fillInvoiceNumber(
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
  const filled = await fillElement(browser, {
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
): Promise<Awaited<ReturnType<typeof readSnapshot>>> {
  const snapshot = await readSnapshot(browser);
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
  filled: Awaited<ReturnType<typeof fillElement>>,
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