import { basename } from "node:path";

import type { DomElementRef } from "../../types/dom-automation.js";
import type { BrowserTargetLease } from "../../lib/browser/browser-authority-api.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import { recordAmazonDomStepTrace } from "./amazon-dom-step-trace.js";
import { AMAZON_INVOICE_UPLOAD_DOM_HINTS } from "./amazon-dom-hints.js";
import {
  evidenceField,
  locateFailureResult,
  locateOrStatus,
  readSnapshot,
  taskResult,
  uploadFile,
} from "./amazon-invoice-upload-flow-support.js";
import type { AmazonInvoiceUploadTaskResult } from "./amazon-invoice-upload.flow.js";
import type { AmazonInvoiceUploadMissionInput } from "./mission.schema.js";
import { fillInvoiceNumber } from "./amazon-invoice-upload-invoice-number.js";

type StepResult<T> =
  | { ok: true; value: T }
  | { ok: false; failure: AmazonInvoiceUploadTaskResult };

const FILE_INPUT_READY_TIMEOUT_MS = 2_000;
const FILE_INPUT_READY_POLL_INTERVAL_MS = 250;
const FILE_ITEM_READY_OBSERVATION_LIMIT = 9;
const AMAZON_READY_FILE_ITEM_TAG = "kat-file-item";
const AMAZON_READY_FILE_STATUS_ATTRIBUTE = "file-status";
const AMAZON_READY_FILE_STATUS = "ready";
const AMAZON_TERMINAL_FILE_STATUSES = [
  "error",
  "failed",
  "rejected",
  "invalid",
] as const;

type AmazonFileItemObservation =
  | { status: "confirmed"; message: string }
  | { status: "rejected"; message: string }
  | { status: "pending"; message: string };

const stepSuccess = <T>(value: T): StepResult<T> => ({ ok: true, value });
const stepFailure = <T>(
  failure: AmazonInvoiceUploadTaskResult,
): StepResult<T> => ({ ok: false, failure });

export async function uploadApprovedInvoice(
  browser: BrowserTargetLease,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<StepResult<string | undefined>> {
  const fileInput = await locateFileInput(browser, runtimeLogger, mission);
  if (!fileInput.ok) return fileInput;
  const attached = await uploadApprovedPdf(
    browser,
    runtimeLogger,
    mission,
    fileInput.value,
  );
  if (!attached.ok) return attached;
  const invoiceNumber = await fillInvoiceNumber(
    browser,
    runtimeLogger,
    mission,
  );
  return invoiceNumber.ok ? attached : invoiceNumber;
}

const locateFileInput = async (
  browser: BrowserTargetLease,
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
    ...(latest.fileInput.ok
      ? {
          selectedElement: latest.fileInput.element,
          reason: latest.fileInput.element.reason,
        }
      : { reason: latest.fileInput.reason }),
  });
  return latest.fileInput.ok
    ? stepSuccess(latest.fileInput.element)
    : stepFailure(
        locateFailureResult(mission, latest.fileInput, "locate file input"),
      );
};

async function pollForFileInput(
  browser: BrowserTargetLease,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
) {
  const startedAt = Date.now();
  let snapshot = await readSnapshot(browser);
  traceFileInputInitialSnapshot(runtimeLogger, mission, snapshot);
  let fileInput = locateInvoiceFileInput(snapshot);
  while (
    !fileInput.ok &&
    Date.now() - startedAt < FILE_INPUT_READY_TIMEOUT_MS
  ) {
    await browser.wait(FILE_INPUT_READY_POLL_INTERVAL_MS);
    snapshot = await readSnapshot(browser);
    fileInput = locateInvoiceFileInput(snapshot);
  }
  return { snapshot, fileInput };
}

