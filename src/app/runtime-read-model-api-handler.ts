import type { ServerResponse } from "node:http";
import type { URL } from "node:url";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { getRuntimeResourceUsageSnapshot } from "../lib/local-runtime/runtime-resource-usage.js";

import { writeJson } from "./runtime-api-response.js";

async function handleRuntimeReportRequest(response: ServerResponse, activeWorkbench: GrassEyeWorkbenchHandle, url: URL): Promise<boolean> {
  if (url.pathname === "/api/runtime/health") {
    writeJson(response, 200, await activeWorkbench.getHealthReport());
    return true;
  }
  if (url.pathname === "/api/runtime/mission-readiness") {
    writeJson(response, 200, await activeWorkbench.getMissionReadinessReport());
    return true;
  }
  if (url.pathname === "/api/runtime/snapshot") {
    writeJson(response, 200, await activeWorkbench.getCommanderConsoleSnapshot());
    return true;
  }
  if (url.pathname === "/api/runtime/resource-usage") {
    const requestedLimit = Number.parseInt(url.searchParams.get("limit") ?? "12", 10);
    writeJson(response, 200, await getRuntimeResourceUsageSnapshot({
      limit: Number.isFinite(requestedLimit) ? requestedLimit : 12,
      modeInfo: activeWorkbench.getModeInfo(),
    }));
    return true;
  }
  return false;
}

export async function handleRuntimeReadModelRequest(response: ServerResponse, activeWorkbench: GrassEyeWorkbenchHandle, url: URL, _tail: number): Promise<boolean> {
  return handleRuntimeReportRequest(response, activeWorkbench, url);
}