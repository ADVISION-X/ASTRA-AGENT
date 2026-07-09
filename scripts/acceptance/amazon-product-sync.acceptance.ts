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
import { persistAmazonProductSyncTask } from "../../src/plugins/amazon-product-sync/amazon-product-sync.storage.js";

const now = (): string => new Date().toISOString();

const action = (message: string): BrowserActionResult => ({
  browserActionId: `amazon-product-sync-acceptance:${Date.now()}`,
  ok: true,
  message,
  createdAt: now(),
});

const fixtureInventoryUrl = "https://sellercentral.amazon.ae/myinventory/inventory";
const fixtureSku = "DL-UG6I-2OWL";

const inventorySearchProbeFixture = <T>(): T => ({
  url: fixtureInventoryUrl,
  title: "Manage Your Inventory",
  detectedState: "ready",
  topGlobalSearchPresent: true,
  topGlobalSearchExcluded: true,
  inventorySearchPlaceholder: "搜索 SKU、商品名称/关键词、FNSKU、ASIN、UPC/EAN",
  inventorySearchUsesShadowInput: true,
  inventorySearchInputPoint: { x: 327, y: 310 },
  inventorySearchButtonPoint: { x: 604, y: 310 },
  reason: null,
}) as T;

const inventorySearchMissingProbeFixture = <T>(): T => ({
  url: fixtureInventoryUrl,
  title: "Manage Your Inventory",
  detectedState: "review_required",
  topGlobalSearchPresent: true,
  topGlobalSearchExcluded: false,
  inventorySearchPlaceholder: null,
  inventorySearchUsesShadowInput: false,
  inventorySearchInputPoint: null,
  inventorySearchButtonPoint: null,
  reason: "inventory_filter_katal_search_missing",
}) as T;

const inventorySearchSubmitFixture = <T>(): T => ({
  url: fixtureInventoryUrl,
  title: "Manage Your Inventory",
  detectedState: "ready",
  ok: true,
  submittedValue: fixtureSku,
  inputValue: fixtureSku,
  hostValue: fixtureSku,
  hostValueGetterDefined: true,
  shadowValueReady: true,
  searchEventsReady: true,
  hostAttributeValue: fixtureSku,
  clickedButton: false,
  searchClickDelayMs: 1200,
  inventorySearchButtonPoint: { x: 604, y: 310 },
  hostValueAction: "kat-input host own value getter for React onInput target",
  topGlobalSearchExcluded: true,
  reason: null,
}) as T;

const inventorySearchButtonClickFixture = <T>(): T => ({
  url: fixtureInventoryUrl,
  title: "Manage Your Inventory",
  detectedState: "ready",
  ok: true,
  clickedButton: true,
  hostValue: fixtureSku,
  inputValue: fixtureSku,
  pointerDownDispatched: true,
  mouseDownDispatched: true,
  pointerUpDispatched: true,
  mouseUpDispatched: true,
  clickEventDispatched: true,
  topGlobalSearchExcluded: true,
  submitAction: "SearchBox-module__searchButton DOM MouseEvent submit click",
  reason: null,
}) as T;

const inventorySearchResultFixture = <T>(): T => ({
  url: fixtureInventoryUrl,
  title: "Manage Your Inventory",
  detectedState: "ready",
  searchVerified: true,
  searchVerificationEvidence: ["exact_sku_row_visible"],
  rows: [
    {
      sellerSku: fixtureSku,
      asinSnapshot: "B012345678",
      sellerCentralTitleSnapshot: "Acceptance Product Title",
      imagePresent: true,
      imageSrc: "https://m.media-amazon.com/images/I/acceptance-product.png",
      listingStatus: "active",
      availableFbaUnits: 0,
      actualInventoryUnits: 0,
      inboundUnits: 0,
      unfulfillableUnits: 0,
      reservedUnits: 0,
      sales30dSnapshot: 4,
    },
  ],
}) as T;

class AmazonProductSyncFakeBrowser implements BrowserController {
  openedUrls: string[] = [];
  openReusePolicies: string[] = [];
  clickLabels: string[] = [];
  evaluateDescriptions: string[] = [];
  evaluateScripts: string[] = [];
  screenshotCalls = 0;
  closeActiveTabCalls = 0;

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

  async open(input: { url: string; reusePolicy?: string }): Promise<BrowserActionResult> {
    this.openedUrls.push(input.url);
    if (input.reusePolicy) this.openReusePolicies.push(input.reusePolicy);
    return action("opened seller central inventory");
  }

  async scroll(): Promise<BrowserActionResult> { return action("scroll"); }

