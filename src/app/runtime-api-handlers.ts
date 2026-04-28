import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";

import { GrassEyeWorkbench } from "../lib/local-runtime/workbench.js";
import { parseTailParam } from "./workbench-api-helpers.js";

export async function handleRuntimeReadRequest(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbench,
  url: URL,
): Promise<boolean> {
  if (request.method === "GET" && url.pathname === "/api/runtime/health") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(await activeWorkbench.getHealthReport(), null, 2));
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/runtime/snapshot") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(await activeWorkbench.getCommanderConsoleSnapshot(), null, 2));
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/runtime/logs") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(await activeWorkbench.evidenceStore.listStructuredRuntimeEvents(parseTailParam(url)), null, 2));
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/runtime/actions") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(await activeWorkbench.evidenceStore.listStructuredActionLogs(parseTailParam(url)), null, 2));
    return true;
  }

  return false;
}