import type { IncomingMessage } from "node:http";

import { createId } from "../lib/local-runtime/ids.js";
import { parseJsonBody } from "./workbench-api-helpers.js";
import { resolveMissionStartBinding } from "./task-start-binding.js";
import { normalizePositiveInteger, normalizeRequestedPlatformId } from "./task-start-normalizers.js";
import type { MissionStartBindingResult } from "./task-start-types.js";

type StartTaskRequestBody = {
  commandSource?: string;
  humanGoal?: string;
  taskTemplateId?: string;
  requestedPlatformId?: string;
  selectedMapId?: string;
  targetProfileRef?: string;
  maxRounds?: number;
  maxMinutes?: number;
};

export type TaskStartDraft = {
  traceId: string;
  attemptId: string;
  commandSource: string;
  humanGoal: string | null;
  maxRounds: number | undefined;
  maxMinutes: number | undefined;
  mapId: string | null;
  resolvedTaskTemplateId: string | null;
  resolvedBinding: MissionStartBindingResult;
};

export async function createTaskStartDraft(request: IncomingMessage): Promise<TaskStartDraft> {
  const body = await parseJsonBody(request) as StartTaskRequestBody;
  const taskTemplateId = body.taskTemplateId?.trim() || null;
  const resolvedBinding = resolveMissionStartBinding({
    taskTemplateId,
    requestedPlatformId: normalizeRequestedPlatformId(body.requestedPlatformId),
    selectedMapId: body.selectedMapId?.trim() || null,
  });

  return {
    traceId: createId("trace"),
    attemptId: createId("attempt"),
    commandSource: body.commandSource?.trim() || "task-api:http-post",
    humanGoal: body.humanGoal?.trim() || null,
    maxRounds: normalizePositiveInteger(body.maxRounds, 9),
    maxMinutes: normalizePositiveInteger(body.maxMinutes, 180),
    mapId: resolvedBinding.ok ? resolvedBinding.selectedMapId : body.selectedMapId?.trim() || null,
    resolvedTaskTemplateId: resolvedBinding.ok ? resolvedBinding.taskTemplateId : taskTemplateId,
    resolvedBinding,
  };
}