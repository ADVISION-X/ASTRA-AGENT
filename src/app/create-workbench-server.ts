import { createServer } from "node:http";
import { URL } from "node:url";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { handleWorkbenchApiBoundary, type WorkbenchApiBoundaryDecision } from "./workbench-api-boundary.js";
import { writeCorsPreflight, writeJson } from "./workbench-http.js";
import { renderWorkbenchHomePage } from "./workbench-home-page.js";
import { handleXuanxueAiProductionRequest } from "./workbench-xuanxue-ai-production-routes.js";
import { upgradeWorkbenchBrowserAuthoritySocket } from "./workbench-browser-websocket-upgrade.js";

const HOME_PAGE_PATHS = new Set(["/", "/index.html"]);
const optionalHeader = (request: import("node:http").IncomingMessage, name: string): string | undefined => {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
};
const recordBoundary = (input: { decision: Exclude<WorkbenchApiBoundaryDecision, { kind: "not_api_request" }>; request: import("node:http").IncomingMessage; url: URL; workbench: GrassEyeWorkbenchHandle }) => {
  const rule = input.decision.kind === "allowed" ? input.decision.routeRule : undefined;
  input.workbench.recordWorkbenchApiBoundaryEvent({
    authenticated: optionalHeader(input.request, "x-grasseye-agent-key") !== undefined,
    decision: input.decision.kind === "allowed" ? "allowed" : "blocked",
    jobOwner: rule?.jobOwner,
    method: input.request.method,
    originCategory: input.decision.kind === "allowed" ? "local-ui" : "unknown",
    path: input.url.pathname,
    reason: input.decision.kind === "allowed" ? "allowed" : input.decision.reason,
    requestId: optionalHeader(input.request, "x-grasseye-request-id"),
    routePurpose: rule?.purpose,
    sourceSystem: optionalHeader(input.request, "x-grasseye-source-system"),
  });
};

async function handleRequest(request: import("node:http").IncomingMessage, response: import("node:http").ServerResponse, workbench: GrassEyeWorkbenchHandle, baseUrl: string): Promise<void> {
  const url = new URL(request.url || "/", baseUrl);
  if (request.method === "GET" && HOME_PAGE_PATHS.has(url.pathname)) {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(renderWorkbenchHomePage());
    return;
  }
  const decision = handleWorkbenchApiBoundary({ method: request.method, path: url.pathname, origin: request.headers.origin, headers: request.headers, baseUrl });
  if (request.method === "OPTIONS") {
    if (decision.kind === "allowed") { recordBoundary({ decision, request, url, workbench }); writeCorsPreflight(response, decision.corsHeaders); return; }
    writeJson(response, 404, { error: "not_found" });
    return;
  }
  if (decision.kind === "blocked") { recordBoundary({ decision, request, url, workbench }); writeJson(response, decision.statusCode, { error: decision.error, reason: decision.reason }, decision.corsHeaders); return; }
  if (decision.kind === "allowed") {
    recordBoundary({ decision, request, url, workbench });
    for (const [name, value] of Object.entries(decision.corsHeaders)) response.setHeader(name, value);
    if (url.pathname === "/api/health") { writeJson(response, 200, await workbench.getHealthReport()); return; }
    if (url.pathname === "/api/mode") { writeJson(response, 200, { mode: workbench.getModeInfo() }); return; }
    if (url.pathname === "/api/browser-authority/pairing") { writeJson(response, 200, workbench.readBrowserAuthorityPairingState(), { "cache-control": "no-store, max-age=0", "referrer-policy": "no-referrer" }); return; }
    if (await handleXuanxueAiProductionRequest(request, response, workbench, url)) return;
  }
  writeJson(response, 404, { error: "not_found" });
}

export function createWorkbenchServer(input: { workbench: GrassEyeWorkbenchHandle; baseUrl: string }): ReturnType<typeof createServer> {
  const server = createServer((request, response) => handleRequest(request, response, input.workbench, input.baseUrl).catch((error) => {
    writeJson(response, 500, { error: "workbench_request_failed", failureReason: error instanceof Error ? error.message : String(error) });
  }));
  server.on("upgrade", (request, socket, head) => {
    if (!upgradeWorkbenchBrowserAuthoritySocket({ request, socket, head, workbench: input.workbench })) socket.destroy();
  });
  return server;
}
