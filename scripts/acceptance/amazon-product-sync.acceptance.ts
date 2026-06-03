import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strict as assert } from "node:assert";

import type {
  BrowserActionResult,
  BrowserCaptureResult,
  BrowserController,
  BrowserGeometrySnapshot,
  BrowserStateSnapshot,
} from "../../src/lib/browser/browser-controller.js";
import {
  getAmazonProductSyncTaskStatus,
  startAmazonProductSyncTask,
} from "../../src/plugins/amazon-product-sync/index.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";

const now = (): string => new Date().toISOString();

const action = (message: string): BrowserActionResult => ({
  browserActionId: `amazon-product-sync-acceptance:${Date.now()}`,
  ok: true,
  message,
  createdAt: now(),
});

class AmazonProductSyncFakeBrowser implements BrowserController {
  openedUrls: string[] = [];
  clickLabels: string[] = [];
  textInputLabels: string[] = [];
  evaluateDescriptions: string[] = [];
  evaluateScripts: string[] = [];
  screenshotCalls = 0;

  getHealth() { return { ok: true, detail: "amazon product sync fake browser" }; }

  getSessionState(): BrowserStateSnapshot {
    return {
      browserMode: "fixture",
      browserProfileRef: "fixture",
      browserExecutablePath: null,
      profileStatus: "profile_ready",
      profileDirectory: "fixture",
      profileProvisioning: "operator_supplied",
      profileVerificationStatus: "operator_verified",
      profileVerificationReason: "fixture",
      loginState: "unknown",
      currentUrl: this.openedUrls.at(-1) ?? "about:blank",
      lastLoginCheckAt: null,
      loginRequiredReason: null,
      reviewRequiredReason: null,
      open: true,
      currentTitle: "Manage Your Inventory",
      browserExecutable: null,
    };
  }

  async getGeometrySnapshot(): Promise<BrowserGeometrySnapshot> {
    return {
      windowX: 0,
      windowY: 0,
      viewportWidth: 1200,
      viewportHeight: 800,
      screenshotWidth: 1200,
      screenshotHeight: 800,
      scaleFactor: 1,
      currentUrl: this.getSessionState().currentUrl,
      pageTitle: "Manage Your Inventory",
      visibleContentBounds: { x: 0, y: 0, width: 1200, height: 800 },
      capturedAt: now(),
    };
  }

  async open(input: { url: string }): Promise<BrowserActionResult> {
    this.openedUrls.push(input.url);
    return action("opened seller central inventory");
  }

  async scroll(): Promise<BrowserActionResult> { return action("scroll"); }

  async click(input: { targetLabel: string }): Promise<BrowserActionResult> {
    this.clickLabels.push(input.targetLabel);
    return action(input.targetLabel);
  }

  async clickLocatedDomElement(): Promise<BrowserActionResult> { return action("clickLocatedDomElement"); }

  async textInput(input: { targetLabel: string }): Promise<BrowserActionResult> {
    this.textInputLabels.push(input.targetLabel);
    return action(input.targetLabel);
  }

  async screenshotRegion(): Promise<BrowserCaptureResult> {
    this.screenshotCalls += 1;
    return {
      browserActionId: `fixture-capture-${this.screenshotCalls}`,
      pageUrl: this.getSessionState().currentUrl,
      pageTitle: "Manage Your Inventory",
      regionLabel: "amazon-product-sync main image evidence",
      regionType: "viewport",
      width: 1200,
      height: 800,
      viewportWidth: 1200,
      viewportHeight: 800,
      sourceFilePath: "/tmp/fixture.png",
      createdAt: now(),
    };
  }

  async evaluateActiveTab<T>(input: { description: string; script: string }): Promise<T> {
    this.evaluateDescriptions.push(input.description);
    this.evaluateScripts.push(input.script);
    if (input.description.includes("locate inventory filter SKU search")) {
      return {
        url: "https://sellercentral.amazon.ae/myinventory/inventory",
        title: "Manage Your Inventory",
        detectedState: "ready",
        topGlobalSearchPresent: true,
        topGlobalSearchExcluded: true,
        inventorySearchPlaceholder: "搜索 SKU、商品名称/关键词、FNSKU、ASIN、UPC/EAN",
        inventorySearchUsesShadowInput: true,
        inventorySearchInputPoint: { x: 327, y: 310 },
        inventorySearchButtonPoint: { x: 604, y: 310 },
        reason: null,
      } as T;
    }
    if (input.description.includes("variation expanders")) {
      return { collapsedCount: 0, points: [] } as T;
    }
    return {
      url: "https://sellercentral.amazon.ae/myinventory/inventory?searchField=all&searchTerm=DL-UG6I-2OWL",
      title: "Manage Your Inventory",
      detectedState: "ready",
      searchVerified: true,
      searchVerificationEvidence: ["url_searchTerm_exact", "exact_sku_row_visible"],
      rows: [
        {
          sellerSku: "DL-UG6I-2OWL",
          asinSnapshot: "B012345678",
          sellerCentralTitleSnapshot: "Acceptance Product Title",
          imagePresent: true,
          listingStatus: "active",
          availableFbaUnits: 28,
          inboundUnits: 0,
          unfulfillableUnits: 0,
          reservedUnits: 0,
          sales30dSnapshot: 4,
        },
      ],
    } as T;
  }

