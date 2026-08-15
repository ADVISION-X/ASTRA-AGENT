import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Page } from "playwright";

import type {
  BrowserActionResult,
  BrowserCaptureResult,
  BrowserTargetSession,
  BrowserGeometrySnapshot,
  BrowserStateSnapshot,
} from "../../src/lib/browser/browser-controller.js";
import type {
  BrowserDocumentRef,
  BrowserTargetRef,
  ControlledBrowserTarget,
} from "../../src/lib/browser/exact-target/browser-target-ref.js";
import { toBrowserEvaluationExpression } from "../../src/lib/browser/exact-target/browser-evaluation-contract.js";

export const ORDER_DETAIL_EIGHTH_WINDOW_SIGNAL_DELAY_MS = 15_000;
const UPLOAD_DIALOG_OPEN_DELAY_MS = 2_300;

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
  <section id="upload-panel" role="dialog" hidden>
    <h2>为订单 123-1234567-1234567 上传发票</h2>
    <p>请上传您的发票或贷记单</p>
    <label for="invoice-file">Choose file</label>
    <kat-file-upload name="document" accept="application/pdf"><span><input id="invoice-file" name="document" type="file" hidden /></span></kat-file-upload>
    <kat-input required="true" label="文件编号" type="text" value="" name="documentNumber"></kat-input>
    <button id="submit-upload">上传</button>
  </section>
  <div id="status"></div>
  <script>
    customElements.define("kat-file-upload", class extends HTMLElement {
      connectedCallback() {
        if (this.shadowRoot) return;
        const root = this.attachShadow({ mode: "open" });
        root.innerHTML = '<input id="kat-file-attachment" type="file" accept="application/pdf" />';
        root.querySelector("input").addEventListener("change", (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const item = document.createElement("kat-file-item");
          item.setAttribute("name", file.name);
          item.setAttribute("file-status", "ready");
          item.textContent = file.name + " 文件未上传";
          root.appendChild(item);
          event.target.value = "";
        });
      }
    });
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
          root.querySelector("input").addEventListener("change", (event) => {
            hidden.value = event.target.value;
            this.setAttribute("value", event.target.value);
          });
        }
      }
    });
    window.uploadInvoiceClickCount = 0;
    document.querySelector("#upload-invoice").addEventListener("click", () => {
      window.uploadInvoiceClickCount += 1;
      window.setTimeout(() => {
        document.querySelector("#upload-panel").hidden = false;
      }, ${UPLOAD_DIALOG_OPEN_DELAY_MS});
    });
    window.setTimeout(() => {
      document.querySelector("#upload-invoice").textContent = "Upload invoice";
    }, ${ORDER_DETAIL_EIGHTH_WINDOW_SIGNAL_DELAY_MS});
    document.querySelector("kat-file-upload").shadowRoot.querySelector("#kat-file-attachment").addEventListener("change", () => {
      document.querySelector("#status").textContent = "File attached INV-1";
    });
    document.querySelector("#submit-upload").addEventListener("click", () => {
      const invoiceNumber = document.querySelector('kat-input[name="documentNumber"] input[name="documentNumber"]').value;
      if (invoiceNumber !== "INV-1") {
        document.querySelector("#status").textContent = "Invoice number missing";
        return;
      }
      document.querySelector("#upload-panel").innerHTML = '<h3>订单123-1234567-1234567的发票</h3>'
        + '<p>感谢您上传文件。客户可以直接从自己的账户下载文件。</p>'
        + '<table><tr><th>日期</th><th>类型</th><th>编号</th><th>状态</th><th>操作</th></tr>'
        + '<tr><td>2026/8/16</td><td>发票 由卖家生成</td><td>INV-1</td><td>等待中：待处理</td><td>下载</td></tr></table>'
        + '<div>上传其他发票或贷记单</div>';
    });
  </script>
