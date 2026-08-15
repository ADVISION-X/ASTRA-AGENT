import { observeExistingInvoiceConfirmation } from "../../src/plugins/amazon-invoice-upload/amazon-existing-invoice-evidence.js";
import type { BrowserDocumentRef, BrowserTargetRef } from "../../src/types/browser-target.js";
import type { DomSnapshot } from "../../src/types/dom-automation.js";

const mission = {
  missionType: "amazon_invoice_upload" as const,
  marketplace: "AE" as const,
  amazonOrderId: "123-1234567-1234567",
  invoiceNo: "INV-BOUNDARY",
  invoicePdfPath: "/tmp/INV-BOUNDARY.pdf",
  sellerCentralEntryUrl: "https://sellercentral.amazon.ae/orders-v3/order/123-1234567-1234567",
};

export function assertPositiveAndNegativeConfirmationBoundary(): void {
  const confirmed = observe({
    dialogs: ["订单123-1234567-1234567的发票 感谢您上传文件"],
    rows: ["2026/8/16 发票 INV-BOUNDARY 等待中：待处理"],
  });
  const duplicateDialog = observe({
    dialogs: ["订单123-1234567-1234567的发票", "订单123-1234567-1234567的发票"],
    rows: ["发票 INV-BOUNDARY 成功：已上传"],
  });
  const conflictingFailure = observe({
    dialogs: ["订单123-1234567-1234567的发票 文件上传失败"],
    rows: ["发票 INV-BOUNDARY 成功：已上传"],
  });
  const duplicateRow = observe({
    dialogs: ["订单123-1234567-1234567的发票"],
    rows: ["发票 INV-BOUNDARY 成功：已上传", "发票 INV-BOUNDARY 成功：已上传"],
  });
  const foreignInvoice = observe({
    dialogs: ["订单123-1234567-1234567的发票 感谢您上传文件"],
    rows: ["发票 INV-FOREIGN 成功：已上传"],
  });
  if (confirmed.status !== "confirmed" || duplicateDialog.status !== "rejected"
    || duplicateRow.status !== "rejected" || conflictingFailure.status !== "rejected"
    || foreignInvoice.status !== "pending") {
    throw new Error(`Amazon inclusion/exclusion boundary failed: ${JSON.stringify({ confirmed, duplicateDialog, duplicateRow, conflictingFailure, foreignInvoice })}.`);
  }
}

const observe = (input: { dialogs: string[]; rows: string[] }) =>
  observeExistingInvoiceConfirmation(confirmationSnapshot(input), mission);

function confirmationSnapshot(input: { dialogs: string[]; rows: string[] }): DomSnapshot {
  const element = (visibleText: string) => ({
    tagName: "div", visibleText, disabled: false, hidden: false, selectorCandidate: "fixture",
  });
  return {
    targetRef: "fixture:confirmation" as BrowserTargetRef,
    documentRef: "fixture:confirmation:document" as BrowserDocumentRef,
    url: mission.sellerCentralEntryUrl,
    title: "Amazon confirmation boundary fixture",
    forms: [], inputs: [], buttons: [], links: [], fileInputs: [], frames: [], textBlocks: [],
    genericClickableElements: [], dropdownTriggers: [], overlays: [], loadingIndicators: [], stickyElements: [],
    dialogs: input.dialogs.map(element),
    tableRows: input.rows.map((visibleText) => ({ ...element(visibleText), candidateKind: "table-row" })),
    roleRows: [], detectedStates: [], capturedAt: new Date().toISOString(),
  };
}
