import { z } from "zod";

export const AmazonInvoiceUploadMissionInputSchema = z.object({
  missionType: z.literal("amazon_invoice_upload"),
  marketplace: z.enum(["AE", "SA", "JP", "US", "UK"]),
  amazonOrderId: z.string().min(1),
  invoiceNo: z.string().min(1),
  invoicePdfPath: z.string().min(1),
  sellerCentralEntryUrl: z.string().url(),
  adminOrderUrl: z.string().url().optional(),
  requireHumanFinalSubmit: z.boolean().optional(),
}).strict();

export type AmazonInvoiceUploadMissionInput = z.infer<typeof AmazonInvoiceUploadMissionInputSchema>;
