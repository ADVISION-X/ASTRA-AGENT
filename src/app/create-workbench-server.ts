import { createServer } from "node:http";
import { URL } from "node:url";

import { renderCommanderConsolePage } from "../lib/local-app-shell/render-commander-console-page.js";
import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { handleAppSettingsRequest } from "./app-settings-api-handlers.js";
import { handleCandidateRequest } from "./candidate-api-handlers.js";
import { handleMapLabRequest } from "./map-lab-api-handlers.js";
import { handleRuntimeReadRequest } from "./runtime-api-handlers.js";
import { handleTaskRequest } from "./task-api-handlers.js";

async function handleArtifactOrRootRequest(
  request: import("node:http").IncomingMessage,
  response: import("node:http").ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> {
  if (request.method === "GET" && url.pathname.startsWith("/artifacts/")) {
    response.writeHead(410, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "artifact_streaming_removed_from_commander_console_ui" }));
    return true;
  }

  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    const [dashboard, appRunLimitSettings] = await Promise.all([
      activeWorkbench.getCommanderConsoleSnapshot(),
      activeWorkbench.getAppRunLimitSettings(),
    ]);
    const html = renderCommanderConsolePage({ dashboard, appRunLimitSettings }, url);
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(html);
    return true;
  }

  return false;
}

async function handleRequest(
  request: import("node:http").IncomingMessage,
  response: import("node:http").ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
  activeBaseUrl: string,
): Promise<void> {
  const url = new URL(request.url ?? "/", activeBaseUrl);

  if (await handleRuntimeReadRequest(request, response, activeWorkbench, url)) {
    return;
  }

  if (await handleTaskRequest(request, response, activeWorkbench, url)) {
    return;
  }

  if (await handleCandidateRequest(request, response, activeWorkbench, url)) {
    return;
  }

  if (await handleAppSettingsRequest(request, response, activeWorkbench, url)) {
    return;
  }

  if (await handleMapLabRequest(request, response, activeWorkbench, url)) {
    return;
  }

  if (await handleArtifactOrRootRequest(request, response, activeWorkbench, url)) {
    return;
  }

  response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ error: "not_found" }));
}

export function createWorkbenchServer(input: {
  workbench: GrassEyeWorkbenchHandle;
  baseUrl: string;
}): ReturnType<typeof createServer> {
  return createServer(async (request, response) => {
    try {
      await handleRequest(request, response, input.workbench, input.baseUrl);
    } catch (error) {
      const failureReason = error instanceof Error ? error.message : String(error);
      if (!response.headersSent) {
        response.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      }
      response.end(JSON.stringify({ error: "workbench_request_failed", failureReason }));
    }
  });
}
