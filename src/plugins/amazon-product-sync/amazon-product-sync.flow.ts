import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type {
  AmazonProductSyncInput,
  AmazonProductSyncRequiredField,
  AmazonProductSyncResultItem,
  AmazonProductSyncTaskRecord,
} from "./amazon-product-sync.schema.js";
import {
  buildInventoryExtractionScript,
  buildInventorySearchProbeScript,
  buildVariationExpansionProbeScript,
} from "./amazon-product-sync.dom-scripts.js";

type PageState = "ready" | "login_required" | "captcha_or_2fa_required" | "review_required";

type ViewportPoint = {
  readonly x: number;
  readonly y: number;
};

type InventorySearchProbe = {
  readonly url: string;
  readonly title: string;
  readonly detectedState: PageState;
  readonly topGlobalSearchPresent: boolean;
  readonly topGlobalSearchExcluded: boolean;
  readonly inventorySearchPlaceholder: string | null;
  readonly inventorySearchUsesShadowInput: boolean;
  readonly inventorySearchInputPoint: ViewportPoint | null;
  readonly inventorySearchButtonPoint: ViewportPoint | null;
  readonly reason: string | null;
};

type ExtractedRow = {
  readonly sellerSku: string;
  readonly asinSnapshot: string | null;
  readonly sellerCentralTitleSnapshot: string | null;
  readonly imagePresent: boolean;
  readonly listingStatus: string | null;
  readonly availableFbaUnits: number | null;
  readonly inboundUnits: number | null;
  readonly unfulfillableUnits: number | null;
  readonly reservedUnits: number | null;
  readonly sales30dSnapshot: number | null;
};

type ExtractedPage = {
  readonly url: string;
  readonly title: string;
  readonly detectedState: PageState;
  readonly searchVerified: boolean;
  readonly searchVerificationEvidence: readonly string[];
  readonly rows: readonly ExtractedRow[];
};

type ExpanderPoint = {
  readonly x: number;
  readonly y: number;
  readonly label: string;
};

type ExpansionProbe = {
  readonly collapsedCount: number;
  readonly points: readonly ExpanderPoint[];
};

const MARKETPLACE_INVENTORY_URL: Record<AmazonProductSyncInput["marketplace"], string> = {
  "amazon.ae": "https://sellercentral.amazon.ae/myinventory/inventory?fulfilledBy=all&page=1&pageSize=25&sort=date_created_desc&status=all",
  "amazon.sa": "https://sellercentral.amazon.sa/myinventory/inventory?fulfilledBy=all&page=1&pageSize=25&sort=date_created_desc&status=all",
  "amazon.com": "https://sellercentral.amazon.com/myinventory/inventory?fulfilledBy=all&page=1&pageSize=25&sort=date_created_desc&status=all",
  "amazon.co.uk": "https://sellercentral.amazon.co.uk/myinventory/inventory?fulfilledBy=all&page=1&pageSize=25&sort=date_created_desc&status=all",
  "amazon.co.jp": "https://sellercentral.amazon.co.jp/myinventory/inventory?fulfilledBy=all&page=1&pageSize=25&sort=date_created_desc&status=all",
};

const normalizeSku = (value: string): string => value.trim().toUpperCase();

const redactedEvidenceRef = (taskId: string, sku: string): string =>
  `evidence://amazon-product-sync/${taskId}/${encodeURIComponent(normalizeSku(sku))}`;

const hasRequiredField = (
  inputItem: AmazonProductSyncInput["items"][number],
  field: AmazonProductSyncRequiredField,
): boolean => inputItem.requiredFields.includes(field);

const terminalTaskStatusFromPage = (state: PageState): AmazonProductSyncTaskRecord["status"] | null => {
  if (state === "login_required") return "login_required";
  if (state === "captcha_or_2fa_required") return "captcha_or_2fa_required";
  if (state === "review_required") return "review_required";
  return null;
};

const buildMissingItem = (
  inputItem: AmazonProductSyncInput["items"][number],
  snapshotAt: string,
  reason: string,
  status: AmazonProductSyncResultItem["status"] = "not_found",
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
  listingStatus: null,
  availableFbaUnits: null,
  inboundUnits: null,
  unfulfillableUnits: null,
  reservedUnits: null,
  sales30dSnapshot: null,
  snapshotAt,
  rowEvidenceRef: null,
  reason,
});

