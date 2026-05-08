import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { parseJsonBody, writeJsonResponse } from "./workbench-api-helpers.js";

type SaveRunLimitSettingsBody = {
  defaultMaxRounds?: unknown;
  defaultMaxMinutes?: unknown;
};

function normalizePositiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 ? value : null;
}

async function handleGetRunLimitSettings(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> {
  if (request.method !== "GET" || url.pathname !== "/api/app-settings/run-limits") {
    return false;
  }

  writeJsonResponse(response, 200, await activeWorkbench.getAppRunLimitSettings());
  return true;
}

async function handleSaveRunLimitSettings(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> {
  if (request.method !== "POST" || url.pathname !== "/api/app-settings/run-limits") {
    return false;
  }

  const body = await parseJsonBody(request) as SaveRunLimitSettingsBody;
  const defaultMaxRounds = normalizePositiveInteger(body.defaultMaxRounds);
  const defaultMaxMinutes = normalizePositiveInteger(body.defaultMaxMinutes);
  if (defaultMaxRounds === null || defaultMaxMinutes === null) {
    writeJsonResponse(response, 400, {
      error: "invalid_run_limit_settings",
      failureReason: "defaultMaxRounds and defaultMaxMinutes must both be positive integers.",
    });
    return true;
  }

  writeJsonResponse(response, 200, await activeWorkbench.saveAppRunLimitSettings({ defaultMaxRounds, defaultMaxMinutes }));
  return true;
}

export async function handleAppSettingsRequest(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> {
  if (await handleGetRunLimitSettings(request, response, activeWorkbench, url)) {
    return true;
  }
  return handleSaveRunLimitSettings(request, response, activeWorkbench, url);
}