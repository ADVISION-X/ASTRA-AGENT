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
  buildInventorySearchButtonClickScript,
  buildInventorySearchProbeScript,
  buildInventorySearchSubmitScript,
  buildInventorySkuCentralLinkReadScript,
  buildSkuCentralReadScript,
  type InventorySkuCentralLinkScriptResult,
  type InventorySearchButtonClickScriptResult,
  type InventorySearchProbeScriptResult,
  type InventorySearchSubmitScriptResult,
  type InventoryReadScriptResult,
  type SkuCentralReadScriptResult,
} from "./amazon-listing-edit-read-sync.dom-scripts.js";
import { editTabUrl, inventoryUrlForPage, pageUrlPath } from "./amazon-listing-edit-read-sync.urls.js";

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
  page: Pick<InventoryReadScriptResult | SkuCentralReadScriptResult | InventorySearchProbeScriptResult | InventorySkuCentralLinkScriptResult, "detectedState" | "title" | "url">,
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

const buildDefaultTargetResolution = (
  mission: AmazonListingEditReadSyncInput,
): AmazonListingEditReadSyncTargetResolution => ({
  mode: mission.targetMode,
  status: mission.targetMode === "inventory" || mission.targetMode === "all-inventory" ? "not_required" : "not_found",
  reason: mission.targetMode === "inventory" || mission.targetMode === "all-inventory" ? null : "target_resolution_not_started",
  candidateCount: 0,
  requested: mission.target,
  matchedParent: null,
  matchedChild: null,
  evidenceRefs: [],
});

const normalize = (value: string | null | undefined): string =>
  (value ?? "").trim().toUpperCase();

const matchesAsin = (item: AmazonListingEditReadSyncInventoryItem, asin: string | null | undefined): boolean =>
  Boolean(asin && normalize(item.asin) === normalize(asin));

const matchesSku = (item: AmazonListingEditReadSyncInventoryItem, sku: string | null | undefined): boolean =>
  Boolean(sku && normalize(item.sku) === normalize(sku));

const matchesParent = (item: AmazonListingEditReadSyncInventoryItem, input: AmazonListingEditReadSyncInput): boolean =>
  matchesAsin(item, input.target.parentAsin)
  || matchesSku(item, input.target.parentSku)
  || Boolean(input.target.parentAsin && normalize(item.parentAsin) === normalize(input.target.parentAsin))
  || Boolean(input.target.parentSku && normalize(item.parentSku) === normalize(input.target.parentSku));

const matchesChild = (item: AmazonListingEditReadSyncInventoryItem, input: AmazonListingEditReadSyncInput): boolean =>
  matchesAsin(item, input.target.childAsin ?? input.target.asin)
  || matchesSku(item, input.target.childSku ?? input.target.sku);

const buildTargetResolution = (
  mission: AmazonListingEditReadSyncInput,
  inventoryItems: readonly AmazonListingEditReadSyncInventoryItem[],
): AmazonListingEditReadSyncTargetResolution => {
  if (mission.targetMode === "inventory" || mission.targetMode === "all-inventory") {
    return {
      ...buildDefaultTargetResolution(mission),
      candidateCount: inventoryItems.length,
      evidenceRefs: inventoryItems.map((item) => item.evidenceRef),
    };
  }
  const parentRows = inventoryItems.filter((item) => item.rowKind === "parent" && matchesParent(item, mission));
  const childRows = inventoryItems.filter((item) => item.rowKind !== "parent" && matchesChild(item, mission));
  if (mission.targetMode === "asin" || mission.targetMode === "sku") {
    const candidates = inventoryItems.filter((item) =>
      mission.targetMode === "asin" ? matchesAsin(item, mission.target.asin) : matchesSku(item, mission.target.sku));
    return buildResolutionFromCandidates(mission, candidates, null);
  }
  if (mission.targetMode === "parent") {
    const children = inventoryItems.filter((item) =>
      item.rowKind === "child" && (matchesParent(item, mission) || parentRows.some((parent) => normalize(parent.asin) === normalize(item.parentAsin) || normalize(parent.sku) === normalize(item.parentSku))));
    if (parentRows.length === 0) {
      return buildFailedResolution(mission, "parent_not_proven", "parent_target_not_found", 0);
    }
    return buildResolutionFromCandidates(mission, children, parentRows[0] ?? null);
  }
  if (mission.targetMode === "child") {
    if (childRows.length !== 1) return buildResolutionFromCandidates(mission, childRows, null);
    const child = childRows[0]!;
    const parentRequired = Boolean(mission.target.parentAsin || mission.target.parentSku);
    if (parentRequired && !matchesParent(child, mission)) {
      return {
        ...buildFailedResolution(mission, "child_parent_mismatch", "child_parent_proof_failed", childRows.length),
        matchedChild: child,
        evidenceRefs: [child.evidenceRef],
      };
    }
    const matchedParent = inventoryItems.find((item) => item.rowKind === "parent" && (normalize(item.asin) === normalize(child.parentAsin) || normalize(item.sku) === normalize(child.parentSku))) ?? null;
    return buildMatchedResolution(mission, childRows, matchedParent, child);
  }
  return buildFailedResolution(mission, "not_found", "invalid_target_mode", 0);
};