</body></html>
`;

type InvoiceDialogFixtureBehavior = "recovers" | "repeats" | "read_failure_recovers" | "delayed_existing" | "delayed_upload_ready";

const noActionsDialogFixtureHtml = (behavior: InvoiceDialogFixtureBehavior): string => `
<html><head><title>Seller Central No Actions Dialog Fixture</title></head>
<body>
  <label for="order-search">Order search</label>
  <input id="order-search" type="search" placeholder="Search orders by order id" />
  <button id="search-button">Search</button>
  <table id="orders">
    <tr id="order-row"><td>123-1234567-1234567</td><td>Buyer</td><td>Ship</td></tr>
  </table>
  <div>订单编号：123-1234567-1234567</div>
  <button id="manage-invoice">管理发票</button>
  <div id="invoice-dialog" role="dialog" hidden
    style="position:fixed;left:250px;top:180px;width:400px;height:220px;background:white;border:1px solid black;z-index:2">
    <div id="invoice-dialog-content"></div>
  </div>
  <script>
    const behavior = ${JSON.stringify(behavior)};
    const dialog = document.querySelector("#invoice-dialog");
    const content = document.querySelector("#invoice-dialog-content");
    let manageClicks = 0;
    const uploadedTable = '<h3>订单123-1234567-1234567的发票</h3><table><tr><th>日期</th><th>类型</th><th>编号</th><th>状态</th><th>操作</th></tr><tr><td>2026/1/27</td><td>发票 由卖家生成</td><td>INV-RECOVERY</td><td>成功：已上传</td><td>下载</td></tr></table><div>上传其他发票或贷记单</div>';
    const uploadReadyTable = '<h3>订单123-1234567-1234567的发票</h3><table><tr><th>日期</th><th>类型</th><th>编号</th><th>状态</th><th>操作</th></tr></table><div>上传其他发票或贷记单</div>';
    document.querySelector("#manage-invoice").addEventListener("click", () => {
      manageClicks += 1;
      window.manageInvoiceClickCount = manageClicks;
      dialog.hidden = false;
      content.innerHTML = "";
      if (behavior === "delayed_existing" || behavior === "delayed_upload_ready") {
        window.setTimeout(() => {
          content.innerHTML = behavior === "delayed_existing" ? uploadedTable : uploadReadyTable;
        }, 2300);
        return;
      }
      content.innerHTML = (behavior === "recovers" || behavior === "read_failure_recovers") && manageClicks === 2
        ? uploadedTable
        : behavior === "read_failure_recovers"
          ? "<h3>订单123-1234567-1234567的发票</h3><div>读取失败</div>"
          : "<h3>订单123-1234567-1234567的发票</h3><div>很抱歉，目前没有可用的操作。</div>";
    });
    document.addEventListener("click", (event) => {
      if (!dialog.hidden && !dialog.contains(event.target) && event.target.id !== "manage-invoice") {
        dialog.hidden = true;
      }
    });
  </script>
</body></html>
`;

export type SmokeFixturePaths = {
  tmp: string;
  htmlPath: string;
  pdfPath: string;
};

export const createSmokeFixturePaths = (): SmokeFixturePaths => {
  const tmp = mkdtempSync(join(tmpdir(), "grasseye-amazon-smoke-"));
  const htmlPath = join(tmp, "seller-central.html");
  const pdfPath = join(tmp, "invoice.pdf");
  writeFileSync(pdfPath, buildInvoicePdf("59.50"));
  writeFileSync(htmlPath, smokeFixtureHtml);
  return { tmp, htmlPath, pdfPath };
};

export const createNoActionsDialogFixturePaths = (
  behavior: "recovers" | "repeats" | "read_failure_recovers",
): SmokeFixturePaths => {
  const tmp = mkdtempSync(join(tmpdir(), "grasseye-amazon-no-actions-"));
  const htmlPath = join(tmp, "seller-central-no-actions.html");
  const pdfPath = join(tmp, "invoice.pdf");
  writeFileSync(pdfPath, buildInvoicePdf("59.50"));
  writeFileSync(htmlPath, noActionsDialogFixtureHtml(behavior));
  return { tmp, htmlPath, pdfPath };
};

export const createDelayedInvoiceDialogFixturePaths = (
  behavior: "delayed_existing" | "delayed_upload_ready",
): SmokeFixturePaths => {
  const tmp = mkdtempSync(join(tmpdir(), "grasseye-amazon-delayed-invoice-dialog-"));
  const htmlPath = join(tmp, "seller-central-delayed-invoice-dialog.html");
  const pdfPath = join(tmp, "invoice.pdf");
  writeFileSync(pdfPath, buildInvoicePdf("59.50"));
  writeFileSync(htmlPath, noActionsDialogFixtureHtml(behavior));
  return { tmp, htmlPath, pdfPath };
};

export const buildInvoicePdf = (amount: string): Buffer => Buffer.from(`%PDF-1.4
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

