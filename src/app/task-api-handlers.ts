import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";

import { GrassEyeWorkbench } from "../lib/local-runtime/workbench.js";
import { parseJsonBody } from "./workbench-api-helpers.js";

function normalizeRequestedPlatformId(value?: string): "facebook-web" | "tiktok-web" | null {
  if (value === "facebook-web" || value === "tiktok-web") {
    return value;
  }

  return null;
}

export async function handleTaskRequest(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbench,
  url: URL,
): Promise<boolean> {
  if (request.method === "POST" && url.pathname === "/api/tasks/start") {
    const body = await parseJsonBody(request) as { humanGoal?: string; requestedPlatformId?: string; selectedMapId?: string };
    const requestedPlatformId = normalizeRequestedPlatformId(body.requestedPlatformId);
    const selectedMapId = body.selectedMapId?.trim() || null;
    const humanGoal = body.humanGoal?.trim() || null;
    if (!requestedPlatformId && !selectedMapId) {
      response.writeHead(400, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: "requested_platform_or_map_required" }));
      return true;
    }

    const result = await activeWorkbench.commanderConsole.execute({
      childCapabilityId: "issue-human-command",
      operatorRef: "commander-console:http",
      input: {
        commandType: "start-mission",
        requestedPlatformId,
        selectedMapId,
        humanGoal,
        initialPayload: {
          kind: "start-mission",
          requestedBy: "commander-console",
          ...(requestedPlatformId ? { requestedPlatformId } : {}),
          ...(selectedMapId ? { selectedMapId } : {}),
          ...(humanGoal ? { humanGoal } : {}),
        },
      },
    });
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(result, null, 2));
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/tasks/pause") {
    const result = await activeWorkbench.commanderConsole.execute({
      childCapabilityId: "pause-mission",
      operatorRef: "commander-console:http",
      input: {},
    });
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(result, null, 2));
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/tasks/stop") {
    const body = await parseJsonBody(request) as { reason?: string };
    const result = await activeWorkbench.commanderConsole.execute({
      childCapabilityId: "stop-mission",
      operatorRef: "commander-console:http",
      input: { operatorNote: body.reason?.trim() || null },
    });
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(result, null, 2));
    return true;
  }

  return false;
}