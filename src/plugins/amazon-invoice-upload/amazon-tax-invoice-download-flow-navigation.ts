import type { BrowserTargetLease } from "../../lib/browser/browser-authority-api.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import { recordAmazonDomStepTrace } from "./amazon-dom-step-trace.js";
import {
  clickLocated,
  fail,
  hoverLocated,
  manualRequired,
  pass,
} from "./amazon-tax-invoice-download-flow-actions.js";
import type { StepOutcome } from "./amazon-tax-invoice-download-flow-types.js";
import {
  FULFILLMENT_REPORTS_URL_PATH,
  TAX_REPORT_URL_PATH,
  isFulfillmentReportsPage,
  isSellerCentralHamburgerMenuOpen,
  isSellerCentralHomeCandidate,
  isSellerCentralReportsMenuExpanded,
  isSellerCentralTaxInvoiceReportLinkPresent,
  locate,
  locateFulfillmentReports,
  locateGlobalMenu,
  locateReportsMenu,
  snapshotHasAnyText,
} from "./amazon-tax-invoice-download-page-state.js";
import {
  gatedDownloadResult,
  readSnapshotAndTrace,
} from "./amazon-tax-invoice-download-runtime-helpers.js";
import type { AmazonTaxInvoiceDownloadMissionInput } from "./mission.schema.js";

const REPORTCENTRAL_PAGE_SETTLE_MS = 3_000;

export async function openSellerCentralHome(
  browser: BrowserTargetLease,
  runtimeLogger: RuntimeLogger,
  mission: AmazonTaxInvoiceDownloadMissionInput,
): Promise<StepOutcome> {
  await browser.open({
    url: mission.sellerCentralEntryUrl,
    title: "Amazon Seller Central tax invoice download entry",
    reusePolicy: "open-new-tab",
  });
  await browser.wait(1_500);
  const snapshot = await readSnapshotAndTrace(
    browser,
    runtimeLogger,
    mission,
    "AID-01",
    "open seller central home",
  );
  const gate = gatedDownloadResult(
    snapshot,
    mission,
    "AID-01",
    "open seller central home",
  );
  if (gate) return fail(gate);
  return isSellerCentralHomeCandidate(snapshot)
    ? pass(undefined, snapshot)
    : fail(
        manualRequired(
          mission,
          "AID-01",
          "Seller Central home did not expose the empirically observed home signals.",
          "open seller central home",
        ),
      );
}

export async function openGlobalMenu(
  browser: BrowserTargetLease,
  runtimeLogger: RuntimeLogger,
  mission: AmazonTaxInvoiceDownloadMissionInput,
): Promise<StepOutcome> {
  const snapshot = await readSnapshotAndTrace(
    browser,
    runtimeLogger,
    mission,
    "AID-02",
    "locate global menu",
  );
  const gate = gatedDownloadResult(
    snapshot,
    mission,
    "AID-02",
    "locate global menu",
  );
  if (gate) return fail(gate);
  const menu = locateGlobalMenu(snapshot);
  if (!menu.ok)
    return fail(
      manualRequired(mission, "AID-02", menu.reason, "locate global menu"),
    );
  const clicked = await clickLocated(
    browser,
    runtimeLogger,
    mission,
    "AID-02",
    "open global menu",
    menu.element,
  );
  if (!clicked.ok) return clicked;
  const after = await readSnapshotAndTrace(
    browser,
    runtimeLogger,
    mission,
    "AID-02",
    "verify global menu opened",
  );
  return (await isSellerCentralHamburgerMenuOpen(browser, after))
    ? pass(undefined, after)
    : fail(
        manualRequired(
          mission,
          "AID-02",
          "Global menu did not expose the empirically observed menu headings.",
          "open global menu",
        ),
      );
}

export async function chooseReportsMenu(
  browser: BrowserTargetLease,
  runtimeLogger: RuntimeLogger,
  mission: AmazonTaxInvoiceDownloadMissionInput,
): Promise<StepOutcome> {
  const snapshot = await readSnapshotAndTrace(
    browser,
    runtimeLogger,
    mission,
    "AID-03",
    "locate reports menu",
  );
  const reports = locateReportsMenu(snapshot);
  if (!reports.ok)
    return fail(
      manualRequired(mission, "AID-03", reports.reason, "locate reports menu"),
    );
  const activated = snapshot.url.includes("sellercentral.amazon.")
    ? await hoverLocated(
        browser,
        runtimeLogger,
        mission,
        "AID-03",
        "choose reports menu",
        reports.element,
      )
    : await clickLocated(
        browser,
        runtimeLogger,
        mission,
        "AID-03",
        "choose reports menu",
        reports.element,
      );
  if (!activated.ok) return activated;
  const after = await readSnapshotAndTrace(
    browser,
    runtimeLogger,
    mission,
    "AID-03",
    "verify reports submenu",
  );
  return (await isSellerCentralReportsMenuExpanded(browser, after))
    ? pass(undefined, after)
    : fail(
        manualRequired(
          mission,
          "AID-03",
          "Reports submenu did not expose fulfillment report links.",
          "choose reports menu",
        ),
      );
}

