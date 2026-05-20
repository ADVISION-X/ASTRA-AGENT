import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { AmazonInvoiceUploadMissionInput } from "./mission.schema.js";
import type { AmazonInvoiceUploadTaskResult } from "./amazon-invoice-upload.flow.js";
import type { AmazonInvoiceUploadStatus } from "./amazon-result-detector.js";

export type AmazonInvoiceUploadPdfFile = {
  filename: string;
  mimeType: string;
  bytes: Buffer;
};

export type AmazonInvoiceUploadTaskRecord = AmazonInvoiceUploadTaskResult & {
  taskId: string;
  mission: AmazonInvoiceUploadMissionInput;
  createdAt: string;
  updatedAt: string;
};

const safeSegment = (value: string): string =>
  value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "invoice";

export function createAmazonInvoiceUploadTaskId(): string {
  return `amazon-invoice-upload_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function saveApprovedInvoicePdf(input: {
  dataDir: string;
  taskId: string;
  invoiceNo: string;
  file: AmazonInvoiceUploadPdfFile;
}): string {
  const extension = path.extname(input.file.filename).toLowerCase();
  if (extension !== ".pdf" || !input.file.mimeType.toLowerCase().includes("pdf")) {
    throw new Error("invoicePdf must be a PDF file.");
  }
  const taskDir = path.join(input.dataDir, "approved-task-files", "amazon-invoice-upload", safeSegment(input.taskId));
  mkdirSync(taskDir, { recursive: true });
  const approvedPath = path.join(taskDir, `${safeSegment(input.invoiceNo)}.pdf`);
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
    createdAt: now,
    updatedAt: now,
  };
}

export function updateTaskRecord(
  record: AmazonInvoiceUploadTaskRecord,
  result: AmazonInvoiceUploadTaskResult | { status: AmazonInvoiceUploadStatus; reason: string; reachedStep: string },
): AmazonInvoiceUploadTaskRecord {
  const fullResult = "ok" in result ? result : {
    ok: result.status === "upload_success",
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

export function saveTaskRecord(dataDir: string, record: AmazonInvoiceUploadTaskRecord): void {
  const taskDir = path.join(dataDir, "plugin-tasks", "amazon-invoice-upload", safeSegment(record.taskId));
  mkdirSync(taskDir, { recursive: true });
  writeFileSync(path.join(taskDir, "task.json"), JSON.stringify(record, null, 2));
}

export function loadTaskRecord(dataDir: string, taskId: string): AmazonInvoiceUploadTaskRecord | null {
  const recordPath = path.join(dataDir, "plugin-tasks", "amazon-invoice-upload", safeSegment(taskId), "task.json");
  if (!existsSync(recordPath)) {
    return null;
  }
  return JSON.parse(readFileSync(recordPath, "utf8")) as AmazonInvoiceUploadTaskRecord;
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
  return records[0] ?? null;
}
