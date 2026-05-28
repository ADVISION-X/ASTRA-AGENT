import { existsSync, readdirSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import type { DomElementRef, DomSnapshot } from "../../types/dom-automation.js";
import { recordAmazonDomStepTrace } from "./amazon-dom-step-trace.js";
import {
  clickElement,
  locateElement,
  readSnapshot,
  verifyState,
} from "./amazon-invoice-upload-flow-support.js";
import { buildDownloadArtifactMetadata } from "./amazon-invoice-upload-storage.js";
import type {
  AmazonTaxInvoiceDownloadTaskResult,
} from "./amazon-invoice-upload-storage.types.js";
import {
  AmazonTaxInvoiceDownloadMissionInputSchema,
  type AmazonTaxInvoiceDownloadMissionInput,
} from "./mission.schema.js";
import {
  AMAZON_TAX_INVOICE_DOWNLOAD_EVIDENCE_STEP_IDS,
  type AmazonTaxInvoiceDownloadEvidenceStepId,
} from "./amazon-tax-invoice-download-evidence.js";

const TAX_REPORT_URL_PATH = "/reportcentral/AFNShipmentInvoicingReport/1";
const WAIT_REPORT_READY_TIMEOUT_MS = 180_000;
const WAIT_REPORT_READY_POLL_MS = 15_000;
const WAIT_DOWNLOAD_FILE_TIMEOUT_MS = 30_000;
const WAIT_DOWNLOAD_FILE_POLL_MS = 1_000;
const evidenceStepIdSet = new Set<string>(AMAZON_TAX_INVOICE_DOWNLOAD_EVIDENCE_STEP_IDS);

type StepOutcome<T = void> =
  | { ok: true; value: T; snapshot?: DomSnapshot }
  | { ok: false; failure: AmazonTaxInvoiceDownloadTaskResult };

type FileCandidate = {
  path: string;
  mtimeMs: number;
  size: number;
};

export async function runAmazonTaxInvoiceDownload(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  rawMission: AmazonTaxInvoiceDownloadMissionInput,
): Promise<AmazonTaxInvoiceDownloadTaskResult> {
  const mission = AmazonTaxInvoiceDownloadMissionInputSchema.parse(rawMission);
  const baselineFiles = listDownloadFiles();

  for (const step of [
    openSellerCentralHome,
    openGlobalMenu,
    chooseReportsMenu,
    openFulfillmentReports,
    openAfnShipmentInvoicingReport,
    selectLast30Days,
    requestCsvDownload,
  ] as const) {
    const result = await step(browser, runtimeLogger, mission);
    if (!result.ok) return result.failure;
  }

  const ready = await waitLatestReportDownloadReady(browser, runtimeLogger, mission);
  if (!ready.ok) return ready.failure;
  const clicked = await clickLatestReportDownload(browser, runtimeLogger, mission, baselineFiles);
  if (!clicked.ok) return clicked.failure;
  return verifyLocalDownloadArtifact(runtimeLogger, mission, clicked.value);
}

async function openSellerCentralHome(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonTaxInvoiceDownloadMissionInput,
): Promise<StepOutcome> {
  await browser.open({ url: mission.sellerCentralEntryUrl, title: "Amazon Seller Central tax invoice download entry" });
  const snapshot = await readSnapshotAndTrace(browser, runtimeLogger, mission, "AID-01", "open seller central home");
  const gate = gatedDownloadResult(snapshot, mission, "AID-01", "open seller central home");
  if (gate) return fail(gate);
  return snapshotHasAnyText(snapshot, ["亚马逊", "Amazon", "搜索", "NEXGEN"])
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
  const menu = locate(snapshot, "clickable", ["目录", "menu", "navigation", "nav", "报告"]);
  if (!menu.ok) return fail(manualRequired(mission, "AID-02", menu.reason, "locate global menu"));
  const clicked = await clickLocated(browser, runtimeLogger, mission, "AID-02", "open global menu", menu.element);
  if (!clicked.ok) return clicked;
  const after = await readSnapshotAndTrace(browser, runtimeLogger, mission, "AID-02", "verify global menu opened");
  return snapshotHasAnyText(after, ["目录", "库存", "订单", "报告"])
    ? pass(undefined, after)
    : fail(manualRequired(mission, "AID-02", "Global menu did not expose the empirically observed menu headings.", "open global menu"));
}

async function chooseReportsMenu(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonTaxInvoiceDownloadMissionInput,
): Promise<StepOutcome> {
  const snapshot = await readSnapshotAndTrace(browser, runtimeLogger, mission, "AID-03", "locate reports menu");
  const reports = locate(snapshot, "clickable", ["报告"]);
  if (!reports.ok) return fail(manualRequired(mission, "AID-03", reports.reason, "locate reports menu"));
  const clicked = await clickLocated(browser, runtimeLogger, mission, "AID-03", "choose reports menu", reports.element);
  if (!clicked.ok) return clicked;
  const after = await readSnapshotAndTrace(browser, runtimeLogger, mission, "AID-03", "verify reports submenu");
  return snapshotHasAnyText(after, ["业务报告", "配送", "Tax Document Library", "管理税费"])
    ? pass(undefined, after)
    : fail(manualRequired(mission, "AID-03", "Reports submenu did not expose fulfillment report links.", "choose reports menu"));
}

async function openFulfillmentReports(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonTaxInvoiceDownloadMissionInput,
): Promise<StepOutcome> {
  const snapshot = await readSnapshotAndTrace(browser, runtimeLogger, mission, "AID-04", "locate fulfillment reports");
  const fulfillment = locate(snapshot, "link", ["配送", "/reportcentral/ref=xx_fbareports_dnav_xx"]);
  if (!fulfillment.ok) return fail(manualRequired(mission, "AID-04", fulfillment.reason, "locate fulfillment reports"));
  const clicked = await clickLocated(browser, runtimeLogger, mission, "AID-04", "open fulfillment reports", fulfillment.element);
  if (!clicked.ok) return clicked;
  const after = await readSnapshotAndTrace(browser, runtimeLogger, mission, "AID-04", "verify fulfillment reports page");
  return snapshotHasAnyText(after, ["配送报告", "亚马逊配送报告", "亚马逊配送货件"])
    ? pass(undefined, after)
    : fail(manualRequired(mission, "AID-04", "Fulfillment reports page did not expose observed report headings.", "open fulfillment reports"));
}

async function openAfnShipmentInvoicingReport(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonTaxInvoiceDownloadMissionInput,
): Promise<StepOutcome> {
  const snapshot = await readSnapshotAndTrace(browser, runtimeLogger, mission, "AID-05", "locate tax invoice report");
  const report = locate(snapshot, "link", ["亚马逊配送货件", "税务发票", TAX_REPORT_URL_PATH]);
  if (!report.ok) return fail(manualRequired(mission, "AID-05", report.reason, "locate tax invoice report"));
  const clicked = await clickLocated(browser, runtimeLogger, mission, "AID-05", "open tax invoice report", report.element);
  if (!clicked.ok) return clicked;
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
  const csvButton = locate(snapshot, "button", ["请求下载 .csv 文件", "CSV"]);
  if (!csvButton.ok) return fail(manualRequired(mission, "AID-07", csvButton.reason, "locate request csv button"));
  const clicked = await clickLocated(browser, runtimeLogger, mission, "AID-07", "request csv download", csvButton.element);
  if (!clicked.ok) return clicked;
  await browser.wait(3_000);
  const after = await readSnapshotAndTrace(browser, runtimeLogger, mission, "AID-07", "verify csv request row");
  return firstReportRowText(after).includes(".csv")
    ? pass(undefined, after)
    : fail(manualRequired(mission, "AID-07", "CSV request did not create an observed .csv report row.", "request csv download"));
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
    if (rowText.includes("亚马逊配送货件") && rowText.includes(".csv") && rowText.includes("下载")) {
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
  return rowText.includes("亚马逊配送货件") && rowText.includes(".csv") && rowText.includes("下载")
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
  const download = locate(snapshot, "button", ["下载"]);
  if (!download.ok) return fail(manualRequired(mission, "AID-10", download.reason, "locate latest report download"));
  const clicked = await clickLocated(browser, runtimeLogger, mission, "AID-10", "click latest report download", download.element);
  if (!clicked.ok) return clicked;
  const artifactPath = await waitForNewDownloadFile(baselineFiles);
  return artifactPath
    ? pass(artifactPath)
    : fail(manualRequired(mission, "AID-11", "No new local Downloads file appeared after clicking the latest report download.", "verify local download artifact"));
}

function verifyLocalDownloadArtifact(
  runtimeLogger: RuntimeLogger,
  mission: AmazonTaxInvoiceDownloadMissionInput,
  filePath: string,
): AmazonTaxInvoiceDownloadTaskResult {
  const metadata = buildDownloadArtifactMetadata(filePath);
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "AID-11 verify local download artifact",
    status: "success",
    reason: `Downloaded artifact persisted as ${metadata.artifactName}.`,
  });
  return {
    ok: true,
    status: "completed",
    reason: "Amazon tax invoice CSV download completed and safe artifact metadata was persisted.",
    reachedStep: "verify local download artifact",
    evidenceStepId: "AID-11",
    downloadArtifactRef: metadata.artifactRef,
    downloadedFileName: metadata.artifactName,
    downloadedFileSize: metadata.fileSize,
    downloadedFileSha256: metadata.sha256,
    downloadedAt: metadata.createdAt,
    domTraceRef: "runtime-evidence/amazon-invoice-upload/download.jsonl",
  };
}