  async click(input: { targetLabel: string }): Promise<BrowserActionResult> {
    this.clickLabels.push(input.targetLabel);
    return action(input.targetLabel);
  }

  async clickLocatedDomElement(): Promise<BrowserActionResult> { return action("clickLocatedDomElement"); }

  async textInput(input: { targetLabel: string }): Promise<BrowserActionResult> { return action(input.targetLabel); }

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
      return inventorySearchProbeFixture<T>();
    }
    if (input.description.includes("fill inventory filter SKU shadow input and submit search")) {
      return inventorySearchSubmitFixture<T>();
    }
    if (input.description.includes("click inventory filter search button DOM")) {
      return inventorySearchButtonClickFixture<T>();
    }
    if (input.description.includes("variation expanders")) {
      return { collapsedCount: 0, points: [] } as T;
    }
    return inventorySearchResultFixture<T>();
  }

  async setFileInputFiles(): Promise<BrowserActionResult> { return action("setFileInputFiles"); }
  async wait(): Promise<BrowserActionResult> {
    await new Promise((resolve) => setTimeout(resolve, 10));
    return action("wait");
  }
  async closeActiveTab(): Promise<BrowserActionResult> {
    this.closeActiveTabCalls += 1;
    return action("closeActiveTab");
  }
  async close(): Promise<BrowserActionResult> { return action("close"); }
}

class AmazonProductSyncHangingBrowser extends AmazonProductSyncFakeBrowser {
  override async open(): Promise<BrowserActionResult> {
    return new Promise<BrowserActionResult>(() => undefined);
  }
}

class AmazonProductSyncDelayedInventoryBrowser extends AmazonProductSyncFakeBrowser {
  inventoryProbeCount = 0;

  override async evaluateActiveTab<T>(input: { description: string; script: string }): Promise<T> {
    if (input.description.includes("locate inventory filter SKU search")) {
      this.inventoryProbeCount += 1;
      this.evaluateDescriptions.push(input.description);
      this.evaluateScripts.push(input.script);
      return this.inventoryProbeCount === 1
        ? inventorySearchMissingProbeFixture<T>()
        : inventorySearchProbeFixture<T>();
    }
    return super.evaluateActiveTab<T>(input);
  }
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

const waitForRunningProgress = async (dataDir: string, taskId: string) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const task = await getAmazonProductSyncTaskStatus({ dataDir, taskId });
    if (task?.status === "running" && task.reachedStep !== "flow_started") {
      return task;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("amazon product sync task did not persist observable running progress");
};

const dataDir = mkdtempSync(join(tmpdir(), "amazon-product-sync-acceptance-"));
const browser = new AmazonProductSyncFakeBrowser();
const runtimeLogger = createRuntimeLogger({ terminalEnabled: false });
const originalFetch = globalThis.fetch;
const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const fetchCalls: string[] = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = String(input);
  fetchCalls.push(url);
  if (url.includes("m.media-amazon.com")) {
    return new Response(pngBytes, { status: 200, headers: { "content-type": "image/png" } });
  }
  if (url.includes("/api/apex/amazon-manage/products/images/sku/")) {
    assert.equal(init?.method, "POST");
    assert.equal((init?.headers as Record<string, string>)["x-amzmgr-agent-product-image-token"], "acceptance-image-token");
    const body = JSON.parse(String(init?.body)) as { readonly imageBase64: string; readonly imageMimeType: string; readonly agentTaskId: string };
    assert.equal(body.imageMimeType, "image/png");
    assert.ok(body.imageBase64.length > 0);
    assert.ok(body.agentTaskId.startsWith("amazon_product_sync_"));
    return Response.json({
      ok: true,
      imageUrl: `/api/apex/amazon-manage/products/images/sku/${fixtureSku}?v=acceptance-sha`,
      mediaId: "acceptance-sha",
      imageSha256: "acceptance-sha",
    });
  }
  return new Response("not found", { status: 404 });
}) as typeof fetch;
const started = await startAmazonProductSyncTask({
  site: "ontheway-amazon-manage",
  requestId: "acceptance-amazon-product-sync-1",
  marketplace: "amazon.ae",
  scope: "selected-skus",
  closeAmazonTabOnCompletion: true,
  items: [{
    sourceKeyType: "sku",
    sourceKey: "DL-UG6I-2OWL",
    sellerSku: "DL-UG6I-2OWL",
    requiredFields: ["mainImage", "asin", "availableInventory", "actualInventory"],
    mainImageUpload: {
      endpoint: `http://127.0.0.1:3000/api/apex/amazon-manage/products/images/sku/${fixtureSku}`,
      token: "acceptance-image-token",
    },
  }],
}, { dataDir, browser, runtimeLogger });

