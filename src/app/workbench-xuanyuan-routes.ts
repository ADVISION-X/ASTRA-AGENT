import type { IncomingMessage, ServerResponse } from "node:http";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { readJsonBody, writeJson } from "./workbench-http.js";

const readTaskId = (url: URL): string | null => {
  const taskId = url.searchParams.get("taskId");
  return taskId && taskId.trim().length > 0 ? taskId.trim() : null;
};

const handleXuanyuanStart = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<void> => {
  writeJson(response, 202, await workbench.startXuanyuanTaskAsync(await readJsonBody(request)));
};

const handleXuanyuanStatus = async (
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<void> => {
  const taskId = readTaskId(url);
  if (!taskId) {
    writeJson(response, 400, { error: "missing_task_id" });
    return;
  }
  const task = await workbench.getXuanyuanTaskStatus(taskId);
  writeJson(response, task ? 200 : 404, task ?? { error: "xuanyuan_task_not_found", taskId });
};

export const handleXuanyuanRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> => {
  if (request.method === "POST" && url.pathname === "/api/xuanyuan/simulate") {
    await handleXuanyuanStart(request, response, workbench);
    return true;
  }
  if (request.method === "GET" && url.pathname === "/api/xuanyuan/status") {
    await handleXuanyuanStatus(response, workbench, url);
    return true;
  }
  if (request.method === "GET" && url.pathname === "/api/xuanyuan/latest") {
    writeJson(response, 200, await workbench.getLatestXuanyuanTask());
    return true;
  }
  if (request.method === "GET" && url.pathname === "/api/xuanyuan/history") {
    writeJson(response, 200, { tasks: await workbench.listXuanyuanHistory() });
    return true;
  }
  return false;
};
