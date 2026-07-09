import { strict as assert } from "node:assert";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { BrowserController } from "../../src/lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { renderAppShell } from "../../src/app/app-shell/app-shell.js";
import { AmazonListingEditReadSyncInputSchema } from "../../src/plugins/amazon-listing-edit-read-sync/amazon-listing-edit-read-sync.schema.js";
import {
  buildEditTabReadScript,
  buildInventoryExpandAndReadScript,
  buildInventorySearchProbeScript,
  buildInventorySearchSubmitScript,
} from "../../src/plugins/amazon-listing-edit-read-sync/amazon-listing-edit-read-sync.dom-scripts.js";
import {
  getAmazonListingEditReadSyncTaskStatus,
  startAmazonListingEditReadSyncTask,
} from "../../src/plugins/amazon-listing-edit-read-sync/index.js";

const childSku = "7Y-PMQW-FOAE";
const childAsin = "B0DB6K6WJ5";
const parentSku = "RB-LVVM-AAF1";
const parentAsin = "B0FJ7RDM6H";

const validInput = {
  site: "on-the-way",
  requestId: "listing-edit-read-sync-acceptance",
  marketplace: "amazon.ae",
  maxItems: 1,
} as const;

const logger: RuntimeLogger = {
  emit() {},
  getActiveMode: () => "FLOW",
  isDebugEnabled: () => false,
  isTraceEnabled: () => false,
};

const waitForTask = async (dataDir: string, taskId: string) => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const task = await getAmazonListingEditReadSyncTaskStatus({ dataDir, taskId });
    if (task && task.status !== "queued" && task.status !== "running") return task;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return getAmazonListingEditReadSyncTaskStatus({ dataDir, taskId });
};

const inventoryResult = () => ({
  url: "https://sellercentral.amazon.ae/myinventory/inventory",
  title: "Manage Your Inventory",
  detectedState: "ready" as const,
  expandedCount: 0,
  expandableCount: 1,
  pageInfo: { currentPage: 1, pageSize: 25, totalItems: 2, totalPages: 1, countText: "1 - 2 共 2" },
  items: [
    { asin: parentAsin, sku: parentSku, title: "Parent shower", rowKind: "parent" as const, parentAsin: null, parentSku: null, evidenceRef: `inventory-row:${parentSku}` },
    { asin: childAsin, sku: childSku, title: "Child shower", rowKind: "child" as const, parentAsin, parentSku, evidenceRef: `inventory-row:${childSku}` },
  ],
  reason: null,
});

const searchProbeResult = () => ({
  url: "https://sellercentral.amazon.ae/myinventory/inventory",
  title: "Manage Your Inventory",
  detectedState: "ready" as const,
  topGlobalSearchPresent: true,
  topGlobalSearchExcluded: true,
  inventorySearchPlaceholder: "搜索 SKU、商品名称/关键词、FNSKU、ASIN、UPC/EAN",
  inventorySearchUsesShadowInput: true,
  reason: null,
});

const searchSubmitResult = () => ({
  url: "https://sellercentral.amazon.ae/myinventory/inventory",
  title: "Manage Your Inventory",
  detectedState: "ready" as const,
  ok: true,
  submittedValue: childSku,
  inputValue: childSku,
  hostValue: childSku,
  hostValueGetterDefined: true,
  shadowValueReady: true,
  searchEventsReady: true,
  topGlobalSearchExcluded: true,
  searchClickDelayMs: 1000,
  reason: null,
});

const searchClickResult = () => ({
  url: "https://sellercentral.amazon.ae/myinventory/inventory",
  title: "Manage Your Inventory",
  detectedState: "ready" as const,
  ok: true,
  clickedButton: true,
  topGlobalSearchExcluded: true,
  reason: null,
});

const skuCentralLinkResult = () => ({
  url: "https://sellercentral.amazon.ae/myinventory/inventory?searchTerm=7Y-PMQW-FOAE",
  title: "Manage Your Inventory",
  detectedState: "ready" as const,
  href: `https://sellercentral.amazon.ae/skucentral?mSku=${childSku}&condition=New&ref_=myp_skuc`,
  target: "_blank",
  linkCount: 1,
  reason: null,
});

const skuCentralResult = () => ({
  url: `https://sellercentral.amazon.ae/skucentral?mSku=${childSku}&condition=New&ref_=myp_skuc`,
  title: "SKU Central",
  detectedState: "ready" as const,
  sku: childSku,
  asin: childAsin,
  fnsku: "X0023A7G4B",
  editButtonVisible: true,
  reason: null,
});

const editTabResult = (description: string) => ({
  tab: description.split(" ").at(-1) ?? "offer",
  status: "read" as const,
  reason: null,
  pageUrlPath: "https://sellercentral.amazon.ae/abis/listing/edit",
  pageTitle: "Edit product information",
  headings: ["AD-VISION Filtered Shower Head"],
  visibleText: `ASIN: ${childAsin} SKU ${childSku}`,
  tabLabels: ["产品详情", "图片", "变种", "报价", "安全与合规"],
  controls: [{ name: "contribution_sku-0-value", label: "SKU", value: childSku, tagName: "kat-input", type: null }],
  imageUrls: [],
  saveActionLabels: ["保存并完成"],
  evidenceRef: "edit-tab",
});

class FakeBrowser implements BrowserController {
  opens: string[] = [];
  evaluateDescriptions: string[] = [];
  waits: number[] = [];

