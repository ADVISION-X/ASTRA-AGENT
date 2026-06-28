import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { strict as assert } from "node:assert";

import type { BrowserController } from "../../src/lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { AmazonListingEditReadSyncInputSchema } from "../../src/plugins/amazon-listing-edit-read-sync/amazon-listing-edit-read-sync.schema.js";
import {
  buildEditTabReadScript,
  buildInventoryExpandAndReadScript,
  buildInventorySearchButtonClickScript,
  buildInventorySearchProbeScript,
  buildInventorySearchSubmitScript,
  buildInventorySkuCentralLinkReadScript,
  buildSkuCentralReadScript,
} from "../../src/plugins/amazon-listing-edit-read-sync/amazon-listing-edit-read-sync.dom-scripts.js";
import {
  getAmazonListingEditReadSyncTaskStatus,
  startAmazonListingEditReadSyncTask,
} from "../../src/plugins/amazon-listing-edit-read-sync/index.js";

const validInput = AmazonListingEditReadSyncInputSchema.parse({
  site: "on-the-way",
  requestId: "listing-edit-read-sync-acceptance",
  marketplace: "amazon.ae",
  maxItems: 1,
});

assert.equal(AmazonListingEditReadSyncInputSchema.safeParse({
  ...validInput,
  selector: "[data-escape]",
}).success, false);
assert.equal(AmazonListingEditReadSyncInputSchema.safeParse({
  ...validInput,
  browserCommand: "click-save",
}).success, false);
assert.equal(AmazonListingEditReadSyncInputSchema.safeParse({
  ...validInput,
  maxItems: 2,
}).success, true);
assert.equal(AmazonListingEditReadSyncInputSchema.safeParse({
  ...validInput,
  maxItems: 201,
}).success, false);
assert.equal(AmazonListingEditReadSyncInputSchema.safeParse({
  ...validInput,
  safetyMode: "single-sku-search-only",
}).success, true);
assert.equal(AmazonListingEditReadSyncInputSchema.safeParse({
  ...validInput,
  safetyMode: "single-sku-search-only",
  maxItems: 2,
}).success, false);
assert.equal(AmazonListingEditReadSyncInputSchema.safeParse({
  ...validInput,
  safetyMode: "single-sku-sku-central-only",
}).success, true);
assert.equal(AmazonListingEditReadSyncInputSchema.safeParse({
  ...validInput,
  safetyMode: "all-inventory-edit-tabs",
  scope: "all-inventory-pages",
  maxItems: 50,
  productType: "SHOWERHEAD",
}).success, true);
assert.equal(AmazonListingEditReadSyncInputSchema.safeParse({
  ...validInput,
  safetyMode: "all-inventory-edit-tabs",
  scope: "visible-inventory-page",
  maxItems: 50,
  productType: "SHOWERHEAD",
}).success, false);

const inventoryScript = buildInventoryExpandAndReadScript();
assert.match(inventoryScript, /VariationExpander-module__expanderHeader/);
assert.match(inventoryScript, /JanusTable-module__tableContentRow/);
assert.doesNotMatch(inventoryScript, /document\.cookie|localStorage|sessionStorage|outerHTML|innerHTML/);

