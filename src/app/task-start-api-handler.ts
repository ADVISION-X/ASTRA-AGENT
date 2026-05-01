import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";

import type { GrassEyeWorkbench } from "../lib/local-runtime/workbench.js";
import { runTaskStartFlow } from "../lib/local-app-shell/task-start-flow.js";

export async function handleTaskStartRequest(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbench,
  url: URL,
): Promise<boolean> {
  if (request.method !== "POST" || url.pathname !== "/api/tasks/start") {
    return false;
  }

  return runTaskStartFlow(request, response, activeWorkbench);
}