const captureMainImageEvidenceRef = async (
  browser: BrowserController,
  input: {
    readonly taskId: string;
    readonly sellerSku: string;
    readonly row: ExtractedRow;
  },
): Promise<string | null> => {
  if (!input.row.imagePresent) return null;
  const capture = await browser.screenshotRegion({
    regionLabel: `amazon-product-sync main image evidence ${input.sellerSku}`,
    contentLines: [
      `taskId=${input.taskId}`,
      `sellerSku=${input.sellerSku}`,
      "field=mainImage",
    ],
    captureProfile: "observation_lightweight",
  });
  return `${redactedEvidenceRef(input.taskId, input.sellerSku)}/main-image/${capture.browserActionId}`;
};

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
  const asinSnapshot = hasRequiredField(inputItem, "asin") ? row.asinSnapshot : null;
  const availableFbaUnits = hasRequiredField(inputItem, "availableInventory") ? row.availableFbaUnits : null;
  const missingRequestedFields = inputItem.requiredFields.filter((field) => {
    if (field === "mainImage") return !mainImageEvidenceRef;
    if (field === "asin") return !asinSnapshot;
    return availableFbaUnits === null;
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
    listingStatus: row.listingStatus,
    availableFbaUnits,
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
}): Promise<AmazonProductSyncTaskRecord> => {
  const now = new Date().toISOString();
  await input.browser.open({
    url: MARKETPLACE_INVENTORY_URL[input.mission.marketplace],
    title: "Seller Central inventory",
    reusePolicy: "reuse-active-tab",
  });
  await input.browser.wait(2200);

  const items: AmazonProductSyncResultItem[] = [];
  for (const item of input.mission.items) {
    items.push(await searchAndExtractSkuItem({
      browser: input.browser,
      taskId: input.taskId,
      item,
      snapshotAt: now,
    }));
  }

  const terminalStatus = resolveTerminalStatus(items);
  const status = terminalStatus ?? resolveOverallStatus(items);
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

const searchAndExtractSkuItem = async (input: {
  browser: BrowserController;
  taskId: string;
  item: AmazonProductSyncInput["items"][number];
  snapshotAt: string;
}): Promise<AmazonProductSyncResultItem> => {
  const probe = await input.browser.evaluateActiveTab<InventorySearchProbe>({
    description: "amazon-product-sync locate inventory filter SKU search and exclude top global search",
    script: buildInventorySearchProbeScript(),
  });
  const terminalStatus = terminalTaskStatusFromPage(probe.detectedState);
  if (terminalStatus) {
    return buildMissingItem(input.item, input.snapshotAt, terminalStatus, "blocked");
  }
  if (!probe.inventorySearchInputPoint || !probe.inventorySearchButtonPoint || !probe.topGlobalSearchExcluded) {
    return buildMissingItem(input.item, input.snapshotAt, probe.reason ?? "inventory_filter_search_not_found", "blocked");
  }

  await input.browser.click({
    targetLabel: `Seller Central inventory filter SKU search input ${input.item.sellerSku}`,
    point: probe.inventorySearchInputPoint,
    coordinateSpace: "browserViewport",
    button: "left",
    clickCount: 1,
  });
  await input.browser.textInput({
    targetLabel: `Seller Central inventory filter clear SKU search ${input.item.sellerSku}`,
    action: "clear-input",
  });
  await input.browser.textInput({
    targetLabel: `Seller Central inventory filter type SKU ${input.item.sellerSku}`,
    action: "type-text",
    text: input.item.sellerSku,
  });
  await input.browser.click({
    targetLabel: `Seller Central inventory filter submit SKU search ${input.item.sellerSku}`,
    point: probe.inventorySearchButtonPoint,
    coordinateSpace: "browserViewport",
    button: "left",
    clickCount: 1,
  });
  await input.browser.wait(1800);
  await expandSellerCentralParentRows(input.browser);

  const page = await input.browser.evaluateActiveTab<ExtractedPage>({
    description: `amazon-product-sync verify result DOM and read exact SKU row ${input.item.sellerSku}`,
    script: buildInventoryExtractionScript(input.item.sellerSku),
  });
  const pageTerminalStatus = terminalTaskStatusFromPage(page.detectedState);
  if (pageTerminalStatus) {
    return buildMissingItem(input.item, input.snapshotAt, pageTerminalStatus, "blocked");
  }
  if (!page.searchVerified) {
    return buildMissingItem(input.item, input.snapshotAt, "inventory_search_result_dom_not_verified", "blocked");
  }

  const normalizedSku = normalizeSku(input.item.sellerSku);
  const matches = page.rows.filter((row) => normalizeSku(row.sellerSku) === normalizedSku);
  if (matches.length === 0) return buildMissingItem(input.item, input.snapshotAt, "sku_not_found");
  if (matches.length > 1) return buildMissingItem(input.item, input.snapshotAt, "ambiguous_sku_rows", "ambiguous");
  const row = matches[0];
  return row
    ? buildMatchedItem(input.browser, input.taskId, input.item, row, input.snapshotAt)
    : buildMissingItem(input.item, input.snapshotAt, "sku_not_found");
};

async function expandSellerCentralParentRows(browser: BrowserController): Promise<void> {
  let stagnantPasses = 0;
  for (let pass = 0; pass < 16; pass += 1) {
    const result = await browser.evaluateActiveTab<ExpansionProbe>({
      description: "amazon-product-sync locate collapsed Seller Central parent variation expanders",
      script: buildVariationExpansionProbeScript(),
    });
    if (result.collapsedCount === 0) return;
    const point = result.points[0];
    if (!point) {
      await browser.scroll({
        targetLabel: "Seller Central inventory variation expander discovery",
        deltaX: 0,
        deltaY: 720,
        coordinateSpace: "browserViewport",
      });
      await browser.wait(900);
      stagnantPasses += 1;
      if (stagnantPasses >= 4) return;
      continue;
    }
    stagnantPasses = 0;
    await browser.click({
      targetLabel: `Seller Central read-only variation expander ${point.label}`,
      point: { x: point.x, y: point.y },
      coordinateSpace: "browserViewport",
      button: "left",
      clickCount: 1,
    });
    await browser.wait(1500);
  }
}
