import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import type { DomElementRef, DomSnapshot } from "../../types/dom-automation.js";
import { recordAmazonDomStepTrace } from "./amazon-dom-step-trace.js";
import { clickElement } from "./amazon-invoice-upload-flow-support.js";
import type { AmazonTaxInvoiceDownloadTaskResult } from "./amazon-invoice-upload-storage.types.js";
import {
  AmazonTaxInvoiceDownloadMissionInputSchema,
  type AmazonTaxInvoiceDownloadMissionInput,
} from "./mission.schema.js";
import type { AmazonTaxInvoiceDownloadEvidenceStepId } from "./amazon-tax-invoice-download-evidence.js";
import {
  listDownloadFiles,
  verifyLocalDownloadArtifact,
  waitForNewDownloadFile,
  type FileCandidate,
} from "./amazon-tax-invoice-download-local-artifact.js";
import {
  assertEvidenceStepId,
  currentUrlOrEntry,
  gatedDownloadResult,
  readSnapshotAndTrace,
} from "./amazon-tax-invoice-download-runtime-helpers.js";
import {
  FULFILLMENT_REPORTS_URL_PATH,
  TAX_REPORT_URL_PATH,
  findSellerCentralLatestReportDownloadPoint,
  firstReportRowText,
  isDownloadableCsvRow,
  isFulfillmentReportsPage,
  isRequestedCsvRowInProgress,
  isSellerCentralHamburgerMenuOpen,
  isSellerCentralHomeCandidate,
  isSellerCentralLast30DaysSelected,
  isSellerCentralLatestReportDownloadable,
  isSellerCentralReportsMenuExpanded,
  isSellerCentralTaxInvoiceReportLinkPresent,
  locate,
  locateFulfillmentReports,
  locateGlobalMenu,
  locateReportsMenu,
  readSellerCentralLatestTaxInvoiceRowState,
  selectSellerCentralLast30Days,
  snapshotHasAnyText,
} from "./amazon-tax-invoice-download-page-state.js";

const WAIT_REPORT_READY_TIMEOUT_MS = 180_000;
const WAIT_REPORT_READY_POLL_MS = 15_000;
const REPORTCENTRAL_PAGE_SETTLE_MS = 3_000;

type StepOutcome<T = void> =
  | { ok: true; value: T; snapshot?: DomSnapshot }
  | { ok: false; failure: AmazonTaxInvoiceDownloadTaskResult };

type DownloadStep = {
  evidenceStepId: AmazonTaxInvoiceDownloadEvidenceStepId;
  reachedStep: string;
  run: (
    browser: BrowserController,
    runtimeLogger: RuntimeLogger,
    mission: AmazonTaxInvoiceDownloadMissionInput,
  ) => Promise<StepOutcome>;
};

export async function runAmazonTaxInvoiceDownload(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  rawMission: AmazonTaxInvoiceDownloadMissionInput,
): Promise<AmazonTaxInvoiceDownloadTaskResult> {
  const mission = AmazonTaxInvoiceDownloadMissionInputSchema.parse(rawMission);
  const baselineFiles = listDownloadFiles();

  for (const step of [
    { evidenceStepId: "AID-01", reachedStep: "open seller central home", run: openSellerCentralHome },
    { evidenceStepId: "AID-02", reachedStep: "open global menu", run: openGlobalMenu },
    { evidenceStepId: "AID-03", reachedStep: "choose reports menu", run: chooseReportsMenu },
    { evidenceStepId: "AID-04", reachedStep: "open fulfillment reports", run: openFulfillmentReports },
    { evidenceStepId: "AID-05", reachedStep: "open tax invoice report", run: openAfnShipmentInvoicingReport },
    { evidenceStepId: "AID-06", reachedStep: "choose event date last 30 days", run: selectLast30Days },
  ] satisfies DownloadStep[]) {
    const result = await runDownloadStep(step, browser, runtimeLogger, mission);
    if (!result.ok) return result.failure;
  }

  const requested = await runDownloadStep(
    { evidenceStepId: "AID-07", reachedStep: "request csv download", run: requestCsvDownload },
    browser,
    runtimeLogger,
    mission,
  );
  if (!requested.ok) return requested.failure;
  const ready = await runDownloadStep(
    { evidenceStepId: "AID-08", reachedStep: "wait latest report download ready", run: waitLatestReportDownloadReady },
    browser,
    runtimeLogger,
    mission,
  );
  if (!ready.ok) return ready.failure;
  const clicked = await runDownloadStep(
    {
      evidenceStepId: "AID-10",
      reachedStep: "click latest report download",
      run: (browserArg, runtimeLoggerArg, missionArg) => clickLatestReportDownload(browserArg, runtimeLoggerArg, missionArg, baselineFiles),
    },
    browser,
    runtimeLogger,
    mission,
  );
  if (!clicked.ok) return clicked.failure;
  return verifyLocalDownloadArtifact(runtimeLogger, mission, clicked.value);
}

