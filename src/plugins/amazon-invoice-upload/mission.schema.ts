import { z } from "zod";

export const AmazonInvoiceUploadMissionInputSchema = z
  .object({
    missionType: z.literal("amazon_invoice_upload"),
    marketplace: z.enum(["AE", "SA", "JP", "US", "UK"]),
    amazonOrderId: z.string().min(1),
    invoiceNo: z.string().min(1),
    invoicePdfPath: z.string().min(1),
    sellerCentralEntryUrl: z.string().url(),
    adminOrderUrl: z.string().url().optional(),
    sourceSystem: z.string().min(1).optional(),
    requestId: z.string().min(1).optional(),
  })
  .strict();

export type AmazonInvoiceUploadMissionInput = z.infer<
  typeof AmazonInvoiceUploadMissionInputSchema
>;

export const AmazonTaxInvoiceDownloadMissionInputSchema = z
  .object({
    missionType: z.literal("amazon_tax_invoice_download"),
    mode: z.literal("download_only").default("download_only"),
    marketplace: z.enum(["AE", "SA", "JP", "US", "UK"]),
    sellerCentralEntryUrl: z.string().url(),
    reportKind: z.literal("afn_shipment_invoicing_tax_invoice"),
    dateRange: z.literal("last_30_days"),
    format: z.literal("csv"),
    sourceSystem: z.string().min(1).optional(),
    requestId: z.string().min(1).optional(),
    callbackUrl: z.string().url().optional(),
    requireHumanReview: z.boolean().optional(),
  })
  .strict();

export type AmazonTaxInvoiceDownloadMissionInput = z.infer<
  typeof AmazonTaxInvoiceDownloadMissionInputSchema
>;
