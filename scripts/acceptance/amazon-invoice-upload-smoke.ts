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
import { runAmazonInvoiceUpload } from "../../src/plugins/amazon-invoice-upload/index.js";

async function main(): Promise<void> {
const tmp = mkdtempSync(join(tmpdir(), "grasseye-amazon-smoke-"));
const htmlPath = join(tmp, "seller-central.html");
const pdfPath = join(tmp, "invoice.pdf");
writeFileSync(pdfPath, "local smoke pdf");
writeFileSync(htmlPath, `
<html><head><title>Seller Central Local Dry Run</title></head>
<body>
  <label for="order-search">Order search</label>
  <input id="order-search" type="search" placeholder="Search orders by order id" />
  <button id="search-button">Search</button>
  <table id="orders">
    <tr id="order-row"><td>123-1234567-1234567</td><td>Buyer</td><td>Ship</td></tr>
  </table>
  <div id="upload-invoice" role="button" tabindex="0">Upload invoice</div>
  <section id="upload-panel" hidden>
    <label for="invoice-file">Choose file</label>
    <input id="invoice-file" type="file" />
    <label for="invoice-number">Invoice number</label>
    <input id="invoice-number" name="documentNumber" type="text" />
    <button id="submit-upload">上传</button>
  </section>
  <div id="status"></div>
  <script>
    document.querySelector("#upload-invoice").addEventListener("click", () => {
      document.querySelector("#upload-panel").hidden = false;
    });
    document.querySelector("#invoice-file").addEventListener("change", () => {
      document.querySelector("#status").textContent = "File attached INV-1";
    });
    document.querySelector("#submit-upload").addEventListener("click", () => {
      document.querySelector("#status").textContent = "Invoice uploaded successfully";
    });
  </script>
</body></html>
`);

const launched = await chromium.launch({ headless: true });
const page = await launched.newPage({ viewport: { width: 900, height: 700 } });
const browser = new AmazonSmokeBrowserAdapter(page, tmp);
const runtimeLogger = createRuntimeLogger({ terminalEnabled: false });

try {
  const result = await runAmazonInvoiceUpload(browser, runtimeLogger, {
    missionType: "amazon_invoice_upload",
    marketplace: "AE",
    amazonOrderId: "123-1234567-1234567",
    invoiceNo: "INV-1",
    invoicePdfPath: pdfPath,
    sellerCentralEntryUrl: pathToFileURL(htmlPath).href,
    requireHumanFinalSubmit: false,
  });

  if (
    result.status !== "upload_success"
    || result.reachedStep !== "upload success verified"
  ) {
    process.stdout.write(`[AMAZON-INVOICE-UPLOAD-SMOKE][FAIL] unexpected dry-run result: ${JSON.stringify(result)}\n`);
    process.exit(1);
  }
  process.stdout.write("[AMAZON-INVOICE-UPLOAD-SMOKE][PASS] plugin dry-run flow reached upload_success\n");
} finally {
  await launched.close();
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
  private closedActiveTabCount = 0;

  constructor(private readonly page: Page, private readonly screenshotDir: string) {}

  getClosedActiveTabCount(): number { return this.closedActiveTabCount; }
  getHealth(): { ok: boolean; detail: string } { return { ok: true, detail: "playwright Amazon upload smoke adapter" }; }
  getSessionState(): BrowserStateSnapshot { return buildBrowserState(this.page); }
  async getGeometrySnapshot(): Promise<BrowserGeometrySnapshot> { return buildGeometrySnapshot(this.page); }
  async open(input: { url: string; title: string }): Promise<BrowserActionResult> {
    await this.page.goto(input.url);
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
    await this.page.locator(input.elementRef.selector).setInputFiles(input.filePath);
    return action(`set approved file for ${input.description}`);
  }
  async wait(durationMs: number): Promise<BrowserActionResult> {
    await this.page.waitForTimeout(durationMs);
    return action(`waited ${durationMs}`);
  }
  async closeActiveTab(): Promise<BrowserActionResult> {
    this.closedActiveTabCount += 1;
    return action("active tab closed");
  }
  async close(): Promise<BrowserActionResult> { return action("adapter closed"); }
}

await main();
