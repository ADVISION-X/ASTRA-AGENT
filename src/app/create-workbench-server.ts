import { createServer } from "node:http";
import { URL } from "node:url";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { handleWorkbenchApiBoundary, type WorkbenchApiBoundaryDecision } from "./workbench-api-boundary.js";
import { writeCorsPreflight, writeJson } from "./workbench-http.js";
import { renderWorkbenchHomePage } from "./workbench-home-page.js";
import { handleProductionRuntimeRequest } from "./workbench-production-runtime-routes.js";
import { upgradeWorkbenchBrowserAuthoritySocket } from "./workbench-browser-websocket-upgrade.js";

const HOME_PAGE_PATHS = new Set(["/", "/index.html"]);

const resolveWorkbenchRequestUrl = (
  request: import("node:http").IncomingMessage,
  baseUrl: string,
): URL => new URL(request.url || "/", baseUrl);

const setResponseHeaders = (
  response: import("node:http").ServerResponse,
  headers: Record<string, string>,
): void => {
  for (const [name, value] of Object.entries(headers)) {
    response.setHeader(name, value);
  }
};

const buildWorkbenchApiBoundaryInput = (input: {
  request: import("node:http").IncomingMessage;
  url: URL;
  baseUrl: string;
  method?: string | undefined;
}) => ({
  method: input.method ?? input.request.method,
  path: input.url.pathname,
  origin: input.request.headers.origin,
  headers: input.request.headers,
  baseUrl: input.baseUrl,
});

const writeBlockedApiBoundaryDecision = (
  response: import("node:http").ServerResponse,
  decision: Extract<WorkbenchApiBoundaryDecision, { kind: "blocked" }>,
): void => {
  writeJson(response, decision.statusCode, {
    error: decision.error,
  }, decision.corsHeaders);
};

const recordApiBoundaryDecision = (input: {
  decision: Exclude<WorkbenchApiBoundaryDecision, { kind: "not_api_request" }>;
  workbench: GrassEyeWorkbenchHandle;
}): void => {
  input.workbench.recordWorkbenchApiBoundaryEvent({
    decision: input.decision.kind === "allowed" ? "allowed" : "blocked",
    reason: input.decision.kind === "allowed" ? "allowed" : input.decision.error,
  });
};

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
  if (input.request.method === "GET" && input.url.pathname === "/api/health") {
    writeJson(input.response, 200, await input.workbench.getHealthReport());
    return true;
  }
  if (input.request.method === "GET" && input.url.pathname === "/api/browser-authority/pairing") {
    writeJson(input.response, 200, input.workbench.readBrowserExtensionBootstrapState(), {
      "cache-control": "no-store, max-age=0",
      "pragma": "no-cache",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
    });
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
  if (await handleProductionRuntimeRequest(
    input.request,
    input.response,
    input.workbench,
    input.url,
  )) {
    return true;
  }
  return false;
};

async function handleRequest(
  request: import("node:http").IncomingMessage,
  response: import("node:http").ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  baseUrl: string,
): Promise<void> {
  const url = resolveWorkbenchRequestUrl(request, baseUrl);

  if (request.method === "OPTIONS") {
    const method = typeof request.headers["access-control-request-method"] === "string"
      ? request.headers["access-control-request-method"]
      : undefined;
    const decision = handleWorkbenchApiBoundary(buildWorkbenchApiBoundaryInput({ request, url, baseUrl, method }));
    if (decision.kind === "allowed") {
      recordApiBoundaryDecision({ decision, workbench });
      writeCorsPreflight(response, decision.corsHeaders);
      return;
    }
    if (decision.kind === "blocked") {
      recordApiBoundaryDecision({ decision, workbench });
      writeBlockedApiBoundaryDecision(response, decision);
      return;
    }
    writeJson(response, 404, { error: "not_found" });
    return;
  }

  if (handleWorkbenchHomeRequest(request, response, url)) {
    return;
  }

  const boundaryDecision = handleWorkbenchApiBoundary(buildWorkbenchApiBoundaryInput({ request, url, baseUrl }));
  if (boundaryDecision.kind === "blocked") {
    recordApiBoundaryDecision({ decision: boundaryDecision, workbench });
    writeBlockedApiBoundaryDecision(response, boundaryDecision);
    return;
  }
  if (boundaryDecision.kind === "allowed") {
    recordApiBoundaryDecision({ decision: boundaryDecision, workbench });
    setResponseHeaders(response, boundaryDecision.corsHeaders);
    if (await handleKnownWorkbenchApiRequest({ request, response, workbench, url })) {
      return;
    }
  }

  writeJson(response, 404, { error: "not_found" });
}

export function createWorkbenchServer(input: {
  workbench: GrassEyeWorkbenchHandle;
  baseUrl: string;
}): ReturnType<typeof createServer> {
  const server = createServer(async (request, response) => {
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
  server.on("upgrade", (request, socket, head) => {
    if (!upgradeWorkbenchBrowserAuthoritySocket({ request, socket, head, workbench: input.workbench })) socket.destroy();
  });
  return server;
}
