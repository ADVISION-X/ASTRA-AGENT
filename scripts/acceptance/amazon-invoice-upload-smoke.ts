import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import type { Page } from "playwright";
import type {
  BrowserActionResult,
  BrowserCaptureResult,
  BrowserController,
  BrowserGeometrySnapshot,
  BrowserStateSnapshot,
} from "../../src/lib/browser/browser-controller.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import {
  getAmazonInvoiceUploadTaskStatus,
  runAmazonInvoiceUpload,
  startAmazonInvoiceUploadTask,
} from "../../src/plugins/amazon-invoice-upload/index.js";
import { extractOrderDomTotalAmount, parsePdfTotalAmount } from "../../src/plugins/amazon-invoice-upload/amazon-invoice-upload-amount-check.js";
import type { DomSnapshot } from "../../src/types/dom-automation.js";

const smokeFixtureHtml = `
<html><head><title>Seller Central Local Dry Run</title></head>
<body>
  <label for="order-search">Order search</label>
  <input id="order-search" type="search" placeholder="Search orders by order id" />
  <button id="search-button">Search</button>
  <table id="orders">
    <tr id="order-row"><td>123-1234567-1234567</td><td>Buyer</td><td>Ship</td></tr>
  </table>
  <aside class="order-details-bordered-box-sale-proceeds">
    <h2>销售收益</h2>
    <table>
      <tr><td>商品总计:</td><td>AED 59.50</td></tr>
      <tr><td>总和:</td><td>AED 59.50</td></tr>
    </table>
  </aside>
  <div id="upload-invoice" role="button" tabindex="0"></div>
  <section id="upload-panel" hidden>
    <label for="invoice-file">Choose file</label>
    <input id="invoice-file" type="file" />
    <kat-input required="true" label="文件编号" type="text" value="" name="documentNumber"></kat-input>
    <button id="submit-upload">上传</button>
  </section>
  <div id="status"></div>
  <script>
    customElements.define("kat-input", class extends HTMLElement {
      connectedCallback() {
        if (!this.shadowRoot) {
          const root = this.attachShadow({ mode: "open" });
          root.innerHTML = '<label for="katal-fixture-input">文件编号</label><input id="katal-fixture-input" part="input" type="text" name="documentNumber" />';
          const hidden = document.createElement("input");
          hidden.hidden = true;
          hidden.name = "documentNumber";
          hidden.type = "text";
          this.appendChild(hidden);
          root.querySelector("input").addEventListener("input", (event) => {
            hidden.value = event.target.value;
            this.setAttribute("value", event.target.value);
          });
        }
      }
    });
    document.querySelector("#upload-invoice").addEventListener("click", () => {
      document.querySelector("#upload-panel").hidden = false;
    });
    document.querySelector("#invoice-file").addEventListener("change", () => {
      document.querySelector("#status").textContent = "File attached INV-1";
    });
    document.querySelector("#submit-upload").addEventListener("click", () => {
      const invoiceNumber = document.querySelector('kat-input[name="documentNumber"] input[name="documentNumber"]').value;
      document.querySelector("#status").textContent = invoiceNumber === "INV-1" ? "Invoice uploaded successfully" : "Invoice number missing";
    });
  </script>
</body></html>
`;

type SmokeFixturePaths = {
  tmp: string;
  htmlPath: string;
  pdfPath: string;
};

const createSmokeFixturePaths = (): SmokeFixturePaths => {
  const tmp = mkdtempSync(join(tmpdir(), "grasseye-amazon-smoke-"));
  const htmlPath = join(tmp, "seller-central.html");
  const pdfPath = join(tmp, "invoice.pdf");
  writeFileSync(pdfPath, buildInvoicePdf("59.50"));
  writeFileSync(htmlPath, smokeFixtureHtml);
  return { tmp, htmlPath, pdfPath };
};

const buildInvoicePdf = (amount: string): Buffer => Buffer.from(`%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj
4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
5 0 obj << /Length 96 >> stream
BT /F1 12 Tf 72 720 Td (Gross amount payable) Tj 0 -16 Td (AED) Tj 0 -16 Td (${amount}) Tj ET
endstream endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000241 00000 n 
0000000311 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
455
%%EOF`);

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
    await assertAmountMismatchSkipsBeforeUpload(runtimeLogger);
    await assertUnreadablePdfSkipsBeforeUpload(runtimeLogger);
    await assertTaskServiceTimeoutGuard(runtimeLogger);
    process.stdout.write("[AMAZON-INVOICE-UPLOAD-SMOKE][PASS] plugin dry-run flow reached upload_success with retained tab lifecycle\n");
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

