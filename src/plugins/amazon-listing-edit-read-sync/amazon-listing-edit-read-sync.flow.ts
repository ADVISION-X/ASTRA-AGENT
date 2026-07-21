import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type {
  AmazonListingEditReadSyncDiagnostic,
  AmazonListingEditReadSyncInput,
  AmazonListingEditReadSyncInventoryItem,
  AmazonListingEditReadSyncItemResult,
  AmazonListingEditReadSyncPageState,
  AmazonListingEditReadSyncTabRead,
  AmazonListingEditReadSyncTargetResolution,
  AmazonListingEditReadSyncTaskRecord,
} from "./amazon-listing-edit-read-sync.schema.js";
import {
  buildBlockedTabRead,
  buildEditTabReadScript,
  buildInventoryExpandAndReadScript,
  buildSkuCentralReadScript,
  type InventoryReadScriptResult,
  type SkuCentralReadScriptResult,
} from "./amazon-listing-edit-read-sync.dom-scripts.js";
import { editTabUrl, inventoryUrlForPage, pageUrlPath } from "./amazon-listing-edit-read-sync.urls.js";
import { buildTargetResolution, selectInventoryItems } from "./amazon-listing-edit-read-sync.target-resolution.js";
import { runInventorySkuSearch } from "./amazon-listing-edit-read-sync.inventory-search.js";

export type AmazonListingEditReadSyncFlowProgress = {
  readonly reachedStep: string;
  readonly reason?: string | null;
  readonly inventoryItems?: readonly AmazonListingEditReadSyncInventoryItem[];
  readonly items?: readonly AmazonListingEditReadSyncItemResult[];
  readonly targetResolution?: AmazonListingEditReadSyncTargetResolution;
  readonly diagnostic?: AmazonListingEditReadSyncDiagnostic;
};

type FlowInput = {
  readonly browser: BrowserController;
  readonly mission: AmazonListingEditReadSyncInput;
  readonly taskId: string;
  readonly createdAt: string;
  readonly onProgress?: (progress: AmazonListingEditReadSyncFlowProgress) => Promise<void>;
};

const authGateFromState = (state: AmazonListingEditReadSyncPageState): AmazonListingEditReadSyncDiagnostic["authGate"] =>
  state === "ready" ? "none" : state;

const buildDiagnostic = (
  stage: string,
  page: Pick<InventoryReadScriptResult | SkuCentralReadScriptResult, "detectedState" | "title" | "url">,
): AmazonListingEditReadSyncDiagnostic => ({
  authGate: authGateFromState(page.detectedState),
  detectedState: page.detectedState,
  diagnosticStage: stage,
  pageTitle: page.title || null,
  pageUrlPath: pageUrlPath(page.url),
});

const terminalStatusFromState = (state: AmazonListingEditReadSyncPageState): AmazonListingEditReadSyncTaskRecord["status"] | null => {
  if (state === "login_required") return "login_required";
  if (state === "captcha_or_2fa_required") return "captcha_or_2fa_required";
  if (state === "review_required") return "review_required";
  return null;
};

const resultEvidenceRef = (taskId: string, sku: string): string =>
  `evidence://amazon-listing-edit-read-sync/${taskId}/${encodeURIComponent(sku)}`;

const readInventoryPage = async (
  input: FlowInput,
  url: string,
  pageLabel: string,
): Promise<InventoryReadScriptResult> => {
  await input.browser.open({
    url,
    title: `Amazon listing edit read sync inventory ${pageLabel}`,
    reusePolicy: "reuse-host-tab",
  });
  await input.browser.wait(1000);
  let latest = await input.browser.evaluateActiveTab<InventoryReadScriptResult>({
      script: buildInventoryExpandAndReadScript(),
      description: `amazon-listing-edit-read-sync inventory expand and read ${pageLabel} pass 1`,
    });
  if (latest.expandedCount > 0) {
    await input.browser.wait(1000);
  }
  for (let attempt = 2; attempt <= 15; attempt += 1) {
    latest = await input.browser.evaluateActiveTab<InventoryReadScriptResult>({
      script: buildInventoryExpandAndReadScript(),
      description: `amazon-listing-edit-read-sync inventory expand and read ${pageLabel} pass ${attempt}`,
    });
    if (latest.items.length > 0 || terminalStatusFromState(latest.detectedState)) {
      return latest;
    }
    await input.browser.wait(1000);
  }
  return latest;
};

