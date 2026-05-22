import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { readJsonBody, writeJson } from "./workbench-http.js";

type FacebookRouteHandler = () => Promise<boolean>;

const handleFacebookMissionRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<boolean> => {
  const input = await readJsonBody(request);
  const result = await workbench.startFacebookProductVideoMiningMission(
    input as Parameters<typeof workbench.startFacebookProductVideoMiningMission>[0],
  );
  writeJson(response, 200, result);
  return true;
};

const handleFacebookRunRequest = async (
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> => {
  const runId = url.searchParams.get("runId");
  if (!runId) {
    writeJson(response, 400, { error: "missing_run_id" });
    return true;
  }
  writeJson(response, 200, await workbench.getFacebookProductVideoMiningRunStatus(runId));
  return true;
};

const handleFacebookLatestRequest = async (
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<boolean> => {
  writeJson(response, 200, await workbench.getLatestFacebookProductVideoMiningRun());
  return true;
};

const readRunId = (response: ServerResponse, url: URL): string | null => {
  const runId = url.searchParams.get("runId");
  if (!runId) {
    writeJson(response, 400, { error: "missing_run_id" });
    return null;
  }
  return runId;
};

const handleFacebookResultsRequest = async (
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> => {
  const runId = readRunId(response, url);
  if (!runId) return true;
  const run = await workbench.getFacebookProductVideoMiningRunStatus(runId);
  if (!run) {
    writeJson(response, 404, { error: "run_not_found" });
    return true;
  }
  writeJson(response, 200, {
    run,
    records: await workbench.listFacebookProductVideoMiningSavedRecords(runId),
  });
  return true;
};

const handleFacebookExportRequest = async (
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> => {
  const runId = readRunId(response, url);
  if (!runId) return true;
  const exported = await workbench.exportFacebookProductVideoMiningSelectionRecords(runId);
  if (!exported) {
    writeJson(response, 404, { error: "run_not_found" });
    return true;
  }
  writeJson(response, 200, exported);
  return true;
};

export const handleFacebookRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> => {
  if (request.method !== "POST" && request.method !== "GET") {
    return false;
  }
  const routeHandlers: Partial<Record<string, FacebookRouteHandler>> = {
    "POST:/api/facebook-product-video-mining/mission": () => handleFacebookMissionRequest(request, response, workbench),
    "GET:/api/facebook-product-video-mining/run": () => handleFacebookRunRequest(response, workbench, url),
    "GET:/api/facebook-product-video-mining/latest": () => handleFacebookLatestRequest(response, workbench),
    "GET:/api/facebook-product-video-mining/results": () => handleFacebookResultsRequest(response, workbench, url),
    "GET:/api/facebook-product-video-mining/export": () => handleFacebookExportRequest(response, workbench, url),
  };
  const routeHandler = routeHandlers[`${request.method}:${url.pathname}`];
  return routeHandler ? routeHandler() : false;
};