export async function openFulfillmentReports(
  browser: BrowserTargetLease,
  runtimeLogger: RuntimeLogger,
  mission: AmazonTaxInvoiceDownloadMissionInput,
): Promise<StepOutcome> {
  const snapshot = await readSnapshotAndTrace(
    browser,
    runtimeLogger,
    mission,
    "AID-04",
    "locate fulfillment reports",
  );
  const fulfillment = locateFulfillmentReports(snapshot);
  if (!fulfillment.ok)
    return fail(
      manualRequired(
        mission,
        "AID-04",
        fulfillment.reason,
        "locate fulfillment reports",
      ),
    );
  if (snapshot.url.includes("sellercentral.amazon.")) {
    const url = new URL(FULFILLMENT_REPORTS_URL_PATH, snapshot.url);
    await browser.open({
      url: url.toString(),
      title: "Open Amazon fulfillment reports",
      reusePolicy: "reuse-exact-url",
    });
    await browser.wait(REPORTCENTRAL_PAGE_SETTLE_MS);
    recordAmazonDomStepTrace({
      runtimeLogger,
      mission,
      stepName: "AID-04 open fulfillment reports",
      status: "success",
      selectedElement: fulfillment.element,
      reason:
        "opened Chrome-verified Seller Central fulfillment reports href with governed browser controller",
    });
  } else {
    const clicked = await clickLocated(
      browser,
      runtimeLogger,
      mission,
      "AID-04",
      "open fulfillment reports",
      fulfillment.element,
    );
    if (!clicked.ok) return clicked;
  }
  const after = await readSnapshotAndTrace(
    browser,
    runtimeLogger,
    mission,
    "AID-04",
    "verify fulfillment reports page",
  );
  return isFulfillmentReportsPage(after)
    ? pass(undefined, after)
    : fail(
        manualRequired(
          mission,
          "AID-04",
          "Fulfillment reports page did not expose observed report headings.",
          "open fulfillment reports",
        ),
      );
}

export async function openAfnShipmentInvoicingReport(
  browser: BrowserTargetLease,
  runtimeLogger: RuntimeLogger,
  mission: AmazonTaxInvoiceDownloadMissionInput,
): Promise<StepOutcome> {
  const snapshot = await readSnapshotAndTrace(
    browser,
    runtimeLogger,
    mission,
    "AID-05",
    "locate tax invoice report",
  );
  const opened = snapshot.url.includes("sellercentral.amazon.")
    ? await openSellerCentralTaxInvoiceReport(browser, runtimeLogger, mission, snapshot)
    : await openFixtureTaxInvoiceReport(browser, runtimeLogger, mission, snapshot);
  if (!opened.ok) return opened;
  const after = await readSnapshotAndTrace(
    browser,
    runtimeLogger,
    mission,
    "AID-05",
    "verify tax invoice report page",
  );
  return after.url.includes(TAX_REPORT_URL_PATH) &&
    snapshotHasAnyText(after, ["亚马逊配送货件", "税务发票", "事件日期"])
    ? pass(undefined, after)
    : fail(
        manualRequired(
          mission,
          "AID-05",
          "Tax invoice report page did not match the empirical URL and heading.",
          "open tax invoice report",
        ),
      );
}

async function openSellerCentralTaxInvoiceReport(
  browser: BrowserTargetLease,
  runtimeLogger: RuntimeLogger,
  mission: AmazonTaxInvoiceDownloadMissionInput,
  snapshot: Awaited<ReturnType<typeof readSnapshotAndTrace>>,
): Promise<StepOutcome> {
  const linkPresent = await isSellerCentralTaxInvoiceReportLinkPresent(
    browser,
    snapshot,
  );
  if (!linkPresent)
    return fail(
      manualRequired(
        mission,
        "AID-05",
        "Tax invoice report link was not proven present on Seller Central report central.",
        "locate tax invoice report",
      ),
    );
  const url = new URL(TAX_REPORT_URL_PATH, snapshot.url);
  await browser.open({
    url: url.toString(),
    title: "Open Amazon tax invoice report",
    reusePolicy: "reuse-exact-url",
  });
  await browser.wait(REPORTCENTRAL_PAGE_SETTLE_MS);
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "AID-05 open tax invoice report",
    status: "success",
    reason:
      "opened Chrome-verified Seller Central tax invoice report href with governed browser controller",
  });
  return pass();
}

async function openFixtureTaxInvoiceReport(
  browser: BrowserTargetLease,
  runtimeLogger: RuntimeLogger,
  mission: AmazonTaxInvoiceDownloadMissionInput,
  snapshot: Awaited<ReturnType<typeof readSnapshotAndTrace>>,
): Promise<StepOutcome> {
  const report = locate(snapshot, "link", [
    "亚马逊配送货件",
    "税务发票",
    TAX_REPORT_URL_PATH,
  ]);
  if (!report.ok)
    return fail(
      manualRequired(
        mission,
        "AID-05",
        report.reason,
        "locate tax invoice report",
      ),
    );
  return clickLocated(
    browser,
    runtimeLogger,
    mission,
    "AID-05",
    "open tax invoice report",
    report.element,
  );
}
