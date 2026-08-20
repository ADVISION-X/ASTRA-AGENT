import type { BrowserTargetLease } from "../../lib/browser/browser-authority-api.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import type { DomSnapshot } from "../../types/dom-automation.js";
import { recordAmazonDomStepTrace } from "./amazon-dom-step-trace.js";
import {
  readSnapshot,
  verifyState,
} from "./amazon-invoice-upload-flow-support.js";
import type { AmazonTaxInvoiceDownloadTaskResult } from "./amazon-invoice-upload-storage.types.js";
import type { AmazonTaxInvoiceDownloadMissionInput } from "./mission.schema.js";
import {
  AMAZON_TAX_INVOICE_DOWNLOAD_EVIDENCE_STEP_IDS,
  type AmazonTaxInvoiceDownloadEvidenceStepId,
} from "./amazon-tax-invoice-download-evidence.js";
import { TAX_DOWNLOAD_SNAPSHOT_TEXT_LIMIT } from "./amazon-tax-invoice-download-page-state.js";

const evidenceStepIdSet = new Set<string>(
  AMAZON_TAX_INVOICE_DOWNLOAD_EVIDENCE_STEP_IDS,
);

export const assertEvidenceStepId = (
  evidenceStepId: AmazonTaxInvoiceDownloadEvidenceStepId,
): AmazonTaxInvoiceDownloadEvidenceStepId => {
  if (!evidenceStepIdSet.has(evidenceStepId)) {
    throw new Error(
      `Unknown Amazon tax invoice evidence step: ${evidenceStepId}`,
    );
  }
  return evidenceStepId;
};

export const readSnapshotAndTrace = async (
  browser: BrowserTargetLease,
  runtimeLogger: RuntimeLogger,
  mission: AmazonTaxInvoiceDownloadMissionInput,
  evidenceStepId: AmazonTaxInvoiceDownloadEvidenceStepId,
  stepName: string,
): Promise<DomSnapshot> => {
  assertEvidenceStepId(evidenceStepId);
  const snapshot = await readSnapshot(browser, {
    includeFrames: false,
    maxTextLengthPerNode: TAX_DOWNLOAD_SNAPSHOT_TEXT_LIMIT,
  });
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: `${evidenceStepId} ${stepName}`,
    status: "snapshot",
    snapshot,
  });
  return snapshot;
};

export const gatedDownloadResult = (
  snapshot: DomSnapshot,
  mission: AmazonTaxInvoiceDownloadMissionInput,
  evidenceStepId: AmazonTaxInvoiceDownloadEvidenceStepId,
  reachedStep: string,
): AmazonTaxInvoiceDownloadTaskResult | null => {
  assertEvidenceStepId(evidenceStepId);
  const gate = verifyState({
    snapshot,
    expectedStates: ["login-required", "captcha-or-2fa-required"],
    successHints: [],
    failureHints: [],
  });
  if (
    gate.status !== "login_required" &&
    gate.status !== "captcha_or_2fa_required"
  ) {
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
};

export const currentUrlOrEntry = (
  snapshot: DomSnapshot,
  mission: AmazonTaxInvoiceDownloadMissionInput,
): string => snapshot.url || mission.sellerCentralEntryUrl;