const inventorySearchProbeScript = buildInventorySearchProbeScript();
assert.match(inventorySearchProbeScript, /form#sc-global-search-form/);
assert.match(inventorySearchProbeScript, /input#sc-search-field/);
assert.match(inventorySearchProbeScript, /搜索 SKU、商品名称\/关键词、FNSKU、ASIN、UPC\/EAN/);
assert.match(inventorySearchProbeScript, /shadowRoot/);

const inventorySearchSubmitScript = buildInventorySearchSubmitScript("7Y-PMQW-FOAE");
assert.match(inventorySearchSubmitScript, /Object\.defineProperty/);
assert.match(inventorySearchSubmitScript, /hostValueGetterDefined/);
assert.match(inventorySearchSubmitScript, /input\[type='text'\], input/);
assert.match(inventorySearchSubmitScript, /dispatchEvent/);

const inventorySearchButtonScript = buildInventorySearchButtonClickScript("7Y-PMQW-FOAE");
assert.match(inventorySearchButtonScript, /SearchBox-module__searchButton/);
assert.match(inventorySearchButtonScript, /pointerdown/);
assert.match(inventorySearchButtonScript, /click/);

const skuCentralLinkScript = buildInventorySkuCentralLinkReadScript("7Y-PMQW-FOAE");
assert.ok(skuCentralLinkScript.includes('a[href*="/skucentral"]'));
assert.match(skuCentralLinkScript, /target/);
assert.match(skuCentralLinkScript, /sku_central_link_not_unique/);

const skuCentralScript = buildSkuCentralReadScript();
assert.match(skuCentralScript, /FNSKU/);
assert.match(skuCentralScript, /B\[0-9A-Z\]\{9\}/);
assert.match(skuCentralScript, /销售额/);
assert.match(skuCentralScript, /编辑商品信息/);

const editScript = buildEditTabReadScript("offer");
assert.match(editScript, /kat-input/);
assert.match(editScript, /imageUrls/);
assert.match(editScript, /footerOnly/);
assert.match(editScript, /not_available/);
assert.doesNotMatch(editScript, /document\.cookie|localStorage|sessionStorage|outerHTML|innerHTML/);

class FakeBrowser implements BrowserController {
  opens: string[] = [];
  waits: number[] = [];
  evaluateDescriptions: string[] = [];

  getHealth() {
    return { ok: true, detail: "fake" };
  }

  getSessionState(): ReturnType<BrowserController["getSessionState"]> {
    return {
      open: true,
      currentUrl: this.opens.at(-1) ?? "",
      currentTitle: "fake",
      browserExecutable: null,
      browserMode: "fixture",
      browserProfileRef: "fake",
      browserExecutablePath: null,
      profileStatus: "profile_ready",
      profileDirectory: "Default",
      profileProvisioning: "managed_default",
      profileVerificationStatus: "default_unverified",
      profileVerificationReason: null,
      loginState: "logged_in",
      lastLoginCheckAt: null,
      loginRequiredReason: null,
      reviewRequiredReason: null,
    };
  }

  async getGeometrySnapshot(): ReturnType<BrowserController["getGeometrySnapshot"]> {
    throw new Error("not used");
  }

  async open(input: Parameters<BrowserController["open"]>[0]) {
    this.opens.push(input.url);
    return { browserActionId: "open", ok: true, message: "opened", createdAt: new Date().toISOString() };
  }

  async scroll(): ReturnType<BrowserController["scroll"]> {
    throw new Error("not used");
  }

  async click(): ReturnType<BrowserController["click"]> {
    throw new Error("not used");
  }

  async clickLocatedDomElement(): ReturnType<BrowserController["clickLocatedDomElement"]> {
    throw new Error("not used");
  }

  async textInput(): ReturnType<BrowserController["textInput"]> {
    throw new Error("not used");
  }

  async screenshotRegion(): ReturnType<BrowserController["screenshotRegion"]> {
    throw new Error("not used");
  }

  async evaluateActiveTab<T>(input: Parameters<BrowserController["evaluateActiveTab"]>[0]): Promise<T> {
    this.evaluateDescriptions.push(input.description);
    const requestedSku = input.description.match(/(?:SKU row|result DOM|shadow input|button DOM|href from result DOM|sku central read) ([A-Z0-9_-]+)/)?.[1] ?? "7Y-PMQW-FOAE";
    const requestedAsin = requestedSku === "GG-65PF-KA2I" ? "B0F2P3JK2H" : "B0DB6K6WJ5";
    if (input.description.includes("locate inventory filter SKU search")) {
      return {
        url: "https://sellercentral.amazon.ae/myinventory/inventory",
        title: "Manage Your Inventory",
        detectedState: "ready",
        topGlobalSearchPresent: true,
        topGlobalSearchExcluded: true,
        inventorySearchPlaceholder: "搜索 SKU、商品名称/关键词、FNSKU、ASIN、UPC/EAN",
        inventorySearchUsesShadowInput: true,
        reason: null,
      } as T;
    }
    if (input.description.includes("fill inventory filter SKU shadow input")) {
      return {
        url: "https://sellercentral.amazon.ae/myinventory/inventory",
        title: "Manage Your Inventory",
        detectedState: "ready",
        ok: true,
        submittedValue: "7Y-PMQW-FOAE",
        inputValue: "7Y-PMQW-FOAE",
        hostValue: "7Y-PMQW-FOAE",
        hostValueGetterDefined: true,
        shadowValueReady: true,
        searchEventsReady: true,
        topGlobalSearchExcluded: true,
        searchClickDelayMs: 1000,
        reason: null,
      } as T;
    }
    if (input.description.includes("click inventory filter search button DOM")) {
      return {
        url: "https://sellercentral.amazon.ae/myinventory/inventory",
        title: "Manage Your Inventory",
        detectedState: "ready",
        ok: true,
        clickedButton: true,
        topGlobalSearchExcluded: true,
        reason: null,
      } as T;
    }
    if (input.description.includes("read unique SKU Central href from result DOM")) {
      return {
        url: "https://sellercentral.amazon.ae/myinventory/inventory?searchTerm=7Y-PMQW-FOAE",
        title: "Manage Your Inventory",
        detectedState: "ready",
        href: `https://sellercentral.amazon.ae/skucentral?mSku=${requestedSku}&condition=New&ref_=myp_skuc`,
        target: "_blank",
        linkCount: 1,
        reason: null,
      } as T;
    }
    if (input.description.includes("inventory")) {
      const page = this.opens.at(-1)?.includes("page=2") ? 2 : 1;
      const sku = input.description.includes("verify inventory search exact SKU row") ? requestedSku : page === 2 ? "GG-65PF-KA2I" : "7Y-PMQW-FOAE";
      const asin = sku === "GG-65PF-KA2I" ? "B0F2P3JK2H" : "B0DB6K6WJ5";
      return {
        url: "https://sellercentral.amazon.ae/myinventory/inventory",
        title: "Manage Your Inventory",
        detectedState: "ready",
        expandedCount: 0,
        expandableCount: 1,
        pageInfo: {
          currentPage: page,
          pageSize: 25,
          totalItems: 35,
          totalPages: 2,
          countText: page === 2 ? "26 - 35 共 35" : "1 - 25 共 35",
        },
        items: [{
          asin,
          sku,
          title: "NEXGEN shower",
          rowKind: "child",
          evidenceRef: `inventory-row:${sku}`,
        }],
        reason: null,
      } as T;
    }
    if (input.description.includes("sku central")) {
      return {
        url: "https://sellercentral.amazon.ae/skucentral?mSku=7Y-PMQW-FOAE&condition=New&ref_=myp_skuc",
        title: "SKU Central",
        detectedState: "ready",
        sku: requestedSku,
        asin: requestedAsin,
        fnsku: "X0023A7G4B",
        editButtonVisible: true,
        reason: null,
      } as T;
    }
    return {
      tab: input.description.split(" ").at(-1),
      status: "read",
      reason: null,
      pageUrlPath: "https://sellercentral.amazon.ae/abis/listing/edit",
      pageTitle: "Edit product information",
      headings: ["AD-VISION Filtered Shower Head"],
      visibleText: "AD-VISION Filtered Shower Head ASIN: B0DB6K6WJ5 SKU 7Y-PMQW-FOAE",
      tabLabels: ["产品详情", "图片", "变种", "报价", "安全与合规"],
      controls: [{
        name: "contribution_sku-0-value",
        label: "SKU",
        value: "7Y-PMQW-FOAE",
        tagName: "kat-input",
        type: null,
      }],
      imageUrls: [],
      saveActionLabels: ["保存并完成"],
      evidenceRef: "edit-tab",
    } as T;
  }

  async setFileInputFiles(): ReturnType<BrowserController["setFileInputFiles"]> {
    throw new Error("not used");
  }

  async wait(durationMs: number) {
    this.waits.push(durationMs);
    return { browserActionId: "wait", ok: true, message: "waited", createdAt: new Date().toISOString() };
  }

  async closeActiveTab(): ReturnType<BrowserController["closeActiveTab"]> {
    throw new Error("not used");
  }

  async close(): ReturnType<BrowserController["close"]> {
    throw new Error("not used");
  }
}

const dataDir = await mkdtemp(path.join(os.tmpdir(), "amazon-listing-edit-read-sync-"));
const browser = new FakeBrowser();
const runtimeLogger: RuntimeLogger = {
  emit() {},
  getActiveMode() {
    return "FLOW";
  },
  isDebugEnabled() {
    return false;
  },
  isTraceEnabled() {
    return false;
  },
};
const runtime = {
  dataDir,
  browser,
  runtimeLogger,
  flowTimeoutMs: 20_000,
};

const runningInventoryOnly = await startAmazonListingEditReadSyncTask(validInput, runtime);
assert.equal(runningInventoryOnly.status, "running");
await new Promise((resolve) => setTimeout(resolve, 50));
const finishedInventoryOnly = await getAmazonListingEditReadSyncTaskStatus({ dataDir, taskId: runningInventoryOnly.taskId });
assert.equal(finishedInventoryOnly?.status, "success");
assert.equal(finishedInventoryOnly?.inventoryItems[0]?.sku, "7Y-PMQW-FOAE");
assert.equal(finishedInventoryOnly?.items.length, 0);
assert.equal(browser.opens.some((url) => url.includes("/skucentral?mSku=7Y-PMQW-FOAE")), false);

browser.opens = [];
browser.evaluateDescriptions = [];
const runningSearchOnly = await startAmazonListingEditReadSyncTask({
  ...validInput,
  requestId: "listing-edit-read-sync-search-only",
  safetyMode: "single-sku-search-only",
}, runtime);
assert.equal(runningSearchOnly.status, "running");
await new Promise((resolve) => setTimeout(resolve, 50));
const finishedSearchOnly = await getAmazonListingEditReadSyncTaskStatus({ dataDir, taskId: runningSearchOnly.taskId });
assert.equal(finishedSearchOnly?.status, "success");
assert.equal(finishedSearchOnly?.reachedStep, "inventory_sku_search_only_finished");
assert.equal(finishedSearchOnly?.items.length, 0);
assert.ok(browser.evaluateDescriptions.some((description) => description.includes("fill inventory filter SKU shadow input")));
assert.ok(browser.evaluateDescriptions.some((description) => description.includes("verify inventory search exact SKU row")));
assert.ok(browser.evaluateDescriptions.some((description) => description.includes("read unique SKU Central href from result DOM")));
assert.equal(browser.opens.some((url) => url.includes("/skucentral?mSku=7Y-PMQW-FOAE")), false);

browser.opens = [];
browser.evaluateDescriptions = [];
const runningSkuCentralOnly = await startAmazonListingEditReadSyncTask({
  ...validInput,
  requestId: "listing-edit-read-sync-sku-central-only",
  safetyMode: "single-sku-sku-central-only",
}, runtime);
assert.equal(runningSkuCentralOnly.status, "running");
await new Promise((resolve) => setTimeout(resolve, 50));
const finishedSkuCentralOnly = await getAmazonListingEditReadSyncTaskStatus({ dataDir, taskId: runningSkuCentralOnly.taskId });
assert.equal(finishedSkuCentralOnly?.status, "success");
assert.equal(finishedSkuCentralOnly?.reachedStep, "sku_central_only_finished");
assert.equal(finishedSkuCentralOnly?.items[0]?.fnsku, "X0023A7G4B");
assert.equal(finishedSkuCentralOnly?.items[0]?.tabs.length, 0);
assert.ok(browser.evaluateDescriptions.some((description) => description.includes("read unique SKU Central href from result DOM")));
assert.equal(browser.opens.some((url) => url.includes("/skucentral?mSku=7Y-PMQW-FOAE")), true);
assert.equal(browser.opens.some((url) => url.includes("/abis/listing/edit")), false);

browser.opens = [];
browser.evaluateDescriptions = [];
const running = await startAmazonListingEditReadSyncTask({
  ...validInput,
  requestId: "listing-edit-read-sync-single-sku",
  safetyMode: "single-sku-edit-tabs",
  productType: "SHOWERHEAD",
}, runtime);
assert.equal(running.status, "running");
await new Promise((resolve) => setTimeout(resolve, 50));
const finished = await getAmazonListingEditReadSyncTaskStatus({ dataDir, taskId: running.taskId });
assert.equal(finished?.status, "success");
assert.equal(finished?.inventoryItems[0]?.sku, "7Y-PMQW-FOAE");
assert.equal(finished?.items[0]?.fnsku, "X0023A7G4B");
assert.equal(finished?.items[0]?.tabs.length, 5);
assert.ok(finished?.items[0]?.tabs.every((tab) => tab.visibleText?.includes("AD-VISION")));
assert.ok(finished?.items[0]?.tabs.some((tab) => tab.saveActionLabels.includes("保存并完成")));
assert.ok(browser.evaluateDescriptions.some((description) => description.includes("locate inventory filter SKU search")));
assert.ok(browser.evaluateDescriptions.some((description) => description.includes("fill inventory filter SKU shadow input")));
assert.ok(browser.evaluateDescriptions.some((description) => description.includes("click inventory filter search button DOM")));
assert.ok(browser.evaluateDescriptions.some((description) => description.includes("verify inventory search exact SKU row")));
assert.ok(browser.evaluateDescriptions.some((description) => description.includes("read unique SKU Central href from result DOM")));
assert.equal(browser.opens.some((url) => url.includes("/skucentral?mSku=7Y-PMQW-FOAE")), true);
assert.equal(browser.opens.some((url) => url.includes("/abis/listing/edit")), true);
assert.equal(browser.opens.some((url) => url.includes("/abis/listing/edit/offer") && url.includes("ref_=obo_el_skuc_ac") && url.endsWith("#offer")), true);
assert.equal(browser.opens.some((url) => url.includes("page=offer")), false);

browser.opens = [];
browser.evaluateDescriptions = [];
const runningAll = await startAmazonListingEditReadSyncTask({
  ...validInput,
  requestId: "listing-edit-read-sync-all",
  safetyMode: "all-inventory-edit-tabs",
  scope: "all-inventory-pages",
  maxItems: 50,
  productType: "SHOWERHEAD",
}, runtime);
assert.equal(runningAll.status, "running");
await new Promise((resolve) => setTimeout(resolve, 50));
const finishedAll = await getAmazonListingEditReadSyncTaskStatus({ dataDir, taskId: runningAll.taskId });
assert.equal(finishedAll?.status, "success");
assert.equal(finishedAll?.inventoryItems.length, 2);
assert.equal(finishedAll?.items.length, 2);
assert.ok(browser.opens.some((url) => url.includes("page=2")));
assert.ok(browser.evaluateDescriptions.some((description) => description.includes("inventory expand and read page 2")));
assert.ok(browser.opens.filter((url) => url.includes("/myinventory/inventory")).length >= 4);

console.log("amazon-listing-edit-read-sync acceptance passed");
