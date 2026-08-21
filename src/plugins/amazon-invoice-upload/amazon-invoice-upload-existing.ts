import type { DomElementRef } from "../../types/dom-automation.js";
import type { BrowserTargetLease } from "../../lib/browser/browser-authority-api.js";
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
  findOrderBoundInvoiceDialogText,
  hasExistingInvoiceEvidence,
  hasInvoiceDialogReadyForUpload,
  locateManageInvoiceEntry,
} from "./amazon-existing-invoice-evidence.js";

const existingInvoiceEvidencePollMs = 250;
const INVOICE_DIALOG_READY_CONFIRMATION_COUNT = 2;
const INVOICE_DIALOG_OBSERVATION_LIMIT = 240;
const noAvailableActionsDialogText = "很抱歉，目前没有可用的操作。";
const invoiceReadFailureDialogText = "读取失败";

type ExistingInvoiceEvidenceWaitResult =
  | { kind: "confirmed"; evidenceRef: string }
  | { kind: "ready_for_upload" }
  | { kind: "not_confirmed"; reason: string }
  | {
      kind: "read_failure";
      failureText: string;
      snapshot: Awaited<ReturnType<typeof readSnapshot>>;
    };

type AlreadyUploadedRetainedTabInput = {
  runtimeLogger: RuntimeLogger;
  mission: AmazonInvoiceUploadMissionInput;
  reason: string;
  evidenceRef: string | undefined;
};

export async function verifyAlreadyUploadedInvoice(
  browser: BrowserTargetLease,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  abortSignal: AbortSignal,
): Promise<AmazonInvoiceUploadTaskResult | null> {
  const snapshot = await readExistingInvoiceSnapshot(browser, abortSignal);
  if (hasExistingInvoiceEvidence(snapshot, mission)) {
    traceAlreadyUploaded(runtimeLogger, mission, snapshot);
    return alreadyUploadedWithRetainedTab({
      runtimeLogger,
      mission,
      reason: "order detail already showed uploaded invoice state",
      evidenceRef: undefined,
    });
  }

  const manageEntry = await openManageInvoiceList(
    browser,
    runtimeLogger,
    mission,
    snapshot,
  );
  if (manageEntry !== null)
    return manageEntry === "not-found" ? null : manageEntry;

  const firstWait = await waitForExistingInvoiceEvidence(
    browser,
    runtimeLogger,
    mission,
    abortSignal,
  );
  if (firstWait.kind === "confirmed") {
    return alreadyUploadedWithRetainedTab({
      runtimeLogger,
      mission,
      reason: "existing invoice verified from Amazon invoice list",
      evidenceRef: firstWait.evidenceRef,
    });
  }
  if (firstWait.kind === "ready_for_upload") return null;
  if (firstWait.kind === "not_confirmed") {
    return existingInvoiceNeedsReview(mission, firstWait.reason);
  }

  return recoverInvoiceReadFailure(
    browser,
    runtimeLogger,
    mission,
    abortSignal,
    firstWait,
  );
}

async function recoverInvoiceReadFailure(
  browser: BrowserTargetLease,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  abortSignal: AbortSignal,
  firstWait: Extract<
    ExistingInvoiceEvidenceWaitResult,
    { kind: "read_failure" }
  >,
): Promise<AmazonInvoiceUploadTaskResult | null> {
  const dismissFailure = await dismissInvoiceReadFailureDialog(
    runtimeLogger,
    mission,
    firstWait.snapshot,
    firstWait.failureText,
  );
  if (dismissFailure) return dismissFailure;

  const reopenedSnapshot = await readExistingInvoiceSnapshot(
    browser,
    abortSignal,
  );
  const reopenedManageEntry = await openManageInvoiceList(
    browser,
    runtimeLogger,
    mission,
    reopenedSnapshot,
  );
  if (reopenedManageEntry !== null) {
    return existingInvoiceNeedsReview(
      mission,
      "Amazon manage-invoice recovery dismissed the blocked dialog, but Manage invoice could not be reopened safely.",
    );
  }

  const secondWait = await waitForExistingInvoiceEvidence(
    browser,
    runtimeLogger,
    mission,
    abortSignal,
  );
  if (secondWait.kind === "confirmed") {
    return alreadyUploadedWithRetainedTab({
      runtimeLogger,
      mission,
      reason:
        "existing invoice verified after one governed no-actions dialog dismissal and reopen",
      evidenceRef: secondWait.evidenceRef,
    });
  }
  if (secondWait.kind === "ready_for_upload") return null;
  if (secondWait.kind === "not_confirmed") {
    return existingInvoiceNeedsReview(mission, secondWait.reason);
  }

  return existingInvoiceNeedsReview(
    mission,
    "Amazon returned the same explicit invoice read-failure dialog after the single governed dismissal and reopen recovery.",
  );
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
  browser: BrowserTargetLease,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  snapshot: Awaited<ReturnType<typeof readSnapshot>>,
): Promise<AmazonInvoiceUploadTaskResult | "not-found" | null> {
  const manageEntry = locateManageInvoiceEntry(snapshot);
  if (!manageEntry.ok) return "not-found";
  traceManageInvoiceEntry(
    runtimeLogger,
    mission,
    snapshot,
    manageEntry.element,
  );
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

async function dismissInvoiceReadFailureDialog(
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  snapshot: Awaited<ReturnType<typeof readSnapshot>>,
  failureText: string,
): Promise<AmazonInvoiceUploadTaskResult | null> {
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "detect invoice read failure dialog",
    status: "snapshot",
    snapshot,
    reason: `The unique current-order invoice dialog exposed the governed read-failure blocker: ${failureText}.`,
  });

  return existingInvoiceNeedsReview(
    mission,
    "NOT_PRODUCTION_VERIFIED: no approved exact DOM intent exists to dismiss this Amazon invoice dialog.",
  );
}

