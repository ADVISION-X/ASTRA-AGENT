import type { IncomingMessage, ServerResponse } from "node:http";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { writeJson } from "./workbench-http.js";

export const handleProductionRuntimeRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> => {
  if (request.method !== "GET" || url.pathname !== "/api/production-runtime/operations-snapshot") return false;
  const jobId = url.searchParams.get("jobId")?.trim() || undefined;
  const snapshot = await workbench.readProductionOperationsSnapshot(jobId);
  writeJson(response, 200, snapshot);
  return true;
};
