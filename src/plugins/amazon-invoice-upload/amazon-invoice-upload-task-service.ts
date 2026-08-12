import { randomUUID } from "node:crypto";

import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import type { ForensicsPersistenceAbilityGroup } from "../../capabilities/forensics-persistence/index.js";
import { recordAmazonDomStepTrace } from "./amazon-dom-step-trace.js";
import { runAmazonInvoiceUpload } from "./amazon-invoice-upload.flow.js";
import type { AmazonInvoiceUploadTaskResult } from "./amazon-invoice-upload.flow.js";
import { runAmazonTaxInvoiceDownload } from "./amazon-tax-invoice-download.flow.js";
import { listAmazonInvoiceUploadLedgerRecords } from "./amazon-invoice-upload-ledger.js";
import { AmazonInvoiceUploadMissionInputSchema, AmazonTaxInvoiceDownloadMissionInputSchema } from "./mission.schema.js";
import type { AmazonInvoiceUploadMissionInput, AmazonTaxInvoiceDownloadMissionInput } from "./mission.schema.js";
import {
  buildReceivedDownloadTaskRecord,
  buildReceivedTaskRecord,
  createAmazonInvoiceUploadTaskId,
  createAmazonTaxInvoiceDownloadTaskId,
  findLatestDownloadTaskRecord,
  findLatestTaskRecordForInvoice,
  loadDownloadTaskRecord,
  loadTaskRecord,
  saveApprovedInvoicePdf,
  saveDownloadTaskRecord,
  saveTaskRecord,
  updateDownloadTaskRecord,
  updateTaskRecord,
} from "./amazon-invoice-upload-storage.js";
import type {
  AmazonInvoiceUploadPdfFile,
  AmazonInvoiceUploadTaskRecord,
  AmazonTaxInvoiceDownloadArtifactMetadata,
  AmazonTaxInvoiceDownloadTaskRecord,
} from "./amazon-invoice-upload-storage.types.js";
import {
  AmazonInvoiceUploadAdminOpenInputSchema,
  type AmazonInvoiceUploadAdminOpenInput,
  type AmazonInvoiceUploadAdminOpenResult,
  type AmazonInvoiceUploadMissionStartResult,
  type AmazonInvoiceUploadTaskStartInput,
} from "./amazon-invoice-upload-task-service.types.js";
import type { AmazonInvoiceUploadLedgerRecord } from "./amazon-invoice-upload-ledger.js";

const DEFAULT_ALLOWED_ADMIN_HOSTS = ["localhost", "127.0.0.1"] as const;
const DEFAULT_UPLOAD_FLOW_TIMEOUT_MS = 300_000;
const API_UPLOAD_FOCUS_RETURN_TIMEOUT_MS = 10_000;
const UPLOAD_FLOW_TIMEOUT_REASON_PREFIX = "amazon_invoice_upload_flow_timeout_after_";
const AMAZON_INVOICE_RUNTIME_LOG_REF = "runtime-logs/workbench.jsonl";

let activeUploadExecutionId: string | null = null;

export async function startAmazonInvoiceAdminOpenTask(
  browser: BrowserController,
  rawInput: AmazonInvoiceUploadAdminOpenInput,
  options: { abortSignal?: AbortSignal } = {},
): Promise<AmazonInvoiceUploadAdminOpenResult> {
  const input = AmazonInvoiceUploadAdminOpenInputSchema.parse(rawInput);
  const adminUrl = new URL(input.adminUrl);
  if (!isAllowedAmazonAdminUrl(adminUrl)) {
    return {
      ok: false,
      currentUrl: browser.getSessionState().currentUrl,
      error: "admin_url_not_allowed",
      failureReason: "Admin URL must target an allowed local development host over http or https.",
    };
  }

  const openResult = await browser.open({
    url: adminUrl.toString(),
    title: "Amazon Manage invoice workspace",
    reusePolicy: input.focusOnlyExistingTab === true ? "focus-existing-same-path-url" : "reuse-exact-url",
    ...(options.abortSignal ? { abortSignal: options.abortSignal } : {}),
  });
  const currentUrl = browser.getSessionState().currentUrl;
  if (!openResult.ok) {
    return {
      ok: false,
      currentUrl,
      error: "admin_open_failed",
      failureReason: openResult.message,
    };
  }

  return {
    ok: true,
    currentUrl,
    error: null,
    failureReason: null,
  };
}

