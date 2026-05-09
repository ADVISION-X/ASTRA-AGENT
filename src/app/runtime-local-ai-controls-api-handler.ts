import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { LocalAiModelRoleSchema } from "../types/local-ai.js";

import { readJsonBody, writeJson } from "./runtime-api-response.js";

async function handleRuntimeLocalAiControlsGet(
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
): Promise<boolean> {
  writeJson(response, 200, await activeWorkbench.getLocalAiRoleControls());
  return true;
}

async function handleRuntimeLocalAiControlsPost(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
): Promise<boolean> {
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

export async function handleRuntimeLocalAiControlsRequest(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> {
  if (url.pathname !== "/api/runtime/local-ai-controls") {
    return false;
  }

  if (request.method === "GET") {
    return handleRuntimeLocalAiControlsGet(response, activeWorkbench);
  }

  if (request.method !== "POST") {
    return false;
  }

  return handleRuntimeLocalAiControlsPost(request, response, activeWorkbench);
}