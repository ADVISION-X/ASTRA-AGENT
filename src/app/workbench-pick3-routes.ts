import type { IncomingMessage, ServerResponse } from "node:http";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { readJsonBody, writeJson } from "./workbench-http.js";

export const handlePick3Request = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<boolean> => {
  const path = request.url?.split("?")[0] ?? "";
  if (request.method === "POST" && path === "/api/pick3-is-blind-eval/start") {
    const body = await readJsonBody(request);
    writeJson(response, 200, await workbench.startPick3IsBlindEvalTask(body));
    return true;
  }
  if (request.method === "GET" && path === "/api/pick3-is-blind-eval/latest") {
    const latest = await workbench.getLatestPick3IsBlindEvalTask();
    if (!latest) {
      writeJson(response, 404, { error: "pick3_task_not_found" });
      return true;
    }
    writeJson(response, 200, latest);
    return true;
  }
  return false;
};