export async function startAmazonInvoiceUploadMission(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  evidenceStore: ForensicsPersistenceAbilityGroup,
  rawInput: AmazonInvoiceUploadMissionInput,
): Promise<AmazonInvoiceUploadMissionStartResult> {
  const input = AmazonInvoiceUploadMissionInputSchema.parse(rawInput);
  const executionId = `amazon-invoice-execution:${randomUUID()}`;
  return withAmazonInvoiceExecutionLease({
    browser,
    executionId,
    mission: input,
    onBusy: () => buildUploadBusyResult(input),
    action: (abortController) => runAmazonInvoiceUploadWithTerminalGuard({
      browser,
      runtimeLogger,
      evidenceStore,
      executionId,
      abortController,
      mission: input,
    }),
  });
}

export async function startAmazonInvoiceUploadTask(input: {
  browser: BrowserController;
  runtimeLogger: RuntimeLogger;
  evidenceStore: ForensicsPersistenceAbilityGroup;
  dataDir: string;
  task: AmazonInvoiceUploadTaskStartInput;
  flowTimeoutMs?: number;
}): Promise<AmazonInvoiceUploadTaskRecord> {
  const mission = AmazonInvoiceUploadMissionInputSchema.parse(input.task.mission);
  const taskId = createAmazonInvoiceUploadTaskId();
  const approvedPath = saveApprovedInvoicePdf({
    dataDir: input.dataDir,
    taskId,
    amazonOrderId: mission.amazonOrderId,
    invoiceNo: mission.invoiceNo,
    file: input.task.invoicePdf,
  });
  const approvedMission = { ...mission, invoicePdfPath: approvedPath };
  const received = buildReceivedTaskRecord({ taskId, mission: approvedMission });
  saveTaskRecord(input.dataDir, received);
  const uploading = updateTaskRecord(received, {
    status: "uploading",
    reason: "Amazon invoice upload started.",
    reachedStep: "uploading",
  });
  saveTaskRecord(input.dataDir, uploading);
  const executionId = createUploadExecutionId(taskId);
  return withAmazonInvoiceExecutionLease({
    browser: input.browser,
    executionId,
    mission: approvedMission,
    onBusy: () => {
      const busy = updateTaskRecord(uploading, buildUploadBusyResult(approvedMission));
      saveTaskRecord(input.dataDir, busy);
      return busy;
    },
    action: async (abortController) => {
      const result = await runAmazonInvoiceUploadWithTerminalGuard({
        browser: input.browser,
        runtimeLogger: input.runtimeLogger,
        evidenceStore: input.evidenceStore,
        executionId,
        taskId,
        abortController,
        mission: approvedMission,
        ...(input.flowTimeoutMs === undefined ? {} : { flowTimeoutMs: input.flowTimeoutMs }),
      });
      const completed = updateTaskRecord(uploading, result);
      saveTaskRecord(input.dataDir, completed);
      await returnApiUploadFocusToAdminBounded({
        runtimeLogger: input.runtimeLogger,
        mission: approvedMission,
        focus: (abortSignal) => returnApiUploadFocusToAdmin({
          browser: input.browser,
          runtimeLogger: input.runtimeLogger,
          mission: approvedMission,
          abortSignal,
        }),
      });
      return completed;
    },
  });
}

