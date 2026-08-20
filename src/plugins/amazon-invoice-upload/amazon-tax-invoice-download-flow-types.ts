import type { BrowserTargetLease } from "../../lib/browser/browser-authority-api.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import type { DomSnapshot } from "../../types/dom-automation.js";
import type { AmazonTaxInvoiceDownloadTaskResult } from "./amazon-invoice-upload-storage.types.js";
import type { AmazonTaxInvoiceDownloadEvidenceStepId } from "./amazon-tax-invoice-download-evidence.js";
import type { AmazonTaxInvoiceDownloadMissionInput } from "./mission.schema.js";

export type StepOutcome<T = void> =
  | { ok: true; value: T; snapshot?: DomSnapshot }
  | { ok: false; failure: AmazonTaxInvoiceDownloadTaskResult };

export type DownloadStep = {
  evidenceStepId: AmazonTaxInvoiceDownloadEvidenceStepId;
  reachedStep: string;
  run: (
    browser: BrowserTargetLease,
    runtimeLogger: RuntimeLogger,
    mission: AmazonTaxInvoiceDownloadMissionInput,
  ) => Promise<StepOutcome>;
};
