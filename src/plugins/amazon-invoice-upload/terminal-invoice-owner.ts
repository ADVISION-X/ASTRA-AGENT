import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type {
  PluginInterventionAction,
  PluginInterventionRequest,
  PluginInterventionSnapshot,
} from "../../types/plugin-intervention.js";
import { PluginInterventionRequestSchema } from "../../types/plugin-intervention.js";
import {
  AmazonInvoiceUploadAdminOpenInputSchema,
  AmazonInvoiceUploadResumeInputSchema,
  AmazonInvoiceUploadTaskStartInputSchema,
  type AmazonInvoiceUploadAdminOpenInput,
  type AmazonInvoiceUploadTaskStartInput,
} from "./amazon-invoice-upload-task-service.types.js";
import type {
  AmazonInvoiceUploadLedgerRecord,
  AmazonInvoiceUploadTaskRecord,
  AmazonTaxInvoiceDownloadArtifactMetadata,
  AmazonTaxInvoiceDownloadTaskRecord,
} from "./amazon-invoice-upload-storage.types.js";
import {
  AmazonInvoiceUploadMissionInputSchema,
  AmazonTaxInvoiceDownloadMissionInputSchema,
  type AmazonInvoiceUploadMissionInput,
  type AmazonTaxInvoiceDownloadMissionInput,
} from "./mission.schema.js";

type TerminalInvoiceState = Readonly<{
  uploads: readonly AmazonInvoiceUploadTaskRecord[];
  downloads: readonly AmazonTaxInvoiceDownloadTaskRecord[];
}>;

const terminalReason = "BROWSER_AUTHORITY_NOT_PRODUCTION_VERIFIED" as const;
const terminalStep = "terminal_browser_authority_gate" as const;

export const AmazonInvoiceUploadInterventionRequestSchema = PluginInterventionRequestSchema;

const statePath = (dataDir: string): string =>
  join(dataDir, "plugin-tasks", "amazon-invoice-upload", "terminal-state.json");

const now = (): string => new Date().toISOString();

const createIntervention = (timestamp: string): PluginInterventionSnapshot => ({
  revision: 0,
  state: "review_required",
  reason: terminalReason,
  checkpoint: terminalStep,
  pending: null,
  updatedAt: timestamp,
});

const readState = (dataDir: string): TerminalInvoiceState => {
  const path = statePath(dataDir);
  if (!existsSync(path)) return { uploads: [], downloads: [] };
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<TerminalInvoiceState>;
    return {
      uploads: Array.isArray(parsed.uploads) ? parsed.uploads : [],
      downloads: Array.isArray(parsed.downloads) ? parsed.downloads : [],
    };
  } catch {
    return { uploads: [], downloads: [] };
  }
};

const writeState = (dataDir: string, state: TerminalInvoiceState): void => {
  const path = statePath(dataDir);
  mkdirSync(join(dataDir, "plugin-tasks", "amazon-invoice-upload"), { recursive: true });
  writeFileSync(path, `${JSON.stringify(state)}\n`, "utf8");
};

