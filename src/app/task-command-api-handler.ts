import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { parseJsonBody, writeJsonResponse } from "./workbench-api-helpers.js";

type MissionCommandBody = {
  reason?: string;
  targetMissionId?: string;
};

type MissionCommandConfig = {
  path: string;
  childCapabilityId: "pause-mission" | "resume-mission" | "stop-mission" | "emergency-stop";
  buildInput: (body: MissionCommandBody) => Record<string, string | null>;
};

const MISSION_COMMANDS: readonly MissionCommandConfig[] = [
  {
    path: "/api/tasks/pause",
    childCapabilityId: "pause-mission",
    buildInput: (body) => ({
      targetMissionId: body.targetMissionId?.trim() || null,
      operatorNote: body.reason?.trim() || null,
    }),
  },
  {
    path: "/api/tasks/resume",
    childCapabilityId: "resume-mission",
    buildInput: (body) => ({
      targetMissionId: body.targetMissionId?.trim() || null,
      operatorNote: body.reason?.trim() || null,
    }),
  },
  {
    path: "/api/tasks/stop",
    childCapabilityId: "stop-mission",
    buildInput: (body) => ({ operatorNote: body.reason?.trim() || null }),
  },
  {
    path: "/api/tasks/emergency-stop",
    childCapabilityId: "emergency-stop",
    buildInput: (body) => ({
      targetMissionId: body.targetMissionId?.trim() || null,
      operatorNote: body.reason?.trim() || null,
    }),
  },
] as const;

const findMissionCommand = (pathname: string): MissionCommandConfig | undefined => {
  return MISSION_COMMANDS.find((command) => command.path === pathname);
};

export async function handleMissionCommandRequest(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> {
  if (request.method !== "POST") {
    return false;
  }

  const command = findMissionCommand(url.pathname);
  if (!command) {
    return false;
  }

  const body = await parseJsonBody(request) as MissionCommandBody;
  const result = await activeWorkbench.commanderConsole.execute({
    childCapabilityId: command.childCapabilityId,
    operatorRef: "commander-console:http",
    input: command.buildInput(body),
  });
  writeJsonResponse(response, 200, result);
  return true;
}