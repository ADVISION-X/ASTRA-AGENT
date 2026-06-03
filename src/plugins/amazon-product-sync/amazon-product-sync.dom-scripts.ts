const INVENTORY_SEARCH_TERM_PARAM = "searchTerm";
const AVAILABLE_FBA_UNITS_LABEL_ZH = "现货（亚马逊物流）";
const REQUESTED_SKU_TOKEN = "__AMAZON_PRODUCT_SYNC_REQUESTED_SKU__";
const SEARCH_TERM_PARAM_TOKEN = "__AMAZON_PRODUCT_SYNC_SEARCH_TERM_PARAM__";
const AVAILABLE_FBA_LABEL_TOKEN = "__AMAZON_PRODUCT_SYNC_AVAILABLE_FBA_LABEL__";

const normalizeSku = (value: string): string => value.trim().toUpperCase();

export function buildInventorySearchProbeScript(): string {
  return `
return (() => {
  const topGlobalSearchFormSelector = "form#sc-global-search-form";
  const topGlobalSearchInputSelector = "input#sc-search-field";
  const topGlobalSearchButtonSelector = "button.sc-search-button";
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
  const topForm = document.querySelector(topGlobalSearchFormSelector);
  const topInput = document.querySelector(topGlobalSearchInputSelector);
  const topButton = document.querySelector(topGlobalSearchButtonSelector);
  let searchHost = null;
  let shadowInputFound = false;
  walkOpenDom(document, (node) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node;
    const placeholder = el.getAttribute("placeholder");
    if (placeholder === inventorySearchPlaceholder && el.tagName.toLowerCase() === "kat-input") {
      searchHost = el;
      shadowInputFound = Boolean(el.shadowRoot && el.shadowRoot.querySelector("input[type='text']"));
    }
  });
  const hostInsideTopSearch = Boolean(searchHost && topForm && topForm.contains(searchHost));
  const group = searchHost ? searchHost.closest("kat-input-group") : null;
  const button = group ? group.querySelector('[class*="SearchBox-module__searchButton"], button, kat-button') : null;
  return {
    url: location.href,
    title: document.title || "",
    detectedState: detect(),
    topGlobalSearchPresent: Boolean(topForm || topInput || topButton),
    topGlobalSearchExcluded: Boolean(searchHost && !hostInsideTopSearch && searchHost !== topInput),
    inventorySearchPlaceholder: searchHost ? searchHost.getAttribute("placeholder") : null,
    inventorySearchUsesShadowInput: shadowInputFound,
    inventorySearchInputPoint: searchHost && visible(searchHost) ? center(searchHost) : null,
    inventorySearchButtonPoint: button && visible(button) ? center(button) : null,
    reason: searchHost ? null : "inventory_filter_katal_search_missing",
  };
})()
`;
}

export function buildVariationExpansionProbeScript(): string {
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

const INVENTORY_EXTRACTION_SCRIPT_TEMPLATE = `
return (() => {
  const requestedSku = ${REQUESTED_SKU_TOKEN};
  const text = String((document.body && document.body.innerText) || "");
  const lower = text.toLowerCase();
  const url = location.href;
  const title = document.title || "";
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
  const clean = (value) => String(value || "").replaceAll("\\u00a0", " ").trim();
  const normalize = (value) => clean(value).toUpperCase();
  const parseInteger = (value) => {
    const cleaned = clean(value).replaceAll(",", "");
    if (cleaned === "" || cleaned === "--") return null;
    const parsed = Number(cleaned);
    return Number.isInteger(parsed) ? parsed : null;
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
  const readStatus = (row) => {
    const statusText = clean(row.querySelector('[class*="Status-module__container"]')?.textContent || "");
    const statusLower = statusText.toLowerCase();
    if (statusText.includes("缺货") || statusLower.includes("out of stock")) return "out_of_stock";
    if (statusText.includes("在售") || statusLower.includes("active")) return "active";
    if (statusText.includes("缺少的信息") || statusLower.includes("missing")) return "missing_information";
    if (statusText.includes("停用") || statusLower.includes("inactive")) return "inactive";
    return statusText ? statusText.slice(0, 80) : null;
  };
  const rowCandidates = Array.from(document.querySelectorAll('[class*="JanusTable-module__tableContentRow"], tr, [role="row"]')).filter(visible);
  const rows = rowCandidates.map((row) => {
    const productDetails = row.querySelector('[class*="ProductDetails-module__container"]');
    if (!productDetails) return null;
    const pairs = readPairs(row);
    const sellerSku = readPair(pairs, "SKU");
    if (!sellerSku || normalize(sellerSku) !== requestedSku) return null;
    const asin = readPair(pairs, "ASIN");
    const titleNode = productDetails.querySelector('[class*="ProductDetails-module__titleContainer"] a')
      || productDetails.querySelector('[class*="ProductDetails-module__titleContainer"]');
    const image = productDetails.querySelector('img[alt="商品图片"], img[src]');
    return {
      sellerSku,
      asinSnapshot: asin ? normalize(asin) : null,
      sellerCentralTitleSnapshot: clean(titleNode ? (titleNode.innerText || titleNode.textContent) : "").slice(0, 240) || null,
      imagePresent: Boolean(image && image.getAttribute("src")),
      listingStatus: readStatus(row),
      availableFbaUnits: parseInteger(readPair(pairs, ${AVAILABLE_FBA_LABEL_TOKEN})),
      inboundUnits: parseInteger(readPair(pairs, "入库")),
      unfulfillableUnits: parseInteger(readPair(pairs, "不可售")),
      reservedUnits: parseInteger(readPair(pairs, "预留")),
      sales30dSnapshot: parseInteger(readPair(pairs, "售出件数")),
    };
  }).filter(Boolean);
  const params = new URL(location.href).searchParams;
  const urlSearchTerm = normalize(params.get(${SEARCH_TERM_PARAM_TOKEN}) || "");
  const countTextFound = /\\d+\\s*-\\s*\\d+\\s*共\\s*\\d+/.test(text) || /\\d+\\s*-\\s*\\d+\\s*of\\s*\\d+/i.test(text);
  const evidence = [];
  if (urlSearchTerm === requestedSku) evidence.push("url_searchTerm_exact");
  if (countTextFound) evidence.push("inventory_result_count_visible");
  if (rows.length > 0) evidence.push("exact_sku_row_visible");
  return { url, title, detectedState: detect(), searchVerified: evidence.length > 0, searchVerificationEvidence: evidence, rows };
})()
`;
export function buildInventoryExtractionScript(sellerSku: string): string {
  return INVENTORY_EXTRACTION_SCRIPT_TEMPLATE
    .replace(REQUESTED_SKU_TOKEN, JSON.stringify(normalizeSku(sellerSku)))
    .replace(SEARCH_TERM_PARAM_TOKEN, JSON.stringify(INVENTORY_SEARCH_TERM_PARAM))
    .replace(AVAILABLE_FBA_LABEL_TOKEN, JSON.stringify(AVAILABLE_FBA_UNITS_LABEL_ZH));
}
