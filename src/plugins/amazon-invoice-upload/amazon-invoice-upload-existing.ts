import type { DomElementRef } from "../../types/dom-automation.js";
import type { BrowserController } from "../../lib/browser/browser-controller.js";
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
  hasExistingInvoiceEvidence,
  locateManageInvoiceEntry,
} from "./amazon-existing-invoice-evidence.js";
import { buildApprovedOrderDetailUrl } from "./amazon-invoice-upload-order-detail.js";

const existingInvoiceEvidenceTimeoutMs = 45_000;
const existingInvoiceEvidencePollMs = 250;
const existingInvoiceEvidenceRecoveryAttempts = 1;
const existingInvoiceEvidenceRecoverySettleMs = 3_000;

type AlreadyUploadedRetainedTabInput = {
  runtimeLogger: RuntimeLogger;
  mission: AmazonInvoiceUploadMissionInput;
  reason: string;
  evidenceRef: string | undefined;
};

export async function verifyAlreadyUploadedInvoice(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<AmazonInvoiceUploadTaskResult | null> {
  const snapshot = await readSnapshot(browser);
  if (hasExistingInvoiceEvidence(snapshot, mission)) {
    traceAlreadyUploaded(runtimeLogger, mission, snapshot);
    return alreadyUploadedWithRetainedTab({
      runtimeLogger,
      mission,
      reason: "order detail already showed uploaded invoice state",
      evidenceRef: undefined,
    });
  }

  const manageEntry = await openManageInvoiceList(browser, runtimeLogger, mission, snapshot);
  if (manageEntry !== null) return manageEntry === "not-found" ? null : manageEntry;

  const evidenceRef = await waitForExistingInvoiceEvidence(browser, runtimeLogger, mission);
  if (evidenceRef) {
    return alreadyUploadedWithRetainedTab({
      runtimeLogger,
      mission,
      reason: "existing invoice verified from Amazon invoice list",
      evidenceRef,
    });
  }

  for (let attempt = 1; attempt <= existingInvoiceEvidenceRecoveryAttempts; attempt += 1) {
    await recoverExistingInvoiceList(browser, runtimeLogger, mission, attempt);
    const recoveredSnapshot = await readSnapshot(browser);
    const recoveredManageEntry = await openManageInvoiceList(browser, runtimeLogger, mission, recoveredSnapshot);
    if (recoveredManageEntry !== null) return recoveredManageEntry === "not-found" ? null : recoveredManageEntry;
    const recoveredEvidenceRef = await waitForExistingInvoiceEvidence(browser, runtimeLogger, mission);
    if (recoveredEvidenceRef) {
      return alreadyUploadedWithRetainedTab({
        runtimeLogger,
        mission,
        reason: "existing invoice verified from Amazon invoice list after recovery refresh",
        evidenceRef: recoveredEvidenceRef,
      });
    }
  }

  return evidenceRef
    ? alreadyUploadedWithRetainedTab({
      runtimeLogger,
      mission,
      reason: "existing invoice verified from Amazon invoice list",
      evidenceRef,
    })
    : existingInvoiceNeedsReview(mission);
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
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  snapshot: Awaited<ReturnType<typeof readSnapshot>>,
): Promise<AmazonInvoiceUploadTaskResult | "not-found" | null> {
  const manageEntry = locateManageInvoiceEntry(snapshot);
  if (!manageEntry.ok) return "not-found";
  traceManageInvoiceEntry(runtimeLogger, mission, snapshot, manageEntry.element);
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

async function recoverExistingInvoiceList(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  attempt: number,
): Promise<void> {
  await browser.open({
    url: buildApprovedOrderDetailUrl(mission),
    title: "Amazon Seller Central manage invoice recovery refresh",
    reusePolicy: "reuse-active-tab",
  });
  await browser.wait(existingInvoiceEvidenceRecoverySettleMs);
  const snapshot = await readSnapshot(browser);
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "recover existing invoice list",
    status: "snapshot",
    snapshot,
    reason: `Manage invoice list did not expose strong evidence within ${existingInvoiceEvidenceTimeoutMs}ms; recovery refresh attempt ${attempt}/${existingInvoiceEvidenceRecoveryAttempts}.`,
  });
}

function existingInvoiceNeedsReview(mission: AmazonInvoiceUploadMissionInput): AmazonInvoiceUploadTaskResult {
  return taskResult({
    status: "review_required",
    reason: `Amazon exposes a manage-invoice entry, but the invoice list did not confirm the expected invoice within ${existingInvoiceEvidenceTimeoutMs}ms.`,
    reachedStep: "verify existing invoice",
    amazonOrderId: mission.amazonOrderId,
    invoiceNo: mission.invoiceNo,
    reviewRequired: true,
  });
}

async function waitForExistingInvoiceEvidence(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<string | undefined> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < existingInvoiceEvidenceTimeoutMs) {
    const snapshot = await readSnapshot(browser);
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
      return evidenceRef;
    }
    await browser.wait(existingInvoiceEvidencePollMs);
  }
  return undefined;
}

function alreadyUploadedWithRetainedTab(input: AlreadyUploadedRetainedTabInput): AmazonInvoiceUploadTaskResult {
  traceAlreadyUploadedRetainedTab(input.runtimeLogger, input.mission, input.evidenceRef);
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
    reason: "Active Seller Central order worker tab retained after already-uploaded verification.",
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
