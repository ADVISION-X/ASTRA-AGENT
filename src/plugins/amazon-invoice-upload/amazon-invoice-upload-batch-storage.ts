import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { AmazonInvoiceUploadBatchMissionInput } from "./mission.schema.js";
import type {
  AmazonInvoiceUploadBatchHistoryQuery,
  AmazonInvoiceUploadBatchItemRecord,
  AmazonInvoiceUploadBatchPdfFile,
  AmazonInvoiceUploadBatchRecord,
} from "./amazon-invoice-upload-batch.types.js";

const MAX_SINGLE_FILE_BYTES = 10 * 1024 * 1024;
const AMAZON_ORDER_PDF_NAME = /^\d{3}-\d{7}-\d{7}\.pdf$/i;

const nowIso = (): string => new Date().toISOString();

const safeSegment = (value: string): string =>
  value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "invoice";

const batchRoot = (dataDir: string): string =>
  path.join(dataDir, "plugin-tasks", "amazon-invoice-upload", "batch");

const batchDir = (dataDir: string, batchId: string): string =>
  path.join(batchRoot(dataDir), safeSegment(batchId));

export function createAmazonInvoiceUploadBatchId(): string {
  return `amazon-invoice-upload-batch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function parseAmazonInvoiceUploadBatchFilename(filename: string): {
  amazonOrderId: string;
  invoiceNo: string;
  safeFileName: string;
} | null {
  const baseName = path.basename(filename);
  if (!AMAZON_ORDER_PDF_NAME.test(baseName)) return null;
  const amazonOrderId = baseName.slice(0, -4);
  return { amazonOrderId, invoiceNo: amazonOrderId, safeFileName: `${amazonOrderId}.pdf` };
}

export function buildAmazonInvoiceUploadBatchItems(files: readonly AmazonInvoiceUploadBatchPdfFile[]): {
  items: AmazonInvoiceUploadBatchItemRecord[];
  ok: boolean;
  reason: string;
} {
  if (files.length === 0) return { ok: false, reason: "empty_batch", items: [] };
  const seenOrderIds = new Set<string>();
  const items: AmazonInvoiceUploadBatchItemRecord[] = [];
  for (const [index, file] of files.entries()) {
    const parsed = parseAmazonInvoiceUploadBatchFilename(file.filename);
    const reason = readFileValidationFailure(file, parsed, seenOrderIds);
    if (parsed) {
      seenOrderIds.add(parsed.amazonOrderId);
    }
    items.push(buildBatchItem(index, file.filename, parsed, reason));
  }
  const firstInvalid = items.find((item) => item.status === "invalid");
  return firstInvalid ? { ok: false, reason: firstInvalid.reason, items } : { ok: true, reason: "valid_batch", items };
}

export function buildReceivedBatchRecord(input: {
  batchId: string;
  mission: AmazonInvoiceUploadBatchMissionInput;
  items: AmazonInvoiceUploadBatchItemRecord[];
}): AmazonInvoiceUploadBatchRecord {
  const now = nowIso();
  return applyBatchCounters({
    batchId: input.batchId,
    taskKind: "invoice_upload_batch",
    mission: input.mission,
    status: "received",
    reason: "Amazon invoice upload batch received.",
    reachedStep: "received",
    total: input.items.length,
    queued: 0,
    uploading: 0,
    succeeded: 0,
    alreadyUploaded: 0,
    failed: 0,
    blockedAuth: 0,
    invalid: 0,
    skipped: 0,
    items: input.items,
    ...(input.mission.sourceSystem ? { sourceSystem: input.mission.sourceSystem } : {}),
    ...(input.mission.requestId ? { requestId: input.mission.requestId } : {}),
    createdAt: now,
    updatedAt: now,
  });
}

export function updateBatchItem(
  record: AmazonInvoiceUploadBatchRecord,
  index: number,
  patch: Partial<AmazonInvoiceUploadBatchItemRecord>,
): AmazonInvoiceUploadBatchRecord {
  const items = record.items.map((item) =>
    item.index === index ? { ...item, ...patch, updatedAt: nowIso() } : item);
  return applyBatchCounters({ ...record, items, updatedAt: nowIso() });
}

export function updateBatchRecord(
  record: AmazonInvoiceUploadBatchRecord,
  patch: Partial<AmazonInvoiceUploadBatchRecord>,
): AmazonInvoiceUploadBatchRecord {
  return applyBatchCounters({ ...record, ...patch, updatedAt: nowIso() });
}

export function saveBatchPdfFile(input: {
  dataDir: string;
  batchId: string;
  file: AmazonInvoiceUploadBatchPdfFile;
  safeFileName: string;
}): string {
  const filesDir = path.join(batchDir(input.dataDir, input.batchId), "files");
  mkdirSync(filesDir, { recursive: true });
  const filePath = path.join(filesDir, safeSegment(input.safeFileName));
  writeFileSync(filePath, input.file.bytes);
  return filePath;
}

export function saveBatchRecord(dataDir: string, record: AmazonInvoiceUploadBatchRecord): void {
  const targetDir = batchDir(dataDir, record.batchId);
  mkdirSync(targetDir, { recursive: true });
  writeFileSync(path.join(targetDir, "batch.json"), JSON.stringify(record, null, 2));
}

export function loadBatchRecord(dataDir: string, batchId: string): AmazonInvoiceUploadBatchRecord | null {
  const recordPath = path.join(batchDir(dataDir, batchId), "batch.json");
  if (!existsSync(recordPath)) return null;
  return JSON.parse(readFileSync(recordPath, "utf8")) as AmazonInvoiceUploadBatchRecord;
}

export function findLatestBatchRecord(
  input: { dataDir: string; marketplace?: string; requestId?: string },
): AmazonInvoiceUploadBatchRecord | null {
  const records = listBatchRecords(input.dataDir, {
    limit: 1,
    ...(input.marketplace ? { marketplace: input.marketplace } : {}),
  }).filter((record) => input.requestId ? record.requestId === input.requestId : true);
  return records[0] ?? null;
}

export function listBatchRecords(
  dataDir: string,
  query: AmazonInvoiceUploadBatchHistoryQuery = {},
): AmazonInvoiceUploadBatchRecord[] {
  const root = batchRoot(dataDir);
  if (!existsSync(root)) return [];
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => loadBatchRecord(dataDir, entry.name))
    .filter((record): record is AmazonInvoiceUploadBatchRecord => matchesHistoryQuery(record, query))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, limit);
}

function readFileValidationFailure(
  file: AmazonInvoiceUploadBatchPdfFile,
  parsed: ReturnType<typeof parseAmazonInvoiceUploadBatchFilename>,
  seenOrderIds: ReadonlySet<string>,
): string | null {
  if (!parsed) return "invalid_pdf_filename";
  if (!file.mimeType.toLowerCase().includes("pdf")) return "invalid_pdf_mime_type";
  if (file.bytes.length > MAX_SINGLE_FILE_BYTES) return "file_too_large";
  return seenOrderIds.has(parsed.amazonOrderId) ? "duplicate_order_id" : null;
}

function buildBatchItem(
  index: number,
  filename: string,
  parsed: ReturnType<typeof parseAmazonInvoiceUploadBatchFilename>,
  failure: string | null,
): AmazonInvoiceUploadBatchItemRecord {
  const now = nowIso();
  return {
    index,
    originalFileName: path.basename(filename),
    safeFileName: parsed?.safeFileName ?? safeSegment(path.basename(filename)),
    amazonOrderId: parsed?.amazonOrderId ?? "",
    invoiceNo: parsed?.invoiceNo ?? "",
    status: failure ? "invalid" : "queued",
    reason: failure ?? "queued",
    reachedStep: failure ? "validate batch file" : "queued",
    updatedAt: now,
  };
}

function applyBatchCounters(record: AmazonInvoiceUploadBatchRecord): AmazonInvoiceUploadBatchRecord {
  const count = (status: AmazonInvoiceUploadBatchItemRecord["status"]): number =>
    record.items.filter((item) => item.status === status).length;
  return {
    ...record,
    total: record.items.length,
    queued: count("queued"),
    uploading: count("uploading"),
    succeeded: count("upload_success"),
    alreadyUploaded: count("already_uploaded"),
    failed: count("failed"),
    blockedAuth: count("blocked_auth"),
    invalid: count("invalid"),
    skipped: count("skipped"),
  };
}

function matchesHistoryQuery(record: AmazonInvoiceUploadBatchRecord | null, query: AmazonInvoiceUploadBatchHistoryQuery): boolean {
  if (!record) return false;
  if (query.status && record.status !== query.status) return false;
  if (query.marketplace && record.mission.marketplace !== query.marketplace) return false;
  return query.orderId ? record.items.some((item) => item.amazonOrderId === query.orderId) : true;
}
