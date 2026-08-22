import type { PluginInterventionSnapshot } from "../../types/plugin-intervention.js";
import type {
  AmazonInvoiceUploadMissionInput,
  AmazonTaxInvoiceDownloadMissionInput,
} from "./mission.schema.js";

export type AmazonInvoiceUploadTaskRecord = Readonly<{
  taskId: string;
  mission: AmazonInvoiceUploadMissionInput;
  ok: false;
  status: string;
  reason: string;
  reachedStep: string;
  amazonOrderId: string;
  invoiceNo: string;
  reviewRequired: boolean;
  intervention: PluginInterventionSnapshot;
  createdAt: string;
  updatedAt: string;
}>;

export type AmazonInvoiceUploadLedgerRecord = Readonly<{
  taskId: string;
  amazonOrderId: string;
  invoiceNo: string;
  status: string;
  reason: string;
  reachedStep: string;
  evidenceRef: null;
  runtimeLogRef: null;
  navigationEvidenceRef: null;
  reviewRequired: boolean;
  createdAt: string;
  updatedAt: string;
}>;

export type AmazonTaxInvoiceDownloadTaskRecord = Readonly<{
  taskId: string;
  taskKind: "tax_invoice_download";
  mission: AmazonTaxInvoiceDownloadMissionInput;
  ok: boolean;
  status: "completed" | "manual_required";
  reason: string;
  reachedStep: string;
  createdAt: string;
  updatedAt: string;
}>;

export type AmazonTaxInvoiceDownloadArtifactMetadata = null;
