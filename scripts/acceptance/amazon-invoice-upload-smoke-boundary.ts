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
    dialogs: [{ text: "订单123-1234567-1234567的发票", rows: ["2026/8/16 发票 由卖家生成 INV-BOUNDARY 下载"] }],
  });
  const duplicateDialog = observe({
    dialogs: [
      { text: "订单123-1234567-1234567的发票", rows: ["发票 INV-BOUNDARY 成功：已上传"] },
      { text: "订单123-1234567-1234567的发票", rows: ["发票 INV-BOUNDARY 成功：已上传"] },
    ],
  });
  const conflictingFailure = observe({
    dialogs: [{ text: "订单123-1234567-1234567的发票 文件上传失败", rows: ["发票 INV-BOUNDARY 成功：已上传"] }],
  });
  const duplicateRow = observe({
    dialogs: [{ text: "订单123-1234567-1234567的发票", rows: ["发票 INV-BOUNDARY 成功：已上传", "发票 INV-BOUNDARY 成功：已上传"] }],
  });
  const foreignInvoice = observe({
    dialogs: [{ text: "订单123-1234567-1234567的发票", rows: ["发票 INV-FOREIGN 成功：已上传"] }],
  });
  const outsideDialogRow = observe({
    dialogs: [{ text: "订单123-1234567-1234567的发票", rows: [] }],
    outsideRows: ["发票 INV-BOUNDARY 成功：已上传"],
  });
  const orderIdOnly = observe({
    dialogs: [{ text: "订单123-1234567-1234567的发票", rows: ["发票 123-1234567-1234567 成功：已上传"] }],
  });
  const partialInvoice = observe({
    dialogs: [{ text: "订单123-1234567-1234567的发票", rows: ["发票 INV-BOUNDARY-EXTRA 成功：已上传"] }],
  });
  const missingSuccessState = observe({
    dialogs: [{ text: "订单123-1234567-1234567的发票", rows: ["发票 INV-BOUNDARY 等待中：待处理"] }],
  });
  const hiddenDialog = observe({
    dialogs: [{ text: "订单123-1234567-1234567的发票", rows: ["发票 INV-BOUNDARY 成功：已上传"], hidden: true }],
  });
  if (confirmed.status !== "confirmed" || duplicateDialog.status !== "rejected"
    || duplicateRow.status !== "rejected" || conflictingFailure.status !== "rejected"
    || foreignInvoice.status !== "pending" || outsideDialogRow.status !== "pending"
    || orderIdOnly.status !== "pending" || partialInvoice.status !== "pending"
    || missingSuccessState.status !== "pending" || hiddenDialog.status !== "pending") {
    throw new Error(`Amazon inclusion/exclusion boundary failed: ${JSON.stringify({ confirmed, duplicateDialog, duplicateRow, conflictingFailure, foreignInvoice, outsideDialogRow, orderIdOnly, partialInvoice, missingSuccessState, hiddenDialog })}.`);
  }
}

type FixtureDialog = { text: string; rows: string[]; hidden?: boolean };

const observe = (input: { dialogs: FixtureDialog[]; outsideRows?: string[] }) =>
  observeExistingInvoiceConfirmation(confirmationSnapshot(input), mission);

function confirmationSnapshot(input: { dialogs: FixtureDialog[]; outsideRows?: string[] }): DomSnapshot {
  const element = (visibleText: string, hidden = false) => ({
    tagName: "div", visibleText, disabled: false, hidden, selectorCandidate: "fixture",
  });
  return {
    targetRef: "fixture:confirmation" as BrowserTargetRef,
    documentRef: "fixture:confirmation:document" as BrowserDocumentRef,
    url: mission.sellerCentralEntryUrl,
    title: "Amazon confirmation boundary fixture",
    forms: [], inputs: [], buttons: [], links: [], fileInputs: [], frames: [], textBlocks: [],
    genericClickableElements: [], dropdownTriggers: [], overlays: [], loadingIndicators: [], stickyElements: [],
    dialogs: input.dialogs.map((dialog) => ({
      ...element(dialog.text, dialog.hidden),
      descendantRows: dialog.rows.map((visibleText) => ({ ...element(visibleText), candidateKind: "table-row" as const })),
    })),
    tableRows: (input.outsideRows ?? []).map((visibleText) => ({ ...element(visibleText), candidateKind: "table-row" })),
    roleRows: [], detectedStates: [], capturedAt: new Date().toISOString(),
  };
}
