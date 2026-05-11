import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { handleRuntimeReadModelRequest } from "./runtime-read-model-api-handler.js";

export async function handleRuntimeReadRequest(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> {
  const requestedTail = Number.parseInt(url.searchParams.get("tail") ?? "200", 10);
  const tail = Number.isFinite(requestedTail) ? requestedTail : 200;

  if (request.method === "GET" && await handleRuntimeReadModelRequest(response, activeWorkbench, url, tail)) {
    return true;
  }

  return false;
}
