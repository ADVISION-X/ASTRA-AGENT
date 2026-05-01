import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";

import { GrassEyeWorkbench } from "../lib/local-runtime/workbench.js";
import { handleMissionCommandRequest } from "./task-mission-command-api-handler.js";
import { handleTaskStartRequest } from "./task-start-api-handler.js";

export async function handleTaskRequest(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbench,
  url: URL,
): Promise<boolean> {
  if (request.method === "POST" && url.pathname === "/api/tasks/start") {
    return handleTaskStartRequest(request, response, activeWorkbench);
  }

  return handleMissionCommandRequest(request, response, activeWorkbench, url);
}