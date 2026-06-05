import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { readJsonBody, writeJson } from "./workbench-http.js";

const handleStartRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<boolean> => {
  const input = await readJsonBody(request);
  const result = await workbench.startAmazonProductFeeSyncTask(input);
  writeJson(response, 200, result);
  return true;
};

const handleStatusRequest = async (
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  taskId: string,
): Promise<boolean> => {
  const task = await workbench.getAmazonProductFeeSyncTaskStatus(taskId);
  if (!task) {
    writeJson(response, 404, { error: "amazon_product_fee_sync_task_not_found" });
    return true;
  }
  writeJson(response, 200, task);
  return true;
};

const handleLatestRequest = async (
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<boolean> => {
  writeJson(response, 200, { task: await workbench.getLatestAmazonProductFeeSyncTask() });
  return true;
};

export const handleAmazonProductFeeSyncRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> => {
  if (request.method === "POST" && url.pathname === "/api/plugins/amazon-product-fee-sync/start") {
    return handleStartRequest(request, response, workbench);
  }
  const statusPrefix = "/api/plugins/amazon-product-fee-sync/status/";
  if (request.method === "GET" && url.pathname.startsWith(statusPrefix)) {
    return handleStatusRequest(response, workbench, url.pathname.slice(statusPrefix.length));
  }
  if (request.method === "GET" && url.pathname === "/api/plugins/amazon-product-fee-sync/latest") {
    return handleLatestRequest(response, workbench);
  }
  return false;
};
