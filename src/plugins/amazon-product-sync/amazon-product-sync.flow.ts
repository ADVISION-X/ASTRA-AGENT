import type { BrowserController } from "../../lib/browser/browser-controller.js";
import { buildInventorySearchButtonClickScript, buildInventoryExtractionScript, buildInventorySearchProbeScript, buildInventorySearchSubmitScript, buildVariationExpansionProbeScript } from "./amazon-product-sync.dom-scripts.js";
import { captureMainImageEvidenceRef, hasRequiredField, redactedEvidenceRef, uploadMainImage } from "./amazon-product-sync.image-transfer.js";
import type { AmazonProductSyncInput, AmazonProductSyncItemDiagnostic, AmazonProductSyncRequiredField, AmazonProductSyncResultItem, AmazonProductSyncTaskRecord } from "./amazon-product-sync.schema.js";

type PageState = "ready" | "login_required" | "captcha_or_2fa_required" | "review_required";

type ViewportPoint = { readonly x: number; readonly y: number };
type InventorySearchProbe = {
  readonly url: string; readonly title: string; readonly detectedState: PageState; readonly topGlobalSearchPresent: boolean;
  readonly topGlobalSearchExcluded: boolean; readonly inventorySearchPlaceholder: string | null;
  readonly inventorySearchUsesShadowInput: boolean; readonly inventorySearchInputPoint: ViewportPoint | null;
  readonly inventorySearchButtonPoint: ViewportPoint | null; readonly reason: string | null;
};
export type ExtractedRow = {
  readonly sellerSku: string; readonly asinSnapshot: string | null; readonly sellerCentralTitleSnapshot: string | null;
  readonly imagePresent: boolean; readonly imageSrc: string | null; readonly listingStatus: string | null; readonly availableFbaUnits: number | null;
  readonly actualInventoryUnits: number | null; readonly inboundUnits: number | null; readonly unfulfillableUnits: number | null; readonly reservedUnits: number | null;
  readonly sales30dSnapshot: number | null;
};
type ExtractedPage = {
  readonly url: string; readonly title: string; readonly detectedState: PageState; readonly searchVerified: boolean;
  readonly searchVerificationEvidence: readonly string[]; readonly rows: readonly ExtractedRow[];
};
type ExpanderPoint = { readonly x: number; readonly y: number; readonly label: string };
type ExpansionProbe = { readonly collapsedCount: number; readonly points: readonly ExpanderPoint[] };
type InventorySearchSubmitResult = {
  readonly url: string; readonly title: string; readonly detectedState: PageState; readonly ok: boolean;
  readonly submittedValue: string | null; readonly inputValue: string | null; readonly clickedButton: boolean;
  readonly hostValue?: string | null; readonly hostValueGetterDefined?: boolean; readonly shadowValueReady?: boolean;
  readonly searchEventsReady?: boolean;
  readonly hostAttributeValue?: string | null;
  readonly searchClickDelayMs?: number; readonly inventorySearchButtonPoint?: ViewportPoint | null;
  readonly topGlobalSearchExcluded: boolean; readonly reason: string | null;
};
type InventorySearchButtonClickResult = {
  readonly url: string; readonly title: string; readonly detectedState: PageState; readonly ok: boolean;
  readonly clickedButton: boolean; readonly hostValue?: string | null; readonly inputValue?: string | null;
  readonly pointerDownDispatched?: boolean; readonly mouseDownDispatched?: boolean; readonly pointerUpDispatched?: boolean;
  readonly mouseUpDispatched?: boolean; readonly clickEventDispatched?: boolean;
  readonly topGlobalSearchExcluded: boolean; readonly reason: string | null;
};

export type AmazonProductSyncFlowProgress = { readonly reachedStep: string; readonly items?: readonly AmazonProductSyncResultItem[]; readonly reason?: string | null; readonly authGate?: AmazonProductSyncItemDiagnostic["authGate"]; readonly detectedState?: string; readonly diagnosticStage?: string; readonly pageTitle?: string | null; readonly pageUrlPath?: string | null };