const createUploadRecord = (mission: AmazonInvoiceUploadMissionInput): AmazonInvoiceUploadTaskRecord => {
  const timestamp = now();
  return {
    taskId: `amazon-invoice-upload-${randomUUID()}`,
    mission,
    ok: false,
    status: "review_required",
    reason: terminalReason,
    reachedStep: terminalStep,
    amazonOrderId: mission.amazonOrderId,
    invoiceNo: mission.invoiceNo,
    reviewRequired: true,
    intervention: createIntervention(timestamp),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const createDownloadRecord = (mission: AmazonTaxInvoiceDownloadMissionInput): AmazonTaxInvoiceDownloadTaskRecord => {
  const timestamp = now();
  return {
    taskId: `amazon-tax-invoice-download-${randomUUID()}`,
    taskKind: "tax_invoice_download",
    mission,
    ok: false,
    status: "manual_required",
    reason: terminalReason,
    reachedStep: terminalStep,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

export const startAmazonInvoiceAdminOpenTask = async (
  input: AmazonInvoiceUploadAdminOpenInput,
): Promise<Readonly<{ ok: false; status: "review_required"; reason: typeof terminalReason }>> => {
  AmazonInvoiceUploadAdminOpenInputSchema.parse(input);
  return { ok: false, status: "review_required", reason: terminalReason };
};

export const startAmazonInvoiceUploadMission = async (
  input: AmazonInvoiceUploadMissionInput,
): Promise<Readonly<{ ok: false; status: "review_required"; reason: typeof terminalReason }>> => {
  AmazonInvoiceUploadMissionInputSchema.parse(input);
  return { ok: false, status: "review_required", reason: terminalReason };
};

export const startAmazonInvoiceUploadTask = async (input: Readonly<{
  dataDir: string;
  task: AmazonInvoiceUploadTaskStartInput;
}>): Promise<AmazonInvoiceUploadTaskRecord> => {
  const task = AmazonInvoiceUploadTaskStartInputSchema.parse(input.task);
  const record = createUploadRecord(task.mission);
  const state = readState(input.dataDir);
  writeState(input.dataDir, { ...state, uploads: [...state.uploads, record] });
  return record;
};

export const resumeAmazonInvoiceUploadTask = async (input: Readonly<{
  dataDir: string;
  taskId: string;
}>): Promise<AmazonInvoiceUploadTaskRecord> => {
  const { taskId } = AmazonInvoiceUploadResumeInputSchema.parse({ taskId: input.taskId });
  const record = readState(input.dataDir).uploads.find((candidate) => candidate.taskId === taskId);
  if (!record) throw new Error("AMAZON_INVOICE_TASK_NOT_FOUND");
  return record;
};

export const getAmazonInvoiceUploadTaskStatus = async (input: Readonly<{
  dataDir: string;
  taskId: string;
}>): Promise<AmazonInvoiceUploadTaskRecord> => {
  const record = readState(input.dataDir).uploads.find((candidate) => candidate.taskId === input.taskId);
  if (!record) throw new Error("AMAZON_INVOICE_TASK_NOT_FOUND");
  return record;
};

export const getLatestAmazonInvoiceUploadTaskForInvoice = async (input: Readonly<{
  dataDir: string;
  amazonOrderId: string;
  invoiceNo?: string;
}>): Promise<AmazonInvoiceUploadTaskRecord | null> => {
  const records = readState(input.dataDir).uploads;
  return [...records].reverse().find((record) =>
    record.amazonOrderId === input.amazonOrderId
      && (input.invoiceNo === undefined || record.invoiceNo === input.invoiceNo),
  ) ?? null;
};

export const listAmazonInvoiceUploadLedger = async (input: Readonly<{
  dataDir: string;
}>): Promise<AmazonInvoiceUploadLedgerRecord[]> =>
  readState(input.dataDir).uploads.map((record) => ({
    taskId: record.taskId,
    amazonOrderId: record.amazonOrderId,
    invoiceNo: record.invoiceNo,
    status: record.status,
    reason: record.reason,
    reachedStep: record.reachedStep,
    evidenceRef: null,
    runtimeLogRef: null,
    navigationEvidenceRef: null,
    reviewRequired: record.reviewRequired,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }));

export const startAmazonTaxInvoiceDownloadTask = async (input: Readonly<{
  dataDir: string;
  mission: AmazonTaxInvoiceDownloadMissionInput;
}>): Promise<AmazonTaxInvoiceDownloadTaskRecord> => {
  const mission = AmazonTaxInvoiceDownloadMissionInputSchema.parse(input.mission);
  const record = createDownloadRecord(mission);
  const state = readState(input.dataDir);
  writeState(input.dataDir, { ...state, downloads: [...state.downloads, record] });
  return record;
};

export const getAmazonTaxInvoiceDownloadTaskStatus = async (input: Readonly<{
  dataDir: string;
  taskId: string;
}>): Promise<AmazonTaxInvoiceDownloadTaskRecord> => {
  const record = readState(input.dataDir).downloads.find((candidate) => candidate.taskId === input.taskId);
  if (!record) throw new Error("AMAZON_TAX_INVOICE_DOWNLOAD_TASK_NOT_FOUND");
  return record;
};

export const getLatestAmazonTaxInvoiceDownloadTask = async (input: Readonly<{
  dataDir: string;
  marketplace?: string;
  requestId?: string;
}>): Promise<AmazonTaxInvoiceDownloadTaskRecord | null> => {
  const records = readState(input.dataDir).downloads;
  return [...records].reverse().find((record) =>
    (input.marketplace === undefined || record.mission.marketplace === input.marketplace)
      && (input.requestId === undefined || record.mission.requestId === input.requestId),
  ) ?? null;
};

export const getAmazonTaxInvoiceDownloadArtifact = (_taskId: string): AmazonTaxInvoiceDownloadArtifactMetadata => null;

const applyIntervention = (
  dataDir: string,
  action: PluginInterventionAction,
  input: PluginInterventionRequest,
): PluginInterventionSnapshot => {
  const state = readState(dataDir);
  const record = state.uploads.find((candidate) => candidate.taskId === input.taskId);
  if (!record) throw new Error("AMAZON_INVOICE_TASK_NOT_FOUND");
  if (record.intervention.revision !== input.expectedRevision) throw new Error("STALE_INTERVENTION_REVISION");
  const timestamp = now();
  const next: PluginInterventionSnapshot = {
    revision: record.intervention.revision + 1,
    state: action === "cancel" ? "cancelled" : "review_required",
    reason: input.reason,
    checkpoint: terminalStep,
    pending: null,
    updatedAt: timestamp,
  };
  const uploads = state.uploads.map((candidate) => candidate.taskId === record.taskId
    ? { ...candidate, intervention: next, updatedAt: timestamp }
    : candidate);
  writeState(dataDir, { ...state, uploads });
  return next;
};

export const readAmazonInvoiceUploadIntervention = async (dataDir: string, taskId: string): Promise<PluginInterventionSnapshot | null> =>
  readState(dataDir).uploads.find((record) => record.taskId === taskId)?.intervention ?? null;

export const pauseAmazonInvoiceUpload = async (dataDir: string, input: PluginInterventionRequest): Promise<PluginInterventionSnapshot> =>
  applyIntervention(dataDir, "pause", input);
export const cancelAmazonInvoiceUpload = async (dataDir: string, input: PluginInterventionRequest): Promise<PluginInterventionSnapshot> =>
  applyIntervention(dataDir, "cancel", input);
export const takeoverAmazonInvoiceUpload = async (dataDir: string, input: PluginInterventionRequest): Promise<PluginInterventionSnapshot> =>
  applyIntervention(dataDir, "takeover", input);
export const resumeAmazonInvoiceUpload = async (dataDir: string, input: PluginInterventionRequest): Promise<PluginInterventionSnapshot> =>
  applyIntervention(dataDir, "resume", input);