async function readSnapshotAndTrace(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonTaxInvoiceDownloadMissionInput,
  evidenceStepId: AmazonTaxInvoiceDownloadEvidenceStepId,
  stepName: string,
): Promise<DomSnapshot> {
  assertEvidenceStepId(evidenceStepId);
  const snapshot = await readSnapshot(browser);
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: `${evidenceStepId} ${stepName}`,
    status: "snapshot",
    snapshot,
  });
  return snapshot;
}

function gatedDownloadResult(
  snapshot: DomSnapshot,
  mission: AmazonTaxInvoiceDownloadMissionInput,
  evidenceStepId: AmazonTaxInvoiceDownloadEvidenceStepId,
  reachedStep: string,
): AmazonTaxInvoiceDownloadTaskResult | null {
  assertEvidenceStepId(evidenceStepId);
  const gate = verifyState({
    snapshot,
    expectedStates: ["login-required", "captcha-or-2fa-required"],
    successHints: [],
    failureHints: [],
  });
  if (gate.status !== "login_required" && gate.status !== "captcha_or_2fa_required") {
    return null;
  }
  return {
    ok: false,
    status: "manual_required",
    reason: gate.reason,
    reachedStep,
    evidenceStepId,
    evidenceRef: gate.evidenceRef,
    reviewRequired: true,
  };
}

