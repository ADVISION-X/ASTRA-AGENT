import type { IncomingMessage, ServerResponse } from "node:http";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { readJsonBody, writeJson } from "./workbench-http.js";
import { runXuanxueProviderInputPreflight } from "../plugins/xuanxue-ai-production/xuanxue-ai-production-provider-input-preflight.js";

const readOrderId = (url: URL): string | null => {
  const orderId = url.searchParams.get("orderId")?.trim();
  return orderId || null;
};

export const handleXuanxueAiProductionRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> => {
  if (
    request.method === "POST"
    && url.pathname === "/api/plugins/xuanxue-ai-production/provider-input-preflight"
  ) {
    const result = await runXuanxueProviderInputPreflight({
      rawInput: await readJsonBody(request),
      aiInputGateway: workbench.getAiInputGatewayAbilityGroup(),
    });
    writeJson(response, 200, result);
    return true;
  }
  if (
    request.method === "GET"
    && url.pathname === "/api/xuanxue-ai-production/status"
  ) {
    const orderId = readOrderId(url);
    if (!orderId) {
      writeJson(response, 400, { error: "missing_order_id" });
      return true;
    }
    const status = workbench.readXuanxueAiProductionStatus(orderId);
    writeJson(
      response,
      status ? 200 : 404,
      status ?? { error: "xuanxue_ai_production_order_not_found", orderId },
    );
    return true;
  }

  if (
    request.method === "POST"
    && url.pathname.startsWith("/api/xuanxue-ai-production/")
  ) {
    const action = url.pathname.slice("/api/xuanxue-ai-production/".length);
    const body = await readJsonBody(request);
    if (action === "pause") {
      writeJson(response, 200, workbench.pauseXuanxueAiProduction(body));
      return true;
    }
    if (action === "cancel") {
      writeJson(response, 200, workbench.cancelXuanxueAiProduction(body));
      return true;
    }
    if (action === "takeover") {
      writeJson(response, 200, workbench.takeoverXuanxueAiProduction(body));
      return true;
    }
    if (action === "resume") {
      writeJson(response, 200, workbench.resumeXuanxueAiProduction(body));
      return true;
    }
  }
  return false;
};
