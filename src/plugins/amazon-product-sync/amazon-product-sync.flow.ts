import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type {
  AmazonProductSyncInput,
  AmazonProductSyncResultItem,
  AmazonProductSyncTaskRecord,
} from "./amazon-product-sync.schema.js";

type ExtractedRow = {
  readonly sellerSku: string;
  readonly asinSnapshot: string | null;
  readonly sellerCentralTitleSnapshot: string | null;
  readonly imageSrc: string | null;
  readonly listingStatus: string | null;
  readonly availableFbaUnits: number | null;
  readonly inboundUnits: number | null;
  readonly unfulfillableUnits: number | null;
  readonly reservedUnits: number | null;
  readonly sales30dSnapshot: number | null;
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

type ExtractedPage = {
  readonly url: string;
  readonly title: string;
  readonly detectedState: "ready" | "login_required" | "captcha_or_2fa_required" | "review_required";
  readonly rows: readonly ExtractedRow[];
};

const MARKETPLACE_INVENTORY_URL: Record<AmazonProductSyncInput["marketplace"], string> = {
  "amazon.ae": "https://sellercentral.amazon.ae/myinventory/inventory?fulfilledBy=all&page=1&pageSize=25&sort=date_created_desc&status=all",
  "amazon.sa": "https://sellercentral.amazon.sa/myinventory/inventory?fulfilledBy=all&page=1&pageSize=25&sort=date_created_desc&status=all",
  "amazon.com": "https://sellercentral.amazon.com/myinventory/inventory?fulfilledBy=all&page=1&pageSize=25&sort=date_created_desc&status=all",
  "amazon.co.uk": "https://sellercentral.amazon.co.uk/myinventory/inventory?fulfilledBy=all&page=1&pageSize=25&sort=date_created_desc&status=all",
  "amazon.co.jp": "https://sellercentral.amazon.co.jp/myinventory/inventory?fulfilledBy=all&page=1&pageSize=25&sort=date_created_desc&status=all",
};

const normalizeSku = (value: string): string => value.trim().toUpperCase();

const terminalStatusFromPage = (state: ExtractedPage["detectedState"]): AmazonProductSyncTaskRecord["status"] | null => {
  if (state === "login_required") return "login_required";
  if (state === "captcha_or_2fa_required") return "captcha_or_2fa_required";
  if (state === "review_required") return "review_required";
  return null;
};

const redactedEvidenceRef = (taskId: string, sku: string): string =>
  `evidence://amazon-product-sync/${taskId}/${encodeURIComponent(normalizeSku(sku))}`;

const buildItemFromRow = (
  taskId: string,
  inputItem: AmazonProductSyncInput["items"][number],
  rows: readonly ExtractedRow[],
  snapshotAt: string,
): AmazonProductSyncResultItem => {
  const normalized = normalizeSku(inputItem.sellerSku);
  const matches = rows.filter((row) => normalizeSku(row.sellerSku) === normalized);
  if (matches.length === 0) {
    return buildMissingItem(inputItem, snapshotAt, "sku_not_found");
  }
  if (matches.length > 1) {
    return buildMissingItem(inputItem, snapshotAt, "ambiguous_sku_rows", "ambiguous");
  }
  const row = matches[0];
  if (!row) {
    return buildMissingItem(inputItem, snapshotAt, "sku_not_found");
  }
  const evidenceRef = redactedEvidenceRef(taskId, inputItem.sellerSku);
  return {
    sellerSku: inputItem.sellerSku,
    sourceKeyType: inputItem.sourceKeyType,
    sourceKey: inputItem.sourceKey,
    status: "matched",
    asinSnapshot: row.asinSnapshot,
    sellerCentralTitleSnapshot: row.sellerCentralTitleSnapshot,
    sellerCentralMainImageEvidenceRef: row.imageSrc ? `${evidenceRef}/main-image` : null,
    listingStatus: row.listingStatus,
    availableFbaUnits: row.availableFbaUnits,
    inboundUnits: row.inboundUnits,
    unfulfillableUnits: row.unfulfillableUnits,
    reservedUnits: row.reservedUnits,
    sales30dSnapshot: row.sales30dSnapshot,
    snapshotAt,
    rowEvidenceRef: evidenceRef,
    reason: null,
  };
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

const resolveOverallStatus = (items: readonly AmazonProductSyncResultItem[]): AmazonProductSyncTaskRecord["status"] => {
  const matched = items.filter((item) => item.status === "matched").length;
  if (matched === items.length) return "success";
  if (matched > 0) return "partial_success";
  return "review_required";
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
  await expandSellerCentralParentRows(input.browser);

  const page = await input.browser.evaluateActiveTab<ExtractedPage>({
    description: "amazon-product-sync read Seller Central inventory DOM",
    script: buildInventoryExtractionScript(input.mission.items.map((item) => item.sellerSku)),
  });
  const terminalStatus = terminalStatusFromPage(page.detectedState);
  if (terminalStatus) {
    return {
      taskId: input.taskId,
      requestId: input.mission.requestId,
      marketplace: input.mission.marketplace,
      ok: false,
      status: terminalStatus,
      reason: page.detectedState,
      reachedStep: "seller_central_state_detection",
      items: input.mission.items.map((item) => buildMissingItem(item, now, page.detectedState)),
      createdAt: input.createdAt,
      updatedAt: now,
    };
  }

  const items = input.mission.items.map((item) => buildItemFromRow(input.taskId, item, page.rows, now));
  const status = resolveOverallStatus(items);
  return {
    taskId: input.taskId,
    requestId: input.mission.requestId,
    marketplace: input.mission.marketplace,
    ok: status === "success" || status === "partial_success",
    status,
    reason: status === "success" ? null : "not_all_skus_matched",
    reachedStep: "seller_central_inventory_rows_extracted",
    items,
    createdAt: input.createdAt,
    updatedAt: now,
  };
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

function buildVariationExpansionProbeScript(): string {
  return `
return (() => {
  const visible = (el) => {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  };
  const textOf = (el) => String((el && (el.innerText || el.textContent)) || "").trim();
  const panelText = (panel) => textOf(panel).replaceAll("\\u00a0", " ").trim();
  const readSplitValue = (scope, label) => {
    if (!scope) return null;
    const splitRows = Array.from(scope.querySelectorAll('[class*="JanusSplitBox-module__row"]')).filter(visible);
    for (const splitRow of splitRows) {
      const panels = Array.from(splitRow.querySelectorAll('[class*="JanusSplitBox-module__panel"]')).filter(visible);
      if (panels.length < 2) continue;
      if (panelText(panels[0]) === label) return panelText(panels[1]);
    }
    return null;
  };
  const rows = Array.from(document.querySelectorAll('[class*="JanusTable-module__tableContentRow"], tr, [role="row"]')).filter(visible);
  const isParentRow = (row) => {
    const title = row.querySelector('[class*="VariationExpander-module__expanderTitle"]');
    const titleText = textOf(title).toLowerCase();
    return titleText.includes("变体 (") || titleText.includes("variation");
  };
  const isChildSkuRow = (row) => {
    const productDetails = row.querySelector('[class*="ProductDetails-module__container"]');
    return Boolean(readSplitValue(productDetails || row, "SKU") && readSplitValue(productDetails || row, "ASIN"));
  };
  const points = [];
  let collapsedCount = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!isParentRow(row)) continue;
    if (rows[index + 1] && isChildSkuRow(rows[index + 1])) continue;
    const target = row.querySelector('[class*="VariationExpander-module__expanderHeader"] svg')
      || row.querySelector('[class*="VariationExpander-module__expanderHeader"]');
    if (!target || !visible(target)) continue;
    collapsedCount += 1;
    const rect = target.getBoundingClientRect();
    const x = Math.round(rect.left + rect.width / 2);
    const y = Math.round(rect.top + rect.height / 2);
    if (x >= 0 && y >= 0 && x <= window.innerWidth && y <= window.innerHeight) {
      points.push({
        x,
        y,
        label: textOf(row.querySelector('[class*="VariationExpander-module__expanderTitle"]')) || "variation group",
      });
    }
  }
  return { collapsedCount, points };
})()
`;
}

const inventoryExtractionStateScript = `
return (() => {
  const text = String((document.body && document.body.innerText) || "");
  const lower = text.toLowerCase();
  const title = document.title || "";
  const url = location.href;
  const visible = (el) => {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  };
  const detect = () => {
    if (lower.includes("captcha") || lower.includes("robot check") || lower.includes("two-step") || lower.includes("two factor") || lower.includes("otp") || lower.includes("verification code") || text.includes("验证码") || text.includes("验证")) return "captcha_or_2fa_required";
    if ((lower.includes("sign in") || lower.includes("login") || lower.includes("password") || text.includes("登录") || text.includes("登陆")) && !lower.includes("manage your inventory") && !text.includes("库存")) return "login_required";
    if (!lower.includes("inventory") && !text.includes("库存") && !text.includes("SKU")) return "review_required";
    return "ready";
  };
  const normalize = (value) => String(value || "").trim().toUpperCase();
  const clean = (value) => String(value || "").replaceAll("\\u00a0", " ").trim();
  const parseInteger = (value) => {
    const cleaned = clean(value).replaceAll(",", "");
    if (cleaned === "" || cleaned === "--") return null;
    const parsed = Number(cleaned);
    return Number.isInteger(parsed) ? parsed : null;
  };
`;

const inventoryExtractionPairScript = `
  const readPairs = (scope) => {
    const pairs = [];
    if (!scope) return pairs;
    const splitRows = Array.from(scope.querySelectorAll('[class*="JanusSplitBox-module__row"]')).filter(visible);
    for (const splitRow of splitRows) {
      const panels = Array.from(splitRow.querySelectorAll('[class*="JanusSplitBox-module__panel"]')).filter(visible);
      if (panels.length < 2) continue;
      pairs.push({ label: clean(panels[0].innerText || panels[0].textContent), value: clean(panels[1].innerText || panels[1].textContent) });
    }
    return pairs;
  };
  const readPair = (pairs, label) => {
    const pair = pairs.find((item) => item.label === label);
    return pair ? pair.value : null;
  };
  const readStatus = (row) => {
    const statusText = clean(row.querySelector('[class*="Status-module__container"]')?.textContent || "");
    const statusLower = statusText.toLowerCase();
    if (statusText.includes("缺货") || statusLower.includes("out of stock")) return "out_of_stock";
    if (statusText.includes("在售") || statusLower.includes("active")) return "active";
    if (statusText.includes("缺少的信息") || statusLower.includes("missing")) return "missing_information";
    if (statusText.includes("停用") || statusLower.includes("inactive")) return "inactive";
    return statusText ? statusText.slice(0, 80) : null;
  };
`;

const inventoryExtractionRowsScript = `
  const rowCandidates = Array.from(document.querySelectorAll('[class*="JanusTable-module__tableContentRow"], tr, [role="row"]')).filter(visible);
  const rows = rowCandidates.map((row) => {
    const productDetails = row.querySelector('[class*="ProductDetails-module__container"]');
    if (!productDetails) return null;
    const pairs = readPairs(row);
    const sellerSku = readPair(pairs, "SKU");
    if (!sellerSku || !requestedSkus.includes(normalize(sellerSku))) return null;
    const asin = readPair(pairs, "ASIN");
    const titleNode = productDetails.querySelector('[class*="ProductDetails-module__titleContainer"] a')
      || productDetails.querySelector('[class*="ProductDetails-module__titleContainer"]');
    const image = productDetails.querySelector("img[src]");
    return {
      sellerSku,
      asinSnapshot: asin ? asin.toUpperCase() : null,
      sellerCentralTitleSnapshot: clean(titleNode ? (titleNode.innerText || titleNode.textContent) : "").slice(0, 240) || null,
      imageSrc: image ? image.getAttribute("src") : null,
      listingStatus: readStatus(row),
      availableFbaUnits: parseInteger(readPair(pairs, "现货（亚马逊物流）") || readPair(pairs, "Available") || readPair(pairs, "Fulfillable")),
      inboundUnits: parseInteger(readPair(pairs, "入库") || readPair(pairs, "Inbound")),
      unfulfillableUnits: parseInteger(readPair(pairs, "不可售") || readPair(pairs, "Unfulfillable")),
      reservedUnits: parseInteger(readPair(pairs, "预留") || readPair(pairs, "Reserved")),
      sales30dSnapshot: parseInteger(readPair(pairs, "售出件数") || readPair(pairs, "Units sold")),
    };
  }).filter(Boolean);
  return { url, title, detectedState: detect(), rows };
})()
`;
function buildInventoryExtractionScript(requestedSkus: readonly string[]): string {
  const requestedSkuJson = JSON.stringify(requestedSkus.map(normalizeSku));
  return `${inventoryExtractionStateScript}
  const requestedSkus = ${requestedSkuJson};
${inventoryExtractionPairScript}
${inventoryExtractionRowsScript}`;
}