const now = (): string => new Date().toISOString();

const action = (message: string, ok = true): BrowserActionResult => ({
  browserActionId: `amazon-smoke:${Date.now()}`,
  ok,
  message,
  createdAt: now(),
});

const buildBrowserState = (page: Page): BrowserStateSnapshot => ({
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
});

const buildGeometrySnapshot = async (page: Page): Promise<BrowserGeometrySnapshot> => {
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
};

export class AmazonSmokeBrowserAdapter implements BrowserTargetSession {
  closeTargetCalls = 0;
  fileInputSetCalls = 0;
  noActionsDialogDismissClicks = 0;
  domSnapshotTimeouts: number[] = [];
  openReusePolicies: string[] = [];
  fileUrlOpenCount = 0;
  duplicateOrderDetailOpenCount = 0;

  constructor(private readonly page: Page, private readonly screenshotDir: string) {}

  getTarget(): ControlledBrowserTarget {
    const url = this.page.url();
    return {
      targetRef: "fixture:amazon-smoke" as BrowserTargetRef,
      documentRef: `fixture:amazon-smoke:${url}` as BrowserDocumentRef,
      url,
      title: "Amazon Invoice Upload Smoke",
      origin: url.startsWith("file:") ? "file://" : new URL(url).origin,
      lifecycle: "attached",
      acquiredAt: now(),
    };
  }
  getHealth(): { ok: boolean; detail: string } { return { ok: true, detail: "playwright Amazon upload smoke adapter" }; }
  getSessionState(): BrowserStateSnapshot { return buildBrowserState(this.page); }
  async getGeometrySnapshot(): Promise<BrowserGeometrySnapshot> { return buildGeometrySnapshot(this.page); }
  async open(input: { url: string; title: string; reusePolicy?: string; browserActionId?: string; abortSignal?: AbortSignal }): Promise<BrowserActionResult> {
    const startedAtMs = Date.now();
    const startedAt = new Date(startedAtMs).toISOString();
    if (input.reusePolicy) this.openReusePolicies.push(input.reusePolicy);
    await this.page.goto(input.url);
    if (input.url.startsWith("file:")) {
      this.fileUrlOpenCount += 1;
      if (this.fileUrlOpenCount > 1) this.duplicateOrderDetailOpenCount += 1;
    }
    return {
      ...action(`opened ${input.title}`),
      browserActionId: input.browserActionId ?? `amazon-smoke:open:${Date.now()}`,
      actionKind: "open",
      requestedHost: new URL(input.url).host || "local-file",
      reusePolicy: (input.reusePolicy ?? "reuse-exact-url") as "reuse-exact-url",
      navigationMode: "navigated_exact_target",
      observedUrl: this.page.url(),
      observedUrlMatchesRequest: new URL(this.page.url()).pathname === new URL(input.url).pathname,
      startedAt,
      durationMs: Math.max(0, Date.now() - startedAtMs),
    };
  }
  async scroll(): Promise<BrowserActionResult> { return action("scroll not needed"); }
  async click(input: { targetLabel: string; point: { x: number; y: number }; button?: "left" | "right" | "middle"; clickCount?: 1 | 2 }): Promise<BrowserActionResult> {
    await this.page.mouse.click(input.point.x, input.point.y, { button: input.button ?? "left", clickCount: input.clickCount ?? 1 });
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
  async evaluate<T>(input: { script: string; description: string; timeoutMs?: number; abortSignal?: AbortSignal }): Promise<T> {
    input.abortSignal?.throwIfAborted();
    if (input.description === "read governed DOM structural summary from exact target") {
      this.domSnapshotTimeouts.push(input.timeoutMs ?? 0);
    }
    if (input.description === "locate and click one safe blank point outside the blocked Amazon manage-invoice dialog") {
      this.noActionsDialogDismissClicks += 1;
    }
    return this.page.evaluate<T>(toBrowserEvaluationExpression(input.script));
  }
  async setFileInputFiles(input: { elementRef: { selector: string; targetKind: "file-input" }; filePath: string; description: string }): Promise<BrowserActionResult> {
    this.fileInputSetCalls += 1;
    const receiver = this.page.locator("kat-file-upload").locator("#kat-file-attachment");
    await receiver.setInputFiles(input.filePath);
    const readyItem = this.page.locator("kat-file-upload").locator('kat-file-item[file-status="ready"]');
    if (await readyItem.count() !== 1 || await receiver.evaluate((element) => (element as HTMLInputElement).files?.length ?? 0) !== 0) {
      throw new Error("fixture component did not consume the approved file into one ready item");
    }
    return action(`set approved file for ${input.description}`);
  }
  async wait(durationMs: number, abortSignal?: AbortSignal): Promise<BrowserActionResult> {
    abortSignal?.throwIfAborted();
    await this.page.waitForTimeout(durationMs);
    abortSignal?.throwIfAborted();
    return action(`waited ${durationMs}`);
  }
  async closeTarget(): Promise<BrowserActionResult> { this.closeTargetCalls += 1; return action("active tab closed"); }
  async close(): Promise<BrowserActionResult> { return action("adapter closed"); }
}

export class AmazonHangingOpenBrowserAdapter implements BrowserTargetSession {
  openCalls = 0;
  abortCount = 0;
  private executionAbortSignal: AbortSignal | null = null;

