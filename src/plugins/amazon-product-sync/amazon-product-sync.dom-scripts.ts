const AVAILABLE_FBA_UNITS_LABEL_ZH = "现货（亚马逊物流）";
const REQUESTED_SKU_TOKEN = "__AMAZON_PRODUCT_SYNC_REQUESTED_SKU__";
const AVAILABLE_FBA_LABEL_TOKEN = "__AMAZON_PRODUCT_SYNC_AVAILABLE_FBA_LABEL__";
const SUBMIT_SKU_TOKEN = "__AMAZON_PRODUCT_SYNC_SUBMIT_SKU__";
const SHADOW_TEXT_INPUT_SELECTOR = "input[type='text'], input";
const COMPOSED_INPUT_CHANGE_DISPATCH = "dispatchEvent";
const INVENTORY_SEARCH_BUTTON_MOUSE_EVENT = "SearchBox-module__searchButton MouseEvent click";
const INVENTORY_SEARCH_BUTTON_DOM_CLICK_ACTION = "SearchBox-module__searchButton DOM MouseEvent submit click";
const INVENTORY_SEARCH_DELAY_TIMER_API = "setTimeout";
const INVENTORY_SEARCH_KATAL_HOST_VALUE_GETTER = "kat-input host own value getter for React onInput target";

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
  const findInventorySearchHost = () => {
    const direct = Array.from(document.querySelectorAll("kat-input"))
      .find((el) => el.getAttribute("placeholder") === inventorySearchPlaceholder);
    if (direct) return direct;
    const startedAt = Date.now();
    const stack = [document];
    let visited = 0;
    while (stack.length > 0 && visited < 1800 && Date.now() - startedAt < 120) {
      const node = stack.pop();
      visited += 1;
      if (!node) continue;
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node;
        if (el.tagName.toLowerCase() === "kat-input" && el.getAttribute("placeholder") === inventorySearchPlaceholder) return el;
      }
      if (node.shadowRoot) stack.push(node.shadowRoot);
      if (node.children) {
        const children = Array.from(node.children);
        for (let index = Math.min(children.length, 80) - 1; index >= 0; index -= 1) stack.push(children[index]);
      }
    }
    return null;
  };
  const topForm = document.querySelector(topGlobalSearchFormSelector);
  const topInput = document.querySelector(topGlobalSearchInputSelector);
  const topButton = document.querySelector(topGlobalSearchButtonSelector);
  const searchHost = findInventorySearchHost();
  const shadowInputFound = Boolean(searchHost && searchHost.shadowRoot && searchHost.shadowRoot.querySelector("input[type='text']"));
  const hostInsideTopSearch = Boolean(searchHost && topForm && topForm.contains(searchHost));
  const group = searchHost ? searchHost.closest("kat-input-group") : null;
  const button = group ? group.querySelector('[class*="SearchBox-module__searchButton"]') : null;
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

