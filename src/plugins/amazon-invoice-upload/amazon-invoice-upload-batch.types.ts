import type { AmazonInvoiceUploadBatchMissionInput } from "./mission.schema.js";
import type { AmazonInvoiceUploadPdfFile } from "./amazon-invoice-upload-storage.types.js";

export type AmazonInvoiceUploadBatchPdfFile = AmazonInvoiceUploadPdfFile;

export type AmazonInvoiceUploadBatchItemStatus =
  | "queued"
  | "validating"
  | "uploading"
  | "upload_success"
  | "already_uploaded"
  | "blocked_auth"
  | "failed"
  | "skipped"
  | "invalid";

export type AmazonInvoiceUploadBatchStatus =
  | "received"
  | "validating"
  | "running"
  | "paused"
  | "completed"
  | "completed_with_errors"
  | "blocked_auth"
  | "failed"
  | "cancelled";

export type AmazonInvoiceUploadBatchItemRecord = {
  index: number;
  originalFileName: string;
  safeFileName: string;
  amazonOrderId: string;
  invoiceNo: string;
  taskId?: string;
  status: AmazonInvoiceUploadBatchItemStatus;
  reason: string;
  reachedStep: string;
  evidenceRef?: string;
  domTraceRef?: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
};

export type AmazonInvoiceUploadBatchRecord = {
  batchId: string;
  taskKind: "invoice_upload_batch";
  mission: AmazonInvoiceUploadBatchMissionInput;
  status: AmazonInvoiceUploadBatchStatus;
  reason: string;
  reachedStep: string;
  total: number;
  queued: number;
  uploading: number;
  succeeded: number;
  alreadyUploaded: number;
  failed: number;
  blockedAuth: number;
  invalid: number;
  skipped: number;
  currentIndex?: number;
  currentOrderId?: string;
  items: AmazonInvoiceUploadBatchItemRecord[];
  sourceSystem?: string;
  requestId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

export type AmazonInvoiceUploadBatchHistoryQuery = {
  limit?: number;
  status?: AmazonInvoiceUploadBatchStatus;
  marketplace?: string;
  orderId?: string;
};
