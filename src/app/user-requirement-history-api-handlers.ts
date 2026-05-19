import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";

import { parseJsonBody, writeJsonResponse } from "./workbench-api-helpers.js";
import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import type { UserRequirementHistoryPlatformId } from "../lib/local-runtime/settings-types.js";

type UserRequirementHistoryBody = {
  id?: string | null;
  title?: string | null;
  userRequirementText?: string;
  selectedPlatforms?: UserRequirementHistoryPlatformId[];
  maxRounds?: number;
  maxMinutes?: number;
};

type UserRequirementHistoryUpsertInput = {
  id: string | null;
  title: string | null;
  userRequirementText: string;
  selectedPlatforms: UserRequirementHistoryPlatformId[];
  maxRounds: number;
  maxMinutes: number;
};

const USER_REQUIREMENT_HISTORY_INVALID_RESPONSE = {
  error: "user_requirement_history_invalid",
  failureReason: "userRequirementText, selectedPlatforms, maxRounds, and maxMinutes are required.",
} as const;

function normalizeSelectedPlatforms(value: unknown): UserRequirementHistoryPlatformId[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value
    .map((item) => (item === "facebook-web" || item === "tiktok-web") ? item : null)
    .filter((item): item is UserRequirementHistoryPlatformId => item !== null)));
}

function normalizePositiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 ? value : null;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const nextValue = value?.trim();
  return nextValue ? nextValue : null;
}

function parseHistoryUpsertInput(body: UserRequirementHistoryBody): UserRequirementHistoryUpsertInput | null {
  const userRequirementText = body.userRequirementText?.trim();
  const selectedPlatforms = normalizeSelectedPlatforms(body.selectedPlatforms);
  const maxRounds = normalizePositiveInteger(body.maxRounds);
  const maxMinutes = normalizePositiveInteger(body.maxMinutes);
  if (!userRequirementText || selectedPlatforms.length === 0 || maxRounds === null || maxMinutes === null) {
    return null;
  }
  return {
    id: normalizeOptionalText(body.id ?? null),
    title: normalizeOptionalText(body.title ?? null),
    userRequirementText,
    selectedPlatforms,
    maxRounds,
    maxMinutes,
  };
}

async function handleHistoryListRequest(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> {
  if (request.method !== "GET" || url.pathname !== "/api/user-requirements/history") {
    return false;
  }
  writeJsonResponse(response, 200, { entries: await activeWorkbench.getUserRequirementHistory() });
  return true;
}

async function handleHistoryUpsertRequest(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> {
  if (request.method !== "POST" || url.pathname !== "/api/user-requirements/history") {
    return false;
  }

  const body = await parseJsonBody(request) as UserRequirementHistoryBody;
  const upsertInput = parseHistoryUpsertInput(body);
  if (!upsertInput) {
    writeJsonResponse(response, 400, USER_REQUIREMENT_HISTORY_INVALID_RESPONSE);
    return true;
  }

  writeJsonResponse(response, 200, {
    entry: await activeWorkbench.upsertUserRequirementHistory(upsertInput),
  });
  return true;
}

async function handleHistoryDeleteRequest(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> {
  if (request.method !== "DELETE" || !url.pathname.startsWith("/api/user-requirements/history/")) {
    return false;
  }

  const id = decodeURIComponent(url.pathname.slice("/api/user-requirements/history/".length)).trim();
  if (!id) {
    writeJsonResponse(response, 400, { error: "user_requirement_history_invalid", failureReason: "history id is required." });
    return true;
  }

  const deleted = await activeWorkbench.deleteUserRequirementHistory(id);
  const wasDeleted = Boolean(deleted);
  writeJsonResponse(response, wasDeleted ? 200 : 404, { deleted: wasDeleted, id });
  return true;
}

async function handleHistoryReuseRequest(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> {
  if (request.method !== "POST" || !url.pathname.startsWith("/api/user-requirements/history/") || !url.pathname.endsWith("/reuse")) {
    return false;
  }

  const id = decodeURIComponent(url.pathname.slice("/api/user-requirements/history/".length, -"/reuse".length)).trim();
  if (!id) {
    writeJsonResponse(response, 400, { error: "user_requirement_history_invalid", failureReason: "history id is required." });
    return true;
  }

  const entry = await activeWorkbench.reuseUserRequirementHistory(id);
  writeJsonResponse(response, entry ? 200 : 404, { entry, id, reused: Boolean(entry) });
  return true;
}

export async function handleUserRequirementHistoryRequest(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> {
  if (await handleHistoryListRequest(request, response, activeWorkbench, url)) {
    return true;
  }
  if (await handleHistoryUpsertRequest(request, response, activeWorkbench, url)) {
    return true;
  }
  if (await handleHistoryReuseRequest(request, response, activeWorkbench, url)) {
    return true;
  }
  return handleHistoryDeleteRequest(request, response, activeWorkbench, url);
}