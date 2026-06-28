import type {
  AmazonListingEditReadSyncInventoryItem,
  AmazonListingEditReadSyncPageState,
  AmazonListingEditReadSyncTab,
  AmazonListingEditReadSyncTabRead,
} from "./amazon-listing-edit-read-sync.schema.js";

export type InventoryReadScriptResult = {
  readonly url: string;
  readonly title: string;
  readonly detectedState: AmazonListingEditReadSyncPageState;
  readonly expandedCount: number;
  readonly expandableCount: number;
  readonly pageInfo: {
    readonly currentPage: number;
    readonly pageSize: number;
    readonly totalItems: number | null;
    readonly totalPages: number | null;
    readonly countText: string | null;
  };
  readonly items: readonly AmazonListingEditReadSyncInventoryItem[];
  readonly reason: string | null;
};

export type SkuCentralReadScriptResult = {
  readonly url: string;
  readonly title: string;
  readonly detectedState: AmazonListingEditReadSyncPageState;
  readonly sku: string | null;
  readonly asin: string | null;
  readonly fnsku: string | null;
  readonly editButtonVisible: boolean;
  readonly reason: string | null;
};

export type InventorySkuCentralLinkScriptResult = {
  readonly url: string;
  readonly title: string;
  readonly detectedState: AmazonListingEditReadSyncPageState;
  readonly href: string | null;
  readonly target: string | null;
  readonly linkCount: number;
  readonly reason: string | null;
};

export type InventorySearchProbeScriptResult = {
  readonly url: string;
  readonly title: string;
  readonly detectedState: AmazonListingEditReadSyncPageState;
  readonly topGlobalSearchPresent: boolean;
  readonly topGlobalSearchExcluded: boolean;
  readonly inventorySearchPlaceholder: string | null;
  readonly inventorySearchUsesShadowInput: boolean;
  readonly reason: string | null;
};

export type InventorySearchSubmitScriptResult = {
  readonly url: string;
  readonly title: string;
  readonly detectedState: AmazonListingEditReadSyncPageState;
  readonly ok: boolean;
  readonly submittedValue: string | null;
  readonly inputValue: string | null;
  readonly hostValue: string | null;
  readonly hostValueGetterDefined: boolean;
  readonly shadowValueReady: boolean;
  readonly searchEventsReady: boolean;
  readonly topGlobalSearchExcluded: boolean;
  readonly searchClickDelayMs: number;
  readonly reason: string | null;
};

export type InventorySearchButtonClickScriptResult = {
  readonly url: string;
  readonly title: string;
  readonly detectedState: AmazonListingEditReadSyncPageState;
  readonly ok: boolean;
  readonly clickedButton: boolean;
  readonly topGlobalSearchExcluded: boolean;
  readonly reason: string | null;
};

const script = (body: string): string => body;

const sharedPageHelpers = `
const textOf = (node) => (node && node.textContent ? node.textContent.replace(/\\s+/g, " ").trim() : "");
const urlPath = () => {
  try {
    const url = new URL(location.href);
    return url.origin + url.pathname;
  } catch {
    return location.href;
  }
};
const detectState = () => {
  const bodyText = textOf(document.body).toLowerCase();
  if (bodyText.includes("sign in") || bodyText.includes("تسجيل الدخول") || bodyText.includes("登录")) return "login_required";
  if (bodyText.includes("captcha") || bodyText.includes("two-step") || bodyText.includes("two factor")) return "captcha_or_2fa_required";
  if (bodyText.includes("review") && bodyText.includes("account")) return "review_required";
  return "ready";
};
`;

const inventorySearchHelpers = `
const inventorySearchPlaceholder = "搜索 SKU、商品名称/关键词、FNSKU、ASIN、UPC/EAN";
const topGlobalSearchForm = document.querySelector("form#sc-global-search-form");
const findInventorySearchHost = () => Array.from(document.querySelectorAll("kat-input"))
  .find((el) => el.getAttribute("placeholder") === inventorySearchPlaceholder) || null;
const visible = (el) => {
  if (!el || !el.getBoundingClientRect) return false;
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
};
const searchButtonForHost = (host) => {
  const group = host ? host.closest("kat-input-group") : null;
  return group ? group.querySelector('[class*="SearchBox-module__searchButton"]') : null;
};
`;

