import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import { AmazonInvoiceUploadBatchMissionInputSchema } from "./mission.schema.js";
import type { AmazonInvoiceUploadBatchMissionInput, AmazonInvoiceUploadMissionInput } from "./mission.schema.js";
import { startAmazonInvoiceUploadTask } from "./amazon-invoice-upload-task-service.js";
import type { AmazonInvoiceUploadTaskRecord } from "./amazon-invoice-upload-storage.types.js";
import type {
  AmazonInvoiceUploadBatchHistoryQuery,
  AmazonInvoiceUploadBatchItemRecord,
  AmazonInvoiceUploadBatchPdfFile,
  AmazonInvoiceUploadBatchRecord,
} from "./amazon-invoice-upload-batch.types.js";
import {
  buildAmazonInvoiceUploadBatchItems,
  buildReceivedBatchRecord,
  createAmazonInvoiceUploadBatchId,
  findLatestBatchRecord,
  listBatchRecords,
  loadBatchRecord,
  saveBatchPdfFile,
  saveBatchRecord,
  updateBatchItem,
  updateBatchRecord,
} from "./amazon-invoice-upload-batch-storage.js";

const sellerCentralOriginByMarketplace = {
  AE: "https://sellercentral.amazon.ae",
  SA: "https://sellercentral.amazon.sa",
  JP: "https://sellercentral.amazon.co.jp",
  US: "https://sellercentral.amazon.com",
  UK: "https://sellercentral.amazon.co.uk",
} as const;

export async function startAmazonInvoiceUploadBatchTask(input: {
  browser: BrowserController;
  runtimeLogger: RuntimeLogger;
  dataDir: string;
  mission: AmazonInvoiceUploadBatchMissionInput;
  invoicePdfs: readonly AmazonInvoiceUploadBatchPdfFile[];
}): Promise<AmazonInvoiceUploadBatchRecord> {
  const mission = AmazonInvoiceUploadBatchMissionInputSchema.parse(input.mission);
  const files = input.invoicePdfs;
  const validation = buildAmazonInvoiceUploadBatchItems(files);
  const batchId = createAmazonInvoiceUploadBatchId();
  let batch = buildReceivedBatchRecord({ batchId, mission, items: validation.items });
  batch = updateBatchRecord(batch, {
    status: validation.ok ? "validating" : "failed",
    reason: validation.ok ? "Amazon invoice upload batch validated." : validation.reason,
    reachedStep: "validate batch files",
    ...(validation.ok ? {} : { completedAt: new Date().toISOString() }),
  });
  saveBatchRecord(input.dataDir, batch);
  if (!validation.ok) return batch;
  return runBatchItems({ ...input, mission, batch });
}

export function getAmazonInvoiceUploadBatchStatus(input: {
  dataDir: string;
  batchId: string;
}): AmazonInvoiceUploadBatchRecord {
  const record = loadBatchRecord(input.dataDir, input.batchId);
  if (!record) throw new Error(`Amazon invoice upload batch not found: ${input.batchId}`);
  return record;
}

export function getLatestAmazonInvoiceUploadBatch(input: {
  dataDir: string;
  marketplace?: string;
  requestId?: string;
}): AmazonInvoiceUploadBatchRecord | null {
  return findLatestBatchRecord(input);
}

export function listAmazonInvoiceUploadBatches(input: {
  dataDir: string;
  query?: AmazonInvoiceUploadBatchHistoryQuery;
}): AmazonInvoiceUploadBatchRecord[] {
  return listBatchRecords(input.dataDir, input.query);
}

async function runBatchItems(input: {
  browser: BrowserController;
  runtimeLogger: RuntimeLogger;
  dataDir: string;
  mission: AmazonInvoiceUploadBatchMissionInput;
  invoicePdfs: readonly AmazonInvoiceUploadBatchPdfFile[];
  batch: AmazonInvoiceUploadBatchRecord;
}): Promise<AmazonInvoiceUploadBatchRecord> {
  let batch = updateBatchRecord(input.batch, {
    status: "running",
    reason: "Amazon invoice upload batch started.",
    reachedStep: "running",
  });
  saveBatchRecord(input.dataDir, batch);
  for (const item of batch.items) {
    if (item.status !== "queued") continue;
    batch = await uploadBatchItem({ ...input, batch, item });
    if (shouldStopBatch(batch, item.index, input.mission)) break;
  }
  batch = finalizeBatch(batch);
  saveBatchRecord(input.dataDir, batch);
  return batch;
}

async function uploadBatchItem(input: {
  browser: BrowserController;
  runtimeLogger: RuntimeLogger;
  dataDir: string;
  mission: AmazonInvoiceUploadBatchMissionInput;
  invoicePdfs: readonly AmazonInvoiceUploadBatchPdfFile[];
  batch: AmazonInvoiceUploadBatchRecord;
  item: AmazonInvoiceUploadBatchItemRecord;
}): Promise<AmazonInvoiceUploadBatchRecord> {
  const startedAt = new Date().toISOString();
  let batch = updateBatchItem(input.batch, input.item.index, {
    status: "uploading",
    reason: "Uploading invoice PDF through existing single-upload task.",
    reachedStep: "start single invoice upload",
    startedAt,
  });
  batch = updateBatchRecord(batch, { currentIndex: input.item.index, currentOrderId: input.item.amazonOrderId });
  saveBatchRecord(input.dataDir, batch);
  const file = input.invoicePdfs[input.item.index];
  if (!file) {
    return updateBatchItem(batch, input.item.index, {
      status: "failed",
      reason: "Batch item PDF file is missing.",
      reachedStep: "load batch file",
      completedAt: new Date().toISOString(),
    });
  }
  const savedPdfPath = saveBatchPdfFile({
    dataDir: input.dataDir,
    batchId: batch.batchId,
    file,
    safeFileName: input.item.safeFileName,
  });
  const singleTask = await startSingleUploadTask({ ...input, file, item: input.item, savedPdfPath });
  return updateBatchItem(batch, input.item.index, normalizeSingleTaskResult(singleTask));
}