assert.equal(started.status, "running");
const runningProgress = await waitForRunningProgress(dataDir, started.taskId);
assert.ok(runningProgress.reachedStep.startsWith("seller_central_inventory_"));
const terminal = await waitForTerminal(dataDir, started.taskId);
assert.equal(terminal.status, "success");
assert.equal(terminal.site, "ontheway-amazon-manage");
assert.equal(terminal.items[0]?.status, "matched");
assert.deepEqual(terminal.items[0]?.requestedFields, ["mainImage", "asin", "availableInventory", "actualInventory"]);
assert.deepEqual(terminal.items[0]?.missingRequestedFields, []);
assert.equal(terminal.items[0]?.asinSnapshot, "B012345678");
assert.equal(terminal.items[0]?.availableFbaUnits, 0);
assert.equal(terminal.items[0]?.actualInventoryUnits, 0);
assert.ok(terminal.items[0]?.sellerCentralMainImageEvidenceRef?.startsWith("evidence://amazon-product-sync/"));
assert.equal(terminal.items[0]?.mainImageUpload?.status, "uploaded");
assert.equal(terminal.items[0]?.mainImageUpload?.mediaId, "acceptance-sha");
assert.ok(terminal.items[0]?.mainImageUpload?.imageUrl?.includes("/api/apex/amazon-manage/products/images/sku/"));
assert.ok(fetchCalls.some((url) => url.includes("m.media-amazon.com")));
assert.ok(fetchCalls.some((url) => url.includes("/api/apex/amazon-manage/products/images/sku/")));
assert.equal(browser.screenshotCalls, 1);
assert.equal(browser.closeActiveTabCalls, 1);
assert.ok(terminal.items[0]?.rowEvidenceRef?.startsWith("evidence://amazon-product-sync/"));

assert.ok(browser.openedUrls[0]?.includes("/myinventory/inventory"));
assert.equal(browser.openedUrls.filter((url) => url.includes("/myinventory/inventory")).length, 1);
assert.ok(browser.openReusePolicies.includes("reuse-host-tab"));
assert.ok(browser.evaluateDescriptions.some((description) => description.includes("exclude top global search")));
assert.ok(browser.evaluateDescriptions.some((description) => description.includes("fill inventory filter SKU shadow input")));
assert.ok(browser.evaluateDescriptions.some((description) => description.includes("click inventory filter search button DOM")));
assert.ok(browser.evaluateDescriptions.some((description) => description.includes("verify result DOM")));
assert.equal(browser.clickLabels.includes("Seller Central inventory filter search button"), false);
assert.ok(browser.evaluateScripts.some((script) => script.includes("form#sc-global-search-form")));
assert.ok(browser.evaluateScripts.some((script) => script.includes("input#sc-search-field")));
assert.ok(browser.evaluateScripts.some((script) => script.includes("button.sc-search-button")));
assert.ok(browser.evaluateScripts.some((script) => script.includes("搜索 SKU、商品名称/关键词、FNSKU、ASIN、UPC/EAN")));
assert.ok(browser.evaluateScripts.some((script) => script.includes("shadowRoot")));
assert.ok(browser.evaluateScripts.some((script) => script.includes("input[type='text'], input")));
assert.ok(browser.evaluateScripts.some((script) => script.includes("dispatchEvent")));
assert.ok(browser.evaluateScripts.some((script) => script.includes("document.createEvent")));
assert.ok(browser.evaluateScripts.some((script) => script.includes("Object.defineProperty")));
assert.ok(browser.evaluateScripts.some((script) => script.includes("hostValueGetterDefined")));
assert.ok(browser.evaluateScripts.some((script) => script.includes("shadowValueReady")));
assert.ok(browser.evaluateScripts.some((script) => script.includes("searchEventsReady")));
assert.ok(browser.evaluateScripts.some((script) => script.includes("kat-input host own value getter for React onInput target")));
assert.ok(browser.evaluateScripts.some((script) => script.includes("SearchBox-module__searchButton MouseEvent click")));
assert.ok(browser.evaluateScripts.some((script) => script.includes("SearchBox-module__searchButton DOM MouseEvent submit click")));
assert.ok(browser.evaluateScripts.some((script) => script.includes("pointerdown")));
assert.ok(browser.evaluateScripts.some((script) => script.includes("clickEventDispatched")));
assert.ok(browser.evaluateScripts.some((script) => script.includes("searchClickDelayMs")));

