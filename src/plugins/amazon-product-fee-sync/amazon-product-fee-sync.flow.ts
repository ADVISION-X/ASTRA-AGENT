import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type {
  AmazonProductFeeMoneyEvidence,
  AmazonProductFeeSyncDiagnostic,
  AmazonProductFeeSyncInput,
  AmazonProductFeeSyncResultItem,
  AmazonProductFeeSyncTaskRecord,
} from "./amazon-product-fee-sync.schema.js";
import {
  buildInventoryFeeExtractionScript,
  buildInventoryFeeSearchButtonClickScript,
  buildInventoryFeeSearchProbeScript,
  buildInventoryFeeSearchSubmitScript,
} from "./amazon-product-fee-sync.dom-scripts.js";

type PageState = "ready" | "login_required" | "captcha_or_2fa_required" | "review_required";

type ViewportPoint = { readonly x: number; readonly y: number };

type InventoryFeeSearchProbe = {
  readonly url: string;
  readonly title: string;
  readonly detectedState: PageState;
  readonly topGlobalSearchPresent: boolean;
  readonly topGlobalSearchExcluded: boolean;
  readonly inventorySearchUsesShadowInput: boolean;
  readonly inventorySearchInputPoint: ViewportPoint | null;
  readonly inventorySearchButtonPoint: ViewportPoint | null;
  readonly reason: string | null;
};

type InventoryFeeSearchSubmitResult = {
  readonly url: string;
  readonly title: string;
  readonly detectedState: PageState;
  readonly ok: boolean;
  readonly submittedValue: string | null;
  readonly inputValue: string | null;
  readonly hostValue: string | null;
  readonly searchClickDelayMs?: number;
  readonly topGlobalSearchExcluded: boolean;
  readonly reason: string | null;
};

type InventoryFeeSearchButtonClickResult = {
  readonly url: string;
  readonly title: string;
  readonly ok: boolean;
  readonly clickedButton: boolean;
  readonly topGlobalSearchExcluded: boolean;
  readonly reason: string | null;
};

type ExtractedFeeRow = {
  readonly sellerSku: string;
  readonly totalAmazonFee: AmazonProductFeeMoneyEvidence;
  readonly fbaFulfillmentFee: AmazonProductFeeMoneyEvidence;
  readonly amazonNonFulfillmentFeeResidual: AmazonProductFeeSyncResultItem["amazonNonFulfillmentFeeResidual"];
  readonly referralFee: AmazonProductFeeSyncResultItem["referralFee"];
};

type ExtractedFeePage = {
  readonly url: string;
  readonly title: string;
  readonly detectedState: PageState;
  readonly searchVerified: boolean;
  readonly searchVerificationEvidence: readonly string[];
  readonly rows: readonly ExtractedFeeRow[];
};

export type AmazonProductFeeSyncFlowProgress = {
  readonly reachedStep: string;
  readonly items?: readonly AmazonProductFeeSyncResultItem[];
  readonly reason?: string | null;
  readonly authGate?: AmazonProductFeeSyncDiagnostic["authGate"];
  readonly detectedState?: string;
  readonly diagnosticStage?: string;
  readonly pageTitle?: string | null;
  readonly pageUrlPath?: string | null;
};

type ProgressReporter = (progress: AmazonProductFeeSyncFlowProgress) => Promise<void>;

const MARKETPLACE_INVENTORY_URL: Record<AmazonProductFeeSyncInput["marketplace"], string> = {
  "amazon.ae": "https://sellercentral.amazon.ae/myinventory/inventory?fulfilledBy=all&page=1&pageSize=25&sort=date_created_desc&status=all",
  "amazon.sa": "https://sellercentral.amazon.sa/myinventory/inventory?fulfilledBy=all&page=1&pageSize=25&sort=date_created_desc&status=all",
  "amazon.com": "https://sellercentral.amazon.com/myinventory/inventory?fulfilledBy=all&page=1&pageSize=25&sort=date_created_desc&status=all",
  "amazon.co.uk": "https://sellercentral.amazon.co.uk/myinventory/inventory?fulfilledBy=all&page=1&pageSize=25&sort=date_created_desc&status=all",
  "amazon.co.jp": "https://sellercentral.amazon.co.jp/myinventory/inventory?fulfilledBy=all&page=1&pageSize=25&sort=date_created_desc&status=all",
};

