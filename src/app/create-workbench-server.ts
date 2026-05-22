import { createServer } from "node:http";
import { URL } from "node:url";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { handleAmazonRequest } from "./workbench-amazon-routes.js";
import { handleDeepResearchRequest } from "./workbench-deep-research-routes.js";
import { handleFacebookRequest } from "./workbench-facebook-routes.js";
import { writeCorsPreflight, writeJson } from "./workbench-http.js";
import { renderWorkbenchHomePage } from "./workbench-home-page.js";
import { handleVideoDownloadRequest } from "./workbench-video-download-routes.js";

const HOME_PAGE_PATHS = new Set(["/", "/index.html"]);

const resolveWorkbenchRequestUrl = (
  request: import("node:http").IncomingMessage,
  baseUrl: string,
): URL => new URL(request.url || "/", baseUrl);

const handleWorkbenchHomeRequest = (
  request: import("node:http").IncomingMessage,
  response: import("node:http").ServerResponse,
  url: URL,
): boolean => {
  if (request.method !== "GET" || !HOME_PAGE_PATHS.has(url.pathname)) {
    return false;
  }
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(renderWorkbenchHomePage());
  return true;
};

const handleWorkbenchMetaRequest = async (input: {
  request: import("node:http").IncomingMessage;
  response: import("node:http").ServerResponse;
  workbench: GrassEyeWorkbenchHandle;
  url: URL;
}): Promise<boolean> => {
  if (input.request.method !== "GET") {
    return false;
  }
  if (input.url.pathname === "/api/health") {
    writeJson(input.response, 200, await input.workbench.getHealthReport());
    return true;
  }
  if (input.url.pathname === "/api/mode") {
    writeJson(input.response, 200, { mode: input.workbench.getModeInfo() });
    return true;
  }
  return false;
};

const handleKnownWorkbenchApiRequest = async (input: {
  request: import("node:http").IncomingMessage;
  response: import("node:http").ServerResponse;
  workbench: GrassEyeWorkbenchHandle;
  url: URL;
}): Promise<boolean> => {
  if (await handleWorkbenchMetaRequest(input)) {
    return true;
  }
  if (await handleDeepResearchRequest(input.request, input.response, input.workbench, input.url)) {
    return true;
  }
  if (await handleAmazonRequest(input.request, input.response, input.workbench, input.url)) {
    return true;
  }
  if (await handleFacebookRequest(input.request, input.response, input.workbench, input.url)) {
    return true;
  }
  return handleVideoDownloadRequest(input.request, input.response, input.workbench);
};

async function handleRequest(
  request: import("node:http").IncomingMessage,
  response: import("node:http").ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  baseUrl: string,
): Promise<void> {
  const url = resolveWorkbenchRequestUrl(request, baseUrl);

  if (request.method === "OPTIONS") {
    writeCorsPreflight(response);
    return;
  }

  if (handleWorkbenchHomeRequest(request, response, url)) {
    return;
  }

  if (await handleKnownWorkbenchApiRequest({ request, response, workbench, url })) {
    return;
  }

  writeJson(response, 404, { error: "not_found" });
}

export function createWorkbenchServer(input: {
  workbench: GrassEyeWorkbenchHandle;
  baseUrl: string;
}): ReturnType<typeof createServer> {
  return createServer(async (request, response) => {
    try {
      await handleRequest(request, response, input.workbench, input.baseUrl);
    } catch (error) {
      const failureReason = error instanceof Error ? error.message : String(error);
      if (!response.headersSent) {
        writeJson(response, 500, { error: "workbench_request_failed", failureReason });
        return;
      }
      response.end(JSON.stringify({ error: "workbench_request_failed", failureReason }));
    }
  });
}