  setExecutionAbortSignal(abortSignal: AbortSignal | null): void { this.executionAbortSignal = abortSignal; }
  getHealth(): { ok: boolean; detail: string } { return { ok: true, detail: "hanging open timeout fixture" }; }
  getSessionState(): BrowserStateSnapshot {
    return {
      browserMode: "fixture", browserProfileRef: "hanging-open", browserExecutablePath: null,
      profileStatus: "profile_ready", profileDirectory: "hanging-open", profileProvisioning: "operator_supplied",
      profileVerificationStatus: "operator_verified", profileVerificationReason: "local timeout fixture",
      loginState: "unknown", currentUrl: "about:blank", lastLoginCheckAt: null, loginRequiredReason: null,
      reviewRequiredReason: null, open: true, currentTitle: "Amazon Invoice Upload Timeout Fixture", browserExecutable: null,
    };
  }
  async getGeometrySnapshot(): Promise<BrowserGeometrySnapshot> {
    return {
      windowX: 0, windowY: 0, viewportWidth: 900, viewportHeight: 700, screenshotWidth: 900, screenshotHeight: 700,
      scaleFactor: 1, currentUrl: "about:blank", pageTitle: "Amazon Invoice Upload Timeout Fixture",
      visibleContentBounds: { x: 0, y: 0, width: 900, height: 700 }, capturedAt: now(),
    };
  }
  async open(input: Parameters<BrowserTargetSession["open"]>[0]): Promise<BrowserActionResult> {
    this.openCalls += 1;
    return new Promise<BrowserActionResult>((_resolve, reject) => {
      const signal = input.abortSignal ?? this.executionAbortSignal ?? undefined;
      signal?.addEventListener("abort", () => {
        this.abortCount += 1;
        reject(signal.reason ?? new Error("aborted"));
      }, { once: true });
    });
  }
  async scroll(): Promise<BrowserActionResult> { return action("scroll not reached"); }
  async click(): Promise<BrowserActionResult> { return action("click not reached"); }
  async clickLocatedDomElement(): Promise<BrowserActionResult> { return action("click located not reached"); }
  async textInput(): Promise<BrowserActionResult> { return action("text input not reached"); }
  async screenshotRegion(input: { regionLabel: string }): Promise<BrowserCaptureResult> {
    return {
      browserActionId: `amazon-timeout:capture:${Date.now()}`, pageUrl: "about:blank",
      pageTitle: "Amazon Invoice Upload Timeout Fixture", regionLabel: input.regionLabel, regionType: "viewport",
      width: 900, height: 700, viewportWidth: 900, viewportHeight: 700,
      sourceFilePath: "/tmp/amazon-invoice-upload-timeout-fixture.png", createdAt: now(),
    };
  }
  async evaluate<T>(): Promise<T> { throw new Error("timeout fixture should not evaluate active tab"); }
  async setFileInputFiles(): Promise<BrowserActionResult> { return action("set file not reached"); }
  async wait(durationMs: number): Promise<BrowserActionResult> { return action(`waited ${durationMs}`); }
  async closeTarget(): Promise<BrowserActionResult> { return action("active tab close not reached"); }
  async close(): Promise<BrowserActionResult> { return action("adapter closed"); }
}
