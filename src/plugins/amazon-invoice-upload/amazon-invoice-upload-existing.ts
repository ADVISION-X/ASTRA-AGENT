import { readDomSnapshotOnce } from "../../capabilities/dom-automation/index.js";
import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type { AmazonInvoiceUploadTaskResult } from "./amazon-invoice-upload.flow.js";
import {
  clickLocated,
  evidenceField,
  locateOrStatus,
  taskResult,
} from "./amazon-invoice-upload-flow-support.js";
import type { AmazonInvoiceUploadMissionInput } from "./mission.schema.js";

const EXISTING_INVOICE_HINTS = [
  "invoice uploaded successfully",
  "感谢您上传文件",
  "客户可以直接从自己的账户下载文件",
  "由卖家生成",
  "待处理",
  "管理发票",
];

export async function verifyAlreadyUploadedInvoice(
  browser: BrowserController,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<AmazonInvoiceUploadTaskResult | null> {
  const snapshot = await readDomSnapshotOnce(browser);
  if (hasExistingInvoiceEvidence(snapshot, mission)) {
    return closeAlreadyUploadedTab(browser, mission, "order detail already showed uploaded invoice state", undefined);
  }

  const manageEntry = locateManageInvoiceEntry(snapshot);
  if (!manageEntry.ok) return null;

  const clickFailure = await clickLocated({
    browser,
    element: manageEntry.element,
    expectedKind: "manage-invoice-entry",
    reachedStep: "open existing invoice list",
    mission,
  });
  if (clickFailure) return clickFailure;

  const evidenceRef = await waitForExistingInvoiceEvidence(browser, mission);
  return evidenceRef
    ? closeAlreadyUploadedTab(browser, mission, "existing invoice verified from Amazon invoice list", evidenceRef)
    : taskResult({
      status: "review_required",
      reason: "Amazon exposes a manage-invoice entry, but the invoice list did not confirm the expected invoice.",
      reachedStep: "verify existing invoice",
      amazonOrderId: mission.amazonOrderId,
      invoiceNo: mission.invoiceNo,
      reviewRequired: true,
    });
}

function locateManageInvoiceEntry(snapshot: Awaited<ReturnType<typeof readDomSnapshotOnce>>): ReturnType<typeof locateOrStatus> {
  const zhEntry = locateOrStatus({
    snapshot,
    targetKind: "button",
    hints: ["管理发票"],
    requiredText: "管理发票",
    notFoundStatus: "upload_entry_not_found",
  });
  if (zhEntry.ok) return zhEntry;
  return locateOrStatus({
    snapshot,
    targetKind: "button",
    hints: ["manage invoice"],
    requiredText: "manage invoice",
    notFoundStatus: "upload_entry_not_found",
  });
}

async function waitForExistingInvoiceEvidence(
  browser: BrowserController,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<string | undefined> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 2500) {
    const snapshot = await readDomSnapshotOnce(browser);
    if (hasExistingInvoiceEvidence(snapshot, mission)) {
      return `amazon-existing-invoice:${mission.amazonOrderId}:${Date.now()}`;
    }
    await browser.wait(200);
  }
  return undefined;
}

function hasExistingInvoiceEvidence(
  snapshot: Awaited<ReturnType<typeof readDomSnapshotOnce>>,
  mission: AmazonInvoiceUploadMissionInput,
): boolean {
  const text = normalizeText([
    snapshot.title,
    ...snapshot.buttons.map((item) => `${item.visibleText ?? ""} ${item.ariaLabel ?? ""}`),
    ...snapshot.dialogs.map((item) => `${item.visibleText ?? ""} ${item.ariaLabel ?? ""}`),
    ...snapshot.tableRows.map((item) => item.visibleText ?? ""),
    ...snapshot.roleRows.map((item) => item.visibleText ?? ""),
    ...snapshot.textBlocks.map((item) => item.visibleText ?? ""),
    ...snapshot.genericClickableElements.map((item) => item.visibleText ?? ""),
  ].join(" "));
  const expectedIdSeen = text.includes(normalizeText(mission.invoiceNo)) || text.includes(normalizeText(mission.amazonOrderId));
  const invoiceStateSeen = EXISTING_INVOICE_HINTS.some((hint) => text.includes(normalizeText(hint)));
  return expectedIdSeen && invoiceStateSeen;
}

async function closeAlreadyUploadedTab(
  browser: BrowserController,
  mission: AmazonInvoiceUploadMissionInput,
  reason: string,
  evidenceRef: string | undefined,
): Promise<AmazonInvoiceUploadTaskResult> {
  const closeResult = await browser.closeActiveTab({
    reason: "Amazon invoice already uploaded state verified",
  });
  if (!closeResult.ok) {
    return taskResult({
      status: "review_required",
      reason: `Amazon Seller Central shows this invoice is already uploaded; ${reason}; active tab close needs review: ${closeResult.message}`,
      reachedStep: "close already uploaded order tab",
      amazonOrderId: mission.amazonOrderId,
      invoiceNo: mission.invoiceNo,
      ...evidenceField(evidenceRef),
      reviewRequired: true,
    });
  }
  return taskResult({
    status: "upload_success",
    reason: `Amazon Seller Central shows this invoice is already uploaded; ${reason}; active order tab closed.`,
    reachedStep: "already uploaded verified",
    amazonOrderId: mission.amazonOrderId,
    invoiceNo: mission.invoiceNo,
    ...evidenceField(evidenceRef),
  });
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