export async function resumeAmazonInvoiceUploadTask(input: {
  browser: BrowserController;
  runtimeLogger: RuntimeLogger;
  evidenceStore: ForensicsPersistenceAbilityGroup;
  dataDir: string;
  taskId: string;
  flowTimeoutMs?: number;
}): Promise<AmazonInvoiceUploadTaskRecord> {
  const record = loadRequiredTaskRecord(input.dataDir, input.taskId);
  const resumed = updateTaskRecord(record, {
    status: "uploading",
    reason: "Amazon invoice upload resumed.",
    reachedStep: "resume",
  });
  saveTaskRecord(input.dataDir, resumed);
  const executionId = createUploadExecutionId(input.taskId);
  return withAmazonInvoiceExecutionLease({
    browser: input.browser,
    executionId,
    mission: record.mission,
    onBusy: () => {
      const busy = updateTaskRecord(resumed, buildUploadBusyResult(record.mission));
      saveTaskRecord(input.dataDir, busy);
      return busy;
    },
    action: async (abortController) => {
      const result = await runAmazonInvoiceUploadWithTerminalGuard({
        browser: input.browser,
        runtimeLogger: input.runtimeLogger,
        evidenceStore: input.evidenceStore,
        executionId,
        taskId: input.taskId,
        abortController,
        mission: record.mission,
        ...(input.flowTimeoutMs === undefined ? {} : { flowTimeoutMs: input.flowTimeoutMs }),
      });
      const completed = updateTaskRecord(resumed, result);
      saveTaskRecord(input.dataDir, completed);
      await returnApiUploadFocusToAdminBounded({
        runtimeLogger: input.runtimeLogger,
        mission: record.mission,
        focus: (abortSignal) => returnApiUploadFocusToAdmin({
          browser: input.browser,
          runtimeLogger: input.runtimeLogger,
          mission: record.mission,
          abortSignal,
        }),
      });
      return completed;
    },
  });
}

export function getAmazonInvoiceUploadTaskStatus(input: {
  dataDir: string;
  taskId: string;
}): AmazonInvoiceUploadTaskRecord {
  return loadRequiredTaskRecord(input.dataDir, input.taskId);
}

export function getLatestAmazonInvoiceUploadTaskForInvoice(input: {
  dataDir: string;
  amazonOrderId: string;
  invoiceNo?: string;
}): AmazonInvoiceUploadTaskRecord | null {
  return findLatestTaskRecordForInvoice(input);
}

export function listAmazonInvoiceUploadLedger(input: {
  dataDir: string;
}): AmazonInvoiceUploadLedgerRecord[] {
  return listAmazonInvoiceUploadLedgerRecords(input.dataDir);
}

export async function startAmazonTaxInvoiceDownloadTask(input: {
  browser: BrowserController;
  runtimeLogger: RuntimeLogger;
  dataDir: string;
  mission: AmazonTaxInvoiceDownloadMissionInput;
}): Promise<AmazonTaxInvoiceDownloadTaskRecord> {
  const mission = AmazonTaxInvoiceDownloadMissionInputSchema.parse(input.mission);
  const taskId = createAmazonTaxInvoiceDownloadTaskId();
  const received = buildReceivedDownloadTaskRecord({ taskId, mission });
  saveDownloadTaskRecord(input.dataDir, received);
  const downloading = updateDownloadTaskRecord(received, {
    status: "downloading",
    reason: "Amazon tax invoice CSV download started.",
    reachedStep: "downloading",
    evidenceStepId: "AID-01",
  });
  saveDownloadTaskRecord(input.dataDir, downloading);
  const result = await runAmazonTaxInvoiceDownload(input.browser, input.runtimeLogger, mission).catch((error: unknown) => ({
    ok: false,
    status: "failed" as const,
    reason: error instanceof Error ? error.message : String(error),
    reachedStep: "download runtime",
    evidenceStepId: "AID-01",
    reviewRequired: true,
  }));
  const completed = updateDownloadTaskRecord(downloading, result);
  saveDownloadTaskRecord(input.dataDir, completed);
  return completed;
}

export function getAmazonTaxInvoiceDownloadTaskStatus(input: {
  dataDir: string;
  taskId: string;
}): AmazonTaxInvoiceDownloadTaskRecord {
  return loadRequiredDownloadTaskRecord(input.dataDir, input.taskId);
}

export function getLatestAmazonTaxInvoiceDownloadTask(input: {
  dataDir: string;
  marketplace?: string;
  requestId?: string;
}): AmazonTaxInvoiceDownloadTaskRecord | null {
  return findLatestDownloadTaskRecord(input);
}

export function getAmazonTaxInvoiceDownloadArtifact(input: {
  dataDir: string;
  taskId: string;
}): AmazonTaxInvoiceDownloadArtifactMetadata | null {
  return loadRequiredDownloadTaskRecord(input.dataDir, input.taskId).artifact ?? null;
}

