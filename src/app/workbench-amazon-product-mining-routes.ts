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
  const result = workbench.startAmazonProductMiningMission(
    input as Parameters<typeof workbench.startAmazonProductMiningMission>[0],
  );
  writeJson(response, 200, result);
  return true;
};

const handleAmazonRunRequest = async (
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> => {
  const taskId = url.searchParams.get("taskId");
  if (!taskId) {
    writeJson(response, 400, { error: "missing_task_id" });
    return true;
  }
  writeJson(response, 200, workbench.getAmazonProductMiningTaskStatus(taskId));
  return true;
};

const handleAmazonLatestRequest = async (
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<boolean> => {
  writeJson(response, 200, workbench.getLatestAmazonProductMiningTask());
  return true;
};

const handleAmazonExportRequest = async (
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> => {
  const taskId = url.searchParams.get("taskId");
  if (!taskId) {
    writeJson(response, 400, { error: "missing_task_id" });
    return true;
  }
  const exported = workbench.exportAmazonProductMiningResult(taskId);
  if (!exported) {
    writeJson(response, 404, { error: "task_not_found" });
    return true;
  }
  writeJson(response, 200, exported);
  return true;
};

export const handleAmazonProductMiningRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> => {
  if (request.method !== "POST" && request.method !== "GET") {
    return false;
  }
  const routeHandlers: Partial<Record<string, AmazonRouteHandler>> = {
    "POST:/api/amazon-product-mining/mission": () => handleAmazonMissionRequest(request, response, workbench),
    "GET:/api/amazon-product-mining/run": () => handleAmazonRunRequest(response, workbench, url),
    "GET:/api/amazon-product-mining/latest": () => handleAmazonLatestRequest(response, workbench),
    "GET:/api/amazon-product-mining/export": () => handleAmazonExportRequest(response, workbench, url),
  };
  const routeHandler = routeHandlers[`${request.method}:${url.pathname}`];
  return routeHandler ? routeHandler() : false;
};
