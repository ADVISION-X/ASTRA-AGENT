import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";

import { GrassEyeWorkbench } from "../lib/local-runtime/workbench.js";

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

  if (request.method === "GET" && url.pathname === "/api/runtime/mission-readiness") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(await activeWorkbench.getMissionReadinessReport(), null, 2));
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/runtime/snapshot") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(await activeWorkbench.getCommanderConsoleSnapshot(), null, 2));
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/runtime/logs") {
    response.writeHead(410, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "runtime_logs_removed_from_commander_console_ui" }));
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/runtime/actions") {
    response.writeHead(410, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "runtime_actions_removed_from_commander_console_ui" }));
    return true;
  }

  return false;
}