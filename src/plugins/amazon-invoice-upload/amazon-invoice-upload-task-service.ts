import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import { runAmazonInvoiceUpload } from "./amazon-invoice-upload.flow.js";
import { runAmazonTaxInvoiceDownload } from "./amazon-tax-invoice-download.flow.js";
import { listAmazonInvoiceUploadLedgerRecords } from "./amazon-invoice-upload-ledger.js";
import { AmazonInvoiceUploadMissionInputSchema, AmazonTaxInvoiceDownloadMissionInputSchema } from "./mission.schema.js";
import type { AmazonInvoiceUploadMissionInput, AmazonTaxInvoiceDownloadMissionInput } from "./mission.schema.js";
import {
  buildReceivedDownloadTaskRecord,
  buildReceivedTaskRecord,
  createAmazonInvoiceUploadTaskId,
  createAmazonTaxInvoiceDownloadTaskId,
  findLatestDownloadTaskRecord,
  findLatestTaskRecordForInvoice,
  loadDownloadTaskRecord,
  loadTaskRecord,
  saveApprovedInvoicePdf,
  saveDownloadTaskRecord,
  saveTaskRecord,
  updateDownloadTaskRecord,
  updateTaskRecord,
} from "./amazon-invoice-upload-storage.js";
import type {
  AmazonInvoiceUploadPdfFile,
  AmazonInvoiceUploadTaskRecord,
  AmazonTaxInvoiceDownloadArtifactMetadata,
  AmazonTaxInvoiceDownloadTaskRecord,
} from "./amazon-invoice-upload-storage.types.js";
import {
  AmazonInvoiceUploadAdminOpenInputSchema,
  type AmazonInvoiceUploadAdminOpenInput,
  type AmazonInvoiceUploadAdminOpenResult,
  type AmazonInvoiceUploadMissionStartResult,
  type AmazonInvoiceUploadTaskStartInput,
} from "./amazon-invoice-upload-task-service.types.js";
import type { AmazonInvoiceUploadLedgerRecord } from "./amazon-invoice-upload-ledger.js";

const DEFAULT_ALLOWED_ADMIN_HOSTS = ["localhost", "127.0.0.1"] as const;

export async function openAmazonInvoiceAdminPage(
  browser: BrowserController,
  rawInput: AmazonInvoiceUploadAdminOpenInput,
): Promise<AmazonInvoiceUploadAdminOpenResult> {
  const input = AmazonInvoiceUploadAdminOpenInputSchema.parse(rawInput);
  const adminUrl = new URL(input.adminUrl);
  if (!isAllowedAmazonAdminUrl(adminUrl)) {
    return {
      ok: false,
      currentUrl: browser.getSessionState().currentUrl,
      error: "admin_url_not_allowed",
      failureReason: "Admin URL must target an allowed local development host over http or https.",
    };
  }

  const openResult = await browser.open({
    url: adminUrl.toString(),
    title: "Amazon Manage invoice workspace",
  });
  const currentUrl = browser.getSessionState().currentUrl;
  if (!openResult.ok) {
    return {
      ok: false,
      currentUrl,
      error: "admin_open_failed",
      failureReason: openResult.message,
    };
  }

  return {
    ok: true,
    currentUrl,
    error: null,
    failureReason: null,
  };
}

export async function startAmazonInvoiceUploadMission(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  rawInput: AmazonInvoiceUploadMissionInput,
): Promise<AmazonInvoiceUploadMissionStartResult> {
  const input = AmazonInvoiceUploadMissionInputSchema.parse(rawInput);
  return runAmazonInvoiceUpload(browser, runtimeLogger, input);
}