function locateInvoiceFileInput(
  snapshot: Awaited<ReturnType<typeof readSnapshot>>,
): ReturnType<typeof locateOrStatus> {
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
  snapshot: Awaited<ReturnType<typeof readSnapshot>>,
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
  browser: BrowserTargetLease,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  fileInput: DomElementRef,
): Promise<StepResult<string | undefined>> => {
  const uploaded = await uploadFile(browser, {
    elementRef: fileInput,
    approvedFilePath: mission.invoicePdfPath,
    approvedTaskFilePath: mission.invoicePdfPath,
    allowedExtensions: [".pdf"],
    uploadPurpose: "approved-pdf-upload",
  });
  traceUploadApprovedPdf(runtimeLogger, mission, fileInput, uploaded);
  if (uploaded.ok) {
    const attachment = await waitForAmazonReadyFileItem(
      browser,
      basename(mission.invoicePdfPath),
    );
    if (attachment.status !== "confirmed") {
      recordAmazonDomStepTrace({
        runtimeLogger,
        mission,
        stepName: "verify file attached",
        status: "review_required",
        selectedElement: fileInput,
        reason: attachment.message,
        evidenceRef: uploaded.afterEvidenceRef,
      });
      return stepFailure(
        taskResult({
          status: "failed",
          reason: attachment.message,
          reachedStep: "verify file attached",
          amazonOrderId: mission.amazonOrderId,
          invoiceNo: mission.invoiceNo,
          ...evidenceField(
            uploaded.afterEvidenceRef ?? uploaded.beforeEvidenceRef,
          ),
          reviewRequired: true,
        }),
      );
    }
    recordAmazonDomStepTrace({
      runtimeLogger,
      mission,
      stepName: "verify file attached",
      status: "success",
      selectedElement: fileInput,
      reason: attachment.message,
      evidenceRef: uploaded.afterEvidenceRef,
    });
    return stepSuccess(uploaded.afterEvidenceRef);
  }
  return stepFailure(
    taskResult({
      status: "failed",
      reason: uploaded.reviewRequiredReason ?? uploaded.message,
      reachedStep: "upload approved PDF",
      amazonOrderId: mission.amazonOrderId,
      invoiceNo: mission.invoiceNo,
      ...evidenceField(uploaded.afterEvidenceRef ?? uploaded.beforeEvidenceRef),
      reviewRequired: uploaded.status === "review_required",
    }),
  );
};

async function waitForAmazonReadyFileItem(
  browser: BrowserTargetLease,
  approvedFileName: string,
): Promise<AmazonFileItemObservation> {
  for (
    let attempt = 1;
    attempt <= FILE_ITEM_READY_OBSERVATION_LIMIT;
    attempt += 1
  ) {
    const observation = await observeAmazonReadyFileItem(
      browser,
      approvedFileName,
    );
    if (observation.status !== "pending") return observation;
    if (attempt < FILE_ITEM_READY_OBSERVATION_LIMIT) {
      await browser.wait(FILE_INPUT_READY_POLL_INTERVAL_MS);
    }
  }
  return {
    status: "pending",
    message: `Amazon file attachment did not reach one unique same-name ready item within ${FILE_ITEM_READY_OBSERVATION_LIMIT} bounded observations.`,
  };
}

const observeAmazonReadyFileItem = (
  browser: BrowserTargetLease,
  approvedFileName: string,
): Promise<AmazonFileItemObservation> =>
  browser.evaluate<AmazonFileItemObservation>({
    description:
      "observe exact Amazon ready file item after approved PDF selection",
    script: `
const approvedFileName = ${JSON.stringify(approvedFileName)};
const fileItemTag = ${JSON.stringify(AMAZON_READY_FILE_ITEM_TAG)};
const fileStatusAttribute = ${JSON.stringify(AMAZON_READY_FILE_STATUS_ATTRIBUTE)};
const readyFileStatus = ${JSON.stringify(AMAZON_READY_FILE_STATUS)};
const terminalFailureStatuses = new Set(${JSON.stringify(AMAZON_TERMINAL_FILE_STATUSES)});
const uploadHosts = Array.from(document.querySelectorAll("kat-file-upload[name='document']"));
if (uploadHosts.length > 1) return {status: "rejected", message: "Amazon page exposed multiple invoice file upload components"};
if (uploadHosts.length === 0) return {status: "pending", message: "Amazon invoice file upload component is not visible yet"};
const root = uploadHosts[0].shadowRoot;
if (!root) return {status: "rejected", message: "Amazon file upload component has no open author shadow root"};
const items = Array.from(root.querySelectorAll(fileItemTag));
if (items.length > 1) return {status: "rejected", message: "Amazon file upload component exposed duplicate or foreign file items"};
if (items.length === 0) return {status: "pending", message: "Amazon file upload component has not exposed the selected file item yet"};
const item = items[0];
const observedName = item.getAttribute("name") || "";
const observedStatus = (item.getAttribute(fileStatusAttribute) || "").toLowerCase();
if (observedName !== approvedFileName) return {status: "rejected", message: "Amazon file upload component exposed a foreign file item"};
if (terminalFailureStatuses.has(observedStatus)) return {status: "rejected", message: "Amazon file upload component exposed a terminal file failure state"};
if (observedStatus !== readyFileStatus) return {status: "pending", message: "Amazon selected file item has not reached ready state yet"};
return {status: "confirmed", message: "Confirmed one Amazon upload component and one same-name ready item, excluding duplicates, foreign files and terminal failure states"};
`,
  });

function traceUploadApprovedPdf(
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  fileInput: DomElementRef,
  uploaded: Awaited<ReturnType<typeof uploadFile>>,
): void {
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "upload approved PDF",
    status: uploaded.ok
      ? "success"
      : uploaded.status === "review_required"
        ? "review_required"
        : "failed",
    selectedElement: fileInput,
    reason: uploaded.ok
      ? uploaded.message
      : (uploaded.reviewRequiredReason ?? uploaded.message),
    evidenceRef: uploaded.afterEvidenceRef ?? uploaded.beforeEvidenceRef,
  });
}