const normalizeSku = (value: string): string => value.trim().toUpperCase();

const redactedEvidenceRef = (taskId: string, sku: string): string =>
  `evidence://amazon-product-fee-sync/${taskId}/${encodeURIComponent(normalizeSku(sku))}`;

const emptyMoneyEvidence = (sourceLabel: string): AmazonProductFeeMoneyEvidence => ({
  amount: null,
  currency: null,
  sourceLabel,
  rawText: null,
  status: "not_visible",
});

const authGateFromState = (state: PageState): AmazonProductFeeSyncDiagnostic["authGate"] =>
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
}): AmazonProductFeeSyncDiagnostic => ({
  authGate: authGateFromState(input.detectedState),
  detectedState: input.detectedState,
  diagnosticStage: input.stageName,
  pageTitle: input.title || null,
  pageUrlPath: pageUrlPath(input.url),
});

const terminalTaskStatusFromPage = (state: PageState): AmazonProductFeeSyncTaskRecord["status"] | null => {
  if (state === "login_required") return "login_required";
  if (state === "captcha_or_2fa_required") return "captcha_or_2fa_required";
  if (state === "review_required") return "review_required";
  return null;
};

const buildMissingItem = (
  inputItem: AmazonProductFeeSyncInput["items"][number],
  snapshotAt: string,
  reason: string,
  status: AmazonProductFeeSyncResultItem["status"] = "not_found",
  diagnostic?: AmazonProductFeeSyncDiagnostic,
): AmazonProductFeeSyncResultItem => ({
  sellerSku: inputItem.sellerSku,
  sourceKeyType: inputItem.sourceKeyType,
  sourceKey: inputItem.sourceKey,
  requestedFields: inputItem.requiredFields,
  missingRequestedFields: inputItem.requiredFields,
  status,
  totalAmazonFee: emptyMoneyEvidence("总费用"),
  fbaFulfillmentFee: emptyMoneyEvidence("亚马逊物流费用"),
  amazonNonFulfillmentFeeResidual: {
    amount: null,
    currency: null,
    status: "not_derived_missing_inputs",
  },
  referralFee: {
    amount: null,
    currency: null,
    status: "not_visible_in_current_dom",
  },
  snapshotAt,
  rowEvidenceRef: null,
  feeEvidenceRef: null,
  reason,
  ...(diagnostic ? { diagnostic } : {}),
});

const buildMatchedItem = (
  taskId: string,
  inputItem: AmazonProductFeeSyncInput["items"][number],
  row: ExtractedFeeRow,
  snapshotAt: string,
): AmazonProductFeeSyncResultItem => {
  const missingRequestedFields = inputItem.requiredFields.filter((field) => {
    if (field === "totalAmazonFee") return row.totalAmazonFee.status !== "visible";
    return row.fbaFulfillmentFee.status !== "visible";
  });
  return {
    sellerSku: inputItem.sellerSku,
    sourceKeyType: inputItem.sourceKeyType,
    sourceKey: inputItem.sourceKey,
    requestedFields: inputItem.requiredFields,
    missingRequestedFields,
    status: missingRequestedFields.length > 0 ? "parse_failed" : "matched",
    totalAmazonFee: row.totalAmazonFee,
    fbaFulfillmentFee: row.fbaFulfillmentFee,
    amazonNonFulfillmentFeeResidual: row.amazonNonFulfillmentFeeResidual,
    referralFee: row.referralFee,
    snapshotAt,
    rowEvidenceRef: redactedEvidenceRef(taskId, inputItem.sellerSku),
    feeEvidenceRef: `${redactedEvidenceRef(taskId, inputItem.sellerSku)}/fees`,
    reason: missingRequestedFields.length > 0 ? "fee_label_missing_or_parse_failed" : null,
  };
};

const resolveOverallStatus = (items: readonly AmazonProductFeeSyncResultItem[]): AmazonProductFeeSyncTaskRecord["status"] => {
  const matched = items.filter((item) => item.status === "matched").length;
  if (matched === items.length) return "success";
  if (matched > 0) return "partial_success";
  return "review_required";
};

