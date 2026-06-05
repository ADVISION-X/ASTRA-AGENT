const SUBMIT_SKU_TOKEN = "__AMAZON_PRODUCT_FEE_SYNC_SUBMIT_SKU__";
const REQUESTED_SKU_TOKEN = "__AMAZON_PRODUCT_FEE_SYNC_REQUESTED_SKU__";
const SHADOW_TEXT_INPUT_SELECTOR = "input[type='text'], input";
const TOTAL_FEE_LABEL_ZH = "总费用";
const FBA_FEE_LABEL_ZH = "亚马逊物流费用";
const REFERRAL_FEE_STATUS_NOT_VISIBLE = "not_visible_in_current_dom";
const RESIDUAL_STATUS_DERIVED = "derived_total_minus_fba_not_referral";

const normalizeSku = (value: string): string => value.trim().toUpperCase();

export type ParsedAmazonFeeMoney = {
  readonly amount: string | null;
  readonly currency: string | null;
  readonly status: "visible" | "not_visible" | "parse_failed";
};

export type AmazonFeeResidualDerivation = {
  readonly amount: string | null;
  readonly currency: string | null;
  readonly status: "derived_total_minus_fba_not_referral" | "not_derived_missing_inputs" | "currency_mismatch";
};

export const parseAmazonFeeMoney = (rawText: string | null): ParsedAmazonFeeMoney => {
  const cleaned = (rawText ?? "").replace(/\u00a0/g, " ").trim();
  if (!cleaned || cleaned === "--") {
    return { amount: null, currency: null, status: "not_visible" };
  }
  const match = cleaned.match(/^([A-Z]{3})\s*([+-]?\d[\d,]*(?:\.\d+)?)$/);
  if (!match) {
    return { amount: null, currency: null, status: "parse_failed" };
  }
  const [, currency, amount] = match;
  if (!currency || !amount) {
    return { amount: null, currency: null, status: "parse_failed" };
  }
  return {
    amount: Number(amount.replace(/,/g, "")).toFixed(2),
    currency,
    status: "visible",
  };
};

export const deriveAmazonFeeResidual = (
  total: ParsedAmazonFeeMoney,
  fba: ParsedAmazonFeeMoney,
): AmazonFeeResidualDerivation => {
  if (total.status !== "visible" || fba.status !== "visible" || !total.amount || !fba.amount) {
    return { amount: null, currency: total.currency ?? fba.currency, status: "not_derived_missing_inputs" };
  }
  if (total.currency !== fba.currency) {
    return { amount: null, currency: null, status: "currency_mismatch" };
  }
  return {
    amount: (Number(total.amount) - Number(fba.amount)).toFixed(2),
    currency: total.currency,
    status: RESIDUAL_STATUS_DERIVED,
  };
};

