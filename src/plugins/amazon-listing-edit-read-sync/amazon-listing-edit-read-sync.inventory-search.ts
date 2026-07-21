import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type {
  AmazonListingEditReadSyncDiagnostic,
  AmazonListingEditReadSyncInput,
  AmazonListingEditReadSyncInventoryItem,
  AmazonListingEditReadSyncPageState,
} from "./amazon-listing-edit-read-sync.schema.js";
import {
  buildInventoryExpandAndReadScript,
  buildInventorySearchButtonClickScript,
  buildInventorySearchProbeScript,
  buildInventorySearchSubmitScript,
  buildInventorySkuCentralLinkReadScript,
  type InventoryReadScriptResult,
  type InventorySearchButtonClickScriptResult,
  type InventorySearchProbeScriptResult,
  type InventorySearchSubmitScriptResult,
  type InventorySkuCentralLinkScriptResult,
} from "./amazon-listing-edit-read-sync.dom-scripts.js";
import { inventoryUrlForPage, pageUrlPath } from "./amazon-listing-edit-read-sync.urls.js";

type SearchInput = { readonly browser: BrowserController; readonly mission: AmazonListingEditReadSyncInput };
type SearchFailure = { readonly ok: false; readonly reason: string; readonly diagnostic: AmazonListingEditReadSyncDiagnostic };
type SearchPhaseSuccess = { readonly ok: true; readonly diagnostic: AmazonListingEditReadSyncDiagnostic };
export type InventorySkuSearchResult = SearchFailure | {
  readonly ok: true;
  readonly diagnostic: AmazonListingEditReadSyncDiagnostic;
  readonly skuCentralHref: string;
};

const authGateFromState = (state: AmazonListingEditReadSyncPageState): AmazonListingEditReadSyncDiagnostic["authGate"] =>
  state === "ready" ? "none" : state;

const buildDiagnostic = (
  stage: string,
  page: Pick<InventoryReadScriptResult | InventorySearchProbeScriptResult | InventorySkuCentralLinkScriptResult, "detectedState" | "title" | "url">,
): AmazonListingEditReadSyncDiagnostic => ({
  authGate: authGateFromState(page.detectedState),
  detectedState: page.detectedState,
  diagnosticStage: stage,
  pageTitle: page.title || null,
  pageUrlPath: pageUrlPath(page.url),
});

const terminalReason = (state: AmazonListingEditReadSyncPageState): string | null => {
  if (state === "login_required") return "login_required";
  if (state === "captcha_or_2fa_required") return "captcha_or_2fa_required";
  if (state === "review_required") return "review_required";
  return null;
};

const fail = (reason: string, diagnostic: AmazonListingEditReadSyncDiagnostic): SearchFailure => ({ ok: false, reason, diagnostic });

const probeInventorySearch = async (input: SearchInput, item: AmazonListingEditReadSyncInventoryItem): Promise<SearchFailure | SearchPhaseSuccess> => {
  const probe = await input.browser.evaluateActiveTab<InventorySearchProbeScriptResult>({
    script: buildInventorySearchProbeScript(),
    description: `amazon-listing-edit-read-sync locate inventory filter SKU search and exclude top global search ${item.sku}`,
  });
  const diagnostic = buildDiagnostic("inventory_filter_probe", probe);
  const terminal = terminalReason(probe.detectedState);
  if (terminal) return fail(terminal, diagnostic);
  if (probe.reason || !probe.topGlobalSearchExcluded || !probe.inventorySearchUsesShadowInput) {
    return fail(probe.reason ?? "inventory_filter_search_not_found", diagnostic);
  }
  return { ok: true, diagnostic };
};

const submitInventorySearch = async (input: SearchInput, item: AmazonListingEditReadSyncInventoryItem): Promise<SearchFailure | SearchPhaseSuccess> => {
  const submit = await input.browser.evaluateActiveTab<InventorySearchSubmitScriptResult>({
    script: buildInventorySearchSubmitScript(item.sku),
    description: `amazon-listing-edit-read-sync fill inventory filter SKU shadow input ${item.sku}`,
  });
  const diagnostic = buildDiagnostic("inventory_filter_submit", submit);
  const terminal = terminalReason(submit.detectedState);
  if (terminal) return fail(terminal, diagnostic);
  if (!submit.ok || !submit.topGlobalSearchExcluded) return fail(submit.reason ?? "inventory_filter_shadow_input_submit_failed", diagnostic);
  await input.browser.wait(Math.min(Math.max(submit.searchClickDelayMs, 1000), 2000));
  return { ok: true, diagnostic };
};