const readInventory = async (input: FlowInput): Promise<InventoryReadScriptResult> =>
  readInventoryPage(input, inventoryUrlForPage(input.mission.marketplace, 1), "page 1");

const mergeInventoryItems = (
  pages: readonly InventoryReadScriptResult[],
): readonly AmazonListingEditReadSyncInventoryItem[] => {
  const seen = new Set<string>();
  const items: AmazonListingEditReadSyncInventoryItem[] = [];
  for (const page of pages) {
    for (const item of page.items) {
      const key = `${item.asin.toUpperCase()}::${item.sku.toUpperCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
  }
  return items;
};

const readAllInventoryPages = async (input: FlowInput): Promise<InventoryReadScriptResult> => {
  const firstPage = await readInventory(input);
  await input.onProgress?.({
    reachedStep: "inventory_page_read",
    reason: firstPage.pageInfo.countText ?? "page_1_read",
    inventoryItems: firstPage.items,
    diagnostic: buildDiagnostic("inventory_page_read", firstPage),
  });
  const terminal = terminalStatusFromState(firstPage.detectedState);
  if (terminal) return firstPage;
  const totalPages = Math.min(firstPage.pageInfo.totalPages ?? 1, Math.ceil(input.mission.maxItems / firstPage.pageInfo.pageSize));
  if (totalPages <= 1) return firstPage;
  const pages: InventoryReadScriptResult[] = [firstPage];
  for (let page = 2; page <= totalPages; page += 1) {
    const nextPage = await readInventoryPage(input, inventoryUrlForPage(input.mission.marketplace, page), `page ${page}`);
    pages.push(nextPage);
    await input.onProgress?.({
      reachedStep: "inventory_page_read",
      reason: nextPage.pageInfo.countText ?? `page_${page}_read`,
      inventoryItems: mergeInventoryItems(pages),
      diagnostic: buildDiagnostic("inventory_page_read", nextPage),
    });
    if (terminalStatusFromState(nextPage.detectedState)) return nextPage;
  }
  return {
    ...pages.at(-1)!,
    items: mergeInventoryItems(pages),
  };
};

const readSkuCentral = async (
  input: FlowInput,
  item: AmazonListingEditReadSyncInventoryItem,
  skuCentralHref: string,
): Promise<SkuCentralReadScriptResult> => {
  await input.browser.open({
    url: skuCentralHref,
    title: `Amazon SKU Central ${item.sku}`,
    reusePolicy: "reuse-host-tab",
  });
  let latest: SkuCentralReadScriptResult | null = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await input.browser.wait(attempt === 0 ? 1200 : 750);
    latest = await input.browser.evaluateActiveTab<SkuCentralReadScriptResult>({
      script: buildSkuCentralReadScript(),
      description: `amazon-listing-edit-read-sync sku central read ${item.sku} attempt ${attempt}`,
    });
    if (terminalStatusFromState(latest.detectedState) || (latest.sku && latest.asin && latest.editButtonVisible)) {
      return latest;
    }
  }
  return latest ?? {
    url: skuCentralHref,
    title: "",
    detectedState: "review_required",
    sku: null,
    asin: null,
    fnsku: null,
    editButtonVisible: false,
    reason: "sku_central_dom_not_ready",
  };
};

const readEditTabs = async (
  input: FlowInput,
  item: AmazonListingEditReadSyncInventoryItem,
): Promise<readonly AmazonListingEditReadSyncTabRead[]> => {
  const reads: AmazonListingEditReadSyncTabRead[] = [];
  for (const tab of input.mission.tabs) {
    const url = editTabUrl(input.mission, item, tab);
    if (!url) {
      reads.push(buildBlockedTabRead(tab, "product_type_required_for_edit_tab_url"));
      continue;
    }
    await input.browser.open({
      url,
      title: `Amazon listing edit ${item.sku} ${tab}`,
      reusePolicy: "reuse-host-tab",
    });
    let latest: AmazonListingEditReadSyncTabRead | null = null;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await input.browser.wait(attempt === 0 ? 1500 : 1000);
      latest = await input.browser.evaluateActiveTab<AmazonListingEditReadSyncTabRead>({
        script: buildEditTabReadScript(tab),
        description: `amazon-listing-edit-read-sync edit tab read ${item.sku} ${tab} attempt ${attempt}`,
      });
      if (latest.status === "read") break;
    }
    reads.push(latest ?? buildBlockedTabRead(tab, "edit_tab_dom_not_ready"));
  }
  return reads;
};

const buildItemResult = async (
  input: FlowInput,
  item: AmazonListingEditReadSyncInventoryItem,
  skuCentralHref: string,
): Promise<AmazonListingEditReadSyncItemResult> => {
  const skuCentral = await readSkuCentral(input, item, skuCentralHref);
  const terminal = terminalStatusFromState(skuCentral.detectedState);
  if (terminal) {
    return {
      asin: item.asin,
      sku: item.sku,
      status: "blocked",
      reason: terminal,
      fnsku: null,
      skuCentralUrlPath: pageUrlPath(skuCentral.url),
      tabs: input.mission.tabs.map((tab) => buildBlockedTabRead(tab, terminal)),
      evidenceRef: resultEvidenceRef(input.taskId, item.sku),
    };
  }
  const tabs = await readEditTabs(input, item);
  const completeTabs = tabs.filter((tab) => tab.status === "read" || tab.status === "not_available").length;
  return {
    asin: skuCentral.asin ?? item.asin,
    sku: skuCentral.sku ?? item.sku,
    status: completeTabs === tabs.length ? "matched" : completeTabs > 0 ? "parse_failed" : "blocked",
    reason: completeTabs === tabs.length ? null : "one_or_more_edit_tabs_not_read",
    fnsku: skuCentral.fnsku,
    skuCentralUrlPath: pageUrlPath(skuCentral.url),
    tabs,
    evidenceRef: resultEvidenceRef(input.taskId, item.sku),
  };
};

const buildBlockedItemResult = (
  input: FlowInput,
  item: AmazonListingEditReadSyncInventoryItem,
  reason: string,
): AmazonListingEditReadSyncItemResult => ({
  asin: item.asin,
  sku: item.sku,
  status: "blocked",
  reason,
  fnsku: null,
  skuCentralUrlPath: null,
  tabs: input.mission.tabs.map((tab) => buildBlockedTabRead(tab, reason)),
  evidenceRef: resultEvidenceRef(input.taskId, item.sku),
});

const buildBatchStoppedTask = (
  input: FlowInput,
  inventoryItems: readonly AmazonListingEditReadSyncInventoryItem[],
  items: readonly AmazonListingEditReadSyncItemResult[],
  targetResolution: AmazonListingEditReadSyncTargetResolution,
  diagnostic: AmazonListingEditReadSyncDiagnostic,
  reason: string,
): AmazonListingEditReadSyncTaskRecord => ({
  taskId: input.taskId,
  site: input.mission.site,
  requestId: input.mission.requestId,
  marketplace: input.mission.marketplace,
  ok: false,
  status: items.some((candidate) => candidate.status === "matched") ? "partial_success" : "review_required",
  reason,
  reachedStep: "batch_stopped_on_first_issue",
  targetResolution,
  inventoryItems,
  items,
  diagnostic,
  createdAt: input.createdAt,
  updatedAt: new Date().toISOString(),
});

const buildSkuCentralOnlyResult = (
  input: FlowInput,
  item: AmazonListingEditReadSyncInventoryItem,
  skuCentral: SkuCentralReadScriptResult,
): AmazonListingEditReadSyncItemResult => {
  const terminal = terminalStatusFromState(skuCentral.detectedState);
  if (terminal) return buildBlockedItemResult(input, item, terminal);
  const hasSku = (skuCentral.sku ?? item.sku).toUpperCase() === item.sku.toUpperCase();
  const hasAsin = Boolean(skuCentral.asin ?? item.asin);
  const matched = hasSku && hasAsin && skuCentral.editButtonVisible;
  return {
    asin: skuCentral.asin ?? item.asin,
    sku: skuCentral.sku ?? item.sku,
    status: matched ? "matched" : "blocked",
    reason: matched ? null : "sku_central_dom_not_verified",
    fnsku: skuCentral.fnsku,
    skuCentralUrlPath: pageUrlPath(skuCentral.url),
    tabs: [],
    evidenceRef: resultEvidenceRef(input.taskId, item.sku),
  };
};

const resolveStatus = (items: readonly AmazonListingEditReadSyncItemResult[]): AmazonListingEditReadSyncTaskRecord["status"] => {
  const matched = items.filter((item) => item.status === "matched").length;
  if (matched === items.length) return "success";
  if (matched > 0) return "partial_success";
  return "review_required";
};

const buildInventoryTerminalTask = (
  input: FlowInput,
  inventoryItems: readonly AmazonListingEditReadSyncInventoryItem[],
  targetResolution: AmazonListingEditReadSyncTargetResolution,
  diagnostic: AmazonListingEditReadSyncDiagnostic,
  status: AmazonListingEditReadSyncTaskRecord["status"],
  reason: string,
): AmazonListingEditReadSyncTaskRecord => ({
  taskId: input.taskId,
  site: input.mission.site,
  requestId: input.mission.requestId,
  marketplace: input.mission.marketplace,
  ok: status === "success",
  status,
  reason: status === "success" ? null : reason,
  reachedStep: status === "success" ? "inventory_only_finished" : "inventory_expanded_asin_sku_read",
  targetResolution,
  inventoryItems,
  items: [],
  diagnostic,
  createdAt: input.createdAt,
  updatedAt: new Date().toISOString(),
});

const processInventoryItem = async (input: {
  flow: FlowInput;
  item: AmazonListingEditReadSyncInventoryItem;
  inventoryItems: readonly AmazonListingEditReadSyncInventoryItem[];
  results: AmazonListingEditReadSyncItemResult[];
  targetResolution: AmazonListingEditReadSyncTargetResolution;
  diagnostic: AmazonListingEditReadSyncDiagnostic;
}): Promise<AmazonListingEditReadSyncTaskRecord | null> => {
  const { flow, item, inventoryItems, results, targetResolution, diagnostic } = input;
  await flow.onProgress?.({ reachedStep: "inventory_sku_search_started", reason: item.sku, inventoryItems, items: results });
  const search = await runInventorySkuSearch(flow, item);
  await flow.onProgress?.({ reachedStep: "inventory_sku_search_finished", reason: search.ok ? "inventory_search_result_dom_verified" : search.reason, inventoryItems, items: results, diagnostic: search.diagnostic });
  if (!search.ok) {
    const blocked = buildBlockedItemResult(flow, item, search.reason);
    results.push(blocked);
    if (flow.mission.safetyMode === "all-inventory-edit-tabs" && flow.mission.stopOnFirstIssue) {
      return buildBatchStoppedTask(flow, inventoryItems, results, targetResolution, search.diagnostic, blocked.reason ?? "batch_stopped_on_first_issue");
    }
    return null;
  }
  if (flow.mission.safetyMode === "single-sku-search-only") return null;
  await flow.onProgress?.({ reachedStep: "sku_central_opening", reason: item.sku, inventoryItems, items: results });
  if (flow.mission.safetyMode === "single-sku-sku-central-only") {
    const skuCentral = await readSkuCentral(flow, item, search.skuCentralHref);
    results.push(buildSkuCentralOnlyResult(flow, item, skuCentral));
    await flow.onProgress?.({ reachedStep: "sku_central_dom_read", reason: item.sku, inventoryItems, items: results });
    return null;
  }
  const itemResult = await buildItemResult(flow, item, search.skuCentralHref);
  results.push(itemResult);
  await flow.onProgress?.({ reachedStep: "item_edit_tabs_read", reason: item.sku, inventoryItems, items: results });
  if (flow.mission.safetyMode === "all-inventory-edit-tabs" && flow.mission.stopOnFirstIssue && itemResult.status !== "matched") {
    return buildBatchStoppedTask(flow, inventoryItems, results, targetResolution, diagnostic, itemResult.reason ?? "batch_stopped_on_first_issue");
  }
  return null;
};

const processInventoryItems = async (input: {
  flow: FlowInput;
  inventoryItems: readonly AmazonListingEditReadSyncInventoryItem[];
  targetResolution: AmazonListingEditReadSyncTargetResolution;
  diagnostic: AmazonListingEditReadSyncDiagnostic;
}): Promise<{ results: AmazonListingEditReadSyncItemResult[]; stoppedTask: AmazonListingEditReadSyncTaskRecord | null }> => {
  const results: AmazonListingEditReadSyncItemResult[] = [];
  for (const item of input.inventoryItems) {
    const stoppedTask = await processInventoryItem({ ...input, item, results });
    if (stoppedTask) return { results, stoppedTask };
  }
  return { results, stoppedTask: null };
};

const buildCompletedTask = (
  input: FlowInput,
  inventoryItems: readonly AmazonListingEditReadSyncInventoryItem[],
  targetResolution: AmazonListingEditReadSyncTargetResolution,
  diagnostic: AmazonListingEditReadSyncDiagnostic,
  results: readonly AmazonListingEditReadSyncItemResult[],
): AmazonListingEditReadSyncTaskRecord => {
  const status = input.mission.safetyMode === "single-sku-search-only"
    ? (results.length === 0 ? "success" : resolveStatus(results))
    : results.length > 0 ? resolveStatus(results) : "review_required";
  return {
    taskId: input.taskId, site: input.mission.site, requestId: input.mission.requestId, marketplace: input.mission.marketplace,
    ok: status === "success", status,
    reason: status === "success" ? null : input.mission.safetyMode === "single-sku-search-only" ? "inventory_sku_search_not_verified" : "not_all_listing_edit_tabs_read",
    reachedStep: input.mission.safetyMode === "single-sku-search-only" ? "inventory_sku_search_only_finished" : input.mission.safetyMode === "single-sku-sku-central-only" ? "sku_central_only_finished" : "flow_finished",
    targetResolution, inventoryItems, items: results, diagnostic,
    createdAt: input.createdAt, updatedAt: new Date().toISOString(),
  };
};

export const runAmazonListingEditReadSyncFlow = async (
  input: FlowInput,
): Promise<AmazonListingEditReadSyncTaskRecord> => {
  await input.onProgress?.({ reachedStep: "seller_central_inventory_opening", reason: "progress_continues" });
  const inventory = input.mission.scope === "all-inventory-pages" ? await readAllInventoryPages(input) : await readInventory(input);
  const diagnostic = buildDiagnostic("inventory_expand_and_read", inventory);
  const terminal = terminalStatusFromState(inventory.detectedState);
  const targetResolution = buildTargetResolution(input.mission, inventory.items);
  const selectedInventoryItems = selectInventoryItems(input.mission, inventory.items, targetResolution);
  await input.onProgress?.({
    reachedStep: "inventory_expanded_asin_sku_read",
    reason: inventory.reason,
    inventoryItems: selectedInventoryItems,
    targetResolution,
    diagnostic,
  });
  if (terminal) {
    return buildInventoryTerminalTask(input, selectedInventoryItems, targetResolution, diagnostic, terminal, terminal);
  }
  if (targetResolution.status !== "matched" && targetResolution.status !== "not_required") {
    return buildInventoryTerminalTask(input, selectedInventoryItems, targetResolution, diagnostic, "review_required", targetResolution.reason ?? "target_resolution_failed");
  }
  if (selectedInventoryItems.length === 0) {
    return buildInventoryTerminalTask(input, [], targetResolution, diagnostic, "review_required", inventory.reason ?? "inventory_asin_sku_rows_not_found");
  }
  if (input.mission.safetyMode === "inventory-only") {
    return buildInventoryTerminalTask(input, selectedInventoryItems, targetResolution, diagnostic, "success", "");
  }
  const processed = await processInventoryItems({ flow: input, inventoryItems: selectedInventoryItems, targetResolution, diagnostic });
  if (processed.stoppedTask) return processed.stoppedTask;
  return buildCompletedTask(input, selectedInventoryItems, targetResolution, diagnostic, processed.results);
};
