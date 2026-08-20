import type { BrowserTargetLease } from "../../lib/browser/browser-authority-api.js";
import type { DomElementRef, DomSnapshot } from "../../types/dom-automation.js";
import { locateElement } from "./amazon-invoice-upload-flow-support.js";

export const TAX_REPORT_URL_PATH =
  "/reportcentral/AFNShipmentInvoicingReport/1";
export const FULFILLMENT_REPORTS_URL_PATH =
  "/reportcentral/ref=xx_fbareports_dnav_xx";
export const SELLER_CENTRAL_GLOBAL_MENU_SELECTOR =
  'navigation-hamburger-menu[data-test-tag="hamburger-menu"]';
export const SELLER_CENTRAL_REPORTS_MENU_SELECTOR = `${SELLER_CENTRAL_GLOBAL_MENU_SELECTOR} >>> [data-test-tag="menu__section-reports"]`;
export const SELLER_CENTRAL_FULFILLMENT_REPORTS_SELECTOR = `${SELLER_CENTRAL_GLOBAL_MENU_SELECTOR} >>> a[data-test-tag="menu__button-ssof-inventory-manager-new"][href="${FULFILLMENT_REPORTS_URL_PATH}"]`;
export const TAX_DOWNLOAD_SNAPSHOT_TEXT_LIMIT = 160;

type LocateResult =
  { ok: true; element: DomElementRef } | { ok: false; reason: string };

export const locate = (
  snapshot: DomSnapshot,
  targetKind: DomElementRef["targetKind"],
  hints: string[],
): LocateResult => {
  const element = locateElement({ snapshot, targetKind, hints });
  if (element.elementRef.startsWith("dom:unresolved:")) {
    return { ok: false, reason: element.reason };
  }
  return { ok: true, element };
};

const compactElementText = (
  input:
    | {
        visibleText?: string | undefined;
        ariaLabel?: string | undefined;
        labelText?: string | undefined;
        nearbyText?: string | undefined;
        placeholder?: string | undefined;
        selectorCandidate?: string | undefined;
      }
    | undefined,
): string => {
  if (!input) return "";
  return [
    input.visibleText,
    input.ariaLabel,
    input.labelText,
    input.nearbyText,
    input.placeholder,
    input.selectorCandidate,
  ]
    .filter(Boolean)
    .join(" ");
};

export const snapshotHasAnyText = (
  snapshot: DomSnapshot,
  needles: string[],
): boolean => {
  const text = [
    snapshot.title,
    snapshot.url,
    ...snapshot.inputs.map(compactElementText),
    ...snapshot.buttons.map(compactElementText),
    ...snapshot.links.map(compactElementText),
    ...snapshot.textBlocks.map(compactElementText),
    ...snapshot.tableRows.map(compactElementText),
    ...snapshot.roleRows.map(compactElementText),
    ...snapshot.genericClickableElements.map(compactElementText),
    ...snapshot.dropdownTriggers.map(compactElementText),
  ].join(" ");
  return needles.some((needle) => text.includes(needle));
};

export const locateGlobalMenu = (snapshot: DomSnapshot): LocateResult => {
  if (!snapshot.url.includes("sellercentral.amazon.")) {
    return locate(snapshot, "clickable", [
      "目录",
      "menu",
      "navigation",
      "nav",
      "报告",
    ]);
  }
  return {
    ok: true,
    element: {
      targetRef: snapshot.targetRef,
      documentRef: snapshot.documentRef,
      elementRef: "dom:amazon-tax-invoice-global-menu",
      selector: SELLER_CENTRAL_GLOBAL_MENU_SELECTOR,
      identity: {
        tagName: "navigation-hamburger-menu",
        testId: "hamburger-menu",
      },
      targetKind: "clickable",
      confidence: 0.98,
      matchedSignals: ["seller-central-hamburger-data-test-tag", "AID-02"],
      reason:
        "Matched Seller Central global menu by Chrome-verified hamburger data-test-tag.",
      fallbackUsed: false,
      sourceSnapshotRef: snapshot.url,
      capturedAt: snapshot.capturedAt,
    },
  };
};

export const locateReportsMenu = (snapshot: DomSnapshot): LocateResult => {
  if (!snapshot.url.includes("sellercentral.amazon.")) {
    return locate(snapshot, "clickable", ["报告"]);
  }
  return {
    ok: true,
    element: {
      targetRef: snapshot.targetRef,
      documentRef: snapshot.documentRef,
      elementRef: "dom:amazon-tax-invoice-reports-menu",
      selector: SELLER_CENTRAL_REPORTS_MENU_SELECTOR,
      identity: { testId: "menu__section-reports" },
      targetKind: "clickable",
      confidence: 0.98,
      matchedSignals: [
        "seller-central-hamburger-shadow-menu-section-reports",
        "AID-03",
      ],
      reason:
        "Matched Seller Central reports menu by Chrome-verified hamburger shadowRoot data-test-tag.",
      fallbackUsed: false,
      sourceSnapshotRef: snapshot.url,
      capturedAt: snapshot.capturedAt,
    },
  };
};