const clickInventorySearch = async (input: SearchInput, item: AmazonListingEditReadSyncInventoryItem): Promise<SearchFailure | SearchPhaseSuccess> => {
  const click = await input.browser.evaluateActiveTab<InventorySearchButtonClickScriptResult>({
    script: buildInventorySearchButtonClickScript(item.sku),
    description: `amazon-listing-edit-read-sync click inventory filter search button DOM ${item.sku}`,
  });
  const diagnostic = buildDiagnostic("inventory_filter_button_click", click);
  const terminal = terminalReason(click.detectedState);
  if (terminal) return fail(terminal, diagnostic);
  if (!click.ok || !click.clickedButton || !click.topGlobalSearchExcluded) {
    return fail(click.reason ?? "inventory_filter_search_button_dom_click_failed", diagnostic);
  }
  return { ok: true, diagnostic };
};

const readUniqueSkuCentralLink = async (
  input: SearchInput,
  item: AmazonListingEditReadSyncInventoryItem,
  resultDiagnostic: AmazonListingEditReadSyncDiagnostic,
): Promise<InventorySkuSearchResult> => {
  const link = await input.browser.evaluateActiveTab<InventorySkuCentralLinkScriptResult>({
    script: buildInventorySkuCentralLinkReadScript(item.sku),
    description: `amazon-listing-edit-read-sync read unique SKU Central href from result DOM ${item.sku}`,
  });
  const diagnostic = buildDiagnostic("inventory_sku_central_link_read", link);
  const terminal = terminalReason(link.detectedState);
  if (terminal) return fail(terminal, diagnostic);
  if (!link.href || link.linkCount !== 1) return fail(link.reason ?? "sku_central_link_not_unique", diagnostic);
  return { ok: true, diagnostic: diagnostic ?? resultDiagnostic, skuCentralHref: link.href };
};

const waitForExactInventoryResult = async (input: SearchInput, item: AmazonListingEditReadSyncInventoryItem): Promise<InventorySkuSearchResult> => {
  let diagnostic: AmazonListingEditReadSyncDiagnostic | null = null;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    await input.browser.wait(750);
    const result = await input.browser.evaluateActiveTab<InventoryReadScriptResult>({
      script: buildInventoryExpandAndReadScript(),
      description: `amazon-listing-edit-read-sync verify inventory search exact SKU row ${item.sku} attempt ${attempt}`,
    });
    diagnostic = buildDiagnostic("inventory_search_result_dom_verify", result);
    const terminal = terminalReason(result.detectedState);
    if (terminal) return fail(terminal, diagnostic);
    if (result.items.some((candidate) => candidate.sku.toUpperCase() === item.sku.toUpperCase())) {
      return readUniqueSkuCentralLink(input, item, diagnostic);
    }
  }
  return fail("inventory_search_result_dom_not_verified", diagnostic ?? {
    authGate: "review_required", detectedState: "review_required", diagnosticStage: "inventory_search_result_dom_verify",
    pageTitle: null, pageUrlPath: null,
  });
};

export const runInventorySkuSearch = async (input: SearchInput, item: AmazonListingEditReadSyncInventoryItem): Promise<InventorySkuSearchResult> => {
  await input.browser.open({
    url: inventoryUrlForPage(input.mission.marketplace, 1),
    title: `Amazon listing edit read sync inventory search ${item.sku}`,
    reusePolicy: "reuse-host-tab",
  });
  await input.browser.wait(900);
  const probe = await probeInventorySearch(input, item);
  if (!probe.ok) return probe;
  const submit = await submitInventorySearch(input, item);
  if (!submit.ok) return submit;
  const click = await clickInventorySearch(input, item);
  if (!click.ok) return click;
  return waitForExactInventoryResult(input, item);
};