async function startSingleUploadTask(input: {
  browser: BrowserController;
  runtimeLogger: RuntimeLogger;
  dataDir: string;
  mission: AmazonInvoiceUploadBatchMissionInput;
  file: AmazonInvoiceUploadBatchPdfFile;
  item: AmazonInvoiceUploadBatchItemRecord;
  savedPdfPath: string;
}): Promise<AmazonInvoiceUploadTaskRecord> {
  return startAmazonInvoiceUploadTask({
    browser: input.browser,
    runtimeLogger: input.runtimeLogger,
    dataDir: input.dataDir,
    task: {
      mission: buildSingleMission(input.mission, input.item, input.savedPdfPath),
      invoicePdf: input.file,
    },
  });
}

function buildSingleMission(
  mission: AmazonInvoiceUploadBatchMissionInput,
  item: AmazonInvoiceUploadBatchItemRecord,
  savedPdfPath: string,
): AmazonInvoiceUploadMissionInput {
  return {
    missionType: "amazon_invoice_upload",
    marketplace: mission.marketplace,
    amazonOrderId: item.amazonOrderId,
    invoiceNo: item.invoiceNo,
    invoicePdfPath: savedPdfPath,
    sellerCentralEntryUrl: buildSellerCentralOrderDetailEntryUrl(mission.marketplace, item.amazonOrderId),
  };
}

function buildSellerCentralOrderDetailEntryUrl(
  marketplace: AmazonInvoiceUploadBatchMissionInput["marketplace"],
  amazonOrderId: string,
): string {
  const url = new URL(sellerCentralOriginByMarketplace[marketplace]);
  url.pathname = `/orders-v3/order/${encodeURIComponent(amazonOrderId)}`;
  return url.toString();
}

function normalizeSingleTaskResult(task: AmazonInvoiceUploadTaskRecord): Partial<AmazonInvoiceUploadBatchItemRecord> {
  const completedAt = new Date().toISOString();
  const evidence = task.evidenceRef ? { evidenceRef: task.evidenceRef } : {};
  const domTrace = task.domTraceRef ? { domTraceRef: task.domTraceRef } : {};
  if (task.status === "upload_success" && task.reason.toLowerCase().includes("already uploaded")) {
    return { status: "already_uploaded", taskId: task.taskId, reason: task.reason, reachedStep: task.reachedStep, completedAt, ...evidence, ...domTrace };
  }
  if (task.status === "upload_success") {
    return { status: "upload_success", taskId: task.taskId, reason: task.reason, reachedStep: task.reachedStep, completedAt, ...evidence, ...domTrace };
  }
  if (task.status === "login_required" || task.status === "captcha_or_2fa_required") {
    return { status: "blocked_auth", taskId: task.taskId, reason: task.reason, reachedStep: task.reachedStep, completedAt, ...evidence, ...domTrace };
  }
  if (task.reviewRequired || task.status === "review_required") {
    return { status: "failed", taskId: task.taskId, reason: task.reason, reachedStep: task.reachedStep, completedAt, ...evidence, ...domTrace };
  }
  return { status: "failed", taskId: task.taskId, reason: task.reason, reachedStep: task.reachedStep, completedAt, ...evidence, ...domTrace };
}

function shouldStopBatch(
  batch: AmazonInvoiceUploadBatchRecord,
  itemIndex: number,
  mission: AmazonInvoiceUploadBatchMissionInput,
): boolean {
  const item = batch.items.find((candidate) => candidate.index === itemIndex);
  if (!item) return false;
  if (item.status === "blocked_auth") return true;
  return item.status === "failed" && mission.stopOnFailed === true;
}

function finalizeBatch(batch: AmazonInvoiceUploadBatchRecord): AmazonInvoiceUploadBatchRecord {
  const remainingQueued = batch.items.filter((item) => item.status === "queued");
  const skippedItems = remainingQueued.reduce(
    (record, item) => updateBatchItem(record, item.index, {
      status: "skipped",
      reason: "Batch stopped before this item.",
      reachedStep: "batch stopped",
      completedAt: new Date().toISOString(),
    }),
    batch,
  );
  const finalStatus = readFinalStatus(skippedItems);
  return updateBatchRecord(skippedItems, {
    status: finalStatus,
    reason: finalStatus === "completed" ? "Amazon invoice upload batch completed." : "Amazon invoice upload batch stopped with non-success items.",
    reachedStep: "batch finalized",
    completedAt: new Date().toISOString(),
  });
}

function readFinalStatus(batch: AmazonInvoiceUploadBatchRecord): AmazonInvoiceUploadBatchRecord["status"] {
  if (batch.blockedAuth > 0) return "blocked_auth";
  if (batch.invalid > 0 || batch.failed > 0 || batch.skipped > 0) return "completed_with_errors";
  return "completed";
}
