import { z } from "zod";

import { AmazonInvoiceUploadMissionInputSchema } from "./mission.schema.js";

export const AmazonInvoiceUploadTaskStartInputSchema = z.object({
  mission: AmazonInvoiceUploadMissionInputSchema,
  invoicePdf: z.unknown(),
}).strict();

export type AmazonInvoiceUploadTaskStartInput = z.infer<typeof AmazonInvoiceUploadTaskStartInputSchema>;

export const AmazonInvoiceUploadResumeInputSchema = z.object({
  taskId: z.string().trim().min(1).max(180),
}).strict();

export const AmazonInvoiceUploadAdminOpenInputSchema = z.object({
  marketplace: z.enum(["AE", "SA", "US"]),
  sellerCentralEntryUrl: z.string().url().max(2_048),
}).strict();

export type AmazonInvoiceUploadAdminOpenInput = z.infer<typeof AmazonInvoiceUploadAdminOpenInputSchema>;