type ProgressReporter = (progress: AmazonProductSyncFlowProgress) => Promise<void>;

const MARKETPLACE_INVENTORY_URL: Record<AmazonProductSyncInput["marketplace"], string> = { "amazon.ae": "https://sellercentral.amazon.ae/myinventory/inventory?fulfilledBy=all&page=1&pageSize=25&sort=date_created_desc&status=all", "amazon.sa": "https://sellercentral.amazon.sa/myinventory/inventory?fulfilledBy=all&page=1&pageSize=25&sort=date_created_desc&status=all", "amazon.com": "https://sellercentral.amazon.com/myinventory/inventory?fulfilledBy=all&page=1&pageSize=25&sort=date_created_desc&status=all", "amazon.co.uk": "https://sellercentral.amazon.co.uk/myinventory/inventory?fulfilledBy=all&page=1&pageSize=25&sort=date_created_desc&status=all", "amazon.co.jp": "https://sellercentral.amazon.co.jp/myinventory/inventory?fulfilledBy=all&page=1&pageSize=25&sort=date_created_desc&status=all" };

const normalizeSku = (value: string): string => value.trim().toUpperCase();

const terminalTaskStatusFromPage = (state: PageState): AmazonProductSyncTaskRecord["status"] | null => {
  if (state === "login_required") return "login_required";
  if (state === "captcha_or_2fa_required") return "captcha_or_2fa_required";
  if (state === "review_required") return "review_required";
  return null;
};

const authGateFromState = (state: PageState): AmazonProductSyncItemDiagnostic["authGate"] =>
  state === "ready" ? "none" : state;

const pageUrlPath = (rawUrl: string): string | null => {
  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
};

const buildDiagnostic = (input: {
  readonly detectedState: PageState;
  readonly stageName: string;
  readonly title: string;
  readonly url: string;
}): AmazonProductSyncItemDiagnostic => ({
  authGate: authGateFromState(input.detectedState),
  detectedState: input.detectedState,
  diagnosticStage: input.stageName,
  pageTitle: input.title || null,
  pageUrlPath: pageUrlPath(input.url),
});

const buildMissingItem = (
  inputItem: AmazonProductSyncInput["items"][number],
  snapshotAt: string,
  reason: string,
  status: AmazonProductSyncResultItem["status"] = "not_found",
  diagnostic?: AmazonProductSyncItemDiagnostic,
): AmazonProductSyncResultItem => ({
  sellerSku: inputItem.sellerSku,
  sourceKeyType: inputItem.sourceKeyType,
  sourceKey: inputItem.sourceKey,
  requestedFields: inputItem.requiredFields,
  missingRequestedFields: inputItem.requiredFields,
  status,
  asinSnapshot: null,
    sellerCentralTitleSnapshot: null,
    sellerCentralMainImageEvidenceRef: null,
    mainImageUpload: null,
    listingStatus: null,
  availableFbaUnits: null,
  actualInventoryUnits: null,
  inboundUnits: null,
  unfulfillableUnits: null,
  reservedUnits: null,
  sales30dSnapshot: null,
  snapshotAt,
  rowEvidenceRef: null,
  reason,
  ...(diagnostic ? { diagnostic } : {}),
});