function now(): string {
  return new Date().toISOString();
}

function action(message: string, ok = true): BrowserActionResult {
  return { browserActionId: `amazon-smoke:${Date.now()}`, ok, message, createdAt: now() };
}

function buildBrowserState(page: Page): BrowserStateSnapshot {
  return {
    browserMode: "fixture",
    browserProfileRef: "playwright-amazon-smoke",
    browserExecutablePath: null,
    profileStatus: "profile_ready",
    profileDirectory: "playwright-amazon-smoke",
    profileProvisioning: "operator_supplied",
    profileVerificationStatus: "operator_verified",
    profileVerificationReason: "local Amazon upload smoke page",
    loginState: "unknown",
    currentUrl: page.url(),
    lastLoginCheckAt: null,
    loginRequiredReason: null,
    reviewRequiredReason: null,
    open: true,
    currentTitle: "Amazon Invoice Upload Smoke",
    browserExecutable: null,
  };
}

async function buildGeometrySnapshot(page: Page): Promise<BrowserGeometrySnapshot> {
  const viewport = page.viewportSize() ?? { width: 800, height: 600 };
  return {
    windowX: 0,
    windowY: 0,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    screenshotWidth: viewport.width,
    screenshotHeight: viewport.height,
    scaleFactor: 1,
    currentUrl: page.url(),
    pageTitle: await page.title(),
    visibleContentBounds: { x: 0, y: 0, width: viewport.width, height: viewport.height },
    capturedAt: now(),
  };
}

class AmazonSmokeBrowserAdapter implements BrowserController {
  closeActiveTabCalls = 0;
  fileInputSetCalls = 0;
  openReusePolicies: string[] = [];
  private fileUrlOpenCount = 0;
  orderDetailRefreshOpenCount = 0;

  constructor(private readonly page: Page, private readonly screenshotDir: string) {}

