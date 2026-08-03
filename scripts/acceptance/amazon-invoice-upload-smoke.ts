import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import {
  getAmazonInvoiceUploadTaskStatus,
  runAmazonInvoiceUpload,
  startAmazonInvoiceUploadTask,
} from "../../src/plugins/amazon-invoice-upload/index.js";
import { extractOrderDomTotalAmount, parsePdfTotalAmount } from "../../src/plugins/amazon-invoice-upload/amazon-invoice-upload-amount-check.js";
import type { DomSnapshot } from "../../src/types/dom-automation.js";
import {
  AmazonHangingOpenBrowserAdapter,
  AmazonSmokeBrowserAdapter,
  buildInvoicePdf,
  createNoActionsDialogFixturePaths,
  createSmokeFixturePaths,
} from "./amazon-invoice-upload-smoke-support.js";

const assertSmokeResult = (result: Awaited<ReturnType<typeof runAmazonInvoiceUpload>>): void => {
  if (result.status === "upload_success" && result.reachedStep === "upload success verified") {
    return;
  }
  process.stdout.write(`[AMAZON-INVOICE-UPLOAD-SMOKE][FAIL] unexpected dry-run result: ${JSON.stringify(result)}\n`);
  process.exit(1);
};

async function main(): Promise<void> {
  const fixture = createSmokeFixturePaths();
  const launched = await chromium.launch({ headless: true });
  const page = await launched.newPage({ viewport: { width: 900, height: 700 } });
  const browser = new AmazonSmokeBrowserAdapter(page, fixture.tmp);
  const runtimeLogger = createRuntimeLogger({ terminalEnabled: false });

  try {
    const result = await runAmazonInvoiceUpload(browser, runtimeLogger, {
      missionType: "amazon_invoice_upload",
      marketplace: "AE",
      amazonOrderId: "123-1234567-1234567",
      invoiceNo: "INV-1",
      invoicePdfPath: fixture.pdfPath,
      sellerCentralEntryUrl: pathToFileURL(fixture.htmlPath).href,
    });
    assertSmokeResult(result);
    if (browser.closeActiveTabCalls !== 0) {
      throw new Error(`Amazon invoice smoke must retain the order tab; closeActiveTabCalls=${browser.closeActiveTabCalls}`);
    }
    if (!browser.openReusePolicies.includes("reuse-active-tab")) {
      throw new Error("Amazon invoice smoke must reuse the active order tab during order detail navigation.");
    }
    if (browser.orderDetailRefreshOpenCount !== 1) {
      throw new Error(`Amazon invoice smoke must execute exactly one conditional recovery refresh; orderDetailRefreshOpenCount=${browser.orderDetailRefreshOpenCount}`);
    }
    assertBackendPdfTextAmountReadable();
    assertSplitSellerCentralOrderTotalReadable();
    assertLongSellerCentralOrderTotalReadable();
    await assertNoActionsDialogRecovery(runtimeLogger, "recovers", "already_uploaded");
    await assertNoActionsDialogRecovery(runtimeLogger, "repeats", "review_required");
    await assertAmountMismatchSkipsBeforeUpload(runtimeLogger);
    await assertUnreadablePdfSkipsBeforeUpload(runtimeLogger);
    await assertTaskServiceTimeoutGuard(runtimeLogger);
    process.stdout.write("[AMAZON-INVOICE-UPLOAD-SMOKE][PASS] plugin dry-run flow reached upload_success with retained tab lifecycle\n");
  } finally {
    await launched.close();
  }
}

