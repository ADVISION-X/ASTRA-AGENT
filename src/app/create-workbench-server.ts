import { createServer } from "node:http";
import { URL } from "node:url";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { handleWorkbenchApiBoundary, type WorkbenchApiBoundaryDecision } from "./workbench-api-boundary.js";
import { readRequestBuffer, writeCorsPreflight, writeJson } from "./workbench-http.js";
import { renderWorkbenchHomePage } from "./workbench-home-page.js";
import { readMultipartFormData } from "./workbench-multipart.js";
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

const readContentType = (request: import("node:http").IncomingMessage): string => {
  const value = request.headers["content-type"];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
};

const readApiBodyPreview = async (
  request: import("node:http").IncomingMessage,
  maxBytes = Number.POSITIVE_INFINITY,
): Promise<unknown> => {
  const contentType = readContentType(request);
  if (contentType.startsWith("application/json")) {
    const raw = (await readRequestBuffer(request, maxBytes)).toString("utf8").trim();
    return raw ? { json: JSON.parse(raw) } : { json: {} };
  }
  if (contentType.startsWith("multipart/form-data")) {
    const form = await readMultipartFormData(request);
    return {
      fields: Object.fromEntries(form.fields.entries()),
      files: [...form.files.keys()],
    };
  }
  return undefined;
};

const buildWorkbenchApiBoundaryInput = (input: {
  request: import("node:http").IncomingMessage;
  url: URL;
  baseUrl: string;
  method?: string | undefined;
  bodyPreview?: unknown;
}) => ({
  method: input.method ?? input.request.method,
  path: input.url.pathname,
  origin: input.request.headers.origin,
  headers: input.request.headers,
  baseUrl: input.baseUrl,
  bodyPreview: input.bodyPreview,
});

const writeBlockedApiBoundaryDecision = (
  response: import("node:http").ServerResponse,
  decision: Extract<WorkbenchApiBoundaryDecision, { kind: "blocked" }>,
): void => {
  writeJson(response, decision.statusCode, {
    error: decision.error,
    reason: decision.reason,
  }, decision.corsHeaders);
};

const readOptionalHeader = (
  request: import("node:http").IncomingMessage,
  name: string,
): string | undefined => {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
};

const recordApiBoundaryDecision = (input: {
  decision: Exclude<WorkbenchApiBoundaryDecision, { kind: "not_api_request" }>;
  request: import("node:http").IncomingMessage;
  url: URL;
  workbench: GrassEyeWorkbenchHandle;
}): void => {
  const routeRule = input.decision.kind === "allowed" ? input.decision.routeRule : undefined;
  input.workbench.recordWorkbenchApiBoundaryEvent({
    authenticated: readOptionalHeader(input.request, "x-grasseye-signature") !== undefined,
    decision: input.decision.kind === "allowed" ? "allowed" : "blocked",
    jobOwner: routeRule?.jobOwner,
    method: input.request.method,
    originCategory: input.decision.kind === "allowed" ? input.decision.originCategory : "unknown",
    path: input.url.pathname,
    reason: input.decision.kind === "allowed" ? "allowed" : input.decision.reason,
    requestId: readOptionalHeader(input.request, "x-grasseye-request-id"),
    routePurpose: routeRule?.purpose,
    sourceSystem: readOptionalHeader(input.request, "x-grasseye-source-system"),
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
  if (input.request.method === "GET" && input.url.pathname === "/api/mode") {
    writeJson(input.response, 200, { mode: input.workbench.getModeInfo() });
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
      recordApiBoundaryDecision({ decision, request, url, workbench });
      writeCorsPreflight(response, decision.corsHeaders);
      return;
    }
    if (decision.kind === "blocked") {
      recordApiBoundaryDecision({ decision, request, url, workbench });
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
    recordApiBoundaryDecision({ decision: boundaryDecision, request, url, workbench });
    writeBlockedApiBoundaryDecision(response, boundaryDecision);
    return;
  }
  if (boundaryDecision.kind === "allowed") {
    let allowedDecision = boundaryDecision;
    if (boundaryDecision.originCategory === "external-website" && request.method !== "GET") {
      const bodyPreview = await readApiBodyPreview(request, Number.POSITIVE_INFINITY);
      const bodyDecision = handleWorkbenchApiBoundary(buildWorkbenchApiBoundaryInput({ request, url, baseUrl, bodyPreview }));
      if (bodyDecision.kind === "blocked") {
        recordApiBoundaryDecision({ decision: bodyDecision, request, url, workbench });
        writeBlockedApiBoundaryDecision(response, bodyDecision);
        return;
      }
      if (bodyDecision.kind === "allowed") {
        allowedDecision = bodyDecision;
      }
    }
    recordApiBoundaryDecision({ decision: allowedDecision, request, url, workbench });
    setResponseHeaders(response, allowedDecision.corsHeaders);
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
