import type { AmazonInvoiceUploadTaskResult } from "./amazon-invoice-upload.flow.js";
import type { AmazonInvoiceUploadMissionInput, AmazonTaxInvoiceDownloadMissionInput } from "./mission.schema.js";
import type { PluginInterventionSnapshot } from "../../types/plugin-intervention.js";

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
  intervention: PluginInterventionSnapshot;
};

export type AmazonTaxInvoiceDownloadStatus =
  | "received"
  | "downloading"
  | "download_requested"
  | "waiting_report_ready"
  | "download_ready"
  | "artifact_persisted"
  | "completed"
  | "manual_required"
  | "failed";

export type AmazonTaxInvoiceDownloadArtifactMetadata = {
  artifactRef: string;
  artifactName: string;
  mimeType: "text/csv";
  fileSize: number;
  sha256: string;
  createdAt: string;
};

export type AmazonTaxInvoiceDownloadTaskResult = {
  ok: boolean;
  status: AmazonTaxInvoiceDownloadStatus;
  reason: string;
  reachedStep: string;
  evidenceStepId?: string;
  downloadArtifactRef?: string;
  downloadedFileName?: string;
  downloadedFileSize?: number;
  downloadedFileSha256?: string;
  downloadedAt?: string;
  evidenceRef?: string;
  runtimeLogRef?: string;
  reviewRequired?: boolean;
};

export type AmazonTaxInvoiceDownloadTaskRecord = AmazonTaxInvoiceDownloadTaskResult & {
  taskId: string;
  taskKind: "tax_invoice_download";
  mission: AmazonTaxInvoiceDownloadMissionInput;
  sourceSystem?: string;
  requestId?: string;
  callbackStatus?: "not_configured" | "pending" | "sent" | "failed";
  artifact?: AmazonTaxInvoiceDownloadArtifactMetadata;
  createdAt: string;
  updatedAt: string;
};