const INVENTORY_SEARCH_SUBMIT_SCRIPT_TEMPLATE = `
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
  const shadowTextInputSelector = ${JSON.stringify(SHADOW_TEXT_INPUT_SELECTOR)};
  const dispatchEventMethod = ${JSON.stringify(COMPOSED_INPUT_CHANGE_DISPATCH)};
  const submitAction = ${JSON.stringify(INVENTORY_SEARCH_BUTTON_MOUSE_EVENT)};
  const hostValueAction = ${JSON.stringify(INVENTORY_SEARCH_KATAL_HOST_VALUE_GETTER)};
  const findMethod = (obj, name) => {
    for (let proto = obj; proto; proto = Object.getPrototypeOf(proto)) {
      const value = proto[name];
      if (typeof value === "function") return value;
    }
    return null;
  };
  const call = (obj, name, ...args) => {
    const fn = obj ? findMethod(obj, name) : null;
    return fn ? fn.call(obj, ...args) : null;
  };
  const querySelector = (root, selector) => call(root, "querySelector", selector);
  const getAttribute = (el, name) => call(el, "getAttribute", name);
  const setAttribute = (el, name, value) => call(el, "setAttribute", name, value);
  const dispatch = (target, event) => event ? call(target, dispatchEventMethod, event) : false;
  const defineOwnValueGetter = (target, value) => {
    try {
      Object.defineProperty(target, "value", {
        configurable: true,
        get: () => value,
      });
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
    if (document && typeof document.createEvent === "function") {
      const event = document.createEvent("Event");
      event.initEvent(name, true, true);
      return event;
    }
    return null;
  };
  const createInputEvent = (value) => {
    if (typeof InputEvent === "function") return new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: value });
    return createDomEvent("input");
  };
  const defineHostValueGetter = (host, value) => {
    return defineOwnValueGetter(host, value);
  };
  const searchHost = Array.from(document.querySelectorAll("kat-input"))
    .find((el) => getAttribute(el, "placeholder") === inventorySearchPlaceholder);
  const shadowInput = searchHost && searchHost.shadowRoot
    ? querySelector(searchHost.shadowRoot, shadowTextInputSelector)
    : null;
  const group = searchHost ? call(searchHost, "closest", "kat-input-group") : null;
  const button = group ? querySelector(group, '[class*="SearchBox-module__searchButton"], button, kat-button') : null;
  const topGlobalSearchExcluded = Boolean(searchHost && !(topForm && topForm.contains(searchHost)));
  if (!searchHost || !shadowInput || !button || !topGlobalSearchExcluded || !visible(searchHost) || !visible(button)) {
    return {
      url: location.href,
      title: document.title || "",
      detectedState: detect(),
      ok: false,
      submittedValue: null,
      inputValue: shadowInput ? shadowInput.value : null,
      clickedButton: false,
      topGlobalSearchExcluded,
      reason: "inventory_filter_shadow_input_not_ready",
    };
  }
  call(searchHost, "click");
  call(shadowInput, "focus");
  const shadowValueReady = setInputValue(shadowInput, sellerSku);
  const hostValueGetterDefined = defineHostValueGetter(searchHost, sellerSku);
  setAttribute(searchHost, "value", sellerSku);
  setAttribute(shadowInput, "value", sellerSku);
  const shadowInputEventDispatched = dispatch(shadowInput, createInputEvent(sellerSku));
  const hostInputEventDispatched = dispatch(searchHost, createInputEvent(sellerSku));
  const shadowChangeEventDispatched = dispatch(shadowInput, createDomEvent("change"));
  const hostChangeEventDispatched = dispatch(searchHost, createDomEvent("change"));
  const searchEventsReady = Boolean(shadowInputEventDispatched && hostInputEventDispatched && shadowChangeEventDispatched && hostChangeEventDispatched);
  const searchClickDelayMs = 1000 + Math.floor(Math.random() * 1001);
  const searchDelayTimerApi = ${JSON.stringify(INVENTORY_SEARCH_DELAY_TIMER_API)};
  const rect = button.getBoundingClientRect();
  const hostValue = searchHost.value;
  const inputValue = shadowInput.value;
  const valueReady = hostValueGetterDefined && hostValue === sellerSku && inputValue === sellerSku;
  const submitReady = valueReady && searchEventsReady;
  return {
    url: location.href,
    title: document.title || "",
    detectedState: detect(),
    ok: submitReady,
    submittedValue: sellerSku,
    inputValue,
    hostValue,
    hostValueGetterDefined,
    shadowValueReady,
    searchEventsReady,
    shadowInputEventDispatched,
    hostInputEventDispatched,
    shadowChangeEventDispatched,
    hostChangeEventDispatched,
    hostAttributeValue: getAttribute(searchHost, "value"),
    clickedButton: false,
    searchClickDelayMs,
    searchDelayTimerApi,
    inventorySearchButtonPoint: { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) },
    submitAction,
    hostValueAction,
    topGlobalSearchExcluded,
    reason: submitReady ? null : "inventory_filter_katal_host_value_or_event_not_ready",
  };
})()
`;

export function buildInventorySearchSubmitScript(sellerSku: string): string {
  return INVENTORY_SEARCH_SUBMIT_SCRIPT_TEMPLATE.replace(SUBMIT_SKU_TOKEN, JSON.stringify(sellerSku.trim()));
}