const buildMatchedItem = async (
  browser: BrowserController,
  taskId: string,
  inputItem: AmazonProductSyncInput["items"][number],
  row: ExtractedRow,
  snapshotAt: string,
): Promise<AmazonProductSyncResultItem> => {
  const mainImageEvidenceRef = hasRequiredField(inputItem, "mainImage")
    ? await captureMainImageEvidenceRef(browser, { taskId, sellerSku: inputItem.sellerSku, row })
    : null;
  const mainImageUpload = await uploadMainImage(inputItem, row, taskId);
  const asinSnapshot = hasRequiredField(inputItem, "asin") ? row.asinSnapshot : null;
  const availableFbaUnits = hasRequiredField(inputItem, "availableInventory") ? row.availableFbaUnits : null;
  const actualInventoryUnits = hasRequiredField(inputItem, "actualInventory") ? row.actualInventoryUnits : null;
  const missingRequestedFields = inputItem.requiredFields.filter((field) => {
    if (field === "mainImage") return mainImageUpload?.status !== "uploaded";
    if (field === "asin") return !asinSnapshot;
    if (field === "availableInventory") return availableFbaUnits === null;
    return actualInventoryUnits === null;
  });

  return {
    sellerSku: inputItem.sellerSku,
    sourceKeyType: inputItem.sourceKeyType,
    sourceKey: inputItem.sourceKey,
    requestedFields: inputItem.requiredFields,
    missingRequestedFields,
    status: "matched",
    asinSnapshot,
    sellerCentralTitleSnapshot: row.sellerCentralTitleSnapshot,
    sellerCentralMainImageEvidenceRef: mainImageEvidenceRef,
    mainImageUpload,
    listingStatus: row.listingStatus,
    availableFbaUnits,
    actualInventoryUnits,
    inboundUnits: row.inboundUnits,
    unfulfillableUnits: row.unfulfillableUnits,
    reservedUnits: row.reservedUnits,
    sales30dSnapshot: row.sales30dSnapshot,
    snapshotAt,
    rowEvidenceRef: redactedEvidenceRef(taskId, inputItem.sellerSku),
    reason: null,
  };
};

const resolveOverallStatus = (items: readonly AmazonProductSyncResultItem[]): AmazonProductSyncTaskRecord["status"] => {
  const matched = items.filter((item) => item.status === "matched").length;
  if (matched === items.length) return "success";
  if (matched > 0) return "partial_success";
  return "review_required";
};

const resolveTerminalStatus = (items: readonly AmazonProductSyncResultItem[]): AmazonProductSyncTaskRecord["status"] | null => {
  const reasons = items.map((item) => item.reason);
  if (reasons.length > 0 && reasons.every((reason) => reason === "login_required")) return "login_required";
  if (reasons.length > 0 && reasons.every((reason) => reason === "captcha_or_2fa_required")) return "captcha_or_2fa_required";
  return null;
};

export const runAmazonProductSyncFlow = async (input: {
  browser: BrowserController;
  mission: AmazonProductSyncInput;
  taskId: string;
  createdAt: string;
  onProgress?: ProgressReporter;
}): Promise<AmazonProductSyncTaskRecord> => {
  const now = new Date().toISOString();
  await input.browser.open({
    url: MARKETPLACE_INVENTORY_URL[input.mission.marketplace],
    title: "Seller Central inventory",
    reusePolicy: "reuse-host-tab",
  });
  await input.onProgress?.({ reachedStep: "seller_central_inventory_page_opened" });
  await input.browser.wait(2200);

  const items: AmazonProductSyncResultItem[] = [];
  for (const item of input.mission.items) {
    await input.onProgress?.({
      reachedStep: `seller_central_inventory_search_started:${item.sellerSku}`,
      items,
    });
    items.push(await searchAndExtractSkuItem({
      browser: input.browser,
      taskId: input.taskId,
      item,
      inventoryUrl: MARKETPLACE_INVENTORY_URL[input.mission.marketplace],
      snapshotAt: now,
      ...(input.onProgress ? { onProgress: input.onProgress } : {}),
    }));
    await input.onProgress?.({
      reachedStep: `seller_central_inventory_search_item_finished:${item.sellerSku}`,
      items,
    });
  }

  const terminalStatus = resolveTerminalStatus(items);
  const status = terminalStatus ?? resolveOverallStatus(items);
  if (input.mission.closeAmazonTabOnCompletion && status === "success") {
    await input.browser.closeActiveTab({
      reason: `amazon_product_sync_completed_last_sku:${input.taskId}`,
    });
  }
  return {
    taskId: input.taskId,
    site: input.mission.site,
    requestId: input.mission.requestId,
    marketplace: input.mission.marketplace,
    ok: status === "success" || status === "partial_success",
    status,
    reason: status === "success" ? null : "not_all_skus_matched",
    reachedStep: "seller_central_inventory_search_and_rows_extracted",
    items,
    createdAt: input.createdAt,
    updatedAt: new Date().toISOString(),
  };
};