async function assertNoActionsDialogRecovery(
  runtimeLogger: ReturnType<typeof createRuntimeLogger>,
  behavior: "recovers" | "repeats",
  expectedStatus: "already_uploaded" | "review_required",
): Promise<void> {
  const fixture = createNoActionsDialogFixturePaths(behavior);
  const launched = await chromium.launch({ headless: true });
  const page = await launched.newPage({ viewport: { width: 900, height: 700 } });
  const browser = new AmazonSmokeBrowserAdapter(page, fixture.tmp);
  try {
    const result = await runAmazonInvoiceUpload(browser, runtimeLogger, {
      missionType: "amazon_invoice_upload",
      marketplace: "AE",
      amazonOrderId: "123-1234567-1234567",
      invoiceNo: "INV-RECOVERY",
      invoicePdfPath: fixture.pdfPath,
      sellerCentralEntryUrl: pathToFileURL(fixture.htmlPath).href,
    });
    if (result.status !== expectedStatus) {
      throw new Error(`No-actions dialog ${behavior} fixture returned ${JSON.stringify(result)}.`);
    }
    if (browser.noActionsDialogDismissClicks !== 1) {
      throw new Error(`No-actions dialog ${behavior} fixture must click outside exactly once; clicks=${browser.noActionsDialogDismissClicks}.`);
    }
    if (browser.orderDetailRefreshOpenCount !== 0) {
      throw new Error(`No-actions dialog ${behavior} fixture must not refresh the order detail page.`);
    }
    if (browser.fileUrlOpenCount !== 2) {
      throw new Error(`No-actions dialog ${behavior} fixture must keep only the two normal entry/order opens; opens=${browser.fileUrlOpenCount}.`);
    }
    if (browser.fileInputSetCalls !== 0) {
      throw new Error(`No-actions dialog ${behavior} fixture must stop before PDF upload.`);
    }
  } finally {
    await launched.close();
  }
}

function assertBackendPdfTextAmountReadable(): void {
  const amount = parsePdfTotalAmount(`G R O S S A M O U N T P AYA B L E
( A E D )
59.50`);
  if (amount?.amountMinor !== 5950) {
    throw new Error(`Backend-rendered PDF text must be amount-readable: ${JSON.stringify(amount)}`);
  }
}

function assertSplitSellerCentralOrderTotalReadable(): void {
  const amount = extractOrderDomTotalAmount({
    url: "https://sellercentral.amazon.ae/orders-v3/order/402-2948017-0456349",
    title: "亚马逊",
    forms: [],
    inputs: [],
    buttons: [],
    links: [],
    fileInputs: [],
    dialogs: [],
    frames: [],
    textBlocks: [
      textBlock("销售收益"),
      textBlock("商品总计:"),
      textBlock("AED 59.50"),
      textBlock("运费总额:"),
      textBlock("AED 2.50"),
      textBlock("促销总额:"),
      textBlock("-AED 2.50"),
      textBlock("总和:"),
      textBlock("AED 59.50"),
    ],
    tableRows: [],
    roleRows: [],
    genericClickableElements: [],
    dropdownTriggers: [],
    overlays: [],
    loadingIndicators: [],
    stickyElements: [],
    detectedStates: [],
    capturedAt: "1970-01-01T00:00:00.000Z",
  });
  if (amount?.amountMinor !== 5950) {
    throw new Error(`Split Seller Central total must be amount-readable: ${JSON.stringify(amount)}`);
  }
}

function assertLongSellerCentralOrderTotalReadable(): void {
  const amount = extractOrderDomTotalAmount({
    url: "https://sellercentral.amazon.ae/orders-v3/order/402-2948017-0456349",
    title: "Amazon",
    forms: [],
    inputs: [],
    buttons: [],
    links: [],
    fileInputs: [],
    dialogs: [],
    frames: [],
    textBlocks: [
      textBlock(`Sales proceeds ${"Adjustment AED 0.00 ".repeat(18)} Total AED 59.50`),
    ],
    tableRows: [],
    roleRows: [],
    genericClickableElements: [],
    dropdownTriggers: [],
    overlays: [],
    loadingIndicators: [],
    stickyElements: [],
    detectedStates: [],
    capturedAt: "1970-01-01T00:00:00.000Z",
  });
  if (amount?.amountMinor !== 5950) {
    throw new Error(`Long Seller Central total must be amount-readable: ${JSON.stringify(amount)}`);
  }
}

function textBlock(visibleText: string): DomSnapshot["textBlocks"][number] {
  return { tagName: "div", visibleText, disabled: false, hidden: false, selectorCandidate: "div", candidateKind: "text" };
}

