import type { BrowserTargetLease } from "../../lib/browser/browser-authority-api.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import { runAmazonTaxInvoiceDownload } from "./amazon-tax-invoice-download.flow.js";
import {
  AmazonTaxInvoiceDownloadMissionInputSchema,
  type AmazonTaxInvoiceDownloadMissionInput,
} from "./mission.schema.js";
import {
  buildReceivedDownloadTaskRecord,
  createAmazonTaxInvoiceDownloadTaskId,
  findLatestDownloadTaskRecord,
  loadDownloadTaskRecord,
  saveDownloadTaskRecord,
  updateDownloadTaskRecord,
} from "./amazon-invoice-upload-storage.js";
import type {
  AmazonTaxInvoiceDownloadArtifactMetadata,
  AmazonTaxInvoiceDownloadTaskRecord,
} from "./amazon-invoice-upload-storage.types.js";

export async function startAmazonTaxInvoiceDownloadTask(input: {
  browser: BrowserTargetLease;
  runtimeLogger: RuntimeLogger;
  dataDir: string;
  mission: AmazonTaxInvoiceDownloadMissionInput;
}): Promise<AmazonTaxInvoiceDownloadTaskRecord> {
  const mission = AmazonTaxInvoiceDownloadMissionInputSchema.parse(
    input.mission,
  );
  const taskId = createAmazonTaxInvoiceDownloadTaskId();
  const received = buildReceivedDownloadTaskRecord({ taskId, mission });
  saveDownloadTaskRecord(input.dataDir, received);
  const downloading = updateDownloadTaskRecord(received, {
    status: "downloading",
    reason: "Amazon tax invoice CSV download started.",
    reachedStep: "downloading",
    evidenceStepId: "AID-01",
  });
  saveDownloadTaskRecord(input.dataDir, downloading);
  const result = await runAmazonTaxInvoiceDownload(
    input.browser,
    input.runtimeLogger,
    mission,
  ).catch((error: unknown) => ({
    ok: false,
    status: "failed" as const,
    reason: error instanceof Error ? error.message : String(error),
    reachedStep: "download runtime",
    evidenceStepId: "AID-01",
    reviewRequired: true,
  }));
  const completed = updateDownloadTaskRecord(downloading, result);
  saveDownloadTaskRecord(input.dataDir, completed);
  return completed;
}

export function getAmazonTaxInvoiceDownloadTaskStatus(input: {
  dataDir: string;
  taskId: string;
}): AmazonTaxInvoiceDownloadTaskRecord {
  return loadRequiredDownloadTaskRecord(input.dataDir, input.taskId);
}

export function getLatestAmazonTaxInvoiceDownloadTask(input: {
  dataDir: string;
  marketplace?: string;
  requestId?: string;
}): AmazonTaxInvoiceDownloadTaskRecord | null {
  return findLatestDownloadTaskRecord(input);
}

export function getAmazonTaxInvoiceDownloadArtifact(input: {
  dataDir: string;
  taskId: string;
}): AmazonTaxInvoiceDownloadArtifactMetadata | null {
  return (
    loadRequiredDownloadTaskRecord(input.dataDir, input.taskId).artifact ?? null
  );
}

function loadRequiredDownloadTaskRecord(
  dataDir: string,
  taskId: string,
): AmazonTaxInvoiceDownloadTaskRecord {
  const record = loadDownloadTaskRecord(dataDir, taskId);
  if (!record) {
    throw new Error(`Amazon tax invoice download task not found: ${taskId}`);
  }
  return record;
}