type SearchAndExtractInput = {
  browser: BrowserController;
  taskId: string;
  item: AmazonProductSyncInput["items"][number];
  inventoryUrl: string;
  snapshotAt: string;
  onProgress?: ProgressReporter;
};

type ReadyInventorySearchProbe = InventorySearchProbe & {
  inventorySearchButtonPoint: { x: number; y: number };
  inventorySearchInputPoint: { x: number; y: number };
};

const locateInventorySearch = async (
  input: SearchAndExtractInput,
): Promise<ReadyInventorySearchProbe | AmazonProductSyncResultItem> => {
  await input.onProgress?.({
    reachedStep: `seller_central_inventory_filter_probe_started:${input.item.sellerSku}`,
  });
  const probe = await input.browser.evaluateActiveTab<InventorySearchProbe>({
    description: "amazon-product-sync locate inventory filter SKU search and exclude top global search",
    script: buildInventorySearchProbeScript(),
  });
  const diagnostic = buildDiagnostic({
    detectedState: probe.detectedState,
    stageName: "seller_central_inventory_filter_probe",
    title: probe.title,
    url: probe.url,
  });
  await input.onProgress?.({
    reachedStep: `seller_central_inventory_filter_probe_finished:${input.item.sellerSku}`,
    reason: probe.reason ?? (probe.detectedState === "ready" ? "inventory_filter_probe_ready" : probe.detectedState),
    authGate: diagnostic.authGate,
    detectedState: diagnostic.detectedState,
    diagnosticStage: diagnostic.diagnosticStage,
    pageTitle: diagnostic.pageTitle,
    pageUrlPath: diagnostic.pageUrlPath,
  });
  const terminalStatus = terminalTaskStatusFromPage(probe.detectedState);
  if (terminalStatus) {
    return buildMissingItem(input.item, input.snapshotAt, terminalStatus, "blocked", diagnostic);
  }
  if (!probe.inventorySearchInputPoint || !probe.inventorySearchButtonPoint || !probe.topGlobalSearchExcluded) {
    return buildMissingItem(input.item, input.snapshotAt, probe.reason ?? "inventory_filter_search_not_found", "blocked", diagnostic);
  }
  return {
    ...probe,
    inventorySearchButtonPoint: probe.inventorySearchButtonPoint,
    inventorySearchInputPoint: probe.inventorySearchInputPoint,
  };
};