export const locateFulfillmentReports = (
  snapshot: DomSnapshot,
): LocateResult => {
  if (!snapshot.url.includes("sellercentral.amazon.")) {
    return locate(snapshot, "link", [
      "配送",
      "/reportcentral/ref=xx_fbareports_dnav_xx",
    ]);
  }
  return {
    ok: true,
    element: {
      targetRef: snapshot.targetRef,
      documentRef: snapshot.documentRef,
      elementRef: "dom:amazon-tax-invoice-fulfillment-reports",
      selector: SELLER_CENTRAL_FULFILLMENT_REPORTS_SELECTOR,
      identity: {
        tagName: "a",
        testId: "menu__button-ssof-inventory-manager-new",
      },
      targetKind: "link",
      confidence: 0.98,
      matchedSignals: [
        "seller-central-hamburger-shadow-fulfillment-reports-link",
        "AID-04",
      ],
      reason:
        "Matched Seller Central fulfillment reports link by Chrome-verified hamburger shadowRoot data-test-tag and href.",
      fallbackUsed: false,
      sourceSnapshotRef: snapshot.url,
      capturedAt: snapshot.capturedAt,
    },
  };
};

export const isSellerCentralHamburgerMenuOpen = async (
  browser: BrowserTargetLease,
  snapshot: DomSnapshot,
): Promise<boolean> => {
  if (!snapshot.url.includes("sellercentral.amazon.")) {
    return snapshotHasAnyText(snapshot, ["目录", "库存", "订单", "报告"]);
  }
  return browser.evaluate<boolean>({
    description: "verify Seller Central hamburger menu open state",
    script: `
const host = document.querySelector(${JSON.stringify(SELLER_CENTRAL_GLOBAL_MENU_SELECTOR)});
const sidebar = host && host.shadowRoot && host.shadowRoot.querySelector('[data-test-tag="menu__sidebar"]');
return Boolean(sidebar && sidebar.classList.contains('menu__sidebar--open'));
`,
  });
};

export const isSellerCentralReportsMenuExpanded = async (
  browser: BrowserTargetLease,
  snapshot: DomSnapshot,
): Promise<boolean> => {
  if (!snapshot.url.includes("sellercentral.amazon.")) {
    return snapshotHasAnyText(snapshot, [
      "业务报告",
      "配送",
      "Tax Document Library",
      "管理税费",
    ]);
  }
  return browser.evaluate<boolean>({
    description: "verify Seller Central reports menu expanded state",
    script: `
const host = document.querySelector(${JSON.stringify(SELLER_CENTRAL_GLOBAL_MENU_SELECTOR)});
const root = host && host.shadowRoot;
const reports = root && root.querySelector('[data-test-tag="menu__section-reports"]');
const fulfillment = root && root.querySelector('a[data-test-tag="menu__button-ssof-inventory-manager-new"][href="/reportcentral/ref=xx_fbareports_dnav_xx"]');
const fulfillmentStyle = fulfillment ? window.getComputedStyle(fulfillment) : null;
return Boolean(
  reports
  && reports.getAttribute('aria-expanded') === 'true'
  && fulfillment
  && fulfillmentStyle
  && fulfillmentStyle.visibility !== 'hidden'
);
`,
  });
};

export const isSellerCentralHomeCandidate = (snapshot: DomSnapshot): boolean =>
  snapshot.url.includes("sellercentral.amazon.") ||
  snapshotHasAnyText(snapshot, [
    "Seller Central",
    "卖家平台",
    "菜单",
    "库存",
    "报告",
  ]);

export const isFulfillmentReportsPage = (snapshot: DomSnapshot): boolean =>
  snapshot.url.includes(TAX_REPORT_URL_PATH) ||
  snapshot.url.includes(FULFILLMENT_REPORTS_URL_PATH) ||
  snapshotHasAnyText(snapshot, [
    "配送报告",
    "亚马逊配送报告",
    "欢迎使用“报告”",
    "亚马逊配送货件",
  ]);

export const isSellerCentralTaxInvoiceReportLinkPresent = async (
  browser: BrowserTargetLease,
  snapshot: DomSnapshot,
): Promise<boolean> => {
  if (!snapshot.url.includes("sellercentral.amazon.")) return false;
  return browser.evaluate<boolean>({
    description: "verify Seller Central tax invoice report link present",
    script: `
const links = Array.from(document.querySelectorAll('a[href="${TAX_REPORT_URL_PATH}"]'));
return links.some((link) => String(link.innerText || link.textContent || "").includes("税务发票"));
`,
  });
};

