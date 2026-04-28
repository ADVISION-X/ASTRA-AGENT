import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";

import { buildStartMissionCommand } from "../capabilities/commander-console/command-builder.js";
import { GrassEyeWorkbench } from "../lib/local-runtime/workbench.js";
import { parseJsonBody } from "./workbench-api-helpers.js";

export async function handleTaskRequest(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbench,
  url: URL,
): Promise<boolean> {
  if (request.method === "POST" && url.pathname === "/api/tasks/start") {
    const body = await parseJsonBody(request) as { humanGoal?: string; requestedPlatformId?: string; selectedMapId?: string; initialPayload?: Record<string, unknown> };
    if (!body.requestedPlatformId && !body.selectedMapId) {
      response.writeHead(400, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: "requested_platform_or_map_required" }));
      return true;
    }
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(await activeWorkbench.commanderConsole.issueHumanCommand(buildStartMissionCommand(body)), null, 2));
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/tasks/pause") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(await activeWorkbench.commanderConsole.pauseMission(), null, 2));
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/tasks/stop") {
    const body = await parseJsonBody(request) as { reason?: string };
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(await activeWorkbench.commanderConsole.stopMission(body.reason), null, 2));
    return true;
  }

  return false;
}