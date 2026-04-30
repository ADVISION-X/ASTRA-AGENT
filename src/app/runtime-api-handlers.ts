import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";

import { GrassEyeWorkbench } from "../lib/local-runtime/workbench.js";
import { LocalAiModelRoleSchema } from "../types/local-ai.js";

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function writeJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload, null, 2));
}

export async function handleRuntimeReadRequest(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbench,
  url: URL,
): Promise<boolean> {
  const requestedTail = Number.parseInt(url.searchParams.get("tail") ?? "200", 10);
  const tail = Number.isFinite(requestedTail) ? requestedTail : 200;

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
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(await activeWorkbench.listRuntimeDebugEvents(tail), null, 2));
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/runtime/actions") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(await activeWorkbench.listRuntimeDebugActions(tail), null, 2));
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/runtime/local-ai-controls") {
    writeJson(response, 200, await activeWorkbench.getLocalAiRoleControls());
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/runtime/local-ai-controls") {
    try {
      const payload = await readJsonBody(request);
      if (!payload || typeof payload !== "object") {
        throw new Error("Local AI control request body must be an object.");
      }
      const role = LocalAiModelRoleSchema.parse((payload as { role?: unknown }).role);
      const enabled = (payload as { enabled?: unknown }).enabled;
      if (typeof enabled !== "boolean") {
        throw new Error("Local AI control request requires boolean enabled.");
      }
      writeJson(response, 200, await activeWorkbench.setLocalAiRoleStartupState({ role, enabled }));
    } catch (error) {
      writeJson(response, 400, {
        error: "invalid_local_ai_control_request",
        failureReason: error instanceof Error ? error.message : String(error),
      });
    }
    return true;
  }

  return false;
}
