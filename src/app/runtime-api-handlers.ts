import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { LocalAiModelRoleSchema } from "../types/local-ai.js";
import { getRuntimeResourceUsageSnapshot } from "./runtime-resource-usage.js";

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

async function handleRuntimeReportRequest(response: ServerResponse, activeWorkbench: GrassEyeWorkbenchHandle, url: URL): Promise<boolean> {
  if (url.pathname === "/api/runtime/health") {
    writeJson(response, 200, await activeWorkbench.getHealthReport());
    return true;
  }
  if (url.pathname === "/api/runtime/mission-readiness") {
    writeJson(response, 200, await activeWorkbench.getMissionReadinessReport());
    return true;
  }
  if (url.pathname === "/api/runtime/snapshot") {
    writeJson(response, 200, await activeWorkbench.getCommanderConsoleSnapshot());
    return true;
  }
  if (url.pathname === "/api/runtime/resource-usage") {
    const requestedLimit = Number.parseInt(url.searchParams.get("limit") ?? "12", 10);
    writeJson(response, 200, await getRuntimeResourceUsageSnapshot({
      limit: Number.isFinite(requestedLimit) ? requestedLimit : 12,
      modeInfo: activeWorkbench.getModeInfo(),
    }));
    return true;
  }
  return false;
}

async function handleRuntimeTimelineRequest(response: ServerResponse, activeWorkbench: GrassEyeWorkbenchHandle, url: URL, tail: number): Promise<boolean> {
  if (url.pathname === "/api/runtime/logs") {
    writeJson(response, 200, await activeWorkbench.listRuntimeDebugEvents(tail));
    return true;
  }
  if (url.pathname === "/api/runtime/actions") {
    writeJson(response, 200, await activeWorkbench.listRuntimeDebugActions(tail));
    return true;
  }
  return url.pathname === "/api/runtime/local-ai-controls"
    ? (writeJson(response, 200, await activeWorkbench.getLocalAiRoleControls()), true)
    : false;
}

async function handleRuntimeGetRequest(response: ServerResponse, activeWorkbench: GrassEyeWorkbenchHandle, url: URL, tail: number): Promise<boolean> {
  if (await handleRuntimeReportRequest(response, activeWorkbench, url)) {
    return true;
  }
  return handleRuntimeTimelineRequest(response, activeWorkbench, url, tail);
}

async function handleRuntimeLocalAiControlUpdate(request: IncomingMessage, response: ServerResponse, activeWorkbench: GrassEyeWorkbenchHandle): Promise<boolean> {
  if (request.method !== "POST") {
    return false;
  }
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

export async function handleRuntimeReadRequest(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> {
  const requestedTail = Number.parseInt(url.searchParams.get("tail") ?? "200", 10);
  const tail = Number.isFinite(requestedTail) ? requestedTail : 200;

  if (request.method === "GET" && await handleRuntimeGetRequest(response, activeWorkbench, url, tail)) {
    return true;
  }

  if (url.pathname === "/api/runtime/local-ai-controls" && await handleRuntimeLocalAiControlUpdate(request, response, activeWorkbench)) {
    return true;
  }

  return false;
}