function findInvoiceReadFailureDialogText(
  snapshot: Awaited<ReturnType<typeof readSnapshot>>,
  mission: AmazonInvoiceUploadMissionInput,
): string | null {
  const dialogText = findOrderBoundInvoiceDialogText(snapshot, mission);
  if (dialogText === null) return null;
  return (
    [noAvailableActionsDialogText, invoiceReadFailureDialogText].find(
      (failureText) => dialogText.includes(failureText),
    ) ?? null
  );
}

function existingInvoiceNeedsReview(
  mission: AmazonInvoiceUploadMissionInput,
  reason: string,
): AmazonInvoiceUploadTaskResult {
  return taskResult({
    status: "review_required",
    reason,
    reachedStep: "verify existing invoice",
    amazonOrderId: mission.amazonOrderId,
    invoiceNo: mission.invoiceNo,
    reviewRequired: true,
  });
}

async function waitForExistingInvoiceEvidence(
  browser: BrowserTargetLease,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  abortSignal: AbortSignal,
): Promise<ExistingInvoiceEvidenceWaitResult> {
  let readyConfirmationCount = 0;
  for (
    let observation = 1;
    observation <= INVOICE_DIALOG_OBSERVATION_LIMIT;
    observation += 1
  ) {
    throwIfAborted(abortSignal);
    const snapshot = await readExistingInvoiceSnapshot(browser, abortSignal);
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
      return { kind: "confirmed", evidenceRef };
    }
    const failureText = findInvoiceReadFailureDialogText(snapshot, mission);
    if (failureText) {
      return { kind: "read_failure", failureText, snapshot };
    }
    if (hasInvoiceDialogReadyForUpload(snapshot, mission)) {
      readyConfirmationCount += 1;
      if (readyConfirmationCount >= INVOICE_DIALOG_READY_CONFIRMATION_COUNT) {
        recordAmazonDomStepTrace({
          runtimeLogger,
          mission,
          stepName: "verify current-order invoice dialog ready for upload",
          status: "success",
          snapshot,
          reason:
            "Current-order invoice dialog exposed a complete invoice table and upload action without a matching uploaded row.",
        });
        return { kind: "ready_for_upload" };
      }
    } else {
      readyConfirmationCount = 0;
    }
    await browser.wait(existingInvoiceEvidencePollMs, abortSignal);
  }
  return {
    kind: "not_confirmed",
    reason: `Amazon current-order invoice dialog did not reach one unique uploaded row or one stable upload-ready state within ${INVOICE_DIALOG_OBSERVATION_LIMIT} bounded observations.`,
  };
}

const readExistingInvoiceSnapshot = (
  browser: BrowserTargetLease,
  abortSignal: AbortSignal,
) => readSnapshot(browser, { maxTextLengthPerNode: 240 }, abortSignal);

function throwIfAborted(abortSignal: AbortSignal): void {
  if (!abortSignal.aborted) return;
  throw abortSignal.reason instanceof Error
    ? abortSignal.reason
    : new Error("Amazon existing-invoice DOM wait aborted.");
}

function alreadyUploadedWithRetainedTab(
  input: AlreadyUploadedRetainedTabInput,
): AmazonInvoiceUploadTaskResult {
  traceAlreadyUploadedRetainedTab(
    input.runtimeLogger,
    input.mission,
    input.evidenceRef,
  );
  return alreadyUploadedSuccess(input.mission, input.reason, input.evidenceRef);
}

function traceAlreadyUploadedRetainedTab(
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  evidenceRef: string | undefined,
): void {
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "retain already uploaded order tab",
    status: "success",
    reason:
      "Active Seller Central order worker tab retained after already-uploaded verification.",
    evidenceRef,
  });
}

function alreadyUploadedSuccess(
  mission: AmazonInvoiceUploadMissionInput,
  reason: string,
  evidenceRef: string | undefined,
): AmazonInvoiceUploadTaskResult {
  return taskResult({
    status: "already_uploaded",
    reason: `Amazon Seller Central shows this invoice is already uploaded; ${reason}; active order tab retained for next invoice navigation.`,
    reachedStep: "already uploaded verified",
    amazonOrderId: mission.amazonOrderId,
    invoiceNo: mission.invoiceNo,
    ...evidenceField(evidenceRef),
  });
}