  async setFileInputFiles(): Promise<BrowserActionResult> { return action("setFileInputFiles"); }
  async wait(): Promise<BrowserActionResult> { return action("wait"); }
  async closeActiveTab(): Promise<BrowserActionResult> { return action("closeActiveTab"); }
  async close(): Promise<BrowserActionResult> { return action("close"); }
}

const waitForTerminal = async (dataDir: string, taskId: string) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const task = await getAmazonProductSyncTaskStatus({ dataDir, taskId });
    if (task && task.status !== "queued" && task.status !== "running") {
      return task;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("amazon product sync task did not reach terminal status");
};

const dataDir = mkdtempSync(join(tmpdir(), "amazon-product-sync-acceptance-"));
const browser = new AmazonProductSyncFakeBrowser();
const runtimeLogger = createRuntimeLogger({ terminalEnabled: false });
const started = await startAmazonProductSyncTask({
  site: "ontheway-amazon-manage",
  requestId: "acceptance-amazon-product-sync-1",
  marketplace: "amazon.ae",
  scope: "selected-skus",
  items: [{
    sourceKeyType: "sku",
    sourceKey: "DL-UG6I-2OWL",
    sellerSku: "DL-UG6I-2OWL",
    requiredFields: ["mainImage", "asin", "availableInventory"],
  }],
}, { dataDir, browser, runtimeLogger });

assert.equal(started.status, "running");
const terminal = await waitForTerminal(dataDir, started.taskId);
assert.equal(terminal.status, "success");
assert.equal(terminal.site, "ontheway-amazon-manage");
assert.equal(terminal.items[0]?.status, "matched");
assert.deepEqual(terminal.items[0]?.requestedFields, ["mainImage", "asin", "availableInventory"]);
assert.deepEqual(terminal.items[0]?.missingRequestedFields, []);
assert.equal(terminal.items[0]?.asinSnapshot, "B012345678");
assert.equal(terminal.items[0]?.availableFbaUnits, 28);
assert.ok(terminal.items[0]?.sellerCentralMainImageEvidenceRef?.startsWith("evidence://amazon-product-sync/"));
assert.equal(browser.screenshotCalls, 1);
assert.ok(terminal.items[0]?.rowEvidenceRef?.startsWith("evidence://amazon-product-sync/"));

assert.ok(browser.openedUrls[0]?.includes("/myinventory/inventory"));
assert.ok(browser.clickLabels.some((label) => label.includes("inventory filter SKU search input")));
assert.ok(browser.clickLabels.some((label) => label.includes("inventory filter submit SKU search")));
assert.ok(browser.textInputLabels.some((label) => label.includes("clear SKU search")));
assert.ok(browser.textInputLabels.some((label) => label.includes("type SKU DL-UG6I-2OWL")));
assert.ok(browser.evaluateDescriptions.some((description) => description.includes("exclude top global search")));
assert.ok(browser.evaluateDescriptions.some((description) => description.includes("verify result DOM")));
assert.ok(browser.evaluateScripts.some((script) => script.includes("form#sc-global-search-form")));
assert.ok(browser.evaluateScripts.some((script) => script.includes("input#sc-search-field")));
assert.ok(browser.evaluateScripts.some((script) => script.includes("button.sc-search-button")));
assert.ok(browser.evaluateScripts.some((script) => script.includes("搜索 SKU、商品名称/关键词、FNSKU、ASIN、UPC/EAN")));
assert.ok(browser.evaluateScripts.some((script) => script.includes("shadowRoot")));
assert.ok(browser.evaluateScripts.some((script) => script.includes("searchTerm")));

process.stdout.write("[AMAZON-PRODUCT-SYNC][PASS] inventory filter SKU search acceptance passed\n");
