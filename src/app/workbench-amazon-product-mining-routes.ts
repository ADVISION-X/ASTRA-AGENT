import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { PluginInterventionRequestSchema } from "../types/plugin-intervention.js";
import { readJsonBody, writeJson } from "./workbench-http.js";

const handleAmazonProductMiningIntervention = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> => {
  const base = "/api/amazon-product-mining/intervention";
  if (request.method === "GET" && url.pathname === `${base}/status`) {
    const taskId = url.searchParams.get("taskId")?.trim();
    if (!taskId) { writeJson(response, 400, { error: "TASK_ID_REQUIRED" }); return true; }
    writeJson(response, 200, await workbench.readAmazonProductMiningIntervention(taskId));
    return true;
  }
  if (request.method !== "POST") return false;
  const invoke = url.pathname === `${base}/pause` ? workbench.pauseAmazonProductMining
    : url.pathname === `${base}/cancel` ? workbench.cancelAmazonProductMining
      : url.pathname === `${base}/takeover` ? workbench.takeoverAmazonProductMining
        : url.pathname === `${base}/resume` ? workbench.resumeAmazonProductMining : null;
  if (!invoke) return false;
  try { writeJson(response, 200, await invoke(PluginInterventionRequestSchema.parse(await readJsonBody(request)))); }
  catch (error) { const reason = error instanceof Error ? error.message : String(error); writeJson(response, reason === "STALE_INTERVENTION_REVISION" ? 409 : 400, { error: reason }); }
  return true;
};

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
  if (await handleAmazonProductMiningIntervention(request, response, workbench, url)) return true;
  if (request.method !== "POST" && request.method !== "GET") {
    return false;
  }
  const routeHandlers: Partial<Record<string, AmazonRouteHandler>> = {
    "POST:/api/amazon-product-mining/mission": () => handleAmazonMissionRequest(request, response, workbench),
    "GET:/api/amazon-product-mining/run": () => handleAmazonRunRequest(response, workbench, url),
    "GET:/api/amazon-product-mining/latest": () => handleAmazonLatestRequest(response, workbench),
    "GET:/api/amazon-product-mining/keyword-reviews": () => handleAmazonKeywordReviewsRequest(response, workbench, url),
    "GET:/api/amazon-product-mining/keyword-review": () => handleAmazonKeywordReviewRequest(response, workbench, url),
    "GET:/api/amazon-product-mining/export": () => handleAmazonExportRequest(response, workbench, url),
  };
  const routeHandler = routeHandlers[`${request.method}:${url.pathname}`];
  return routeHandler ? routeHandler() : false;
};