async function runDownloadStep<T = void>(
  step: Omit<DownloadStep, "run"> & {
    run: (
      browser: BrowserController,
      runtimeLogger: RuntimeLogger,
      mission: AmazonTaxInvoiceDownloadMissionInput,
    ) => Promise<StepOutcome<T>>;
  },
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonTaxInvoiceDownloadMissionInput,
): Promise<StepOutcome<T>> {
  try {
    return await step.run(browser, runtimeLogger, mission);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return fail({
      ok: false,
      status: "failed",
      reason,
      reachedStep: step.reachedStep,
      evidenceStepId: step.evidenceStepId,
      domTraceRef: `runtime-evidence/amazon-invoice-upload/download-${mission.marketplace}-${mission.requestId ?? "latest"}.jsonl`,
      reviewRequired: true,
    });
  }
}

async function openSellerCentralHome(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonTaxInvoiceDownloadMissionInput,
): Promise<StepOutcome> {
  await browser.open({
    url: mission.sellerCentralEntryUrl,
    title: "Amazon Seller Central tax invoice download entry",
    reusePolicy: "open-new-tab",
  });
  await browser.wait(1_500);
  const snapshot = await readSnapshotAndTrace(browser, runtimeLogger, mission, "AID-01", "open seller central home");
  const gate = gatedDownloadResult(snapshot, mission, "AID-01", "open seller central home");
  if (gate) return fail(gate);
  return isSellerCentralHomeCandidate(snapshot)
    ? pass(undefined, snapshot)
    : fail(manualRequired(mission, "AID-01", "Seller Central home did not expose the empirically observed home signals.", "open seller central home"));
}

async function openGlobalMenu(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonTaxInvoiceDownloadMissionInput,
): Promise<StepOutcome> {
  const snapshot = await readSnapshotAndTrace(browser, runtimeLogger, mission, "AID-02", "locate global menu");
  const gate = gatedDownloadResult(snapshot, mission, "AID-02", "locate global menu");
  if (gate) return fail(gate);
  const menu = locateGlobalMenu(snapshot);
  if (!menu.ok) return fail(manualRequired(mission, "AID-02", menu.reason, "locate global menu"));
  const clicked = await clickLocated(browser, runtimeLogger, mission, "AID-02", "open global menu", menu.element);
  if (!clicked.ok) return clicked;
  const after = await readSnapshotAndTrace(browser, runtimeLogger, mission, "AID-02", "verify global menu opened");
  return await isSellerCentralHamburgerMenuOpen(browser, after)
    ? pass(undefined, after)
    : fail(manualRequired(mission, "AID-02", "Global menu did not expose the empirically observed menu headings.", "open global menu"));
}