  getHealth = () => ({ ok: true, detail: "fake" });
  getSessionState = (): ReturnType<BrowserController["getSessionState"]> => ({
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
  });
  getGeometrySnapshot = async (): ReturnType<BrowserController["getGeometrySnapshot"]> => { throw new Error("not used"); };
  open = async (input: Parameters<BrowserController["open"]>[0]) => {
    this.opens.push(input.url);
    return { browserActionId: "open", ok: true, message: "opened", createdAt: new Date().toISOString() };
  };
  scroll = async (): ReturnType<BrowserController["scroll"]> => { throw new Error("not used"); };
  click = async (): ReturnType<BrowserController["click"]> => { throw new Error("not used"); };
  clickLocatedDomElement = async (): ReturnType<BrowserController["clickLocatedDomElement"]> => { throw new Error("not used"); };
  textInput = async (): ReturnType<BrowserController["textInput"]> => { throw new Error("not used"); };
  screenshotRegion = async (): ReturnType<BrowserController["screenshotRegion"]> => { throw new Error("not used"); };
  setFileInputFiles = async (): ReturnType<BrowserController["setFileInputFiles"]> => { throw new Error("not used"); };
  closeActiveTab = async (): ReturnType<BrowserController["closeActiveTab"]> => { throw new Error("not used"); };
  close = async (): ReturnType<BrowserController["close"]> => { throw new Error("not used"); };
  wait = async (durationMs: number) => {
    this.waits.push(durationMs);
    return { browserActionId: "wait", ok: true, message: "waited", createdAt: new Date().toISOString() };
  };
  evaluateActiveTab = async <T>(input: Parameters<BrowserController["evaluateActiveTab"]>[0]): Promise<T> => {
    this.evaluateDescriptions.push(input.description);
    if (input.description.includes("locate inventory filter")) return searchProbeResult() as T;
    if (input.description.includes("fill inventory filter")) return searchSubmitResult() as T;
    if (input.description.includes("click inventory filter")) return searchClickResult() as T;
    if (input.description.includes("read unique SKU Central href")) return skuCentralLinkResult() as T;
    if (input.description.includes("sku central read")) return skuCentralResult() as T;
    if (input.description.includes("edit tab read")) return editTabResult(input.description) as T;
    return inventoryResult() as T;
  };
}

const assertSchema = () => {
  assert.equal(AmazonListingEditReadSyncInputSchema.safeParse({ ...validInput, selector: "[data-escape]" }).success, false);
  assert.equal(AmazonListingEditReadSyncInputSchema.safeParse({ ...validInput, browserCommand: "click-save" }).success, false);
  assert.equal(AmazonListingEditReadSyncInputSchema.safeParse({ ...validInput, rawHtml: "<html></html>" }).success, false);
  assert.equal(AmazonListingEditReadSyncInputSchema.safeParse({ ...validInput, targetMode: "asin", target: { asin: childAsin } }).success, true);
  assert.equal(AmazonListingEditReadSyncInputSchema.safeParse({ ...validInput, targetMode: "sku", target: { sku: childSku } }).success, true);
  assert.equal(AmazonListingEditReadSyncInputSchema.safeParse({ ...validInput, targetMode: "parent", target: { parentSku } }).success, true);
  assert.equal(AmazonListingEditReadSyncInputSchema.safeParse({ ...validInput, targetMode: "child", target: { parentSku, childSku } }).success, true);
  assert.equal(AmazonListingEditReadSyncInputSchema.safeParse({ ...validInput, targetMode: "child", target: {} }).success, false);
};

const assertDomScripts = () => {
  assert.match(buildInventoryExpandAndReadScript(), /parentAsin/);
  assert.match(buildInventoryExpandAndReadScript(), /parentSku/);
  assert.match(buildInventorySearchProbeScript(), /form#sc-global-search-form/);
  assert.match(buildInventorySearchSubmitScript(childSku), /Object\.defineProperty/);
  assert.doesNotMatch(buildEditTabReadScript("offer"), /document\.cookie|localStorage|sessionStorage|outerHTML|innerHTML/);
};

const startAndFinish = async (rawInput: unknown) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "amazon-listing-edit-read-sync-"));
  const browser = new FakeBrowser();
  const running = await startAmazonListingEditReadSyncTask(rawInput, { dataDir, browser, runtimeLogger: logger, flowTimeoutMs: 20_000 });
  const task = await waitForTask(dataDir, running.taskId);
  assert.ok(task);
  return { browser, task };
};

const assertTargetModes = async () => {
  const skuRun = await startAndFinish({ ...validInput, targetMode: "sku", target: { sku: childSku }, safetyMode: "single-sku-search-only" });
  assert.equal(skuRun.task?.targetResolution.status, "matched");
  assert.equal(skuRun.browser.opens.some((url) => url.includes("/skucentral")), false);

  const childRun = await startAndFinish({ ...validInput, targetMode: "child", target: { parentSku, childSku }, safetyMode: "single-sku-sku-central-only" });
  assert.equal(childRun.task?.status, "success");
  assert.equal(childRun.task?.items[0]?.fnsku, "X0023A7G4B");

  const parentRun = await startAndFinish({ ...validInput, targetMode: "parent", target: { parentSku }, safetyMode: "inventory-only" });
  assert.equal(parentRun.task?.status, "success");
  assert.equal(parentRun.task?.targetResolution.matchedParent?.sku, parentSku);
  assert.equal(parentRun.task?.inventoryItems[0]?.sku, childSku);
};

const assertAppShell = () => {
  const html = renderAppShell();
  assert.match(html, /data-skill-id="amazon-listing-edit-read-sync"/);
  assert.match(html, /data-listing-edit-read-form/);
  assert.match(html, /name="targetMode"/);
  assert.match(html, /name="parentSku"/);
  assert.match(html, /name="childSku"/);
  assert.doesNotMatch(html, /name="selector"|name="browserCommand"|name="rawHtml"/);
};

assertSchema();
assertDomScripts();
assertAppShell();
await assertTargetModes();

console.log("amazon-listing-edit-read-sync acceptance passed");
