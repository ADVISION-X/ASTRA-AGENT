import type { AmazonInvoiceUploadTaskResult } from "./amazon-invoice-upload.flow.js";
import type { AmazonInvoiceUploadMissionInput } from "./mission.schema.js";

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