export const buildInventorySearchProbeScript = (): string => script(`
${sharedPageHelpers}
${inventorySearchHelpers}
const host = findInventorySearchHost();
const shadowInput = host && host.shadowRoot ? host.shadowRoot.querySelector("input[type='text'], input") : null;
const button = searchButtonForHost(host);
const topGlobalSearchExcluded = Boolean(host && !(topGlobalSearchForm && topGlobalSearchForm.contains(host)));
return {
  url: location.href,
  title: document.title,
  detectedState: detectState(),
  topGlobalSearchPresent: Boolean(topGlobalSearchForm || document.querySelector("input#sc-search-field") || document.querySelector("button.sc-search-button")),
  topGlobalSearchExcluded,
  inventorySearchPlaceholder: host ? host.getAttribute("placeholder") : null,
  inventorySearchUsesShadowInput: Boolean(shadowInput),
  reason: host && shadowInput && button && visible(host) && visible(button) && topGlobalSearchExcluded ? null : "inventory_filter_katal_search_missing",
};
`);

export const buildInventorySearchSubmitScript = (sellerSku: string): string => script(`
${sharedPageHelpers}
${inventorySearchHelpers}
const sellerSku = ${JSON.stringify(sellerSku.trim())};
const host = findInventorySearchHost();
const shadowInput = host && host.shadowRoot ? host.shadowRoot.querySelector("input[type='text'], input") : null;
const button = searchButtonForHost(host);
const topGlobalSearchExcluded = Boolean(host && !(topGlobalSearchForm && topGlobalSearchForm.contains(host)));
const defineOwnValueGetter = (target, value) => {
  try {
    Object.defineProperty(target, "value", { configurable: true, get: () => value });
    return target.value === value;
  } catch {
    return false;
  }
};
const setInputValue = (input, value) => {
  for (let proto = input; proto; proto = Object.getPrototypeOf(proto)) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    if (descriptor && typeof descriptor.set === "function") {
      descriptor.set.call(input, value);
      return input.value === value;
    }
  }
  return defineOwnValueGetter(input, value);
};
const createDomEvent = (name) => {
  if (typeof Event === "function") return new Event(name, { bubbles: true, composed: true });
  const event = document.createEvent("Event");
  event.initEvent(name, true, true);
  return event;
};
const createInputEvent = (value) => {
  if (typeof InputEvent === "function") return new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: value });
  return createDomEvent("input");
};
if (!host || !shadowInput || !button || !topGlobalSearchExcluded || !visible(host) || !visible(button)) {
  return {
    url: location.href,
    title: document.title,
    detectedState: detectState(),
    ok: false,
    submittedValue: null,
    inputValue: shadowInput ? shadowInput.value : null,
    hostValue: host ? host.value : null,
    hostValueGetterDefined: false,
    shadowValueReady: false,
    searchEventsReady: false,
    topGlobalSearchExcluded,
    searchClickDelayMs: 1000,
    reason: "inventory_filter_shadow_input_not_ready",
  };
}
host.click();
shadowInput.focus();
const shadowValueReady = setInputValue(shadowInput, sellerSku);
const hostValueGetterDefined = defineOwnValueGetter(host, sellerSku);
host.setAttribute("value", sellerSku);
shadowInput.setAttribute("value", sellerSku);
const searchEventsReady = Boolean(
  shadowInput.dispatchEvent(createInputEvent(sellerSku))
  && host.dispatchEvent(createInputEvent(sellerSku))
  && shadowInput.dispatchEvent(createDomEvent("change"))
  && host.dispatchEvent(createDomEvent("change"))
);
const searchClickDelayMs = 1000 + Math.floor(Math.random() * 1001);
const inputValue = shadowInput.value;
const hostValue = host.value;
const ok = hostValueGetterDefined && shadowValueReady && searchEventsReady && hostValue === sellerSku && inputValue === sellerSku;
return {
  url: location.href,
  title: document.title,
  detectedState: detectState(),
  ok,
  submittedValue: sellerSku,
  inputValue,
  hostValue,
  hostValueGetterDefined,
  shadowValueReady,
  searchEventsReady,
  topGlobalSearchExcluded,
  searchClickDelayMs,
  reason: ok ? null : "inventory_filter_katal_host_value_or_event_not_ready",
};
`);