const submitInventorySearch = async (
  input: SearchAndExtractInput,
): Promise<AmazonProductSyncResultItem | null> => {
  await input.onProgress?.({
    reachedStep: `seller_central_inventory_filter_type_started:${input.item.sellerSku}`,
  });
  const submitResult = await input.browser.evaluateActiveTab<InventorySearchSubmitResult>({
    description: `amazon-product-sync fill inventory filter SKU shadow input and submit search ${input.item.sellerSku}`,
    script: buildInventorySearchSubmitScript(input.item.sellerSku),
  });
  const diagnostic = buildDiagnostic({
    detectedState: submitResult.detectedState,
    stageName: "seller_central_inventory_filter_submit",
    title: submitResult.title,
    url: submitResult.url,
  });
  const terminalStatus = terminalTaskStatusFromPage(submitResult.detectedState);
  if (terminalStatus) {
    return buildMissingItem(input.item, input.snapshotAt, terminalStatus, "blocked", diagnostic);
  }
  if (!submitResult.ok || !submitResult.topGlobalSearchExcluded) {
    return buildMissingItem(input.item, input.snapshotAt, submitResult.reason ?? "inventory_filter_shadow_input_submit_failed", "blocked", diagnostic);
  }
  const searchClickDelayMs = Math.min(Math.max(submitResult.searchClickDelayMs ?? 1000, 1000), 2000);
  await input.onProgress?.({
    reachedStep: `seller_central_inventory_filter_submit_started:${input.item.sellerSku}`,
  });
  await input.browser.wait(searchClickDelayMs);
  const clickResult = await input.browser.evaluateActiveTab<InventorySearchButtonClickResult>({
    description: `amazon-product-sync click inventory filter search button DOM ${input.item.sellerSku}`,
    script: buildInventorySearchButtonClickScript(input.item.sellerSku),
  });
  const clickDiagnostic = buildDiagnostic({
    detectedState: clickResult.detectedState,
    stageName: "seller_central_inventory_filter_button_click",
    title: clickResult.title,
    url: clickResult.url,
  });
  const clickTerminalStatus = terminalTaskStatusFromPage(clickResult.detectedState);
  if (clickTerminalStatus) {
    return buildMissingItem(input.item, input.snapshotAt, clickTerminalStatus, "blocked", clickDiagnostic);
  }
  if (!clickResult.ok || !clickResult.clickedButton || !clickResult.topGlobalSearchExcluded) {
    return buildMissingItem(input.item, input.snapshotAt, clickResult.reason ?? "inventory_filter_search_button_dom_click_failed", "blocked", clickDiagnostic);
  }
  await input.browser.wait(900);
  await input.onProgress?.({
    reachedStep: `seller_central_inventory_filter_submit_finished:${input.item.sellerSku}`,
  });
  return null;
};

const revealInventoryVariations = async (input: SearchAndExtractInput): Promise<void> => {
  await input.onProgress?.({
    reachedStep: `seller_central_inventory_variation_expand_started:${input.item.sellerSku}`,
  });
  await expandSellerCentralParentRows(input);
  await input.onProgress?.({
    reachedStep: `seller_central_inventory_variation_expand_finished:${input.item.sellerSku}`,
  });
};

const extractInventoryPage = async (
  input: SearchAndExtractInput,
  options: { readonly requireSearchVerified: boolean } = { requireSearchVerified: true },
): Promise<ExtractedPage | AmazonProductSyncResultItem> => {
  await input.onProgress?.({
    reachedStep: `seller_central_inventory_dom_extract_started:${input.item.sellerSku}`,
  });
  const page = await input.browser.evaluateActiveTab<ExtractedPage>({
    description: `amazon-product-sync verify result DOM and read exact SKU row ${input.item.sellerSku}`,
    script: buildInventoryExtractionScript(input.item.sellerSku),
  });
  const diagnostic = buildDiagnostic({
    detectedState: page.detectedState,
    stageName: "seller_central_inventory_dom_extract",
    title: page.title,
    url: page.url,
  });
  await input.onProgress?.({
    reachedStep: `seller_central_inventory_dom_extract_finished:${input.item.sellerSku}`,
    reason: page.detectedState === "ready" ? "inventory_dom_extract_finished" : page.detectedState,
    authGate: diagnostic.authGate,
    detectedState: diagnostic.detectedState,
    diagnosticStage: diagnostic.diagnosticStage,
    pageTitle: diagnostic.pageTitle,
    pageUrlPath: diagnostic.pageUrlPath,
  });
  const pageTerminalStatus = terminalTaskStatusFromPage(page.detectedState);
  if (pageTerminalStatus) {
    return buildMissingItem(input.item, input.snapshotAt, pageTerminalStatus, "blocked", diagnostic);
  }
  if (options.requireSearchVerified && !page.searchVerified) {
    return buildMissingItem(input.item, input.snapshotAt, "inventory_search_result_dom_not_verified", "blocked", diagnostic);
  }
  return page;
};