const buildFailedResolution = (
  mission: AmazonListingEditReadSyncInput,
  status: AmazonListingEditReadSyncTargetResolution["status"],
  reason: string,
  candidateCount: number,
): AmazonListingEditReadSyncTargetResolution => ({
  mode: mission.targetMode,
  status,
  reason,
  candidateCount,
  requested: mission.target,
  matchedParent: null,
  matchedChild: null,
  evidenceRefs: [],
});

const buildMatchedResolution = (
  mission: AmazonListingEditReadSyncInput,
  candidates: readonly AmazonListingEditReadSyncInventoryItem[],
  matchedParent: AmazonListingEditReadSyncInventoryItem | null,
  matchedChild: AmazonListingEditReadSyncInventoryItem,
): AmazonListingEditReadSyncTargetResolution => ({
  mode: mission.targetMode,
  status: "matched",
  reason: null,
  candidateCount: candidates.length,
  requested: mission.target,
  matchedParent,
  matchedChild,
  evidenceRefs: [matchedChild.evidenceRef, ...(matchedParent ? [matchedParent.evidenceRef] : [])],
});

const buildResolutionFromCandidates = (
  mission: AmazonListingEditReadSyncInput,
  candidates: readonly AmazonListingEditReadSyncInventoryItem[],
  matchedParent: AmazonListingEditReadSyncInventoryItem | null,
): AmazonListingEditReadSyncTargetResolution => {
  if (candidates.length === 0) return buildFailedResolution(mission, "not_found", "target_not_found", 0);
  if (candidates.length > 1) return buildFailedResolution(mission, "ambiguous", "target_ambiguous", candidates.length);
  return buildMatchedResolution(mission, candidates, matchedParent, candidates[0]!);
};

const selectInventoryItems = (
  mission: AmazonListingEditReadSyncInput,
  inventoryItems: readonly AmazonListingEditReadSyncInventoryItem[],
  targetResolution: AmazonListingEditReadSyncTargetResolution,
): readonly AmazonListingEditReadSyncInventoryItem[] => {
  if (targetResolution.status === "matched" && targetResolution.matchedChild) {
    return [targetResolution.matchedChild];
  }
  if (mission.targetMode === "inventory" || mission.targetMode === "all-inventory") {
    return inventoryItems.filter((item) => item.rowKind !== "parent").slice(0, mission.maxItems);
  }
  return [];
};

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