async function chooseReportsMenu(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonTaxInvoiceDownloadMissionInput,
): Promise<StepOutcome> {
  const snapshot = await readSnapshotAndTrace(browser, runtimeLogger, mission, "AID-03", "locate reports menu");
  const reports = locateReportsMenu(snapshot);
  if (!reports.ok) return fail(manualRequired(mission, "AID-03", reports.reason, "locate reports menu"));
  const activated = snapshot.url.includes("sellercentral.amazon.")
    ? await hoverLocated(browser, runtimeLogger, mission, "AID-03", "choose reports menu", reports.element)
    : await clickLocated(browser, runtimeLogger, mission, "AID-03", "choose reports menu", reports.element);
  if (!activated.ok) return activated;
  const after = await readSnapshotAndTrace(browser, runtimeLogger, mission, "AID-03", "verify reports submenu");
  return await isSellerCentralReportsMenuExpanded(browser, after)
    ? pass(undefined, after)
    : fail(manualRequired(mission, "AID-03", "Reports submenu did not expose fulfillment report links.", "choose reports menu"));
}

async function openFulfillmentReports(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonTaxInvoiceDownloadMissionInput,
): Promise<StepOutcome> {
  const snapshot = await readSnapshotAndTrace(browser, runtimeLogger, mission, "AID-04", "locate fulfillment reports");
  const fulfillment = locateFulfillmentReports(snapshot);
  if (!fulfillment.ok) return fail(manualRequired(mission, "AID-04", fulfillment.reason, "locate fulfillment reports"));
  if (snapshot.url.includes("sellercentral.amazon.")) {
    const url = new URL(FULFILLMENT_REPORTS_URL_PATH, snapshot.url);
    await browser.open({ url: url.toString(), title: "Open Amazon fulfillment reports", reusePolicy: "reuse-active-tab" });
    await browser.wait(REPORTCENTRAL_PAGE_SETTLE_MS);
    recordAmazonDomStepTrace({
      runtimeLogger,
      mission,
      stepName: "AID-04 open fulfillment reports",
      status: "success",
      selectedElement: fulfillment.element,
      reason: "opened Chrome-verified Seller Central fulfillment reports href with governed browser controller",
    });
  } else {
    const clicked = await clickLocated(browser, runtimeLogger, mission, "AID-04", "open fulfillment reports", fulfillment.element);
    if (!clicked.ok) return clicked;
  }
  const after = await readSnapshotAndTrace(browser, runtimeLogger, mission, "AID-04", "verify fulfillment reports page");
  return isFulfillmentReportsPage(after)
    ? pass(undefined, after)
    : fail(manualRequired(mission, "AID-04", "Fulfillment reports page did not expose observed report headings.", "open fulfillment reports"));
}

async function openAfnShipmentInvoicingReport(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonTaxInvoiceDownloadMissionInput,
): Promise<StepOutcome> {
  const snapshot = await readSnapshotAndTrace(browser, runtimeLogger, mission, "AID-05", "locate tax invoice report");
  if (snapshot.url.includes("sellercentral.amazon.")) {
    const linkPresent = await isSellerCentralTaxInvoiceReportLinkPresent(browser, snapshot);
    if (!linkPresent) {
      return fail(manualRequired(mission, "AID-05", "Tax invoice report link was not proven present on Seller Central report central.", "locate tax invoice report"));
    }
    const url = new URL(TAX_REPORT_URL_PATH, snapshot.url);
    await browser.open({ url: url.toString(), title: "Open Amazon tax invoice report", reusePolicy: "reuse-active-tab" });
    await browser.wait(REPORTCENTRAL_PAGE_SETTLE_MS);
    recordAmazonDomStepTrace({
      runtimeLogger,
      mission,
      stepName: "AID-05 open tax invoice report",
      status: "success",
      reason: "opened Chrome-verified Seller Central tax invoice report href with governed browser controller",
    });
  } else {
    const report = locate(snapshot, "link", ["亚马逊配送货件", "税务发票", TAX_REPORT_URL_PATH]);
    if (!report.ok) return fail(manualRequired(mission, "AID-05", report.reason, "locate tax invoice report"));
    const clicked = await clickLocated(browser, runtimeLogger, mission, "AID-05", "open tax invoice report", report.element);
    if (!clicked.ok) return clicked;
  }
  const after = await readSnapshotAndTrace(browser, runtimeLogger, mission, "AID-05", "verify tax invoice report page");
  return after.url.includes(TAX_REPORT_URL_PATH) && snapshotHasAnyText(after, ["亚马逊配送货件", "税务发票", "事件日期"])
    ? pass(undefined, after)
    : fail(manualRequired(mission, "AID-05", "Tax invoice report page did not match the empirical URL and heading.", "open tax invoice report"));
}

