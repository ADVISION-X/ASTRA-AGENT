import type { BrowserTargetLease } from "../../lib/browser/browser-authority-api.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import { recordAmazonDomStepTrace } from "./amazon-dom-step-trace.js";
import {
  clickLocated,
  fail,
  manualRequired,
  pass,
} from "./amazon-tax-invoice-download-flow-actions.js";
import type { StepOutcome } from "./amazon-tax-invoice-download-flow-types.js";
import {
  WAIT_REPORT_READY_POLL_MS,
  WAIT_REPORT_READY_TIMEOUT_MS,
} from "./amazon-tax-invoice-download-flow-constants.js";
import {
  currentUrlOrEntry,
  gatedDownloadResult,
  readSnapshotAndTrace,
} from "./amazon-tax-invoice-download-runtime-helpers.js";
import {
  firstReportRowText,
  isDownloadableCsvRow,
  isRequestedCsvRowInProgress,
  isSellerCentralLast30DaysSelected,
  isSellerCentralLatestReportDownloadable,
  locate,
  readSellerCentralLatestTaxInvoiceRowState,
  selectSellerCentralLast30Days,
  snapshotHasAnyText,
} from "./amazon-tax-invoice-download-page-state.js";
import type { AmazonTaxInvoiceDownloadMissionInput } from "./mission.schema.js";

export async function selectLast30Days(
  browser: BrowserTargetLease,
  runtimeLogger: RuntimeLogger,
  mission: AmazonTaxInvoiceDownloadMissionInput,
): Promise<StepOutcome> {
  const snapshot = await readSnapshotAndTrace(
    browser,
    runtimeLogger,
    mission,
    "AID-06",
    "locate event date dropdown",
  );
  if (snapshot.url.includes("sellercentral.amazon."))
    return selectSellerCentralDate(browser, runtimeLogger, mission);
  return selectFixtureDate(browser, runtimeLogger, mission, snapshot);
}

async function selectSellerCentralDate(
  browser: BrowserTargetLease,
  runtimeLogger: RuntimeLogger,
  mission: AmazonTaxInvoiceDownloadMissionInput,
): Promise<StepOutcome> {
  const selected = await selectSellerCentralLast30Days(browser);
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "AID-06 choose event date last 30 days",
    status: selected.ok ? "success" : "review_required",
    reason: selected.ok
      ? "selected Seller Central event date dropdown value 30"
      : selected.reason,
  });
  if (!selected.ok)
    return fail(
      manualRequired(
        mission,
        "AID-06",
        selected.reason,
        "choose event date last 30 days",
      ),
    );
  await browser.wait(500);
  const after = await readSnapshotAndTrace(
    browser,
    runtimeLogger,
    mission,
    "AID-06",
    "verify last 30 days selected",
  );
  return (await isSellerCentralLast30DaysSelected(browser, after))
    ? pass(undefined, after)
    : fail(
        manualRequired(
          mission,
          "AID-06",
          "Event date dropdown did not retain Seller Central value 30 after selection.",
          "choose event date last 30 days",
        ),
      );
}

async function selectFixtureDate(
  browser: BrowserTargetLease,
  runtimeLogger: RuntimeLogger,
  mission: AmazonTaxInvoiceDownloadMissionInput,
  snapshot: Awaited<ReturnType<typeof readSnapshotAndTrace>>,
): Promise<StepOutcome> {
  const dropdown = locate(snapshot, "dropdown-trigger", [
    "事件日期",
    "今天",
    "最近 30 天",
  ]);
  if (!dropdown.ok)
    return fail(
      manualRequired(
        mission,
        "AID-06",
        dropdown.reason,
        "locate event date dropdown",
      ),
    );
  const opened = await clickLocated(
    browser,
    runtimeLogger,
    mission,
    "AID-06",
    "open event date dropdown",
    dropdown.element,
  );
  if (!opened.ok) return opened;
  const options = await readSnapshotAndTrace(
    browser,
    runtimeLogger,
    mission,
    "AID-06",
    "locate last 30 days option",
  );
  const option = locate(options, "clickable", ["最近 30 天", 'value="30"']);
  if (!option.ok)
    return fail(
      manualRequired(
        mission,
        "AID-06",
        option.reason,
        "locate last 30 days option",
      ),
    );
  const selected = await clickLocated(
    browser,
    runtimeLogger,
    mission,
    "AID-06",
    "choose event date last 30 days",
    option.element,
  );
  if (!selected.ok) return selected;
  const after = await readSnapshotAndTrace(
    browser,
    runtimeLogger,
    mission,
    "AID-06",
    "verify last 30 days selected",
  );
  return snapshotHasAnyText(after, ["最近 30 天", 'value="30"'])
    ? pass(undefined, after)
    : fail(
        manualRequired(
          mission,
          "AID-06",
          "Event date did not expose last 30 days after selection.",
          "choose event date last 30 days",
        ),
      );
}