const waitForInventorySearchResult = async (
  input: SearchAndExtractInput,
): Promise<ExtractedPage | AmazonProductSyncResultItem> => {
  let lastPage: ExtractedPage | null = null;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const page = await extractInventoryPage(input, { requireSearchVerified: false });
    if ("status" in page) return page;
    if (page.searchVerified) return page;
    lastPage = page;
    await input.onProgress?.({
      reachedStep: `seller_central_inventory_search_result_wait_${attempt}:${input.item.sellerSku}`,
      reason: "inventory_search_result_dom_pending",
    });
    await input.browser.wait(750);
  }
  const diagnostic = lastPage
    ? buildDiagnostic({
      detectedState: lastPage.detectedState,
      stageName: "seller_central_inventory_search_result_wait",
      title: lastPage.title,
      url: lastPage.url,
    })
    : undefined;
  return buildMissingItem(input.item, input.snapshotAt, "inventory_search_result_dom_not_verified", "blocked", diagnostic);
};

const resolveExtractedSkuItem = async (
  input: SearchAndExtractInput,
  page: ExtractedPage,
): Promise<AmazonProductSyncResultItem> => {
  const normalizedSku = normalizeSku(input.item.sellerSku);
  const matches = page.rows.filter((row) => normalizeSku(row.sellerSku) === normalizedSku);
  if (matches.length === 0) return buildMissingItem(input.item, input.snapshotAt, "sku_not_found");
  if (matches.length > 1) return buildMissingItem(input.item, input.snapshotAt, "ambiguous_sku_rows", "ambiguous");
  const row = matches[0];
  return row
    ? buildMatchedItem(input.browser, input.taskId, input.item, row, input.snapshotAt)
    : buildMissingItem(input.item, input.snapshotAt, "sku_not_found");
};

const searchAndExtractSkuItem = async (input: SearchAndExtractInput): Promise<AmazonProductSyncResultItem> => {
  const probe = await locateInventorySearch(input);
  if ("status" in probe) return probe;
  const failedSubmit = await submitInventorySearch(input);
  if (failedSubmit) return failedSubmit;
  const initialPage = await waitForInventorySearchResult(input);
  if ("status" in initialPage) return initialPage;
  if (initialPage.rows.some((row) => normalizeSku(row.sellerSku) === normalizeSku(input.item.sellerSku))) {
    return resolveExtractedSkuItem(input, initialPage);
  }
  await revealInventoryVariations(input);
  const page = await extractInventoryPage(input);
  if ("status" in page) return page;
  return resolveExtractedSkuItem(input, page);
};

async function expandSellerCentralParentRows(input: SearchAndExtractInput): Promise<void> {
  let stagnantPasses = 0;
  for (let pass = 0; pass < 16; pass += 1) {
    const result = await input.browser.evaluateActiveTab<ExpansionProbe>({
      description: "amazon-product-sync locate collapsed Seller Central parent variation expanders",
      script: buildVariationExpansionProbeScript(),
    });
    await input.onProgress?.({
      reachedStep: `seller_central_inventory_variation_expand_pass_${pass}:${input.item.sellerSku}`,
    });
    if (result.collapsedCount === 0) return;
    const point = result.points[0];
    if (!point) {
      await input.browser.scroll({
        targetLabel: "Seller Central inventory variation expander discovery",
        deltaX: 0,
        deltaY: 720,
        coordinateSpace: "browserViewport",
      });
      await input.browser.wait(900);
      stagnantPasses += 1;
      if (stagnantPasses >= 4) return;
      continue;
    }
    stagnantPasses = 0;
    await input.browser.click({
      targetLabel: `Seller Central read-only variation expander ${point.label}`,
      point: { x: point.x, y: point.y },
      coordinateSpace: "browserViewport",
      button: "left",
      clickCount: 1,
    });
    await input.browser.wait(1500);
  }
}
