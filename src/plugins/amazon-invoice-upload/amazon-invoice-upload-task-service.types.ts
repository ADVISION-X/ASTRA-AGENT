import { z } from "zod";

import type { AmazonInvoiceUploadStatus } from "./amazon-result-detector.js";
import type { AmazonInvoiceUploadMissionInput } from "./mission.schema.js";
import type { AmazonInvoiceUploadPdfFile } from "./amazon-invoice-upload-storage.types.js";

export const AmazonInvoiceUploadAdminOpenInputSchema = z.object({
  adminUrl: z.string().url(),
  focusOnlyExistingTab: z.boolean().optional(),
}).strict();

export type AmazonInvoiceUploadAdminOpenInput = z.infer<typeof AmazonInvoiceUploadAdminOpenInputSchema>;

export type AmazonInvoiceUploadAdminOpenResult = {
  ok: boolean;
  currentUrl: string;
  error: "admin_url_not_allowed" | "admin_open_failed" | null;
  failureReason: string | null;
};

export type AmazonInvoiceUploadMissionStartResult = {
  ok: boolean;
  taskId?: string;
  status: AmazonInvoiceUploadStatus;
  reason: string;
  reachedStep: string;
  phaseStatus?: AmazonInvoiceUploadStatus;
  amazonOrderId?: string;
  invoiceNo?: string;
  evidenceRef?: string;
  reviewRequired?: boolean;
};

export type AmazonInvoiceUploadTaskStartInput = {
  mission: AmazonInvoiceUploadMissionInput;
  invoicePdf: AmazonInvoiceUploadPdfFile;
};