export const buildInventorySearchButtonClickScript = (sellerSku: string): string => script(`
${sharedPageHelpers}
${inventorySearchHelpers}
const sellerSku = ${JSON.stringify(sellerSku.trim())};
const host = findInventorySearchHost();
const shadowInput = host && host.shadowRoot ? host.shadowRoot.querySelector("input[type='text'], input") : null;
const button = searchButtonForHost(host);
const topGlobalSearchExcluded = Boolean(host && !(topGlobalSearchForm && topGlobalSearchForm.contains(host)));
const createMouseEvent = (name) => {
  if (typeof MouseEvent === "function") return new MouseEvent(name, { bubbles: true, cancelable: true, view: window });
  const event = document.createEvent("MouseEvents");
  event.initMouseEvent(name, true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
  return event;
};
if (!host || !shadowInput || !button || !topGlobalSearchExcluded || !visible(button)) {
  return {
    url: location.href,
    title: document.title,
    detectedState: detectState(),
    ok: false,
    clickedButton: false,
    topGlobalSearchExcluded,
    reason: "inventory_filter_search_button_dom_not_ready",
  };
}
const valueReady = host.value === sellerSku && shadowInput.value === sellerSku;
const clickedButton = Boolean(
  button.dispatchEvent(createMouseEvent("pointerdown"))
  && button.dispatchEvent(createMouseEvent("mousedown"))
  && button.dispatchEvent(createMouseEvent("pointerup"))
  && button.dispatchEvent(createMouseEvent("mouseup"))
  && button.dispatchEvent(createMouseEvent("click"))
);
return {
  url: location.href,
  title: document.title,
  detectedState: detectState(),
  ok: valueReady && clickedButton,
  clickedButton,
  topGlobalSearchExcluded,
  reason: valueReady && clickedButton ? null : "inventory_filter_search_button_dom_click_failed",
};
`);

export const buildInventorySkuCentralLinkReadScript = (sellerSku: string): string => script(`
${sharedPageHelpers}
const sellerSku = ${JSON.stringify(sellerSku.trim())};
const normalizedSku = sellerSku.toUpperCase();
const visible = (el) => {
  if (!el || !el.getBoundingClientRect) return false;
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
};
const links = Array.from(document.querySelectorAll('a[href*="/skucentral"]'))
  .filter(visible)
  .filter((link) => {
    const href = link.getAttribute("href") || "";
    const text = textOf(link).toUpperCase();
    return href.includes("mSku=" + encodeURIComponent(sellerSku)) || text === normalizedSku;
  });
const link = links.length === 1 ? links[0] : null;
return {
  url: location.href,
  title: document.title,
  detectedState: detectState(),
  href: link ? new URL(link.getAttribute("href") || "", location.href).href : null,
  target: link ? link.getAttribute("target") : null,
  linkCount: links.length,
  reason: link ? null : "sku_central_link_not_unique",
};
`);

