import type { IncomingMessage, ServerResponse } from "node:http";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { writeJson } from "./workbench-http.js";

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
    request.method === "GET"
    && url.pathname === "/api/xuanxue-ai-production/status"
  ) {
    const orderId = readOrderId(url);
    if (!orderId) {
      writeJson(response, 400, { error: "missing_order_id" });
      return true;
    }
    const quarantined = workbench.readXuanxueAiProductionQuarantine(orderId);
    if (quarantined) {
      writeJson(response, 200, {
        order: quarantined,
        quarantine: {
          state: "review_required",
          reason: quarantined.failureReason,
        },
      });
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

  return false;
};
