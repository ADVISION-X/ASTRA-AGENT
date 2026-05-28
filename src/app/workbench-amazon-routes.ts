import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { readJsonBody, writeJson } from "./workbench-http.js";
import { readMultipartFormData } from "./workbench-multipart.js";

type AmazonRouteHandler = () => Promise<boolean>;

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
  writeJson(response, 200, result);
  return true;
};

const handleAmazonPluginStartRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<boolean> => {
  const form = await readMultipartFormData(request);
  const missionText = form.fields.get("mission");
  const invoicePdf = form.files.get("invoicePdf");
  if (!missionText || !invoicePdf) {
    writeJson(response, 400, { error: "missing_mission_or_invoice_pdf" });
    return true;
  }
  const result = await workbench.startAmazonInvoiceUploadTask({
    mission: JSON.parse(missionText) as Parameters<typeof workbench.startAmazonInvoiceUploadTask>[0]["mission"],
    invoicePdf,
  });
  writeJson(response, 200, result);
  return true;
};

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
  writeJson(response, 200, result);
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
  writeJson(response, 200, await workbench.getAmazonInvoiceUploadTaskStatus(taskId));
  return true;
};

const handleAmazonPluginStatusRequest = async (
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  taskId: string,
): Promise<boolean> => {
  writeJson(response, 200, await workbench.getAmazonInvoiceUploadTaskStatus(taskId));
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
  writeJson(response, 200, { task: result });
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
  writeJson(response, 200, record ? { found: true, record } : { found: false });
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

const handleAmazonPluginRequest = (
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
  if (request.method === "POST" && url.pathname === "/api/plugins/amazon-invoice-upload/start") {
    return handleAmazonPluginStartRequest(request, response, workbench);
  }
  if (request.method === "GET" && url.pathname === "/api/plugins/amazon-invoice-upload/latest") {
    return handleAmazonPluginLatestRequest(response, workbench, url);
  }
  const statusPrefix = "/api/plugins/amazon-invoice-upload/status/";
  if (request.method === "GET" && url.pathname.startsWith(statusPrefix)) {
    return handleAmazonPluginStatusRequest(response, workbench, url.pathname.slice(statusPrefix.length));
  }
  return null;
};

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
