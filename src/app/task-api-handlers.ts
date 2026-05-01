import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { handleMissionCommandRequest } from "./task-command-api-handler.js";
import { handleTaskStartRequest } from "./task-start-api-handler.js";

export async function handleTaskRequest(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> {
  if (await handleTaskStartRequest(request, response, activeWorkbench, url)) {
    return true;
  }

  return handleMissionCommandRequest(request, response, activeWorkbench, url);
}