async function assertUnreadablePdfSkipsBeforeUpload(runtimeLogger: ReturnType<typeof createRuntimeLogger>): Promise<void> {
  const fixture = createSmokeFixturePaths();
  const unreadablePdfPath = join(fixture.tmp, "unreadable.pdf");
  writeFileSync(unreadablePdfPath, Buffer.from("%PDF-1.4\n% unreadable amount fixture\n"));
  const launched = await chromium.launch({ headless: true });
  const page = await launched.newPage({ viewport: { width: 900, height: 700 } });
  const browser = new AmazonSmokeBrowserAdapter(page, fixture.tmp);
  try {
    const result = await runAmazonInvoiceUpload(browser, runtimeLogger, {
      missionType: "amazon_invoice_upload",
      marketplace: "AE",
      amazonOrderId: "123-1234567-1234567",
      invoiceNo: "INV-UNREADABLE",
      invoicePdfPath: unreadablePdfPath,
      sellerCentralEntryUrl: pathToFileURL(fixture.htmlPath).href,
    });
    if (result.status !== "amount_mismatch_skipped" || result.amountCheck?.status !== "pdf_unreadable") {
      throw new Error(`Unreadable PDF amount must skip before upload: ${JSON.stringify(result)}`);
    }
    if (browser.fileInputSetCalls !== 0) {
      throw new Error(`Unreadable PDF must not attach a file; fileInputSetCalls=${browser.fileInputSetCalls}`);
    }
  } finally {
    await launched.close();
  }
}

async function assertAmountMismatchSkipsBeforeUpload(runtimeLogger: ReturnType<typeof createRuntimeLogger>): Promise<void> {
  const fixture = createSmokeFixturePaths();
  const mismatchPdfPath = join(fixture.tmp, "mismatch.pdf");
  writeFileSync(mismatchPdfPath, buildInvoicePdf("39.07"));
  const launched = await chromium.launch({ headless: true });
  const page = await launched.newPage({ viewport: { width: 900, height: 700 } });
  const browser = new AmazonSmokeBrowserAdapter(page, fixture.tmp);
  try {
    const result = await runAmazonInvoiceUpload(browser, runtimeLogger, {
      missionType: "amazon_invoice_upload",
      marketplace: "AE",
      amazonOrderId: "123-1234567-1234567",
      invoiceNo: "INV-MISMATCH",
      invoicePdfPath: mismatchPdfPath,
      sellerCentralEntryUrl: pathToFileURL(fixture.htmlPath).href,
    });
    if (result.status !== "amount_mismatch_skipped" || result.reachedStep !== "verify invoice amount against order total") {
      throw new Error(`Amount mismatch must skip before upload: ${JSON.stringify(result)}`);
    }
    if (browser.fileInputSetCalls !== 0) {
      throw new Error(`Amount mismatch must not attach a PDF; fileInputSetCalls=${browser.fileInputSetCalls}`);
    }
  } finally {
    await launched.close();
  }
}

async function assertTaskServiceTimeoutGuard(runtimeLogger: ReturnType<typeof createRuntimeLogger>): Promise<void> {
  const fixture = createSmokeFixturePaths();
  const browser = new AmazonHangingOpenBrowserAdapter();
  const task = await startAmazonInvoiceUploadTask({
    browser,
    runtimeLogger,
    dataDir: fixture.tmp,
    flowTimeoutMs: 20,
    task: {
      mission: {
        missionType: "amazon_invoice_upload",
        marketplace: "AE",
        amazonOrderId: "123-1234567-1234567",
        invoiceNo: "INV-TIMEOUT",
        invoicePdfPath: fixture.pdfPath,
        sellerCentralEntryUrl: pathToFileURL(fixture.htmlPath).href,
      },
      invoicePdf: {
        filename: "INV-TIMEOUT.pdf",
        mimeType: "application/pdf",
        bytes: Buffer.from("timeout pdf"),
      },
    },
  });
  const persisted = getAmazonInvoiceUploadTaskStatus({ dataDir: fixture.tmp, taskId: task.taskId });
  if (persisted.status !== "failed" || persisted.reason !== "amazon_invoice_upload_flow_timeout_after_20ms") {
    throw new Error(`Amazon invoice upload task timeout guard failed: ${JSON.stringify(persisted)}`);
  }
}

await main();