const runInventorySkuSearch = async (
  input: FlowInput,
  item: AmazonListingEditReadSyncInventoryItem,
): Promise<{ readonly ok: true; readonly diagnostic: AmazonListingEditReadSyncDiagnostic; readonly skuCentralHref: string } | { readonly ok: false; readonly reason: string; readonly diagnostic: AmazonListingEditReadSyncDiagnostic }> => {
  await input.browser.open({
    url: inventoryUrlForPage(input.mission.marketplace, 1),
    title: `Amazon listing edit read sync inventory search ${item.sku}`,
    reusePolicy: "reuse-host-tab",
  });
  await input.browser.wait(900);
  const probe = await input.browser.evaluateActiveTab<InventorySearchProbeScriptResult>({
    script: buildInventorySearchProbeScript(),
    description: `amazon-listing-edit-read-sync locate inventory filter SKU search and exclude top global search ${item.sku}`,
  });
  let diagnostic = buildDiagnostic("inventory_filter_probe", probe);
  const terminal = terminalStatusFromState(probe.detectedState);
  if (terminal) return { ok: false, reason: terminal, diagnostic };
  if (probe.reason || !probe.topGlobalSearchExcluded || !probe.inventorySearchUsesShadowInput) {
    return { ok: false, reason: probe.reason ?? "inventory_filter_search_not_found", diagnostic };
  }
  const submit = await input.browser.evaluateActiveTab<InventorySearchSubmitScriptResult>({
    script: buildInventorySearchSubmitScript(item.sku),
    description: `amazon-listing-edit-read-sync fill inventory filter SKU shadow input ${item.sku}`,
  });
  diagnostic = buildDiagnostic("inventory_filter_submit", submit);
  const submitTerminal = terminalStatusFromState(submit.detectedState);
  if (submitTerminal) return { ok: false, reason: submitTerminal, diagnostic };
  if (!submit.ok || !submit.topGlobalSearchExcluded) {
    return { ok: false, reason: submit.reason ?? "inventory_filter_shadow_input_submit_failed", diagnostic };
  }
  await input.browser.wait(Math.min(Math.max(submit.searchClickDelayMs, 1000), 2000));
  const click = await input.browser.evaluateActiveTab<InventorySearchButtonClickScriptResult>({
    script: buildInventorySearchButtonClickScript(item.sku),
    description: `amazon-listing-edit-read-sync click inventory filter search button DOM ${item.sku}`,
  });
  diagnostic = buildDiagnostic("inventory_filter_button_click", click);
  const clickTerminal = terminalStatusFromState(click.detectedState);
  if (clickTerminal) return { ok: false, reason: clickTerminal, diagnostic };
  if (!click.ok || !click.clickedButton || !click.topGlobalSearchExcluded) {
    return { ok: false, reason: click.reason ?? "inventory_filter_search_button_dom_click_failed", diagnostic };
  }
  for (let attempt = 0; attempt < 24; attempt += 1) {
    await input.browser.wait(750);
    const result = await input.browser.evaluateActiveTab<InventoryReadScriptResult>({
      script: buildInventoryExpandAndReadScript(),
      description: `amazon-listing-edit-read-sync verify inventory search exact SKU row ${item.sku} attempt ${attempt}`,
    });
    diagnostic = buildDiagnostic("inventory_search_result_dom_verify", result);
    const resultTerminal = terminalStatusFromState(result.detectedState);
    if (resultTerminal) return { ok: false, reason: resultTerminal, diagnostic };
    const exactMatch = result.items.some((candidate) => candidate.sku.toUpperCase() === item.sku.toUpperCase());
    if (exactMatch) {
      const link = await input.browser.evaluateActiveTab<InventorySkuCentralLinkScriptResult>({
        script: buildInventorySkuCentralLinkReadScript(item.sku),
        description: `amazon-listing-edit-read-sync read unique SKU Central href from result DOM ${item.sku}`,
      });
      diagnostic = buildDiagnostic("inventory_sku_central_link_read", link);
      const linkTerminal = terminalStatusFromState(link.detectedState);
      if (linkTerminal) return { ok: false, reason: linkTerminal, diagnostic };
      if (!link.href || link.linkCount !== 1) {
        return { ok: false, reason: link.reason ?? "sku_central_link_not_unique", diagnostic };
      }
      return { ok: true, diagnostic, skuCentralHref: link.href };
    }
  }
  return { ok: false, reason: "inventory_search_result_dom_not_verified", diagnostic };
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
  const results: AmazonListingEditReadSyncItemResult[] = [];
  for (const item of selectedInventoryItems) {
    await input.onProgress?.({ reachedStep: "inventory_sku_search_started", reason: item.sku, inventoryItems: selectedInventoryItems, items: results });
    const search = await runInventorySkuSearch(input, item);
    await input.onProgress?.({ reachedStep: "inventory_sku_search_finished", reason: search.ok ? "inventory_search_result_dom_verified" : search.reason, inventoryItems: selectedInventoryItems, items: results, diagnostic: search.diagnostic });
    if (!search.ok) {
      const blocked = buildBlockedItemResult(input, item, search.reason);
      results.push(blocked);
      if (input.mission.safetyMode === "all-inventory-edit-tabs" && input.mission.stopOnFirstIssue) {
        return buildBatchStoppedTask(input, selectedInventoryItems, results, targetResolution, search.diagnostic, blocked.reason ?? "batch_stopped_on_first_issue");
      }
      continue;
    }
    if (input.mission.safetyMode === "single-sku-search-only") {
      continue;
    }
    if (input.mission.safetyMode === "single-sku-sku-central-only") {
      await input.onProgress?.({ reachedStep: "sku_central_opening", reason: item.sku, inventoryItems: selectedInventoryItems, items: results });
      const skuCentral = await readSkuCentral(input, item, search.skuCentralHref);
      results.push(buildSkuCentralOnlyResult(input, item, skuCentral));
      await input.onProgress?.({ reachedStep: "sku_central_dom_read", reason: item.sku, inventoryItems: selectedInventoryItems, items: results });
      continue;
    }
    await input.onProgress?.({ reachedStep: "sku_central_opening", reason: item.sku, inventoryItems: selectedInventoryItems, items: results });
    const itemResult = await buildItemResult(input, item, search.skuCentralHref);
    results.push(itemResult);
    await input.onProgress?.({ reachedStep: "item_edit_tabs_read", reason: item.sku, inventoryItems: selectedInventoryItems, items: results });
    if (input.mission.safetyMode === "all-inventory-edit-tabs" && input.mission.stopOnFirstIssue && itemResult.status !== "matched") {
      return buildBatchStoppedTask(input, selectedInventoryItems, results, targetResolution, diagnostic, itemResult.reason ?? "batch_stopped_on_first_issue");
    }
  }
  const status = input.mission.safetyMode === "single-sku-search-only"
    ? (results.length === 0 ? "success" : resolveStatus(results))
    : results.length > 0 ? resolveStatus(results) : "review_required";
  return {
    taskId: input.taskId,
    site: input.mission.site,
    requestId: input.mission.requestId,
    marketplace: input.mission.marketplace,
    ok: status === "success",
    status,
    reason: status === "success" ? null : input.mission.safetyMode === "single-sku-search-only" ? "inventory_sku_search_not_verified" : "not_all_listing_edit_tabs_read",
    reachedStep: input.mission.safetyMode === "single-sku-search-only" ? "inventory_sku_search_only_finished" : input.mission.safetyMode === "single-sku-sku-central-only" ? "sku_central_only_finished" : "flow_finished",
    targetResolution,
    inventoryItems: selectedInventoryItems,
    items: results,
    diagnostic,
    createdAt: input.createdAt,
    updatedAt: new Date().toISOString(),
  };
};
