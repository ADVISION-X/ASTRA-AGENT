import { z } from "zod";

import type { AmazonInvoiceUploadStatus } from "./amazon-result-detector.js";
import {
  AmazonInvoiceUploadMissionInputSchema,
  type AmazonInvoiceUploadMissionInput,
} from "./mission.schema.js";
import type { AmazonInvoiceUploadPdfFile } from "./amazon-invoice-upload-storage.types.js";

export const AmazonInvoiceUploadAdminOpenInputSchema = z
  .object({
    adminUrl: z.string().url(),
  })
  .strict();

export type AmazonInvoiceUploadAdminOpenInput = z.infer<
  typeof AmazonInvoiceUploadAdminOpenInputSchema
>;

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

export const AmazonInvoiceUploadTaskStartInputSchema = z
  .object({
    mission: AmazonInvoiceUploadMissionInputSchema,
    invoicePdf: z
      .object({
        filename: z.string().min(1),
        mimeType: z.string().min(1),
        bytes: z.instanceof(Buffer),
      })
      .strict(),
  })
  .strict();

export const AmazonInvoiceUploadResumeInputSchema = z
  .object({
    taskId: z.string().trim().min(1),
  })
  .strict();