const delayedDataDir = mkdtempSync(join(tmpdir(), "amazon-product-sync-delayed-inventory-acceptance-"));
const delayedBrowser = new AmazonProductSyncDelayedInventoryBrowser();
const delayedStarted = await startAmazonProductSyncTask({
  site: "ontheway-amazon-manage",
  requestId: "acceptance-amazon-product-sync-delayed-inventory",
  marketplace: "amazon.ae",
  scope: "selected-skus",
  items: [{
    sourceKeyType: "sku",
    sourceKey: "DL-UG6I-2OWL",
    sellerSku: "DL-UG6I-2OWL",
    requiredFields: ["mainImage", "asin", "availableInventory", "actualInventory"],
    mainImageUpload: {
      endpoint: `http://127.0.0.1:3000/api/apex/amazon-manage/products/images/sku/${fixtureSku}`,
      token: "acceptance-image-token",
    },
  }],
}, { dataDir: delayedDataDir, browser: delayedBrowser, runtimeLogger });
const delayedTerminal = await waitForTerminal(delayedDataDir, delayedStarted.taskId);
assert.equal(delayedTerminal.status, "success");
assert.equal(delayedBrowser.inventoryProbeCount, 2);

await assert.rejects(
  () => startAmazonProductSyncTask({
    site: "ontheway-amazon-manage",
    requestId: "acceptance-amazon-product-sync-reject-partial-fields",
    marketplace: "amazon.ae",
    scope: "selected-skus",
    items: [{
      sourceKeyType: "sku",
      sourceKey: "DL-UG6I-2OWL",
      sellerSku: "DL-UG6I-2OWL",
      requiredFields: ["availableInventory"],
    }],
  }, { dataDir, browser, runtimeLogger }),
  /mainImage, asin, availableInventory, and actualInventory/u,
);

await assert.rejects(
  () => startAmazonProductSyncTask({
    site: "ontheway-amazon-manage",
    requestId: "acceptance-amazon-product-sync-reject-multi-sku-agent-task",
    marketplace: "amazon.ae",
    scope: "selected-skus",
    items: [
      {
        sourceKeyType: "sku",
        sourceKey: "DL-UG6I-2OWL",
        sellerSku: "DL-UG6I-2OWL",
          requiredFields: ["mainImage", "asin", "availableInventory", "actualInventory"],
      },
      {
        sourceKeyType: "sku",
        sourceKey: "CB-T02I-5X78",
        sellerSku: "CB-T02I-5X78",
        requiredFields: ["mainImage", "asin", "availableInventory", "actualInventory"],
      },
    ],
  }, { dataDir, browser, runtimeLogger }),
  /exactly one SKU item/u,
);

const timeoutDataDir = mkdtempSync(join(tmpdir(), "amazon-product-sync-timeout-acceptance-"));
const timeoutBrowser = new AmazonProductSyncHangingBrowser();
const expectedTimeoutReason = "amazon_product_sync_flow_timeout_after_20ms";
const timedOut = await startAmazonProductSyncTask({
  site: "ontheway-amazon-manage",
  requestId: "acceptance-amazon-product-sync-timeout",
  marketplace: "amazon.ae",
  scope: "selected-skus",
  items: [{
    sourceKeyType: "sku",
    sourceKey: "DL-UG6I-2OWL",
    sellerSku: "DL-UG6I-2OWL",
    requiredFields: ["mainImage", "asin", "availableInventory", "actualInventory"],
  }],
}, { dataDir: timeoutDataDir, browser: timeoutBrowser, runtimeLogger, flowTimeoutMs: 20 });
const timeoutTerminal = await waitForTerminal(timeoutDataDir, timedOut.taskId);
assert.equal(timeoutTerminal.status, "failed");
assert.equal(timeoutTerminal.reason, expectedTimeoutReason);

const staleDataDir = mkdtempSync(join(tmpdir(), "amazon-product-sync-stale-acceptance-"));
await persistAmazonProductSyncTask(staleDataDir, {
  taskId: "amazon_product_sync_stale_acceptance",
  site: "ontheway-amazon-manage",
  requestId: "acceptance-amazon-product-sync-stale",
  marketplace: "amazon.ae",
  ok: false,
  status: "running",
  reason: null,
  reachedStep: "flow_started",
  items: [],
  createdAt: new Date(Date.now() - 70_000).toISOString(),
  updatedAt: new Date(Date.now() - 70_000).toISOString(),
});
const staleStatus = await getAmazonProductSyncTaskStatus({
  dataDir: staleDataDir,
  taskId: "amazon_product_sync_stale_acceptance",
});
assert.equal(staleStatus?.status, "failed");
assert.equal(staleStatus?.reason, "amazon_product_sync_running_progress_stale_after_60000ms");

globalThis.fetch = originalFetch;
process.stdout.write("[AMAZON-PRODUCT-SYNC][PASS] inventory filter SKU search acceptance passed\n");
