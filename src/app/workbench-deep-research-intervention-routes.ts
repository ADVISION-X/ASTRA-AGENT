import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { PluginInterventionRequestSchema } from "../types/plugin-intervention.js";
import { readJsonBody, writeJson } from "./workbench-http.js";

const interventionBase = "/api/deep-research-analysis/intervention";

export const handleDeepResearchIntervention = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> => {
  if (request.method === "GET" && url.pathname === `${interventionBase}/status`) {
    const taskId = url.searchParams.get("taskId")?.trim();
    if (!taskId) { writeJson(response, 400, { error: "TASK_ID_REQUIRED" }); return true; }
    writeJson(response, 200, await workbench.readDeepResearchIntervention(taskId));
    return true;
  }
  if (request.method !== "POST") return false;
  const invoke = url.pathname === `${interventionBase}/pause` ? workbench.pauseDeepResearch
    : url.pathname === `${interventionBase}/cancel` ? workbench.cancelDeepResearch
      : url.pathname === `${interventionBase}/takeover` ? workbench.takeoverDeepResearch
        : url.pathname === `${interventionBase}/resume` ? workbench.resumeDeepResearch : null;
  if (!invoke) return false;
  try {
    const input = PluginInterventionRequestSchema.parse(await readJsonBody(request));
    writeJson(response, 200, await invoke(input));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    writeJson(response, reason === "STALE_INTERVENTION_REVISION" ? 409 : 400, { error: reason });
  }
  return true;
};
