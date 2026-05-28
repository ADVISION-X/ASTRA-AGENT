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

const handleAmazonKeywordReviewsRequest = async (
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> => {
  const taskId = url.searchParams.get("taskId") ?? undefined;
  writeJson(response, 200, { reviews: workbench.listAmazonProductMiningKeywordReviews(taskId) });
  return true;
};

const handleAmazonKeywordReviewRequest = async (
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> => {
  const reviewId = url.searchParams.get("reviewId");
  if (!reviewId) {
    writeJson(response, 400, { error: "missing_review_id" });
    return true;
  }
  const review = workbench.getAmazonProductMiningKeywordReview(reviewId);
  if (!review) {
    writeJson(response, 404, { error: "review_not_found" });
    return true;
  }
  writeJson(response, 200, { review });
  return true;
};

const handleAmazonKeywordReviewManualIngestRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<boolean> => {
  const input = await readJsonBody(request);
  writeJson(response, 200, { review: workbench.ingestAmazonProductMiningKeywordReview(input) });
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

const readTaskIdFromControlRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<string | null> => {
  const input = await readJsonBody(request);
  const taskId = typeof input === "object" && input !== null && "taskId" in input
    ? (input as { taskId?: unknown }).taskId
    : null;
  if (typeof taskId !== "string" || taskId.trim().length === 0) {
    writeJson(response, 400, { error: "missing_task_id" });
    return null;
  }
  return taskId;
};

const handleAmazonPauseRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<boolean> => {
  const taskId = await readTaskIdFromControlRequest(request, response);
  if (!taskId) return true;
  const result = workbench.pauseAmazonProductMiningTask(taskId);
  writeJson(response, result ? 200 : 404, result ?? { error: "task_not_found" });
  return true;
};

const handleAmazonContinueRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<boolean> => {
  const taskId = await readTaskIdFromControlRequest(request, response);
  if (!taskId) return true;
  const result = workbench.continueAmazonProductMiningTask(taskId);
  writeJson(response, result ? 200 : 404, result ?? { error: "task_not_continuable" });
  return true;
};

const handleAmazonTerminateRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<boolean> => {
  const taskId = await readTaskIdFromControlRequest(request, response);
  if (!taskId) return true;
  const result = workbench.terminateAmazonProductMiningTask(taskId);
  writeJson(response, result ? 200 : 404, result ?? { error: "task_not_found" });
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
    "GET:/api/amazon-product-mining/keyword-reviews": () => handleAmazonKeywordReviewsRequest(response, workbench, url),
    "GET:/api/amazon-product-mining/keyword-review": () => handleAmazonKeywordReviewRequest(response, workbench, url),
    "POST:/api/amazon-product-mining/keyword-review/manual-ingest": () => handleAmazonKeywordReviewManualIngestRequest(request, response, workbench),
    "GET:/api/amazon-product-mining/export": () => handleAmazonExportRequest(response, workbench, url),
    "POST:/api/amazon-product-mining/pause": () => handleAmazonPauseRequest(request, response, workbench),
    "POST:/api/amazon-product-mining/continue": () => handleAmazonContinueRequest(request, response, workbench),
    "POST:/api/amazon-product-mining/terminate": () => handleAmazonTerminateRequest(request, response, workbench),
  };
  const routeHandler = routeHandlers[`${request.method}:${url.pathname}`];
  return routeHandler ? routeHandler() : false;
};
