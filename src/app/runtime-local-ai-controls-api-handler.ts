import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { writeJson } from "./runtime-api-response.js";

// Local AI controls have been governed out of the WorkbenchFacade.
// This handler returns 404 for all requests to /api/runtime/local-ai-controls.

export async function handleRuntimeLocalAiControlsRequest(
  _request: IncomingMessage,
  response: ServerResponse,
  _activeWorkbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> {
  if (url.pathname !== "/api/runtime/local-ai-controls") {
    return false;
  }
  writeJson(response, 404, { error: "not_found", failureReason: "Local AI controls endpoint has been removed." });
  return true;
}