async function selectLast30Days(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonTaxInvoiceDownloadMissionInput,
): Promise<StepOutcome> {
  const snapshot = await readSnapshotAndTrace(browser, runtimeLogger, mission, "AID-06", "locate event date dropdown");
  if (snapshot.url.includes("sellercentral.amazon.")) {
    const selected = await selectSellerCentralLast30Days(browser);
    recordAmazonDomStepTrace({
      runtimeLogger,
      mission,
      stepName: "AID-06 choose event date last 30 days",
      status: selected.ok ? "success" : "review_required",
      reason: selected.ok ? "selected Seller Central event date dropdown value 30" : selected.reason,
    });
    if (!selected.ok) return fail(manualRequired(mission, "AID-06", selected.reason, "choose event date last 30 days"));
    await browser.wait(500);
    const after = await readSnapshotAndTrace(browser, runtimeLogger, mission, "AID-06", "verify last 30 days selected");
    return await isSellerCentralLast30DaysSelected(browser, after)
      ? pass(undefined, after)
      : fail(manualRequired(mission, "AID-06", "Event date dropdown did not retain Seller Central value 30 after selection.", "choose event date last 30 days"));
  }
  const dropdown = locate(snapshot, "dropdown-trigger", ["事件日期", "今天", "最近 30 天"]);
  if (!dropdown.ok) return fail(manualRequired(mission, "AID-06", dropdown.reason, "locate event date dropdown"));
  const opened = await clickLocated(browser, runtimeLogger, mission, "AID-06", "open event date dropdown", dropdown.element);
  if (!opened.ok) return opened;
  const options = await readSnapshotAndTrace(browser, runtimeLogger, mission, "AID-06", "locate last 30 days option");
  const option = locate(options, "clickable", ["最近 30 天", "value=\"30\""]);
  if (!option.ok) return fail(manualRequired(mission, "AID-06", option.reason, "locate last 30 days option"));
  const selected = await clickLocated(browser, runtimeLogger, mission, "AID-06", "choose event date last 30 days", option.element);
  if (!selected.ok) return selected;
  const after = await readSnapshotAndTrace(browser, runtimeLogger, mission, "AID-06", "verify last 30 days selected");
  return snapshotHasAnyText(after, ["最近 30 天", "value=\"30\""])
    ? pass(undefined, after)
    : fail(manualRequired(mission, "AID-06", "Event date did not expose last 30 days after selection.", "choose event date last 30 days"));
}

async function requestCsvDownload(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonTaxInvoiceDownloadMissionInput,
): Promise<StepOutcome> {
  const snapshot = await readSnapshotAndTrace(browser, runtimeLogger, mission, "AID-07", "locate request csv button");
  if (snapshot.url.includes("sellercentral.amazon.")) {
    const latestState = await readSellerCentralLatestTaxInvoiceRowState(browser);
    if (latestState.state === "pending") {
      return pass(undefined, snapshot);
    }
  }
  const beforeRow = firstReportRowText(snapshot);
  if (isRequestedCsvRowInProgress(beforeRow)) {
    return pass(undefined, snapshot);
  }
  const csvButton = locate(snapshot, "button", ["请求下载 .csv 文件", "CSV"]);
  if (!csvButton.ok) return fail(manualRequired(mission, "AID-07", csvButton.reason, "locate request csv button"));
  const clicked = await clickLocated(browser, runtimeLogger, mission, "AID-07", "request csv download", csvButton.element);
  if (!clicked.ok) return clicked;
  await browser.wait(3_000);
  const after = await readSnapshotAndTrace(browser, runtimeLogger, mission, "AID-07", "verify csv request row");
  const afterRow = firstReportRowText(after);
  const sellerCentralRequested = after.url.includes("sellercentral.amazon.")
    ? (await readSellerCentralLatestTaxInvoiceRowState(browser)).state === "pending"
    : false;
  return (afterRow !== beforeRow && isRequestedCsvRowInProgress(afterRow)) || sellerCentralRequested
    ? pass(undefined, after)
    : fail(manualRequired(mission, "AID-07", "Latest row is not proven to be the current requested CSV report.", "request csv download"));
}

