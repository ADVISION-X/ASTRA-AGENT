import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import type { AmazonInvoiceUploadTaskRecord } from "../plugins/amazon-invoice-upload/amazon-invoice-upload-storage.types.js";
import { readJsonBody, writeJson } from "./workbench-http.js";
import { readMultipartFormData } from "./workbench-multipart.js";

type AmazonRouteHandler = () => Promise<boolean>;
type AmazonInvoiceUploadRouteMission = Parameters<GrassEyeWorkbenchHandle["startAmazonInvoiceUploadTask"]>[0]["mission"];

function sanitizeAmazonInvoiceUploadMission(missionText: string, request: IncomingMessage): AmazonInvoiceUploadRouteMission {
  const raw = JSON.parse(missionText) as Record<string, unknown>;
  const sourceSystem = readOptionalHeader(request, "x-grasseye-source-system") ?? readOptionalRawString(raw.sourceSystem);
  const requestId = readOptionalHeader(request, "x-grasseye-request-id") ?? readOptionalRawString(raw.requestId);
  const mission: AmazonInvoiceUploadRouteMission = {
    missionType: "amazon_invoice_upload",
    marketplace: raw.marketplace as AmazonInvoiceUploadRouteMission["marketplace"],
    amazonOrderId: String(raw.amazonOrderId ?? ""),
    invoiceNo: String(raw.invoiceNo ?? ""),
    invoicePdfPath: typeof raw.invoicePdfPath === "string" && raw.invoicePdfPath ? raw.invoicePdfPath : "approved-by-workbench",
    sellerCentralEntryUrl: String(raw.sellerCentralEntryUrl ?? ""),
    ...(typeof raw.adminOrderUrl === "string" && raw.adminOrderUrl ? { adminOrderUrl: raw.adminOrderUrl } : {}),
    ...(sourceSystem ? { sourceSystem } : {}),
    ...(requestId ? { requestId } : {}),
  };
  delete raw.requireHumanFinalSubmit;
  delete raw.stopOnManualRequired;
  return mission;
}

function readOptionalHeader(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name];
  const normalized = Array.isArray(value) ? value[0] : value;
  return readOptionalRawString(normalized);
}

function readOptionalRawString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function sanitizeAmazonInvoiceUploadTaskRecordForResponse(
  record: AmazonInvoiceUploadTaskRecord,
): AmazonInvoiceUploadTaskRecord {
  return {
    ...record,
    mission: {
      ...record.mission,
      invoicePdfPath: "redacted-local-invoice-pdf-path",
    },
  };
}

const handleAmazonMissionRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<boolean> => {
  const input = await readJsonBody(request);
  const result = await workbench.startAmazonInvoiceUploadMission(input as Parameters<typeof workbench.startAmazonInvoiceUploadMission>[0]);
  writeJson(response, 200, result);
  return true;
};

const handleAmazonTaskCreateRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<boolean> => {
  const input = await readJsonBody(request);
  const result = await workbench.startAmazonInvoiceUploadTask(input as Parameters<typeof workbench.startAmazonInvoiceUploadTask>[0]);
  writeJson(response, 200, sanitizeAmazonInvoiceUploadTaskRecordForResponse(result));
  return true;
};

