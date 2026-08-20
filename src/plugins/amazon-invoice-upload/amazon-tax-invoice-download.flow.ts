import type { BrowserTargetLease } from "../../lib/browser/browser-authority-api.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import { fail } from "./amazon-tax-invoice-download-flow-actions.js";
import type {
  DownloadStep,
  StepOutcome,
} from "./amazon-tax-invoice-download-flow-types.js";
import {
  chooseReportsMenu,
  openAfnShipmentInvoicingReport,
  openFulfillmentReports,
  openGlobalMenu,
  openSellerCentralHome,
} from "./amazon-tax-invoice-download-flow-navigation.js";
import {
  requestCsvDownload,
  selectLast30Days,
  waitLatestReportDownloadReady,
} from "./amazon-tax-invoice-download-flow-report.js";
import type { AmazonTaxInvoiceDownloadTaskResult } from "./amazon-invoice-upload-storage.types.js";
import {
  AmazonTaxInvoiceDownloadMissionInputSchema,
  type AmazonTaxInvoiceDownloadMissionInput,
} from "./mission.schema.js";
import {
  listDownloadFiles,
  verifyLocalDownloadArtifact,
  type FileCandidate,
} from "./amazon-tax-invoice-download-local-artifact.js";
import { clickLatestReportDownload } from "./amazon-tax-invoice-download-flow-actions.js";

export async function runAmazonTaxInvoiceDownload(
  browser: BrowserTargetLease,
  runtimeLogger: RuntimeLogger,
  rawMission: AmazonTaxInvoiceDownloadMissionInput,
): Promise<AmazonTaxInvoiceDownloadTaskResult> {
  const mission = AmazonTaxInvoiceDownloadMissionInputSchema.parse(rawMission);
  const baselineFiles = listDownloadFiles();
  const initialFailure = await runInitialDownloadSteps(
    browser,
    runtimeLogger,
    mission,
  );
  if (initialFailure) return initialFailure;
  const requested = await runDownloadStep(
    {
      evidenceStepId: "AID-07",
      reachedStep: "request csv download",
      run: requestCsvDownload,
    },
    browser,
    runtimeLogger,
    mission,
  );
  if (!requested.ok) return requested.failure;
  const ready = await runDownloadStep(
    {
      evidenceStepId: "AID-08",
      reachedStep: "wait latest report download ready",
      run: waitLatestReportDownloadReady,
    },
    browser,
    runtimeLogger,
    mission,
  );
  if (!ready.ok) return ready.failure;
  const clicked = await runDownloadStep(
    {
      evidenceStepId: "AID-10",
      reachedStep: "click latest report download",
      run: (browserArg, runtimeLoggerArg, missionArg) =>
        clickLatestReportDownload(
          browserArg,
          runtimeLoggerArg,
          missionArg,
          baselineFiles,
        ),
    },
    browser,
    runtimeLogger,
    mission,
  );
  if (!clicked.ok) return clicked.failure;
  return verifyLocalDownloadArtifact(runtimeLogger, mission, clicked.value);
}

async function runInitialDownloadSteps(
  browser: BrowserTargetLease,
  runtimeLogger: RuntimeLogger,
  mission: AmazonTaxInvoiceDownloadMissionInput,
): Promise<AmazonTaxInvoiceDownloadTaskResult | null> {
  for (const step of [
    {
      evidenceStepId: "AID-01",
      reachedStep: "open seller central home",
      run: openSellerCentralHome,
    },
    {
      evidenceStepId: "AID-02",
      reachedStep: "open global menu",
      run: openGlobalMenu,
    },
    {
      evidenceStepId: "AID-03",
      reachedStep: "choose reports menu",
      run: chooseReportsMenu,
    },
    {
      evidenceStepId: "AID-04",
      reachedStep: "open fulfillment reports",
      run: openFulfillmentReports,
    },
    {
      evidenceStepId: "AID-05",
      reachedStep: "open tax invoice report",
      run: openAfnShipmentInvoicingReport,
    },
    {
      evidenceStepId: "AID-06",
      reachedStep: "choose event date last 30 days",
      run: selectLast30Days,
    },
  ] satisfies DownloadStep[]) {
    const result = await runDownloadStep(step, browser, runtimeLogger, mission);
    if (!result.ok) return result.failure;
  }
  return null;
}

async function runDownloadStep<T = void>(
  step: Omit<DownloadStep, "run"> & {
    run: (
      browser: BrowserTargetLease,
      runtimeLogger: RuntimeLogger,
      mission: AmazonTaxInvoiceDownloadMissionInput,
    ) => Promise<StepOutcome<T>>;
  },
  browser: BrowserTargetLease,
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
      runtimeLogRef: "runtime-logs/workbench.jsonl",
      reviewRequired: true,
    });
  }
}
