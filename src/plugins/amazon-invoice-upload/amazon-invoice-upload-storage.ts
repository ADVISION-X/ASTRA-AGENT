import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { AmazonInvoiceUploadTaskResult } from "./amazon-invoice-upload.flow.js";
import type { AmazonInvoiceUploadStatus } from "./amazon-result-detector.js";
import type { AmazonTaxInvoiceDownloadMissionInput, AmazonInvoiceUploadMissionInput } from "./mission.schema.js";
import { upsertAmazonInvoiceUploadLedgerRecord } from "./amazon-invoice-upload-ledger.js";
import type {
  AmazonInvoiceUploadPdfFile,
  AmazonInvoiceUploadTaskRecord,
  AmazonTaxInvoiceDownloadArtifactMetadata,
  AmazonTaxInvoiceDownloadTaskRecord,
  AmazonTaxInvoiceDownloadTaskResult,
  AmazonTaxInvoiceDownloadStatus,
} from "./amazon-invoice-upload-storage.types.js";

const safeSegment = (value: string): string =>
  value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "invoice";

export function createAmazonInvoiceUploadTaskId(): string {
  return `amazon-invoice-upload_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createAmazonTaxInvoiceDownloadTaskId(): string {
  return `amazon-tax-invoice-download_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function saveApprovedInvoicePdf(input: {
  dataDir: string;
  taskId: string;
  amazonOrderId: string;
  invoiceNo: string;
  file: AmazonInvoiceUploadPdfFile;
}): string {
  const extension = path.extname(input.file.filename).toLowerCase();
  if (extension !== ".pdf" || !input.file.mimeType.toLowerCase().includes("pdf")) {
    throw new Error("invoicePdf must be a PDF file.");
  }
  const invoiceDir = path.join(os.homedir(), "Downloads", "invoice");
  mkdirSync(invoiceDir, { recursive: true });
  const approvedPath = path.join(invoiceDir, `${safeSegment(input.invoiceNo)}.pdf`);
  writeFileSync(approvedPath, input.file.bytes);
  return approvedPath;
}

export function buildReceivedTaskRecord(input: {
  taskId: string;
  mission: AmazonInvoiceUploadMissionInput;
}): AmazonInvoiceUploadTaskRecord {
  const now = new Date().toISOString();
  return {
    taskId: input.taskId,
    mission: input.mission,
    ok: false,
    status: "received",
    reason: "Amazon invoice upload task received.",
    reachedStep: "received",
    amazonOrderId: input.mission.amazonOrderId,
    invoiceNo: input.mission.invoiceNo,
    intervention: { revision: 0, state: "running", reason: null, checkpoint: "received", pending: null, updatedAt: now },
    createdAt: now,
    updatedAt: now,
  };
}

export function updateTaskRecord(
  record: AmazonInvoiceUploadTaskRecord,
  result: AmazonInvoiceUploadTaskResult | { status: AmazonInvoiceUploadStatus; reason: string; reachedStep: string },
): AmazonInvoiceUploadTaskRecord {
  const fullResult = "ok" in result ? result : {
    ok: result.status === "upload_success" || result.status === "already_uploaded",
    status: result.status,
    reason: result.reason,
    reachedStep: result.reachedStep,
    amazonOrderId: record.amazonOrderId,
    invoiceNo: record.invoiceNo,
  };
  return {
    ...record,
    ...fullResult,
    updatedAt: new Date().toISOString(),
  };
}

export function saveTaskStateOnly(dataDir: string, record: AmazonInvoiceUploadTaskRecord): void {
  const taskDir = path.join(dataDir, "plugin-tasks", "amazon-invoice-upload", safeSegment(record.taskId));
  mkdirSync(taskDir, { recursive: true });
  writeFileSync(path.join(taskDir, "task.json"), JSON.stringify(record, null, 2));
}

export function saveTaskRecord(dataDir: string, record: AmazonInvoiceUploadTaskRecord): void {
  saveTaskStateOnly(dataDir, record);
  upsertAmazonInvoiceUploadLedgerRecord(dataDir, record);
}

export function loadTaskRecord(dataDir: string, taskId: string): AmazonInvoiceUploadTaskRecord | null {
  const recordPath = path.join(dataDir, "plugin-tasks", "amazon-invoice-upload", safeSegment(taskId), "task.json");
  if (!existsSync(recordPath)) {
    return null;
  }
  const record = JSON.parse(readFileSync(recordPath, "utf8")) as AmazonInvoiceUploadTaskRecord;
  return record.intervention ? record : { ...record, intervention: { revision: 0, state: "running", reason: null, checkpoint: record.reachedStep, pending: null, updatedAt: record.updatedAt } };
}

export function findLatestTaskRecordForInvoice(input: {
  dataDir: string;
  amazonOrderId: string;
  invoiceNo?: string;
}): AmazonInvoiceUploadTaskRecord | null {
  const tasksDir = path.join(input.dataDir, "plugin-tasks", "amazon-invoice-upload");
  if (!existsSync(tasksDir)) {
    return null;
  }
  const records = readdirSync(tasksDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => loadTaskRecord(input.dataDir, entry.name))
    .filter((record): record is AmazonInvoiceUploadTaskRecord => {
      if (!record || record.amazonOrderId !== input.amazonOrderId) {
        return false;
      }
      return input.invoiceNo ? record.invoiceNo === input.invoiceNo : true;
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  return selectCanonicalUploadTaskRecord(records);
}

function selectCanonicalUploadTaskRecord(
  records: readonly AmazonInvoiceUploadTaskRecord[],
): AmazonInvoiceUploadTaskRecord | null {
  const successful = records.filter((record) =>
    record.status === "upload_success" || record.status === "already_uploaded");
  return (successful[0] ?? records[0]) ?? null;
}

export function buildReceivedDownloadTaskRecord(input: {
  taskId: string;
  mission: AmazonTaxInvoiceDownloadMissionInput;
}): AmazonTaxInvoiceDownloadTaskRecord {
  const now = new Date().toISOString();
  return {
    taskId: input.taskId,
    taskKind: "tax_invoice_download",
    mission: input.mission,
    ok: false,
    status: "received",
    reason: "Amazon tax invoice CSV download task received.",
    reachedStep: "received",
    evidenceStepId: "AID-01",
    callbackStatus: input.mission.callbackUrl ? "pending" : "not_configured",
    ...(input.mission.sourceSystem ? { sourceSystem: input.mission.sourceSystem } : {}),
    ...(input.mission.requestId ? { requestId: input.mission.requestId } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

export function updateDownloadTaskRecord(
  record: AmazonTaxInvoiceDownloadTaskRecord,
  result: AmazonTaxInvoiceDownloadTaskResult | {
    status: AmazonTaxInvoiceDownloadStatus;
    reason: string;
    reachedStep: string;
    evidenceStepId?: string;
  },
): AmazonTaxInvoiceDownloadTaskRecord {
  const fullResult: AmazonTaxInvoiceDownloadTaskResult = "ok" in result ? result : {
    ok: result.status === "completed" || result.status === "artifact_persisted",
    status: result.status,
    reason: result.reason,
    reachedStep: result.reachedStep,
    ...(result.evidenceStepId ? { evidenceStepId: result.evidenceStepId } : {}),
  };
  const artifact = fullResult.downloadArtifactRef ? {
    artifactRef: fullResult.downloadArtifactRef,
    artifactName: fullResult.downloadedFileName ?? "amazon-tax-invoice.csv",
    mimeType: "text/csv" as const,
    fileSize: fullResult.downloadedFileSize ?? 0,
    sha256: fullResult.downloadedFileSha256 ?? "",
    createdAt: fullResult.downloadedAt ?? new Date().toISOString(),
  } : record.artifact;
  return {
    ...record,
    ...fullResult,
    ...(artifact ? { artifact } : {}),
    updatedAt: new Date().toISOString(),
  };
}

export function saveDownloadTaskRecord(dataDir: string, record: AmazonTaxInvoiceDownloadTaskRecord): void {
  const taskDir = path.join(dataDir, "plugin-tasks", "amazon-invoice-upload", "download", safeSegment(record.taskId));
  mkdirSync(taskDir, { recursive: true });
  writeFileSync(path.join(taskDir, "task.json"), JSON.stringify(record, null, 2));
}

export function loadDownloadTaskRecord(dataDir: string, taskId: string): AmazonTaxInvoiceDownloadTaskRecord | null {
  const recordPath = path.join(dataDir, "plugin-tasks", "amazon-invoice-upload", "download", safeSegment(taskId), "task.json");
  if (!existsSync(recordPath)) {
    return null;
  }
  return JSON.parse(readFileSync(recordPath, "utf8")) as AmazonTaxInvoiceDownloadTaskRecord;
}

export function findLatestDownloadTaskRecord(input: {
  dataDir: string;
  marketplace?: string;
  requestId?: string;
}): AmazonTaxInvoiceDownloadTaskRecord | null {
  const tasksDir = path.join(input.dataDir, "plugin-tasks", "amazon-invoice-upload", "download");
  if (!existsSync(tasksDir)) {
    return null;
  }
  const records = readdirSync(tasksDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => loadDownloadTaskRecord(input.dataDir, entry.name))
    .filter((record): record is AmazonTaxInvoiceDownloadTaskRecord => {
      if (!record) return false;
      if (input.marketplace && record.mission.marketplace !== input.marketplace) return false;
      return input.requestId ? record.requestId === input.requestId : true;
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  return records[0] ?? null;
}

export function buildDownloadArtifactMetadata(filePath: string): AmazonTaxInvoiceDownloadArtifactMetadata {
  const stats = statSync(filePath);
  const bytes = readFileSync(filePath);
  return {
    artifactRef: `amazon-invoice-upload/download/${safeSegment(path.basename(filePath))}:${hashFilePath(filePath)}`,
    artifactName: path.basename(filePath),
    mimeType: "text/csv",
    fileSize: stats.size,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    createdAt: stats.mtime.toISOString(),
  };
}

function hashFilePath(filePath: string): string {
  return createHash("sha256").update(filePath).digest("hex").slice(0, 16);
}