const INVENTORY_SEARCH_BUTTON_CLICK_SCRIPT_TEMPLATE = `
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
  const searchHost = Array.from(document.querySelectorAll("kat-input"))
    .find((el) => el.getAttribute("placeholder") === inventorySearchPlaceholder);
  const shadowInput = searchHost && searchHost.shadowRoot
    ? searchHost.shadowRoot.querySelector(${JSON.stringify(SHADOW_TEXT_INPUT_SELECTOR)})
    : null;
  const group = searchHost ? searchHost.closest("kat-input-group") : null;
  const button = group ? group.querySelector('[class*="SearchBox-module__searchButton"]') : null;
  const topGlobalSearchExcluded = Boolean(searchHost && !(topForm && topForm.contains(searchHost)));
  const submitAction = ${JSON.stringify(INVENTORY_SEARCH_BUTTON_DOM_CLICK_ACTION)};
  if (!searchHost || !shadowInput || !button || !topGlobalSearchExcluded || !visible(button)) {
    return {
      url: location.href,
      title: document.title || "",
      detectedState: detect(),
      ok: false,
      clickedButton: false,
      topGlobalSearchExcluded,
      submitAction,
      reason: "inventory_filter_search_button_dom_not_ready",
    };
  }
  const hostValue = searchHost.value;
  const inputValue = shadowInput.value;
  const valueReady = hostValue === sellerSku && inputValue === sellerSku;
  const createMouseEvent = (name) => {
    if (typeof MouseEvent === "function") return new MouseEvent(name, { bubbles: true, cancelable: true, view: window });
    if (document && typeof document.createEvent === "function") {
      const event = document.createEvent("MouseEvents");
      event.initMouseEvent(name, true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
      return event;
    }
    return null;
  };
  const dispatchMouse = (name) => {
    const event = createMouseEvent(name);
    return event ? button.dispatchEvent(event) : false;
  };
  const pointerDownDispatched = dispatchMouse("pointerdown");
  const mouseDownDispatched = dispatchMouse("mousedown");
  const pointerUpDispatched = dispatchMouse("pointerup");
  const mouseUpDispatched = dispatchMouse("mouseup");
  const clickEventDispatched = dispatchMouse("click");
  const clickedButton = Boolean(pointerDownDispatched && mouseDownDispatched && pointerUpDispatched && mouseUpDispatched && clickEventDispatched);
  return {
    url: location.href,
    title: document.title || "",
    detectedState: detect(),
    ok: valueReady && clickedButton,
    clickedButton,
    hostValue,
    inputValue,
    pointerDownDispatched,
    mouseDownDispatched,
    pointerUpDispatched,
    mouseUpDispatched,
    clickEventDispatched,
    topGlobalSearchExcluded,
    submitAction,
    reason: valueReady && clickedButton ? null : "inventory_filter_search_button_dom_click_failed",
  };
})()
`;

export function buildInventorySearchButtonClickScript(sellerSku: string): string {
  return INVENTORY_SEARCH_BUTTON_CLICK_SCRIPT_TEMPLATE.replace(SUBMIT_SKU_TOKEN, JSON.stringify(sellerSku.trim()));
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
  const inventorySearchPlaceholder = "搜索 SKU、商品名称/关键词、FNSKU、ASIN、UPC/EAN";
  const inventorySearchHost = Array.from(document.querySelectorAll("kat-input"))
    .find((el) => el.getAttribute("placeholder") === inventorySearchPlaceholder);
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
    const imageSrc = image && image.getAttribute("src") ? new URL(image.getAttribute("src"), location.href).href : null;
    const availableFbaUnits = parseInteger(readPair(pairs, ${AVAILABLE_FBA_LABEL_TOKEN}));
    const unfulfillableUnits = parseInteger(readPair(pairs, "不可售"));
    const reservedUnits = parseInteger(readPair(pairs, "预留"));
    const actualInventoryUnits = availableFbaUnits === null || unfulfillableUnits === null || reservedUnits === null
      ? null
      : availableFbaUnits + unfulfillableUnits + reservedUnits;
    return {
      sellerSku,
      asinSnapshot: asin ? normalize(asin) : null,
      sellerCentralTitleSnapshot: clean(titleNode ? (titleNode.innerText || titleNode.textContent) : "").slice(0, 240) || null,
      imagePresent: Boolean(image && image.getAttribute("src")),
      imageSrc,
      listingStatus: readStatus(row),
      availableFbaUnits,
      actualInventoryUnits,
      inboundUnits: parseInteger(readPair(pairs, "入库")),
      unfulfillableUnits,
      reservedUnits,
      sales30dSnapshot: parseInteger(readPair(pairs, "售出件数")),
    };
  }).filter(Boolean);
  const evidence = [];
  if (rows.length > 0) evidence.push("exact_sku_row_visible");
  return { url, title, detectedState: detect(), searchVerified: evidence.length > 0, searchVerificationEvidence: evidence, rows };
})()
`;
export function buildInventoryExtractionScript(sellerSku: string): string {
  return INVENTORY_EXTRACTION_SCRIPT_TEMPLATE
    .replace(REQUESTED_SKU_TOKEN, JSON.stringify(normalizeSku(sellerSku)))
    .replace(AVAILABLE_FBA_LABEL_TOKEN, JSON.stringify(AVAILABLE_FBA_UNITS_LABEL_ZH));
}