export function buildInventoryFeeSearchProbeScript(): string {
  return `
return (() => {
  const inventorySearchPlaceholder = "搜索 SKU、商品名称/关键词、FNSKU、ASIN、UPC/EAN";
  const text = String((document.body && document.body.innerText) || "");
  const lower = text.toLowerCase();
  const visible = (el) => {
    if (!el || !el.getBoundingClientRect) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  };
  const center = (el) => {
    const rect = el.getBoundingClientRect();
    return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
  };
  const detect = () => {
    if (lower.includes("captcha") || lower.includes("robot check") || lower.includes("two-step") || lower.includes("two factor") || lower.includes("otp") || lower.includes("verification code") || text.includes("验证码") || text.includes("验证")) return "captcha_or_2fa_required";
    if ((lower.includes("sign in") || lower.includes("login") || lower.includes("password") || text.includes("登录") || text.includes("登陆")) && !lower.includes("manage your inventory") && !text.includes("库存")) return "login_required";
    if (!lower.includes("inventory") && !text.includes("库存") && !text.includes("SKU")) return "review_required";
    return "ready";
  };
  const walkOpenDom = (root, visit) => {
    const stack = [root];
    while (stack.length > 0) {
      const node = stack.pop();
      if (!node) continue;
      visit(node);
      if (node.shadowRoot) stack.push(node.shadowRoot);
      if (node.children) {
        const children = Array.from(node.children);
        for (let index = children.length - 1; index >= 0; index -= 1) stack.push(children[index]);
      }
    }
  };
  const topForm = document.querySelector("form#sc-global-search-form");
  const topInput = document.querySelector("input#sc-search-field");
  const topButton = document.querySelector("button.sc-search-button");
  let searchHost = null;
  let shadowInputFound = false;
  walkOpenDom(document, (node) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node;
    if (el.tagName.toLowerCase() === "kat-input" && el.getAttribute("placeholder") === inventorySearchPlaceholder) {
      searchHost = el;
      shadowInputFound = Boolean(el.shadowRoot && el.shadowRoot.querySelector("input[type='text']"));
    }
  });
  const group = searchHost ? searchHost.closest("kat-input-group") : null;
  const button = group ? group.querySelector('[class*="SearchBox-module__searchButton"]') : null;
  const hostInsideTopSearch = Boolean(searchHost && topForm && topForm.contains(searchHost));
  return {
    url: location.href,
    title: document.title || "",
    detectedState: detect(),
    topGlobalSearchPresent: Boolean(topForm || topInput || topButton),
    topGlobalSearchExcluded: Boolean(searchHost && !hostInsideTopSearch && searchHost !== topInput),
    inventorySearchUsesShadowInput: shadowInputFound,
    inventorySearchInputPoint: searchHost && visible(searchHost) ? center(searchHost) : null,
    inventorySearchButtonPoint: button && visible(button) ? center(button) : null,
    reason: searchHost ? null : "inventory_filter_katal_search_missing",
  };
})()
`;
}

const INVENTORY_FEE_SEARCH_SUBMIT_SCRIPT_TEMPLATE = `
return (() => {
  const sellerSku = ${SUBMIT_SKU_TOKEN};
  const inventorySearchPlaceholder = "搜索 SKU、商品名称/关键词、FNSKU、ASIN、UPC/EAN";
  const text = String((document.body && document.body.innerText) || "");
  const lower = text.toLowerCase();
  const visible = (el) => {
    if (!el || !el.getBoundingClientRect) return false;
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
  const topForm = document.querySelector("form#sc-global-search-form");
  const searchHost = Array.from(document.querySelectorAll("kat-input")).find((el) => el.getAttribute("placeholder") === inventorySearchPlaceholder);
  const shadowInput = searchHost && searchHost.shadowRoot ? searchHost.shadowRoot.querySelector(${JSON.stringify(SHADOW_TEXT_INPUT_SELECTOR)}) : null;
  const group = searchHost ? searchHost.closest("kat-input-group") : null;
  const button = group ? group.querySelector('[class*="SearchBox-module__searchButton"], button, kat-button') : null;
  const topGlobalSearchExcluded = Boolean(searchHost && !(topForm && topForm.contains(searchHost)));
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
  const event = (name) => new Event(name, { bubbles: true, composed: true });
  const inputEvent = () => typeof InputEvent === "function"
    ? new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: sellerSku })
    : event("input");
  if (!searchHost || !shadowInput || !button || !topGlobalSearchExcluded || !visible(searchHost) || !visible(button)) {
    return {
      url: location.href,
      title: document.title || "",
      detectedState: detect(),
      ok: false,
      submittedValue: null,
      inputValue: shadowInput ? shadowInput.value : null,
      hostValue: searchHost ? searchHost.value : null,
      clickedButton: false,
      topGlobalSearchExcluded,
      reason: "inventory_filter_shadow_input_not_ready",
    };
  }
  searchHost.click();
  shadowInput.focus();
  const shadowValueReady = setInputValue(shadowInput, sellerSku);
  const hostValueGetterDefined = defineOwnValueGetter(searchHost, sellerSku);
  searchHost.setAttribute("value", sellerSku);
  shadowInput.setAttribute("value", sellerSku);
  const shadowInputEventDispatched = shadowInput.dispatchEvent(inputEvent());
  const hostInputEventDispatched = searchHost.dispatchEvent(inputEvent());
  const shadowChangeEventDispatched = shadowInput.dispatchEvent(event("change"));
  const hostChangeEventDispatched = searchHost.dispatchEvent(event("change"));
  const hostValue = searchHost.value;
  const inputValue = shadowInput.value;
  const ok = hostValueGetterDefined && shadowValueReady && hostValue === sellerSku && inputValue === sellerSku
    && shadowInputEventDispatched && hostInputEventDispatched && shadowChangeEventDispatched && hostChangeEventDispatched;
  const rect = button.getBoundingClientRect();
  return {
    url: location.href,
    title: document.title || "",
    detectedState: detect(),
    ok,
    submittedValue: sellerSku,
    inputValue,
    hostValue,
    hostValueGetterDefined,
    shadowValueReady,
    shadowInputEventDispatched,
    hostInputEventDispatched,
    shadowChangeEventDispatched,
    hostChangeEventDispatched,
    searchClickDelayMs: 1000 + Math.floor(Math.random() * 1001),
    inventorySearchButtonPoint: { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) },
    clickedButton: false,
    topGlobalSearchExcluded,
    reason: ok ? null : "inventory_filter_katal_host_value_or_event_not_ready",
  };
})()
`;