export async function startAmazonInvoiceUploadTask(input: {
  browser: BrowserController;
  runtimeLogger: RuntimeLogger;
  dataDir: string;
  task: AmazonInvoiceUploadTaskStartInput;
}): Promise<AmazonInvoiceUploadTaskRecord> {
  const mission = AmazonInvoiceUploadMissionInputSchema.parse(input.task.mission);
  const taskId = createAmazonInvoiceUploadTaskId();
  const approvedPath = saveApprovedInvoicePdf({
    dataDir: input.dataDir,
    taskId,
    amazonOrderId: mission.amazonOrderId,
    invoiceNo: mission.invoiceNo,
    file: input.task.invoicePdf,
  });
  const approvedMission = { ...mission, invoicePdfPath: approvedPath };
  const received = buildReceivedTaskRecord({ taskId, mission: approvedMission });
  saveTaskRecord(input.dataDir, received);
  const uploading = updateTaskRecord(received, {
    status: "uploading",
    reason: "Amazon invoice upload started.",
    reachedStep: "uploading",
  });
  saveTaskRecord(input.dataDir, uploading);
  const result = await runAmazonInvoiceUpload(input.browser, input.runtimeLogger, approvedMission);
  const completed = updateTaskRecord(uploading, result);
  saveTaskRecord(input.dataDir, completed);
  return completed;
}

export async function resumeAmazonInvoiceUploadTask(input: {
  browser: BrowserController;
  runtimeLogger: RuntimeLogger;
  dataDir: string;
  taskId: string;
}): Promise<AmazonInvoiceUploadTaskRecord> {
  const record = loadRequiredTaskRecord(input.dataDir, input.taskId);
  const resumed = updateTaskRecord(record, {
    status: "uploading",
    reason: "Amazon invoice upload resumed.",
    reachedStep: "resume",
  });
  saveTaskRecord(input.dataDir, resumed);
  const result = await runAmazonInvoiceUpload(input.browser, input.runtimeLogger, record.mission);
  const completed = updateTaskRecord(resumed, result);
  saveTaskRecord(input.dataDir, completed);
  return completed;
}

export function getAmazonInvoiceUploadTaskStatus(input: {
  dataDir: string;
  taskId: string;
}): AmazonInvoiceUploadTaskRecord {
  return loadRequiredTaskRecord(input.dataDir, input.taskId);
}

export function getLatestAmazonInvoiceUploadTaskForInvoice(input: {
  dataDir: string;
  amazonOrderId: string;
  invoiceNo?: string;
}): AmazonInvoiceUploadTaskRecord | null {
  return findLatestTaskRecordForInvoice(input);
}

export function listAmazonInvoiceUploadLedger(input: {
  dataDir: string;
}): AmazonInvoiceUploadLedgerRecord[] {
  return listAmazonInvoiceUploadLedgerRecords(input.dataDir);
}

export async function startAmazonTaxInvoiceDownloadTask(input: {
  browser: BrowserController;
  runtimeLogger: RuntimeLogger;
  dataDir: string;
  mission: AmazonTaxInvoiceDownloadMissionInput;
}): Promise<AmazonTaxInvoiceDownloadTaskRecord> {
  const mission = AmazonTaxInvoiceDownloadMissionInputSchema.parse(input.mission);
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
  const result = await runAmazonTaxInvoiceDownload(input.browser, input.runtimeLogger, mission).catch((error: unknown) => ({
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
  return loadRequiredDownloadTaskRecord(input.dataDir, input.taskId).artifact ?? null;
}

function isAllowedAmazonAdminUrl(url: URL): boolean {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return false;
  }

  return getAllowedAmazonAdminHosts().has(url.hostname.toLowerCase());
}

function getAllowedAmazonAdminHosts(): Set<string> {
  const configuredHosts = process.env.GRASSEYE_AMAZON_ADMIN_ALLOWED_HOSTS
    ?.split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return new Set(configuredHosts && configuredHosts.length > 0 ? configuredHosts : DEFAULT_ALLOWED_ADMIN_HOSTS);
}

function loadRequiredTaskRecord(dataDir: string, taskId: string): AmazonInvoiceUploadTaskRecord {
  const record = loadTaskRecord(dataDir, taskId);
  if (!record) {
    throw new Error(`Amazon invoice upload task not found: ${taskId}`);
  }
  return record;
}

function loadRequiredDownloadTaskRecord(dataDir: string, taskId: string): AmazonTaxInvoiceDownloadTaskRecord {
  const record = loadDownloadTaskRecord(dataDir, taskId);
  if (!record) {
    throw new Error(`Amazon tax invoice download task not found: ${taskId}`);
  }
  return record;
}
