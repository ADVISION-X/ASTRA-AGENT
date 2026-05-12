import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { parseJsonBody, writeJsonResponse } from "./workbench-api-helpers.js";

type SaveRunLimitSettingsBody = {
  defaultMaxRounds?: unknown;
  defaultMaxMinutes?: unknown;
};

type SaveOnlineAiProviderSettingsBody = {
  displayName?: unknown;
  apiKey?: unknown;
  modelName?: unknown;
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

async function handleGetOnlineAiProviderSettings(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> {
  if (request.method !== "GET" || url.pathname !== "/api/app-settings/online-ai-provider") {
    return false;
  }

  try {
    writeJsonResponse(response, 200, await activeWorkbench.getOnlineAiProviderSettings());
  } catch (error) {
    writeJsonResponse(response, 200, {
      providerCompany: "google",
      providerKind: "gemini-api",
      displayName: "Google Gemini",
      modelName: "gemini-2.5-flash-lite",
      endpoint: "https://generativelanguage.googleapis.com/v1beta",
      hasApiKey: false,
      maskedApiKey: null,
      updatedAt: null,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
  return true;
}

async function handleSaveOnlineAiProviderSettings(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> {
  if (request.method !== "POST" || url.pathname !== "/api/app-settings/online-ai-provider") {
    return false;
  }

  const body = await parseJsonBody(request) as SaveOnlineAiProviderSettingsBody;
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (apiKey.length < 10) {
    writeJsonResponse(response, 400, {
      error: "invalid_online_ai_provider_settings",
      failureReason: "Google Gemini API key is required.",
    });
    return true;
  }

  writeJsonResponse(response, 200, await activeWorkbench.saveOnlineAiProviderSettings({
    displayName: typeof body.displayName === "string" ? body.displayName : null,
    apiKey,
    modelName: typeof body.modelName === "string" ? body.modelName : null,
  }));
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
  if (await handleGetOnlineAiProviderSettings(request, response, activeWorkbench, url)) {
    return true;
  }
  if (await handleSaveOnlineAiProviderSettings(request, response, activeWorkbench, url)) {
    return true;
  }
  return handleSaveRunLimitSettings(request, response, activeWorkbench, url);
}
