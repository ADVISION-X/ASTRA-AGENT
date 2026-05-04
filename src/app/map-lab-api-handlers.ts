import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { parseJsonBody, writeJsonResponse } from "./workbench-api-helpers.js";

type AiProviderCompany = "openai" | "deepseek" | "openrouter";

const AI_PROVIDER_COMPANY_DEFAULTS: Record<AiProviderCompany, { baseUrl: string; model: string }> = {
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4.1-mini" },
  deepseek: { baseUrl: "https://api.deepseek.com", model: "deepseek-chat" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-4.1-mini" },
};

function normalizeProviderCompany(value: unknown): AiProviderCompany {
  return value === "deepseek" || value === "openrouter" ? value : "openai";
}

async function handleProviderConfigRequest(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> {
  if (request.method === "GET" && url.pathname === "/api/map-lab/state") {
    writeJsonResponse(response, 200, await activeWorkbench.getMapLabSnapshot());
    return true;
  }
  if (request.method !== "POST" || url.pathname !== "/api/ai-provider-settings/provider-config") {
    return false;
  }
  const body = await parseJsonBody(request) as {
    displayName?: string | null;
    providerKind?: string | null;
    providerCompany?: string | null;
    baseUrl?: string;
    model?: string;
    apiKey?: string;
    allowPaidProvider?: boolean;
    providerAllowlist?: string[];
    dataPolicy?: { allowExternalTransmission?: boolean };
    costPolicy?: { maxEstimatedCost?: number };
    operatorApprovalRef?: string | null;
    approvalReason?: string | null;
  };
  const providerCompany = normalizeProviderCompany(body.providerCompany);
  const providerDefaults = AI_PROVIDER_COMPANY_DEFAULTS[providerCompany];
  const baseUrl = body.baseUrl?.trim() || providerDefaults.baseUrl;
  const model = body.model?.trim() || providerDefaults.model;
  if (!baseUrl || !model || !body.apiKey) {
    writeJsonResponse(response, 400, { error: "invalid_provider_config" });
    return true;
  }
  writeJsonResponse(response, 200, await activeWorkbench.saveMapLabProviderConfig({
    baseUrl,
    model,
    apiKey: body.apiKey,
    displayName: body.displayName ?? null,
    providerCompany,
    providerKind: body.providerKind ?? "openai-compatible",
    allowPaidProvider: body.allowPaidProvider ?? true,
    providerAllowlist: body.providerAllowlist ?? ["paid-analysis-ai"],
    dataPolicy: body.dataPolicy ?? { allowExternalTransmission: true },
    costPolicy: body.costPolicy ?? { maxEstimatedCost: 5 },
    operatorApprovalRef: body.operatorApprovalRef ?? null,
    approvalReason: body.approvalReason ?? null,
  }));
  return true;
}

async function handleGenerateDraftRequest(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> {
  if (request.method !== "POST" || url.pathname !== "/api/map-lab/generate") {
    return false;
  }
  writeJsonResponse(response, 200, await activeWorkbench.generateMapLabDraft(await parseJsonBody(request)));
  return true;
}

async function handleApproveDraftRequest(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> {
  if (request.method !== "POST" || url.pathname !== "/api/map-lab/approve") {
    return false;
  }
  const body = await parseJsonBody(request) as { packageId?: string; packageVersion?: string; approvedBy?: string };
  if (!body.packageId || !body.packageVersion || !body.approvedBy) {
    writeJsonResponse(response, 400, { error: "invalid_map_lab_approval_request" });
    return true;
  }
  writeJsonResponse(response, 200, await activeWorkbench.approveMapLabDraft({
    packageId: body.packageId,
    packageVersion: body.packageVersion,
    approvedBy: body.approvedBy,
  }));
  return true;
}

async function handleActivateDraftRequest(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> {
  if (request.method !== "POST" || url.pathname !== "/api/map-lab/activate") {
    return false;
  }
  const body = await parseJsonBody(request) as {
    packageId?: string;
    packageVersion?: string;
    approvedBy?: string;
    reason?: string;
  };
  if (!body.packageId || !body.packageVersion || !body.approvedBy || !body.reason) {
    writeJsonResponse(response, 400, { error: "invalid_map_lab_activation_request" });
    return true;
  }
  writeJsonResponse(response, 200, await activeWorkbench.activateMapLabDraft({
    packageId: body.packageId,
    packageVersion: body.packageVersion,
    approvedBy: body.approvedBy,
    reason: body.reason,
  }));
  return true;
}

export async function handleMapLabRequest(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> {
  if (await handleProviderConfigRequest(request, response, activeWorkbench, url)) {
    return true;
  }
  if (await handleGenerateDraftRequest(request, response, activeWorkbench, url)) {
    return true;
  }
  if (await handleApproveDraftRequest(request, response, activeWorkbench, url)) {
    return true;
  }
  return handleActivateDraftRequest(request, response, activeWorkbench, url);
}