export function buildInventoryFeeSearchSubmitScript(sellerSku: string): string {
  return INVENTORY_FEE_SEARCH_SUBMIT_SCRIPT_TEMPLATE.replace(SUBMIT_SKU_TOKEN, JSON.stringify(sellerSku.trim()));
}

const INVENTORY_FEE_SEARCH_BUTTON_CLICK_SCRIPT_TEMPLATE = `
return (() => {
  const sellerSku = ${SUBMIT_SKU_TOKEN};
  const inventorySearchPlaceholder = "搜索 SKU、商品名称/关键词、FNSKU、ASIN、UPC/EAN";
  const topForm = document.querySelector("form#sc-global-search-form");
  const searchHost = Array.from(document.querySelectorAll("kat-input")).find((el) => el.getAttribute("placeholder") === inventorySearchPlaceholder);
  const shadowInput = searchHost && searchHost.shadowRoot ? searchHost.shadowRoot.querySelector(${JSON.stringify(SHADOW_TEXT_INPUT_SELECTOR)}) : null;
  const group = searchHost ? searchHost.closest("kat-input-group") : null;
  const button = group ? group.querySelector('[class*="SearchBox-module__searchButton"]') : null;
  const topGlobalSearchExcluded = Boolean(searchHost && !(topForm && topForm.contains(searchHost)));
  if (!searchHost || !shadowInput || !button || !topGlobalSearchExcluded) {
    return { ok: false, clickedButton: false, topGlobalSearchExcluded, reason: "inventory_filter_search_button_dom_not_ready" };
  }
  const createMouseEvent = (name) => new MouseEvent(name, { bubbles: true, cancelable: true, view: window });
  const pointerDownDispatched = button.dispatchEvent(createMouseEvent("pointerdown"));
  const mouseDownDispatched = button.dispatchEvent(createMouseEvent("mousedown"));
  const pointerUpDispatched = button.dispatchEvent(createMouseEvent("pointerup"));
  const mouseUpDispatched = button.dispatchEvent(createMouseEvent("mouseup"));
  const clickEventDispatched = button.dispatchEvent(createMouseEvent("click"));
  const clickedButton = pointerDownDispatched && mouseDownDispatched && pointerUpDispatched && mouseUpDispatched && clickEventDispatched;
  return {
    url: location.href,
    title: document.title || "",
    ok: searchHost.value === sellerSku && shadowInput.value === sellerSku && clickedButton,
    clickedButton,
    hostValue: searchHost.value,
    inputValue: shadowInput.value,
    pointerDownDispatched,
    mouseDownDispatched,
    pointerUpDispatched,
    mouseUpDispatched,
    clickEventDispatched,
    topGlobalSearchExcluded,
    reason: clickedButton ? null : "inventory_filter_search_button_dom_click_failed",
  };
})()
`;

