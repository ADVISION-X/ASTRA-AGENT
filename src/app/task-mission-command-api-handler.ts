import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";

import { GrassEyeWorkbench } from "../lib/local-runtime/workbench.js";
import { sendJson } from "./task-api-response.js";
import { parseJsonBody } from "./workbench-api-helpers.js";

type MissionCommandRoute = {
  pathname: string;
  childCapabilityId: "pause-mission" | "resume-mission" | "stop-mission" | "emergency-stop";
  buildInput: (body: { reason?: string; targetMissionId?: string }) => Record<string, string | null>;
};

const trimOptional = (value?: string): string | null => value?.trim() || null;

const MISSION_COMMAND_ROUTES: MissionCommandRoute[] = [
  { pathname: "/api/tasks/pause", childCapabilityId: "pause-mission", buildInput: (body) => ({ targetMissionId: trimOptional(body.targetMissionId), operatorNote: trimOptional(body.reason) }) },
  { pathname: "/api/tasks/resume", childCapabilityId: "resume-mission", buildInput: (body) => ({ targetMissionId: trimOptional(body.targetMissionId), operatorNote: trimOptional(body.reason) }) },
  { pathname: "/api/tasks/stop", childCapabilityId: "stop-mission", buildInput: (body) => ({ operatorNote: trimOptional(body.reason) }) },
  { pathname: "/api/tasks/emergency-stop", childCapabilityId: "emergency-stop", buildInput: (body) => ({ targetMissionId: trimOptional(body.targetMissionId), operatorNote: trimOptional(body.reason) }) },
];

const getMissionCommandRoute = (request: IncomingMessage, url: URL): MissionCommandRoute | null => {
  if (request.method !== "POST") {
    return null;
  }

  return MISSION_COMMAND_ROUTES.find((route) => route.pathname === url.pathname) ?? null;
};

export async function handleMissionCommandRequest(request: IncomingMessage, response: ServerResponse, activeWorkbench: GrassEyeWorkbench, url: URL): Promise<boolean> {
  const route = getMissionCommandRoute(request, url);
  if (!route) {
    return false;
  }

  const body = await parseJsonBody(request) as { reason?: string; targetMissionId?: string };
  const result = await activeWorkbench.commanderConsole.execute({
    childCapabilityId: route.childCapabilityId,
    operatorRef: "commander-console:http",
    input: route.buildInput(body),
  });
  sendJson(response, 200, result);
  return true;
}