const resolveTerminalStatus = (items: readonly AmazonProductFeeSyncResultItem[]): AmazonProductFeeSyncTaskRecord["status"] | null => {
  const reasons = items.map((item) => item.reason);
  if (reasons.length > 0 && reasons.every((reason) => reason === "login_required")) return "login_required";
  if (reasons.length > 0 && reasons.every((reason) => reason === "captcha_or_2fa_required")) return "captcha_or_2fa_required";
  return null;
};

const sleepViaBrowser = (browser: BrowserController, durationMs: number): Promise<unknown> =>
  browser.wait(durationMs);

export const runAmazonProductFeeSyncFlow = async (input: {
  readonly browser: BrowserController;
  readonly mission: AmazonProductFeeSyncInput;
  readonly taskId: string;
  readonly createdAt: string;
  readonly onProgress?: ProgressReporter;
}): Promise<AmazonProductFeeSyncTaskRecord> => {
  const inputItem = input.mission.items[0];
  if (!inputItem) {
    throw new Error("amazon_product_fee_sync_missing_single_sku_item");
  }
  const inventoryUrl = MARKETPLACE_INVENTORY_URL[input.mission.marketplace];
  await input.onProgress?.({ reachedStep: "seller_central_inventory_opening", reason: "progress_continues" });
  await input.browser.open({
    url: inventoryUrl,
    title: `Amazon product fee sync ${inputItem.sellerSku}`,
    reusePolicy: "reuse-host-tab",
  });
  await sleepViaBrowser(input.browser, 1000);

  const probe = await input.browser.evaluateActiveTab<InventoryFeeSearchProbe>({
    script: buildInventoryFeeSearchProbeScript(),
    description: "probe Seller Central inventory fee sync search control",
  });
  await input.onProgress?.({
    reachedStep: "inventory_search_probe",
    reason: probe.reason ?? "inventory_filter_probe_ready",
    authGate: authGateFromState(probe.detectedState),
    detectedState: probe.detectedState,
    diagnosticStage: "inventory_search_probe",
    pageTitle: probe.title,
    pageUrlPath: pageUrlPath(probe.url),
  });
  const pageTerminal = terminalTaskStatusFromPage(probe.detectedState);
  if (pageTerminal) {
    const item = buildMissingItem(
      inputItem,
      new Date().toISOString(),
      probe.detectedState,
      "blocked",
      buildDiagnostic({ detectedState: probe.detectedState, stageName: "inventory_search_probe", title: probe.title, url: probe.url }),
    );
    return buildFinalTask(input, [item], pageTerminal, probe.detectedState);
  }
  if (!probe.topGlobalSearchExcluded || !probe.inventorySearchUsesShadowInput) {
    const item = buildMissingItem(
      inputItem,
      new Date().toISOString(),
      probe.reason ?? "inventory_filter_katal_search_missing",
      "blocked",
      buildDiagnostic({ detectedState: probe.detectedState, stageName: "inventory_search_probe", title: probe.title, url: probe.url }),
    );
    return buildFinalTask(input, [item], "review_required", item.reason);
  }

  const submit = await input.browser.evaluateActiveTab<InventoryFeeSearchSubmitResult>({
    script: buildInventoryFeeSearchSubmitScript(inputItem.sellerSku),
    description: `submit Seller Central inventory fee sync SKU ${inputItem.sellerSku}`,
  });
  await input.onProgress?.({
    reachedStep: "inventory_search_sku_submitted",
    reason: submit.reason ?? "inventory_search_value_submitted",
    authGate: authGateFromState(submit.detectedState),
    detectedState: submit.detectedState,
    diagnosticStage: "inventory_search_sku_submitted",
    pageTitle: submit.title,
    pageUrlPath: pageUrlPath(submit.url),
  });
  if (!submit.ok || !submit.searchClickDelayMs) {
    const item = buildMissingItem(
      inputItem,
      new Date().toISOString(),
      submit.reason ?? "inventory_search_submit_failed",
      "blocked",
      buildDiagnostic({ detectedState: submit.detectedState, stageName: "inventory_search_sku_submitted", title: submit.title, url: submit.url }),
    );
    return buildFinalTask(input, [item], "review_required", item.reason);
  }

  await sleepViaBrowser(input.browser, submit.searchClickDelayMs);
  const click = await input.browser.evaluateActiveTab<InventoryFeeSearchButtonClickResult>({
    script: buildInventoryFeeSearchButtonClickScript(inputItem.sellerSku),
    description: `click Seller Central inventory fee search button ${inputItem.sellerSku}`,
  });
  await input.onProgress?.({ reachedStep: "inventory_search_button_clicked", reason: click.reason ?? "inventory_search_dom_mouse_events_dispatched" });
  if (!click.ok) {
    const item = buildMissingItem(inputItem, new Date().toISOString(), click.reason ?? "inventory_search_button_click_failed", "blocked");
    return buildFinalTask(input, [item], "review_required", item.reason);
  }

  let extracted: ExtractedFeePage | null = null;
  for (let attempt = 0; attempt < 15; attempt += 1) {
    await sleepViaBrowser(input.browser, attempt === 0 ? 1500 : 1000);
    extracted = await input.browser.evaluateActiveTab<ExtractedFeePage>({
      script: buildInventoryFeeExtractionScript(inputItem.sellerSku),
      description: `extract Seller Central inventory fee row ${inputItem.sellerSku}`,
    });
    if (extracted.searchVerified && extracted.rows.length === 1) {
      break;
    }
  }

  const snapshotAt = new Date().toISOString();
  if (!extracted) {
    const item = buildMissingItem(inputItem, snapshotAt, "inventory_fee_dom_extract_not_executed", "blocked");
    return buildFinalTask(input, [item], "review_required", item.reason);
  }
  await input.onProgress?.({
    reachedStep: "inventory_fee_dom_extract_finished",
    reason: extracted.searchVerified ? "exact_sku_fee_row_visible" : "inventory_search_result_dom_not_verified",
    authGate: authGateFromState(extracted.detectedState),
    detectedState: extracted.detectedState,
    diagnosticStage: "inventory_fee_dom_extract_finished",
    pageTitle: extracted.title,
    pageUrlPath: pageUrlPath(extracted.url),
  });
  const extractTerminal = terminalTaskStatusFromPage(extracted.detectedState);
  if (extractTerminal) {
    const item = buildMissingItem(
      inputItem,
      snapshotAt,
      extracted.detectedState,
      "blocked",
      buildDiagnostic({ detectedState: extracted.detectedState, stageName: "inventory_fee_dom_extract_finished", title: extracted.title, url: extracted.url }),
    );
    return buildFinalTask(input, [item], extractTerminal, extracted.detectedState);
  }
  if (!extracted.searchVerified || extracted.rows.length === 0) {
    const item = buildMissingItem(
      inputItem,
      snapshotAt,
      "inventory_search_result_dom_not_verified",
      "not_found",
      buildDiagnostic({ detectedState: extracted.detectedState, stageName: "inventory_fee_dom_extract_finished", title: extracted.title, url: extracted.url }),
    );
    return buildFinalTask(input, [item], "review_required", item.reason);
  }
  if (extracted.rows.length > 1) {
    const item = buildMissingItem(inputItem, snapshotAt, "ambiguous_exact_sku_rows", "ambiguous");
    return buildFinalTask(input, [item], "review_required", item.reason);
  }

  const [extractedRow] = extracted.rows;
  if (!extractedRow) {
    const item = buildMissingItem(inputItem, snapshotAt, "inventory_fee_exact_sku_row_missing_after_verification", "not_found");
    return buildFinalTask(input, [item], "review_required", item.reason);
  }
  const item = buildMatchedItem(input.taskId, inputItem, extractedRow, snapshotAt);
  return buildFinalTask(input, [item], resolveTerminalStatus([item]) ?? resolveOverallStatus([item]), item.reason);
};

const buildFinalTask = (
  input: {
    readonly mission: AmazonProductFeeSyncInput;
    readonly taskId: string;
    readonly createdAt: string;
  },
  items: readonly AmazonProductFeeSyncResultItem[],
  status: AmazonProductFeeSyncTaskRecord["status"],
  reason: string | null,
): AmazonProductFeeSyncTaskRecord => {
  const updatedAt = new Date().toISOString();
  return {
    taskId: input.taskId,
    site: input.mission.site,
    requestId: input.mission.requestId,
    marketplace: input.mission.marketplace,
    ok: status === "success" || status === "partial_success",
    status,
    reason,
    reachedStep: "finished",
    items,
    createdAt: input.createdAt,
    updatedAt,
  };
};