export const buildInventoryExpandAndReadScript = (): string => script(`
${sharedPageHelpers}
const currentUrl = new URL(location.href);
const currentPage = Number(currentUrl.searchParams.get("page") || "1");
const pageSize = Number(currentUrl.searchParams.get("pageSize") || "25");
const bodyTextForPage = textOf(document.body);
const countMatch = bodyTextForPage.match(/\\b\\d+\\s*-\\s*\\d+\\s*共\\s*(\\d+)\\b/);
const totalItems = countMatch ? Number(countMatch[1]) : null;
const totalPages = totalItems && pageSize > 0 ? Math.max(1, Math.ceil(totalItems / pageSize)) : null;
const countText = countMatch ? countMatch[0] : null;
const expanderHeaders = Array.from(document.querySelectorAll('[class*="VariationExpander-module__expanderHeader"]'));
let expandedCount = 0;
for (const header of expanderHeaders) {
  const text = textOf(header);
  const alreadyOpen = text.includes("隐藏") || text.includes("Hide") || header.getAttribute("aria-expanded") === "true";
  if (!alreadyOpen && header instanceof HTMLElement) {
    header.click();
    expandedCount += 1;
  }
}
const readField = (row, label) => {
  const candidates = Array.from(row.querySelectorAll('[class*="JanusSplitBox-module__row"], [class*="ProductDetails-module__container"]'));
  for (const candidate of candidates) {
    const text = textOf(candidate);
    if (label === "ASIN") {
      const match = text.match(/(?:ASIN|Parent ASIN)[:：]?(B[0-9A-Z]{9})/);
      if (match) return match[1];
    }
    if (label === "SKU") {
      const match = text.match(/(?:SKU|父 SKU)[:：]?([A-Z0-9][A-Z0-9_-]{0,127})/);
      if (match) return match[1];
    }
    const parts = text.split(" ").filter(Boolean);
    const index = parts.indexOf(label);
    if (index < 0 || !parts[index + 1]) continue;
    const value = parts[index + 1].replace(/^[:：]/, "").trim();
    if (label === "ASIN" && /^B[0-9A-Z]{9}$/.test(value)) return value;
    if (label === "SKU" && !value.includes("ASIN") && value.length <= 128) return value;
    if (label !== "ASIN" && label !== "SKU" && value) return value;
  }
  return null;
};
const rows = Array.from(document.querySelectorAll('[class*="JanusTable-module__tableContentRow"]'));
const items = [];
const seen = new Set();
for (const row of rows) {
  const sku = readField(row, "SKU");
  const asin = readField(row, "ASIN");
  if (!sku || !asin) continue;
  const key = asin + "::" + sku;
  if (seen.has(key)) continue;
  seen.add(key);
  const rowText = textOf(row);
  const rowKind = rowText.includes("子 ASIN") || rowText.includes("Child ASIN")
    ? "child"
    : row.querySelector('[class*="VariationExpander-module__expanderHeader"]') ? "parent" : "unknown";
  items.push({
    asin,
    sku,
    title: readField(row, "商品名称") || readField(row, "Product name") || null,
    rowKind,
    evidenceRef: "inventory-row:" + encodeURIComponent(sku),
  });
}
return {
  url: location.href,
  title: document.title,
  detectedState: detectState(),
  expandedCount,
  expandableCount: expanderHeaders.length,
  pageInfo: {
    currentPage,
    pageSize,
    totalItems,
    totalPages,
    countText,
  },
  items,
  reason: items.length > 0 ? null : "inventory_asin_sku_rows_not_found",
};
`);

export const buildSkuCentralReadScript = (): string => script(`
${sharedPageHelpers}
const bodyText = textOf(document.body);
const readSku = () => {
  const match = bodyText.match(/SKU[:：]?\\s*([A-Z0-9][A-Z0-9_-]{0,127}?)(?=\\s*(?:ASIN[:：]|FNSKU[:：]|销售额|SKU 成本|$))/);
  return match ? match[1] : null;
};
const readAsin = () => {
  const match = bodyText.match(/ASIN[:：]?\\s*(B[0-9A-Z]{9})/);
  return match ? match[1] : null;
};
const readFnsku = () => {
  const match = bodyText.match(/FNSKU[:：]?\\s*([A-Z0-9]{10,24})(?=\\s*(?:销售额|SKU 成本|定价|库存|入库|操作|$))/);
  return match ? match[1] : null;
};
const buttonTexts = Array.from(document.querySelectorAll("button, kat-button, a"))
  .map((node) => [
    node.getAttribute("label"),
    node.getAttribute("aria-label"),
    textOf(node),
  ].filter(Boolean).join(" "));
const sku = readSku();
const asin = readAsin();
const fnsku = readFnsku();
return {
  url: location.href,
  title: document.title,
  detectedState: detectState(),
  sku,
  asin,
  fnsku,
  editButtonVisible: buttonTexts.some((value) => value.includes("编辑商品信息") || value.includes("Edit product info")),
  reason: sku || asin ? null : "sku_central_dom_not_ready",
};
`);