export const selectSellerCentralLast30Days = async (
  browser: BrowserTargetLease,
): Promise<{ ok: true } | { ok: false; reason: string }> =>
  browser.evaluate<{ ok: true } | { ok: false; reason: string }>({
    description: "select Seller Central event date last 30 days",
    script: `
const dropdown = document.querySelector('kat-dropdown[label="事件日期"]');
if (!dropdown) return {ok: false, reason: "Seller Central event date dropdown not found"};
const rawOptions = dropdown.getAttribute("options") || "[]";
let options;
try {
  options = JSON.parse(rawOptions);
} catch {
  return {ok: false, reason: "Seller Central event date dropdown options were not parseable"};
}
if (!Array.isArray(options) || !options.some((option) => String(option.value) === "30" && String(option.name || "").includes("30"))) {
  return {ok: false, reason: "Seller Central event date dropdown did not expose last 30 days option"};
}
dropdown.value = "30";
dropdown.setAttribute("value", "30");
dropdown.dispatchEvent(new Event("input", {bubbles: true}));
dropdown.dispatchEvent(new Event("change", {bubbles: true}));
dropdown.dispatchEvent(new CustomEvent("katChange", {bubbles: true, detail: {value: "30"}}));
return String(dropdown.value || dropdown.getAttribute("value")) === "30"
  ? {ok: true}
  : {ok: false, reason: "Seller Central event date dropdown did not accept value 30"};
`,
  });

export const isSellerCentralLast30DaysSelected = async (
  browser: BrowserTargetLease,
  snapshot: DomSnapshot,
): Promise<boolean> => {
  if (!snapshot.url.includes("sellercentral.amazon.")) {
    return snapshotHasAnyText(snapshot, ["最近 30 天", 'value="30"']);
  }
  return browser.evaluate<boolean>({
    description: "verify Seller Central event date last 30 days selected",
    script: `
const dropdown = document.querySelector('kat-dropdown[label="事件日期"]');
return Boolean(dropdown && String(dropdown.value || dropdown.getAttribute("value")) === "30");
`,
  });
};

export const firstReportRowText = (snapshot: DomSnapshot): string => {
  const rows = [...snapshot.tableRows, ...snapshot.roleRows];
  return compactElementText(
    rows.find((row) => compactElementText(row).includes("亚马逊配送货件")) ??
      rows[0],
  );
};

export const isRequestedCsvRowInProgress = (rowText: string): boolean =>
  rowText.includes("亚马逊配送货件") &&
  rowText.includes(".csv") &&
  rowText.includes("进行中");

export const isDownloadableCsvRow = (rowText: string): boolean => {
  const normalized = rowText.replace(/\s+/g, "");
  return (
    normalized.includes("亚马逊配送货件") &&
    normalized.includes(".csv") &&
    normalized.includes("下载")
  );
};

export const isSellerCentralLatestReportDownloadable = async (
  browser: BrowserTargetLease,
  snapshot: DomSnapshot,
): Promise<boolean> => {
  if (!snapshot.url.includes("sellercentral.amazon.")) return false;
  const latestState = await readSellerCentralLatestTaxInvoiceRowState(browser);
  return latestState.state === "downloadable";
};

export const findSellerCentralLatestReportDownloadPoint = async (
  browser: BrowserTargetLease,
): Promise<
  { ok: true; point: { x: number; y: number } } | { ok: false; reason: string }
> =>
  browser.evaluate<
    | { ok: true; point: { x: number; y: number } }
    | { ok: false; reason: string }
  >({
    description:
      "locate Seller Central latest tax invoice report download button",
    script: `
const rows = Array.from(document.querySelectorAll('kat-table-row'));
const row = rows.find((candidate) => {
  const text = String(candidate.innerText || candidate.textContent || "");
  return text.includes("亚马逊配送货件") && text.includes("税务发票");
});
if (!row) return {ok: false, reason: "Seller Central latest tax invoice row was not found"};
const button = row.querySelector('kat-button[label="下载"]');
if (!button) return {ok: false, reason: "Seller Central latest tax invoice row is not downloadable yet"};
const rect = button.getBoundingClientRect();
const style = window.getComputedStyle(button);
if (style.display === "none" || style.visibility === "hidden" || rect.width === 0 || rect.height === 0) {
  return {ok: false, reason: "Seller Central latest report download button is hidden"};
}
return {ok: true, point: {x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2)}};
`,
  });

export const readSellerCentralLatestTaxInvoiceRowState = async (
  browser: BrowserTargetLease,
): Promise<{ state: "downloadable" | "pending" | "missing"; reason: string }> =>
  browser.evaluate<{
    state: "downloadable" | "pending" | "missing";
    reason: string;
  }>({
    description: "read Seller Central latest tax invoice row state",
    script: `
const rows = Array.from(document.querySelectorAll('kat-table-row'));
const row = rows.find((candidate) => {
  const text = String(candidate.innerText || candidate.textContent || "");
  return text.includes("亚马逊配送货件") && text.includes("税务发票");
});
if (!row) return {state: "missing", reason: "Seller Central latest tax invoice row was not found"};
const text = String(row.innerText || row.textContent || "");
return row.querySelector('kat-button[label="下载"]')
  ? {state: "downloadable", reason: "Seller Central latest tax invoice row exposes a download button"}
  : {state: "pending", reason: text.includes("进行中") ? "Seller Central latest tax invoice row is in progress" : "Seller Central latest tax invoice row has no download button"};
`,
  });
