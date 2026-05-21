import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { readJsonBody, writeJson } from "./workbench-http.js";

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

export const handleAmazonRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> => {
  if (request.method !== "POST" && request.method !== "GET") {
    return false;
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