  getHealth(): { ok: boolean; detail: string } { return { ok: true, detail: "playwright Amazon upload smoke adapter" }; }
  getSessionState(): BrowserStateSnapshot { return buildBrowserState(this.page); }
  async getGeometrySnapshot(): Promise<BrowserGeometrySnapshot> { return buildGeometrySnapshot(this.page); }
  async open(input: { url: string; title: string; reusePolicy?: string }): Promise<BrowserActionResult> {
    if (input.reusePolicy) this.openReusePolicies.push(input.reusePolicy);
    await this.page.goto(input.url);
    if (input.url.startsWith("file:")) {
      this.fileUrlOpenCount += 1;
      if (this.fileUrlOpenCount >= 3) {
        this.orderDetailRefreshOpenCount += 1;
        await this.page.locator("#upload-invoice").evaluate((element) => {
          element.textContent = "Upload invoice";
        });
      }
    }
    return action(`opened ${input.title}`);
  }
  async scroll(): Promise<BrowserActionResult> { return action("scroll not needed"); }
  async click(input: { targetLabel: string; point: { x: number; y: number }; button?: "left" | "right" | "middle"; clickCount?: 1 | 2 }): Promise<BrowserActionResult> {
    await this.page.mouse.click(input.point.x, input.point.y, {
      button: input.button ?? "left",
      clickCount: input.clickCount ?? 1,
    });
    return action(`clicked ${input.targetLabel}`);
  }
  async clickLocatedDomElement(input: { targetLabel: string; point: { x: number; y: number } }): Promise<BrowserActionResult> {
    await this.page.mouse.click(input.point.x, input.point.y);
    return action(`clicked located DOM element ${input.targetLabel}`);
  }
  async textInput(input: { targetLabel: string; action: "type-text" | "clear-input" | "press-key"; text?: string | null; key?: "Enter" | "Tab" | "Escape" | "Backspace" | "Delete" | "L" | "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | null }): Promise<BrowserActionResult> {
    if (input.action === "clear-input") {
      await this.page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
      await this.page.keyboard.press("Backspace");
      return action(`cleared active input for ${input.targetLabel}`);
    }
    if (input.action === "press-key") {
      await this.page.keyboard.press(input.key ?? "Enter");
      return action(`pressed key for ${input.targetLabel}`);
    }
    await this.page.keyboard.type(input.text ?? "");
    return action(`typed text for ${input.targetLabel}`);
  }
  async screenshotRegion(input: { regionLabel: string }): Promise<BrowserCaptureResult> {
    const geometry = await buildGeometrySnapshot(this.page);
    const sourceFilePath = join(this.screenshotDir, `${input.regionLabel}-${Date.now()}.png`);
    await this.page.screenshot({ path: sourceFilePath, fullPage: false });
    return {
      browserActionId: `amazon-smoke:capture:${Date.now()}`,
      pageUrl: this.page.url(),
      pageTitle: await this.page.title(),
      regionLabel: input.regionLabel,
      regionType: "viewport",
      width: geometry.viewportWidth,
      height: geometry.viewportHeight,
      viewportWidth: geometry.viewportWidth,
      viewportHeight: geometry.viewportHeight,
      sourceFilePath,
      createdAt: now(),
    };
  }
  async evaluateActiveTab<T>(input: { script: string }): Promise<T> {
    return this.page.evaluate<unknown, string>((source) => {
      const run = new Function(source) as () => unknown;
      return run();
    }, input.script) as Promise<T>;
  }
  async setFileInputFiles(input: { elementRef: { selector: string; targetKind: "file-input" }; filePath: string; description: string }): Promise<BrowserActionResult> {
    this.fileInputSetCalls += 1;
    await this.page.locator(input.elementRef.selector).setInputFiles(input.filePath);
    return action(`set approved file for ${input.description}`);
  }
  async wait(durationMs: number): Promise<BrowserActionResult> {
    await this.page.waitForTimeout(durationMs);
    return action(`waited ${durationMs}`);
  }
  async closeActiveTab(): Promise<BrowserActionResult> {
    this.closeActiveTabCalls += 1;
    return action("active tab closed");
  }
  async close(): Promise<BrowserActionResult> { return action("adapter closed"); }
}

class AmazonHangingOpenBrowserAdapter implements BrowserController {
  getHealth(): { ok: boolean; detail: string } { return { ok: true, detail: "hanging open timeout fixture" }; }
  getSessionState(): BrowserStateSnapshot {
    return {
      browserMode: "fixture",
      browserProfileRef: "hanging-open",
      browserExecutablePath: null,
      profileStatus: "profile_ready",
      profileDirectory: "hanging-open",
      profileProvisioning: "operator_supplied",
      profileVerificationStatus: "operator_verified",
      profileVerificationReason: "local timeout fixture",
      loginState: "unknown",
      currentUrl: "about:blank",
      lastLoginCheckAt: null,
      loginRequiredReason: null,
      reviewRequiredReason: null,
      open: true,
      currentTitle: "Amazon Invoice Upload Timeout Fixture",
      browserExecutable: null,
    };
  }
  async getGeometrySnapshot(): Promise<BrowserGeometrySnapshot> {
    return {
      windowX: 0,
      windowY: 0,
      viewportWidth: 900,
      viewportHeight: 700,
      screenshotWidth: 900,
      screenshotHeight: 700,
      scaleFactor: 1,
      currentUrl: "about:blank",
      pageTitle: "Amazon Invoice Upload Timeout Fixture",
      visibleContentBounds: { x: 0, y: 0, width: 900, height: 700 },
      capturedAt: now(),
    };
  }
  async open(): Promise<BrowserActionResult> {
    return new Promise<BrowserActionResult>(() => undefined);
  }
  async scroll(): Promise<BrowserActionResult> { return action("scroll not reached"); }
  async click(): Promise<BrowserActionResult> { return action("click not reached"); }
  async clickLocatedDomElement(): Promise<BrowserActionResult> { return action("click located not reached"); }
  async textInput(): Promise<BrowserActionResult> { return action("text input not reached"); }
  async screenshotRegion(input: { regionLabel: string }): Promise<BrowserCaptureResult> {
    return {
      browserActionId: `amazon-timeout:capture:${Date.now()}`,
      pageUrl: "about:blank",
      pageTitle: "Amazon Invoice Upload Timeout Fixture",
      regionLabel: input.regionLabel,
      regionType: "viewport",
      width: 900,
      height: 700,
      viewportWidth: 900,
      viewportHeight: 700,
      sourceFilePath: "/tmp/amazon-invoice-upload-timeout-fixture.png",
      createdAt: now(),
    };
  }
  async evaluateActiveTab<T>(): Promise<T> {
    throw new Error("timeout fixture should not evaluate active tab");
  }
  async setFileInputFiles(): Promise<BrowserActionResult> { return action("set file not reached"); }
  async wait(durationMs: number): Promise<BrowserActionResult> { return action(`waited ${durationMs}`); }
  async closeActiveTab(): Promise<BrowserActionResult> { return action("active tab close not reached"); }
  async close(): Promise<BrowserActionResult> { return action("adapter closed"); }
}

await main();
