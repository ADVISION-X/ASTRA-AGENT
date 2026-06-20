import type { IncomingMessage, ServerResponse } from "node:http";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { readJsonBody, writeJson } from "./workbench-http.js";

const handlePick3Start = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<void> => {
  const body = await readJsonBody(request);
  writeJson(response, 200, await workbench.startPick3IsBlindEvalTask(body));
};

const handlePick3Latest = async (
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<void> => {
  const latest = await workbench.getLatestPick3IsBlindEvalTask();
  writeJson(response, latest ? 200 : 404, latest ?? { error: "pick3_task_not_found" });
};

const handlePick3History = async (
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<void> => {
  writeJson(response, 200, { tasks: await workbench.listPick3HumanReviewHistory() });
};

const handlePick3Trend = async (
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<void> => {
  writeJson(response, 200, await workbench.listPick3TrendSnapshot());
};

const handlePick3ReviewTask = async (
  url: URL,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<void> => {
  const taskId = url.searchParams.get("taskId") ?? "";
  const detail = taskId ? await workbench.getPick3HumanReviewTask(taskId) : null;
  writeJson(response, detail ? 200 : 404, detail ?? { error: "pick3_human_review_task_not_found" });
};

const handlePick3ReviewInteraction = async (
  url: URL,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<void> => {
  const taskId = url.searchParams.get("taskId") ?? "";
  const interactionId = url.searchParams.get("interactionId") ?? "";
  const answer = taskId && interactionId
    ? await workbench.getPick3HumanReviewInteraction({ interactionId, taskId })
    : null;
  writeJson(response, answer ? 200 : 404, answer ?? { error: "pick3_human_review_interaction_not_found" });
};

const handlePick3DeleteTask = async (
  url: URL,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<void> => {
  const taskId = url.searchParams.get("taskId") ?? "";
  const result = taskId ? await workbench.deletePick3HumanReviewTask(taskId) : null;
  writeJson(response, result ? 200 : 404, result ?? { error: "pick3_human_review_task_not_found" });
};

const handlePick3GetRequest = async (
  path: string,
  url: URL,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<boolean> => {
  if (path === "/api/pick3-is-blind-eval/history") await handlePick3History(response, workbench);
  else if (path === "/api/pick3-is-blind-eval/trend") await handlePick3Trend(response, workbench);
  else if (path === "/api/pick3-is-blind-eval/task") await handlePick3ReviewTask(url, response, workbench);
  else if (path === "/api/pick3-is-blind-eval/interaction") await handlePick3ReviewInteraction(url, response, workbench);
  else if (path === "/api/pick3-is-blind-eval/latest") await handlePick3Latest(response, workbench);
  else return false;
  return true;
};

const handlePick3WriteRequest = async (
  request: IncomingMessage,
  path: string,
  url: URL,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<boolean> => {
  if (request.method === "POST" && path === "/api/pick3-is-blind-eval/start") await handlePick3Start(request, response, workbench);
  else if (request.method === "DELETE" && path === "/api/pick3-is-blind-eval/task") await handlePick3DeleteTask(url, response, workbench);
  else return false;
  return true;
};

export const handlePick3Request = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<boolean> => {
  const path = request.url?.split("?")[0] ?? "";
  const url = new URL(request.url ?? "/", "http://localhost");
  if (request.method === "GET") return handlePick3GetRequest(path, url, response, workbench);
  return handlePick3WriteRequest(request, path, url, response, workbench);
};