export function buildInventoryFeeSearchButtonClickScript(sellerSku: string): string {
  return INVENTORY_FEE_SEARCH_BUTTON_CLICK_SCRIPT_TEMPLATE.replace(SUBMIT_SKU_TOKEN, JSON.stringify(sellerSku.trim()));
}

const INVENTORY_FEE_EXTRACTION_SCRIPT_TEMPLATE = `
return (() => {
  const requestedSku = ${REQUESTED_SKU_TOKEN};
  const totalFeeLabel = ${JSON.stringify(TOTAL_FEE_LABEL_ZH)};
  const fbaFeeLabel = ${JSON.stringify(FBA_FEE_LABEL_ZH)};
  const referralFeeStatus = ${JSON.stringify(REFERRAL_FEE_STATUS_NOT_VISIBLE)};
  const residualStatus = ${JSON.stringify(RESIDUAL_STATUS_DERIVED)};
  const text = String((document.body && document.body.innerText) || "");
  const lower = text.toLowerCase();
  const clean = (value) => String(value || "").replaceAll("\\u00a0", " ").trim();
  const normalize = (value) => clean(value).toUpperCase();
  const visible = (el) => {
    if (!el || !el.getBoundingClientRect) return false;
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
  const parseMoney = (raw) => {
    const cleaned = clean(raw);
    if (!cleaned || cleaned === "--") return { amount: null, currency: null, status: "not_visible" };
    const match = cleaned.match(/^([A-Z]{3})\\s*([+-]?\\d[\\d,]*(?:\\.\\d+)?)$/);
    if (!match) return { amount: null, currency: null, status: "parse_failed" };
    return { amount: Number(match[2].replaceAll(",", "")).toFixed(2), currency: match[1], status: "visible" };
  };
  const deriveResidual = (total, fba) => {
    if (total.status !== "visible" || fba.status !== "visible" || !total.amount || !fba.amount) {
      return { amount: null, currency: total.currency || fba.currency, status: "not_derived_missing_inputs" };
    }
    if (total.currency !== fba.currency) return { amount: null, currency: null, status: "currency_mismatch" };
    return { amount: (Number(total.amount) - Number(fba.amount)).toFixed(2), currency: total.currency, status: residualStatus };
  };
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
  const rowCandidates = Array.from(document.querySelectorAll('[class*="JanusTable-module__tableContentRow"], tr, [role="row"]')).filter(visible);
  const rows = rowCandidates.map((row) => {
    const productDetails = row.querySelector('[class*="ProductDetails-module__container"]');
    if (!productDetails) return null;
    const pairs = readPairs(row);
    const sellerSku = readPair(pairs, "SKU");
    if (!sellerSku || normalize(sellerSku) !== requestedSku) return null;
    const totalRaw = readPair(pairs, totalFeeLabel);
    const fbaRaw = readPair(pairs, fbaFeeLabel);
    const totalAmazonFee = { ...parseMoney(totalRaw), sourceLabel: totalFeeLabel, rawText: totalRaw };
    const fbaFulfillmentFee = { ...parseMoney(fbaRaw), sourceLabel: fbaFeeLabel, rawText: fbaRaw };
    return {
      sellerSku,
      totalAmazonFee,
      fbaFulfillmentFee,
      amazonNonFulfillmentFeeResidual: deriveResidual(totalAmazonFee, fbaFulfillmentFee),
      referralFee: { amount: null, currency: totalAmazonFee.currency || fbaFulfillmentFee.currency, status: referralFeeStatus },
    };
  }).filter(Boolean);
  return {
    url: location.href,
    title: document.title || "",
    detectedState: detect(),
    searchVerified: rows.length > 0,
    searchVerificationEvidence: rows.length > 0 ? ["exact_sku_row_visible"] : [],
    rows,
  };
})()
`;

export function buildInventoryFeeExtractionScript(sellerSku: string): string {
  return INVENTORY_FEE_EXTRACTION_SCRIPT_TEMPLATE.replace(REQUESTED_SKU_TOKEN, JSON.stringify(normalizeSku(sellerSku)));
}