export const buildEditTabReadScript = (tab: AmazonListingEditReadSyncTab): string => script(`
${sharedPageHelpers}
const bounded = (value, max = 300) => {
  const text = String(value ?? "").replace(/\\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max) : text;
};
const controls = Array.from(document.querySelectorAll("input, textarea, select, kat-input, kat-select, kat-textarea, kat-radiobutton, kat-checkbox, kat-date-picker"))
  .map((control) => ({
    name: control.getAttribute("name") || control.getAttribute("id") || control.getAttribute("data-testid") || null,
    label: bounded(control.getAttribute("label") || control.getAttribute("placeholder") || control.getAttribute("aria-label") || ""),
    value: bounded(control.value ?? control.getAttribute("value") ?? ""),
    tagName: control.tagName.toLowerCase(),
    type: control.getAttribute("type"),
    visible: Boolean(control.offsetWidth || control.offsetHeight || control.getClientRects().length),
  }))
  .filter((control) => control.visible)
  .slice(0, 500)
  .map(({ visible, ...control }) => control);
const tabLabels = Array.from(document.querySelectorAll('[role="tab"], kat-tab, a, button'))
  .map(textOf)
  .filter((value) => value.length > 0)
  .slice(0, 120);
const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, [role='heading']"))
  .map((node) => bounded(textOf(node), 160))
  .filter((value) => value.length > 0)
  .slice(0, 30);
const imageUrls = Array.from(document.querySelectorAll("img"))
  .map((image) => image.currentSrc || image.src || "")
  .filter((value) => value.startsWith("http"))
  .slice(0, 200);
const saveActionLabels = Array.from(document.querySelectorAll("button, kat-button, [role='button']"))
  .map((node) => bounded([node.getAttribute("label"), node.getAttribute("aria-label"), textOf(node)].filter(Boolean).join(" "), 120))
  .filter((value) => /保存|Save|提交|Submit|发布|Publish/u.test(value))
  .slice(0, 20);
const visibleText = textOf(document.body);
const contentReady = visibleText.includes("ASIN:") || visibleText.includes("ASIN：") || controls.length > 3 || headings.length > 0;
const footerOnly = !contentReady && controls.length <= 1 && tabLabels.some((value) => value.includes("新版卖家平台") || value.includes("Amazon Seller"));
const status = contentReady ? "read" : footerOnly ? "not_available" : "blocked";
return {
  tab: ${JSON.stringify(tab)},
  status,
  reason: status === "read" ? null : footerOnly ? "edit_tab_footer_only_no_business_dom" : "edit_tab_dom_not_ready",
  pageUrlPath: urlPath(),
  pageTitle: document.title || null,
  headings,
  visibleText: status === "read" || status === "not_available" ? bounded(visibleText, 20000) : null,
  tabLabels,
  controls,
  imageUrls,
  saveActionLabels,
  evidenceRef: status === "read" || status === "not_available" ? "edit-tab:${tab}" : null,
};
`);

export const buildBlockedTabRead = (
  tab: AmazonListingEditReadSyncTab,
  reason: string,
): AmazonListingEditReadSyncTabRead => ({
  tab,
  status: "blocked",
  reason,
  pageUrlPath: null,
  pageTitle: null,
  headings: [],
  visibleText: null,
  tabLabels: [],
  controls: [],
  imageUrls: [],
  saveActionLabels: [],
  evidenceRef: null,
});
