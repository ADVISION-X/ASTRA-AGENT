import type { IncomingMessage, ServerResponse } from "node:http";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { writeJson } from "./workbench-http.js";

export const handleProductionRuntimeRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> => {
  if (request.method !== "GET" || ![
    "/api/production-runtime/status",
    "/api/production-runtime/diagnosis",
  ].includes(url.pathname)) return false;
  const jobId = url.searchParams.get("jobId")?.trim();
  if (!jobId) {
    writeJson(response, 400, { error: "missing_job_id" });
    return true;
  }
  if (url.pathname === "/api/production-runtime/diagnosis") {
    const diagnosis = workbench.diagnoseProductionRuntime(jobId);
    writeJson(response, diagnosis.status === "DIAGNOSIS_COMPLETE" ? 200 : 409, diagnosis);
    return true;
  }
  const status = workbench.readProductionTaskStatus(jobId);
  writeJson(response, status ? 200 : 404, status ? {
    ...status,
    atomic_steps: workbench.diagnoseProductionRuntime(jobId).atomicSteps,
  } : { error: "production_task_not_found", jobId });
  return true;
};
