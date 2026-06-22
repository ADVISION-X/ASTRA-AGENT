import type { IncomingMessage, ServerResponse } from "node:http";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { readRequestBuffer, writeJson } from "./workbench-http.js";

const readJsonBody = async (request: IncomingMessage): Promise<unknown> => {
  const raw = (await readRequestBuffer(request)).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
};

export const handleLotteryTicketPlanRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<boolean> => {
  if (request.method !== "POST" || request.url?.split("?")[0] !== "/api/lottery-ticket-plan/generate") {
    return false;
  }
  writeJson(response, 200, workbench.generateLotteryTicketPlan(await readJsonBody(request)));
  return true;
};