export async function requestCsvDownload(
  browser: BrowserTargetLease,
  runtimeLogger: RuntimeLogger,
  mission: AmazonTaxInvoiceDownloadMissionInput,
): Promise<StepOutcome> {
  const snapshot = await readSnapshotAndTrace(
    browser,
    runtimeLogger,
    mission,
    "AID-07",
    "locate request csv button",
  );
  if (snapshot.url.includes("sellercentral.amazon.")) {
    const latestState =
      await readSellerCentralLatestTaxInvoiceRowState(browser);
    if (latestState.state === "pending") return pass(undefined, snapshot);
  }
  const beforeRow = firstReportRowText(snapshot);
  if (isRequestedCsvRowInProgress(beforeRow))
    return pass(undefined, snapshot);
  const csvButton = locate(snapshot, "button", ["请求下载 .csv 文件", "CSV"]);
  if (!csvButton.ok)
    return fail(
      manualRequired(
        mission,
        "AID-07",
        csvButton.reason,
        "locate request csv button",
      ),
    );
  const clicked = await clickLocated(
    browser,
    runtimeLogger,
    mission,
    "AID-07",
    "request csv download",
    csvButton.element,
  );
  if (!clicked.ok) return clicked;
  await browser.wait(3_000);
  const after = await readSnapshotAndTrace(
    browser,
    runtimeLogger,
    mission,
    "AID-07",
    "verify csv request row",
  );
  const afterRow = firstReportRowText(after);
  const sellerCentralRequested = after.url.includes("sellercentral.amazon.")
    ? (await readSellerCentralLatestTaxInvoiceRowState(browser)).state ===
      "pending"
    : false;
  return (afterRow !== beforeRow && isRequestedCsvRowInProgress(afterRow)) ||
    sellerCentralRequested
    ? pass(undefined, after)
    : fail(
        manualRequired(
          mission,
          "AID-07",
          "Latest row is not proven to be the current requested CSV report.",
          "request csv download",
        ),
      );
}

export async function waitLatestReportDownloadReady(
  browser: BrowserTargetLease,
  runtimeLogger: RuntimeLogger,
  mission: AmazonTaxInvoiceDownloadMissionInput,
): Promise<StepOutcome> {
  const startedAt = Date.now();
  let lastSnapshot = await readSnapshotAndTrace(
    browser,
    runtimeLogger,
    mission,
    "AID-08",
    "wait latest report download ready",
  );
  while (Date.now() - startedAt <= WAIT_REPORT_READY_TIMEOUT_MS) {
    const rowText = firstReportRowText(lastSnapshot);
    if (
      (rowText && isDownloadableCsvRow(rowText)) ||
      (await isSellerCentralLatestReportDownloadable(browser, lastSnapshot))
    ) {
      return pass(undefined, lastSnapshot);
    }
    const gate = gatedDownloadResult(
      lastSnapshot,
      mission,
      "AID-08",
      "wait latest report download ready",
    );
    if (gate) return fail(gate);
    await browser.wait(WAIT_REPORT_READY_POLL_MS);
    lastSnapshot = await readSnapshotAndTrace(
      browser,
      runtimeLogger,
      mission,
      "AID-08",
      "wait latest report download ready",
    );
  }
  await browser.open({
    url: currentUrlOrEntry(lastSnapshot, mission),
    title: "Refresh Amazon tax invoice report page",
  });
  const refreshed = await readSnapshotAndTrace(
    browser,
    runtimeLogger,
    mission,
    "AID-09",
    "refresh if needed",
  );
  const rowText = firstReportRowText(refreshed);
  return (rowText && isDownloadableCsvRow(rowText)) ||
    (await isSellerCentralLatestReportDownloadable(browser, refreshed))
    ? pass(undefined, refreshed)
    : fail(
        manualRequired(
          mission,
          "AID-09",
          "Latest report was not downloadable after wait and refresh.",
          "refresh if needed",
        ),
      );
}