async function handleAmazonPluginStartRequest(
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<boolean> {
  const form = await readMultipartFormData(request);
  const missionText = form.fields.get("mission");
  const invoicePdf = form.files.get("invoicePdf");
  if (!missionText || !invoicePdf) {
    writeJson(response, 400, { error: "missing_mission_or_invoice_pdf" });
    return true;
  }
  const result = await workbench.startAmazonInvoiceUploadTask({
    mission: sanitizeAmazonInvoiceUploadMission(missionText, request),
    invoicePdf,
  });
  writeJson(response, 200, sanitizeAmazonInvoiceUploadTaskRecordForResponse(result));
  return true;
}

const handleAmazonPluginDownloadStartRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<boolean> => {
  const input = await readJsonBody(request);
  const result = await workbench.startAmazonTaxInvoiceDownloadTask(
    input as Parameters<typeof workbench.startAmazonTaxInvoiceDownloadTask>[0],
  );
  writeJson(response, 200, result);
  return true;
};

const handleAmazonTaskResumeRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<boolean> => {
  const input = await readJsonBody(request);
  const result = await workbench.resumeAmazonInvoiceUploadTask(input as Parameters<typeof workbench.resumeAmazonInvoiceUploadTask>[0]);
  writeJson(response, 200, sanitizeAmazonInvoiceUploadTaskRecordForResponse(result));
  return true;
};

const handleAmazonTaskStatusRequest = async (
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> => {
  const taskId = url.searchParams.get("taskId");
  if (!taskId) {
    writeJson(response, 400, { error: "missing_task_id" });
    return true;
  }
  writeJson(response, 200, sanitizeAmazonInvoiceUploadTaskRecordForResponse(await workbench.getAmazonInvoiceUploadTaskStatus(taskId)));
  return true;
};

const handleAmazonPluginStatusRequest = async (
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  taskId: string,
): Promise<boolean> => {
  writeJson(response, 200, sanitizeAmazonInvoiceUploadTaskRecordForResponse(await workbench.getAmazonInvoiceUploadTaskStatus(taskId)));
  return true;
};

const handleAmazonPluginDownloadStatusRequest = async (
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  taskId: string,
): Promise<boolean> => {
  writeJson(response, 200, await workbench.getAmazonTaxInvoiceDownloadTaskStatus(taskId));
  return true;
};

const handleAmazonLatestRequest = async (
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> => {
  const amazonOrderId = url.searchParams.get("amazonOrderId");
  if (!amazonOrderId) {
    writeJson(response, 400, { error: "missing_amazon_order_id" });
    return true;
  }
  const invoiceNo = url.searchParams.get("invoiceNo") ?? undefined;
  const result = await workbench.getLatestAmazonInvoiceUploadTaskForInvoice({
    amazonOrderId,
    ...(invoiceNo ? { invoiceNo } : {}),
  });
  writeJson(response, 200, { task: result ? sanitizeAmazonInvoiceUploadTaskRecordForResponse(result) : null });
  return true;
};

const handleAmazonPluginLatestRequest = async (
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> => {
  const amazonOrderId = url.searchParams.get("amazonOrderId");
  if (!amazonOrderId) {
    writeJson(response, 400, { error: "missing_amazon_order_id" });
    return true;
  }
  const invoiceNo = url.searchParams.get("invoiceNo") ?? undefined;
  const record = await workbench.getLatestAmazonInvoiceUploadTaskForInvoice({
    amazonOrderId,
    ...(invoiceNo ? { invoiceNo } : {}),
  });
  writeJson(response, 200, record ? { found: true, record: sanitizeAmazonInvoiceUploadTaskRecordForResponse(record) } : { found: false });
  return true;
};

const handleAmazonPluginLedgerRequest = async (
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<boolean> => {
  writeJson(response, 200, { records: await workbench.listAmazonInvoiceUploadLedger() });
  return true;
};

const handleAmazonPluginDownloadLatestRequest = async (
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> => {
  const marketplace = url.searchParams.get("marketplace") ?? undefined;
  const requestId = url.searchParams.get("requestId") ?? undefined;
  const record = await workbench.getLatestAmazonTaxInvoiceDownloadTask({
    ...(marketplace ? { marketplace } : {}),
    ...(requestId ? { requestId } : {}),
  });
  writeJson(response, 200, record ? { found: true, record } : { found: false });
  return true;
};

const handleAmazonPluginDownloadArtifactRequest = async (
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  taskId: string,
): Promise<boolean> => {
  const artifact = await workbench.getAmazonTaxInvoiceDownloadArtifact(taskId);
  if (!artifact) {
    writeJson(response, 404, { error: "download_artifact_not_found" });
    return true;
  }
  writeJson(response, 200, { artifact });
  return true;
};

const handleAmazonPluginDownloadRequest = (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> | null => {
  if (request.method === "POST" && url.pathname === "/api/plugins/amazon-invoice-upload/download/start") {
    return handleAmazonPluginDownloadStartRequest(request, response, workbench);
  }
  if (request.method === "GET" && url.pathname === "/api/plugins/amazon-invoice-upload/download/latest") {
    return handleAmazonPluginDownloadLatestRequest(response, workbench, url);
  }
  const downloadStatusPrefix = "/api/plugins/amazon-invoice-upload/download/status/";
  if (request.method === "GET" && url.pathname.startsWith(downloadStatusPrefix)) {
    return handleAmazonPluginDownloadStatusRequest(response, workbench, url.pathname.slice(downloadStatusPrefix.length));
  }
  const downloadArtifactPrefix = "/api/plugins/amazon-invoice-upload/download/artifact/";
  if (request.method === "GET" && url.pathname.startsWith(downloadArtifactPrefix)) {
    return handleAmazonPluginDownloadArtifactRequest(response, workbench, url.pathname.slice(downloadArtifactPrefix.length));
  }
  return null;
};

const handleAmazonPluginUploadRequest = (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> | null => {
  if (request.method === "POST" && url.pathname === "/api/plugins/amazon-invoice-upload/start") {
    return handleAmazonPluginStartRequest(request, response, workbench);
  }
  if (request.method === "GET" && url.pathname === "/api/plugins/amazon-invoice-upload/latest") {
    return handleAmazonPluginLatestRequest(response, workbench, url);
  }
  if (request.method === "GET" && url.pathname === "/api/plugins/amazon-invoice-upload/ledger") {
    return handleAmazonPluginLedgerRequest(response, workbench);
  }
  const statusPrefix = "/api/plugins/amazon-invoice-upload/status/";
  if (request.method === "GET" && url.pathname.startsWith(statusPrefix)) {
    return handleAmazonPluginStatusRequest(response, workbench, url.pathname.slice(statusPrefix.length));
  }
  return null;
};

const handleAmazonPluginRequest = (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> | null =>
  handleAmazonPluginDownloadRequest(request, response, workbench, url)
  ?? handleAmazonPluginUploadRequest(request, response, workbench, url);

export const handleAmazonRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> => {
  if (request.method !== "POST" && request.method !== "GET") {
    return false;
  }
  const pluginResult = handleAmazonPluginRequest(request, response, workbench, url);
  if (pluginResult) {
    return pluginResult;
  }
  const routeHandlers: Partial<Record<string, AmazonRouteHandler>> = {
    "POST:/api/amazon-invoice-upload/mission": () => handleAmazonMissionRequest(request, response, workbench),
    "POST:/api/amazon-invoice-upload/task": () => handleAmazonTaskCreateRequest(request, response, workbench),
    "POST:/api/amazon-invoice-upload/task/resume": () => handleAmazonTaskResumeRequest(request, response, workbench),
    "GET:/api/amazon-invoice-upload/task": () => handleAmazonTaskStatusRequest(response, workbench, url),
    "GET:/api/amazon-invoice-upload/latest": () => handleAmazonLatestRequest(response, workbench, url),
  };
  const routeHandler = routeHandlers[`${request.method}:${url.pathname}`];
  return routeHandler ? routeHandler() : false;
};
