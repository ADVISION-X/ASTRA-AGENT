import { z } from "zod";

export const AmazonMarketplaceSchema = z.enum(["AE", "SA", "US"]);

export const AmazonInvoiceUploadMissionInputSchema = z.object({
  missionType: z.literal("amazon_invoice_upload"),
  marketplace: AmazonMarketplaceSchema,
  amazonOrderId: z.string().trim().min(1).max(128),
  invoiceNo: z.string().trim().min(1).max(128),
  invoicePdfPath: z.string().trim().min(1).max(1_024),
  sellerCentralEntryUrl: z.string().url().max(2_048),
  adminOrderUrl: z.string().url().max(2_048).optional(),
  sourceSystem: z.string().trim().min(1).max(128).optional(),
  requestId: z.string().trim().min(1).max(180).optional(),
}).strict();

export type AmazonInvoiceUploadMissionInput = z.infer<typeof AmazonInvoiceUploadMissionInputSchema>;

export const AmazonTaxInvoiceDownloadMissionInputSchema = z.object({
  missionType: z.literal("amazon_tax_invoice_download"),
  mode: z.literal("download_only"),
  marketplace: AmazonMarketplaceSchema,
  sellerCentralEntryUrl: z.string().url().max(2_048),
  reportKind: z.literal("afn_shipment_invoicing_tax_invoice"),
  dateRange: z.enum(["last_30_days", "last_90_days", "custom"]),
  format: z.literal("csv"),
  callbackUrl: z.string().url().max(2_048).optional(),
  sourceSystem: z.string().trim().min(1).max(128).optional(),
  requestId: z.string().trim().min(1).max(180).optional(),
  requireHumanReview: z.boolean().optional(),
}).strict();

export type AmazonTaxInvoiceDownloadMissionInput = z.infer<typeof AmazonTaxInvoiceDownloadMissionInputSchema>;
