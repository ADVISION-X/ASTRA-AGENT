import type { BrowserTargetLease } from "../../lib/browser/browser-authority-api.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import type { DomElementRef, DomSnapshot } from "../../types/dom-automation.js";
import { recordAmazonDomStepTrace } from "./amazon-dom-step-trace.js";
import { clickElement } from "./amazon-invoice-upload-flow-support.js";
import type { AmazonTaxInvoiceDownloadTaskResult } from "./amazon-invoice-upload-storage.types.js";
import type { AmazonTaxInvoiceDownloadEvidenceStepId } from "./amazon-tax-invoice-download-evidence.js";
import {
  waitForNewDownloadFile,
  type FileCandidate,
} from "./amazon-tax-invoice-download-local-artifact.js";
import {
  assertEvidenceStepId,
  readSnapshotAndTrace,
} from "./amazon-tax-invoice-download-runtime-helpers.js";
import {
  findSellerCentralLatestReportDownloadPoint,
  locate,
} from "./amazon-tax-invoice-download-page-state.js";
import type { StepOutcome } from "./amazon-tax-invoice-download-flow-types.js";
import type { AmazonTaxInvoiceDownloadMissionInput } from "./mission.schema.js";

export async function clickLatestReportDownload(
  browser: BrowserTargetLease,
  runtimeLogger: RuntimeLogger,
  mission: AmazonTaxInvoiceDownloadMissionInput,
  baselineFiles: FileCandidate[],
): Promise<StepOutcome<string>> {
  const snapshot = await readSnapshotAndTrace(
    browser,
    runtimeLogger,
    mission,
    "AID-10",
    "locate latest report download",
  );
  if (snapshot.url.includes("sellercentral.amazon.")) {
    const target = await findSellerCentralLatestReportDownloadPoint(browser);
    if (!target.ok)
      return fail(
        manualRequired(
          mission,
          "AID-10",
          target.reason,
          "locate latest report download",
        ),
      );
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
      reason: clicked.ok
        ? "clicked Seller Central latest report row download button"
        : clicked.message,
    });
    if (!clicked.ok)
      return fail(
        manualRequired(
          mission,
          "AID-10",
          clicked.message,
          "click latest report download",
        ),
      );
    return downloadedArtifactOrFailure(baselineFiles, mission);
  }
  const download = locate(snapshot, "button", ["下载"]);
  if (!download.ok)
    return fail(
      manualRequired(
        mission,
        "AID-10",
        download.reason,
        "locate latest report download",
      ),
    );
  const clicked = await clickLocated(
    browser,
    runtimeLogger,
    mission,
    "AID-10",
    "click latest report download",
    download.element,
  );
  if (!clicked.ok) return clicked;
  return downloadedArtifactOrFailure(baselineFiles, mission);
}

async function downloadedArtifactOrFailure(
  baselineFiles: FileCandidate[],
  mission: AmazonTaxInvoiceDownloadMissionInput,
): Promise<StepOutcome<string>> {
  const artifactPath = await waitForNewDownloadFile(baselineFiles);
  return artifactPath
    ? pass(artifactPath)
    : fail(
        manualRequired(
          mission,
          "AID-11",
          "No new local Downloads file appeared after clicking the latest report download.",
          "verify local download artifact",
        ),
      );
}

export async function clickLocated(
  browser: BrowserTargetLease,
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
    reason: clicked.ok
      ? clicked.message
      : (clicked.reviewRequiredReason ?? clicked.message),
    evidenceRef: clicked.afterEvidenceRef ?? clicked.beforeEvidenceRef,
  });
  return clicked.ok
    ? pass()
    : fail(
        manualRequired(
          mission,
          evidenceStepId,
          clicked.reviewRequiredReason ?? clicked.message,
          reachedStep,
        ),
      );
}

export async function hoverLocated(
  browser: BrowserTargetLease,
  runtimeLogger: RuntimeLogger,
  mission: AmazonTaxInvoiceDownloadMissionInput,
  evidenceStepId: AmazonTaxInvoiceDownloadEvidenceStepId,
  reachedStep: string,
  element: DomElementRef,
): Promise<StepOutcome> {
  assertEvidenceStepId(evidenceStepId);
  const point = await browser.evaluate<
    | { ok: true; point: { x: number; y: number } }
    | { ok: false; reason: string }
  >({
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
    return fail(
      manualRequired(mission, evidenceStepId, point.reason, reachedStep),
    );
  }
  if (!browser.move) {
    return fail(
      manualRequired(
        mission,
        evidenceStepId,
        "Current browser controller does not expose real mouse move for Seller Central hover.",
        reachedStep,
      ),
    );
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
    reason: hovered.ok
      ? "hovered Seller Central menu right edge"
      : hovered.message,
  });
  return hovered.ok
    ? pass()
    : fail(
        manualRequired(mission, evidenceStepId, hovered.message, reachedStep),
      );
}

export function manualRequired(
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
    runtimeLogRef: "runtime-logs/workbench.jsonl",
    reviewRequired: true,
  };
}

export function pass<T = void>(value?: T, snapshot?: DomSnapshot): StepOutcome<T> {
  return { ok: true, value: value as T, ...(snapshot ? { snapshot } : {}) };
}

export function fail<T = void>(
  failure: AmazonTaxInvoiceDownloadTaskResult,
): StepOutcome<T> {
  return { ok: false, failure };
}
