import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { URL } from "node:url";

import { renderCommanderConsolePage } from "../lib/local-app-shell/render-commander-console-page.js";
import { getLocaleFromRequestUrl } from "../lib/localization/locale.js";
import { GrassEyeWorkbench } from "../lib/local-runtime/workbench.js";
import { handleCandidateRequest } from "./candidate-api-handlers.js";
import { handleRuntimeReadRequest } from "./runtime-api-handlers.js";
import { handleTaskRequest } from "./task-api-handlers.js";
import { getArtifactContentType } from "./workbench-api-helpers.js";

async function handleArtifactOrRootRequest(
  request: import("node:http").IncomingMessage,
  response: import("node:http").ServerResponse,
  activeWorkbench: GrassEyeWorkbench,
  url: URL,
): Promise<boolean> {
  if (request.method === "GET" && url.pathname.startsWith("/artifacts/")) {
    const artifactName = path.basename(url.pathname);
    const filePath = path.join(activeWorkbench.evidenceStore.getDataDir(), "artifacts", artifactName);
    response.writeHead(200, { "content-type": getArtifactContentType(filePath) });
    createReadStream(filePath).pipe(response);
    return true;
  }

  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    const locale = getLocaleFromRequestUrl(url);
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(renderCommanderConsolePage(await activeWorkbench.getCommanderConsoleSnapshot(), { locale, requestUrl: url }));
    return true;
  }

  return false;
}

async function handleRequest(
  request: import("node:http").IncomingMessage,
  response: import("node:http").ServerResponse,
  activeWorkbench: GrassEyeWorkbench,
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

  if (await handleArtifactOrRootRequest(request, response, activeWorkbench, url)) {
    return;
  }

  response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ error: "not_found" }));
}

export function createWorkbenchServer(input: {
  workbench: GrassEyeWorkbench;
  baseUrl: string;
}): ReturnType<typeof createServer> {
  return createServer(async (request, response) => {
    await handleRequest(request, response, input.workbench, input.baseUrl);
  });
}