function isAllowedAmazonAdminUrl(url: URL): boolean {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return false;
  }

  return getAllowedAmazonAdminHosts().has(url.hostname.toLowerCase());
}

function getAllowedAmazonAdminHosts(): Set<string> {
  const configuredHosts = process.env.GRASSEYE_AMAZON_ADMIN_ALLOWED_HOSTS
    ?.split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return new Set(configuredHosts && configuredHosts.length > 0 ? configuredHosts : DEFAULT_ALLOWED_ADMIN_HOSTS);
}
async function returnApiUploadFocusToAdmin(input: {
  browser: BrowserController;
  runtimeLogger: RuntimeLogger;
  mission: AmazonInvoiceUploadMissionInput;
  abortSignal: AbortSignal;
}): Promise<void> {
  if (!isApiUploadMission(input.mission) || !input.mission.adminOrderUrl) return;
  const result = await startAmazonInvoiceAdminOpenTask(input.browser, {
    adminUrl: input.mission.adminOrderUrl,
    focusOnlyExistingTab: true,
  }, { abortSignal: input.abortSignal });
  recordAmazonDomStepTrace({
    runtimeLogger: input.runtimeLogger,
    mission: input.mission,
    stepName: "return API upload focus to website",
    status: result.ok ? "success" : "failed",
    reason: result.ok
      ? "API upload reached a terminal result; switched back to the existing Amazon Manage invoice tab."
      : result.failureReason ?? "Existing Amazon Manage invoice tab could not be focused.",
  });
}
function isApiUploadMission(mission: AmazonInvoiceUploadMissionInput): boolean {
  return Boolean(mission.sourceSystem || mission.requestId);
}
function loadRequiredTaskRecord(dataDir: string, taskId: string): AmazonInvoiceUploadTaskRecord {
  const record = loadTaskRecord(dataDir, taskId);
  if (!record) {
    throw new Error(`Amazon invoice upload task not found: ${taskId}`);
  }
  return record;
}
function loadRequiredDownloadTaskRecord(dataDir: string, taskId: string): AmazonTaxInvoiceDownloadTaskRecord {
  const record = loadDownloadTaskRecord(dataDir, taskId);
  if (!record) {
    throw new Error(`Amazon tax invoice download task not found: ${taskId}`);
  }
  return record;
}
async function runAmazonInvoiceUploadWithTerminalGuard(input: {
  browser: BrowserController;
  runtimeLogger: RuntimeLogger;
  evidenceStore: ForensicsPersistenceAbilityGroup;
  executionId: string;
  taskId?: string;
  abortController: AbortController;
  mission: AmazonInvoiceUploadMissionInput;
  flowTimeoutMs?: number;
}): Promise<AmazonInvoiceUploadTaskResult> {
  const timeoutMs = resolveUploadFlowTimeoutMs(input.flowTimeoutMs);
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    input.abortController.abort(new Error(`${UPLOAD_FLOW_TIMEOUT_REASON_PREFIX}${timeoutMs}ms`));
  }, timeoutMs);
  try {
    const result = await runAmazonInvoiceUpload(input.browser, input.runtimeLogger, input.mission, {
      executionId: input.executionId,
      ...(input.taskId ? { taskId: input.taskId } : {}),
      abortSignal: input.abortController.signal,
      evidenceStore: input.evidenceStore,
      runtimeLogRef: AMAZON_INVOICE_RUNTIME_LOG_REF,
    }).catch((error: unknown) => buildUploadFlowFailureResult(input.mission, error));
    return timedOut ? buildUploadFlowTimeoutResult(input.mission, timeoutMs) : result;
  } finally {
    clearTimeout(timeout);
  }
}
function createUploadExecutionId(taskId: string): string {
  return `amazon-invoice-execution:${randomUUID()}:task:${taskId}`;
}
async function withAmazonInvoiceExecutionLease<T>(input: {
  browser: BrowserController;
  executionId: string;
  mission: AmazonInvoiceUploadMissionInput;
  action: (abortController: AbortController) => Promise<T>;
  onBusy: () => T;
}): Promise<T> {
  if (activeUploadExecutionId !== null) return input.onBusy();
  const abortController = new AbortController();
  activeUploadExecutionId = input.executionId;
  input.browser.setExecutionAbortSignal?.(abortController.signal);
  try {
    return await input.action(abortController);
  } finally {
    if (!abortController.signal.aborted) abortController.abort(new Error("amazon_invoice_upload_execution_complete"));
    input.browser.setExecutionAbortSignal?.(null);
    activeUploadExecutionId = null;
  }
}
function buildUploadBusyResult(mission: AmazonInvoiceUploadMissionInput): AmazonInvoiceUploadTaskResult {
  return {
    ok: false,
    status: "review_required",
    reason: "amazon_invoice_upload_busy: another invoice execution owns the shared browser",
    reachedStep: "execution lease",
    amazonOrderId: mission.amazonOrderId,
    invoiceNo: mission.invoiceNo,
    reviewRequired: true,
  };
}
function resolveUploadFlowTimeoutMs(explicitTimeoutMs?: number): number {
  if (explicitTimeoutMs && Number.isFinite(explicitTimeoutMs) && explicitTimeoutMs > 0) {
    return Math.floor(explicitTimeoutMs);
  }
  const configured = Number.parseInt(process.env.GRASSEYE_AMAZON_INVOICE_UPLOAD_FLOW_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_UPLOAD_FLOW_TIMEOUT_MS;
}
function buildUploadFlowTimeoutResult(
  mission: AmazonInvoiceUploadMissionInput,
  timeoutMs: number,
): AmazonInvoiceUploadTaskResult {
  return {
    ok: false,
    status: "review_required",
    reason: `${UPLOAD_FLOW_TIMEOUT_REASON_PREFIX}${timeoutMs}ms`,
    reachedStep: "upload flow timeout",
    amazonOrderId: mission.amazonOrderId,
    invoiceNo: mission.invoiceNo,
    reviewRequired: true,
  };
}
function buildUploadFlowFailureResult(
  mission: AmazonInvoiceUploadMissionInput,
  error: unknown,
): AmazonInvoiceUploadTaskResult {
  return {
    ok: false,
    status: "failed",
    reason: `amazon_invoice_upload_flow_failed: ${sanitizeFailureReason(error)}`,
    reachedStep: "upload flow runtime",
    amazonOrderId: mission.amazonOrderId,
    invoiceNo: mission.invoiceNo,
    reviewRequired: true,
  };
}
function sanitizeFailureReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\/[^\s"'<>]+/g, "[path]").slice(0, 240) || "unknown_error";
}
async function returnApiUploadFocusToAdminBounded(input: {
  runtimeLogger: RuntimeLogger;
  mission: AmazonInvoiceUploadMissionInput;
  focus: (abortSignal: AbortSignal) => Promise<void>;
}): Promise<void> {
  if (!isApiUploadMission(input.mission) || !input.mission.adminOrderUrl) return;
  const abortController = new AbortController();
  let timedOut = false;
  let focusError: unknown;
  const timeout = setTimeout(() => {
    timedOut = true;
    abortController.abort(new Error(`amazon_invoice_admin_focus_timeout_after_${API_UPLOAD_FOCUS_RETURN_TIMEOUT_MS}ms`));
  }, API_UPLOAD_FOCUS_RETURN_TIMEOUT_MS);
  try {
    await input.focus(abortController.signal).catch((error: unknown) => {
      focusError = error;
    });
  } finally {
    clearTimeout(timeout);
  }
  if (timedOut) {
    recordAmazonDomStepTrace({
      runtimeLogger: input.runtimeLogger,
      mission: input.mission,
      stepName: "return API upload focus to website",
      status: "failed",
      reason: `API upload focus return timed out after ${API_UPLOAD_FOCUS_RETURN_TIMEOUT_MS}ms; the browser action was aborted and fully settled before lease release.`,
    });
  } else if (focusError) {
    recordAmazonDomStepTrace({
      runtimeLogger: input.runtimeLogger,
      mission: input.mission,
      stepName: "return API upload focus to website",
      status: "failed",
      reason: `API upload focus return failed after terminal upload result: ${sanitizeFailureReason(focusError)}`,
    });
  }
}