function locate(
  snapshot: DomSnapshot,
  targetKind: DomElementRef["targetKind"],
  hints: string[],
): { ok: true; element: DomElementRef } | { ok: false; reason: string } {
  const element = locateElement({ snapshot, targetKind, hints });
  if (element.elementRef.startsWith("dom:unresolved:")) {
    return { ok: false, reason: element.reason };
  }
  return { ok: true, element };
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

function assertEvidenceStepId(
  evidenceStepId: AmazonTaxInvoiceDownloadEvidenceStepId,
): AmazonTaxInvoiceDownloadEvidenceStepId {
  if (!evidenceStepIdSet.has(evidenceStepId)) {
    throw new Error(`Unknown Amazon tax invoice evidence step: ${evidenceStepId}`);
  }
  return evidenceStepId;
}

function snapshotHasAnyText(snapshot: DomSnapshot, needles: string[]): boolean {
  const haystack = [
    snapshot.title,
    ...snapshot.inputs.map(compactElementText),
    ...snapshot.buttons.map(compactElementText),
    ...snapshot.links.map(compactElementText),
    ...snapshot.textBlocks.map(compactElementText),
    ...snapshot.tableRows.map(compactElementText),
    ...snapshot.roleRows.map(compactElementText),
    ...snapshot.genericClickableElements.map(compactElementText),
    ...snapshot.dropdownTriggers.map(compactElementText),
  ].join(" ");
  return needles.some((needle) => haystack.includes(needle));
}

function firstReportRowText(snapshot: DomSnapshot): string {
  const rows = [...snapshot.tableRows, ...snapshot.roleRows];
  return compactElementText(rows.find((row) => compactElementText(row).includes("亚马逊配送货件")) ?? rows[0]);
}

function compactElementText(input: {
  visibleText?: string | undefined;
  ariaLabel?: string | undefined;
  labelText?: string | undefined;
  nearbyText?: string | undefined;
  placeholder?: string | undefined;
  selectorCandidate?: string | undefined;
} | undefined): string {
  if (!input) return "";
  return [
    input.visibleText,
    input.ariaLabel,
    input.labelText,
    input.nearbyText,
    input.placeholder,
    input.selectorCandidate,
  ].filter(Boolean).join(" ");
}

function currentUrlOrEntry(snapshot: DomSnapshot, mission: AmazonTaxInvoiceDownloadMissionInput): string {
  return snapshot.url || mission.sellerCentralEntryUrl;
}

function pass<T = void>(value?: T, snapshot?: DomSnapshot): StepOutcome<T> {
  return { ok: true, value: value as T, ...(snapshot ? { snapshot } : {}) };
}

function fail<T = void>(failure: AmazonTaxInvoiceDownloadTaskResult): StepOutcome<T> {
  return { ok: false, failure };
}

function listDownloadFiles(): FileCandidate[] {
  const downloadsDir = path.join(os.homedir(), "Downloads");
  if (!existsSync(downloadsDir)) return [];
  return readdirSync(downloadsDir)
    .filter((name) => !name.endsWith(".crdownload") && !name.endsWith(".download"))
    .map((name) => path.join(downloadsDir, name))
    .filter((filePath) => existsSync(filePath))
    .map((filePath) => {
      const stats = statSync(filePath);
      return { path: filePath, mtimeMs: stats.mtimeMs, size: stats.size };
    });
}

async function waitForNewDownloadFile(baselineFiles: FileCandidate[]): Promise<string | null> {
  const baseline = new Map(baselineFiles.map((file) => [file.path, `${file.mtimeMs}:${file.size}`]));
  const startedAt = Date.now();
  while (Date.now() - startedAt <= WAIT_DOWNLOAD_FILE_TIMEOUT_MS) {
    const current = listDownloadFiles()
      .filter((file) => file.size > 0)
      .filter((file) => baseline.get(file.path) !== `${file.mtimeMs}:${file.size}`)
      .sort((left, right) => right.mtimeMs - left.mtimeMs);
    if (current[0]) return current[0].path;
    await new Promise((resolve) => setTimeout(resolve, WAIT_DOWNLOAD_FILE_POLL_MS));
  }
  return null;
}