async function waitLatestReportDownloadReady(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonTaxInvoiceDownloadMissionInput,
): Promise<StepOutcome> {
  const startedAt = Date.now();
  let lastSnapshot = await readSnapshotAndTrace(browser, runtimeLogger, mission, "AID-08", "wait latest report download ready");
  while (Date.now() - startedAt <= WAIT_REPORT_READY_TIMEOUT_MS) {
    const rowText = firstReportRowText(lastSnapshot);
    if (isDownloadableCsvRow(rowText) || await isSellerCentralLatestReportDownloadable(browser, lastSnapshot)) {
      return pass(undefined, lastSnapshot);
    }
    const gate = gatedDownloadResult(lastSnapshot, mission, "AID-08", "wait latest report download ready");
    if (gate) return fail(gate);
    await browser.wait(WAIT_REPORT_READY_POLL_MS);
    lastSnapshot = await readSnapshotAndTrace(browser, runtimeLogger, mission, "AID-08", "wait latest report download ready");
  }
  await browser.open({ url: currentUrlOrEntry(lastSnapshot, mission), title: "Refresh Amazon tax invoice report page" });
  const refreshed = await readSnapshotAndTrace(browser, runtimeLogger, mission, "AID-09", "refresh if needed");
  const rowText = firstReportRowText(refreshed);
  return isDownloadableCsvRow(rowText) || await isSellerCentralLatestReportDownloadable(browser, refreshed)
    ? pass(undefined, refreshed)
    : fail(manualRequired(mission, "AID-09", "Latest report was not downloadable after wait and refresh.", "refresh if needed"));
}

async function clickLatestReportDownload(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonTaxInvoiceDownloadMissionInput,
  baselineFiles: FileCandidate[],
): Promise<StepOutcome<string>> {
  const snapshot = await readSnapshotAndTrace(browser, runtimeLogger, mission, "AID-10", "locate latest report download");
  if (snapshot.url.includes("sellercentral.amazon.")) {
    const target = await findSellerCentralLatestReportDownloadPoint(browser);
    if (!target.ok) return fail(manualRequired(mission, "AID-10", target.reason, "locate latest report download"));
    const clicked = await browser.click({
      targetLabel: "click latest tax invoice report download",
      coordinateSpace: "browserViewport",
      button: "left",
      clickCount: 1,
      point: target.point,
    });
    recordAmazonDomStepTrace({
      runtimeLogger,
      mission,
      stepName: "AID-10 click latest report download",
      status: clicked.ok ? "success" : "review_required",
      reason: clicked.ok ? "clicked Seller Central latest report row download button" : clicked.message,
    });
    if (!clicked.ok) return fail(manualRequired(mission, "AID-10", clicked.message, "click latest report download"));
    const artifactPath = await waitForNewDownloadFile(baselineFiles);
    return artifactPath
      ? pass(artifactPath)
      : fail(manualRequired(mission, "AID-11", "No new local Downloads file appeared after clicking the latest report download.", "verify local download artifact"));
  }
  const download = locate(snapshot, "button", ["下载"]);
  if (!download.ok) return fail(manualRequired(mission, "AID-10", download.reason, "locate latest report download"));
  const clicked = await clickLocated(browser, runtimeLogger, mission, "AID-10", "click latest report download", download.element);
  if (!clicked.ok) return clicked;
  const artifactPath = await waitForNewDownloadFile(baselineFiles);
  return artifactPath
    ? pass(artifactPath)
    : fail(manualRequired(mission, "AID-11", "No new local Downloads file appeared after clicking the latest report download.", "verify local download artifact"));
}

async function clickLocated(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonTaxInvoiceDownloadMissionInput,
  evidenceStepId: AmazonTaxInvoiceDownloadEvidenceStepId,
  reachedStep: string,
  element: DomElementRef,
): Promise<StepOutcome> {
  assertEvidenceStepId(evidenceStepId);
  const clicked = await clickElement(browser, {
    elementRef: element,
    expectedKind: reachedStep,
    waitAfterMs: 250,
  });
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: `${evidenceStepId} ${reachedStep}`,
    status: clicked.ok ? "success" : "review_required",
    selectedElement: element,
    reason: clicked.ok ? clicked.message : clicked.reviewRequiredReason ?? clicked.message,
    evidenceRef: clicked.afterEvidenceRef ?? clicked.beforeEvidenceRef,
  });
  return clicked.ok
    ? pass()
    : fail(manualRequired(mission, evidenceStepId, clicked.reviewRequiredReason ?? clicked.message, reachedStep));
}

async function hoverLocated(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonTaxInvoiceDownloadMissionInput,
  evidenceStepId: AmazonTaxInvoiceDownloadEvidenceStepId,
  reachedStep: string,
  element: DomElementRef,
): Promise<StepOutcome> {
  assertEvidenceStepId(evidenceStepId);
  const point = await browser.evaluateActiveTab<{ ok: true; point: { x: number; y: number } } | { ok: false; reason: string }>({
    description: "locate Seller Central hover target point",
    script: `
const selector = ${JSON.stringify(element.selector)};
const parts = selector.split(">>>").map((part) => part.trim()).filter(Boolean);
const hosts = parts.length === 2 ? Array.from(document.querySelectorAll(parts[0])) : [];
if (hosts.length !== 1 || !hosts[0].shadowRoot) return {ok: false, reason: "shadow host not found"};
const matches = Array.from(hosts[0].shadowRoot.querySelectorAll(parts[1]));
if (matches.length !== 1) return {ok: false, reason: "hover selector did not match exactly one element"};
const el = matches[0];
const style = window.getComputedStyle(el);
const rect = el.getBoundingClientRect();
if (style.display === "none" || style.visibility === "hidden" || rect.width === 0 || rect.height === 0) {
  return {ok: false, reason: "hover target is hidden"};
}
return {ok: true, point: {x: Math.round(rect.x + rect.width - 4), y: Math.round(rect.y + rect.height / 2)}};
`,
  });
  if (!point.ok) {
    return fail(manualRequired(mission, evidenceStepId, point.reason, reachedStep));
  }
  if (!browser.move) {
    return fail(manualRequired(mission, evidenceStepId, "Current browser controller does not expose real mouse move for Seller Central hover.", reachedStep));
  }
  const hovered = await browser.move({
    targetLabel: reachedStep,
    coordinateSpace: "browserViewport",
    point: point.point,
  });
  await browser.wait(1_000);
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: `${evidenceStepId} ${reachedStep}`,
    status: hovered.ok ? "success" : "review_required",
    selectedElement: element,
    reason: hovered.ok ? "hovered Seller Central menu right edge" : hovered.message,
  });
  return hovered.ok
    ? pass()
    : fail(manualRequired(mission, evidenceStepId, hovered.message, reachedStep));
}

function manualRequired(
  mission: AmazonTaxInvoiceDownloadMissionInput,
  evidenceStepId: AmazonTaxInvoiceDownloadEvidenceStepId,
  reason: string,
  reachedStep: string,
): AmazonTaxInvoiceDownloadTaskResult {
  assertEvidenceStepId(evidenceStepId);
  return {
    ok: false,
    status: "manual_required",
    reason,
    reachedStep,
    evidenceStepId,
    domTraceRef: `runtime-evidence/amazon-invoice-upload/download-${mission.marketplace}-${mission.requestId ?? "latest"}.jsonl`,
    reviewRequired: true,
  };
}

function pass<T = void>(value?: T, snapshot?: DomSnapshot): StepOutcome<T> {
  return { ok: true, value: value as T, ...(snapshot ? { snapshot } : {}) };
}

function fail<T = void>(failure: AmazonTaxInvoiceDownloadTaskResult): StepOutcome<T> {
  return { ok: false, failure };
}
