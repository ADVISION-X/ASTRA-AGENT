import type { IncomingMessage, ServerResponse } from "node:http";

import { createId } from "../local-runtime/ids.js";
import type { GrassEyeWorkbenchHandle } from "../local-runtime/workbench-handle.js";
import { parseTaskJsonBody } from "./task-http-helpers.js";
import {
  normalizePositiveInteger,
  normalizeRequestedPlatformId,
  resolveMissionStartBinding,
  type MissionStartBinding,
} from "./task-start-binding.js";
import {
  recordTaskStartDraftEvents,
  recordTaskStartLocalAiReadiness,
  recordTaskStartPreflightStart,
  sendBlockedTaskStartPreflight,
  sendTaskStartBindingFailure,
  writeTaskStartDispatchResult,
} from "./task-start-support.js";
import type { StartApproval, StartDraft, StartTaskBody } from "./task-start-types.js";

const buildStartDraft = async (request: IncomingMessage): Promise<StartDraft> => {
  const body = await parseTaskJsonBody(request) as StartTaskBody;
  return {
    traceId: createId("trace"),
    attemptId: createId("attempt"),
    commandSource: body.commandSource?.trim() || "task-api:http-post",
    humanGoal: body.humanGoal?.trim() || null,
    taskTemplateId: body.taskTemplateId?.trim() || null,
    requestedPlatformId: normalizeRequestedPlatformId(body.requestedPlatformId),
    selectedMapId: body.selectedMapId?.trim() || null,
    maxRounds: normalizePositiveInteger(body.maxRounds, 9),
    maxMinutes: normalizePositiveInteger(body.maxMinutes, 180),
  };
};

const buildApproval = (draft: StartDraft, binding: Extract<MissionStartBinding, { ok: true }>): StartApproval => {
  return { ...draft, binding };
};

const buildStartMissionInput = (approval: StartApproval) => {
  return {
    commandType: "start-mission" as const,
    requestedPlatformId: approval.binding.requestedPlatformId,
    selectedMapId: approval.binding.selectedMapId,
    humanGoal: approval.humanGoal,
    maxRounds: approval.maxRounds,
    maxMinutes: approval.maxMinutes,
    initialPayload: {
      kind: "start-mission" as const,
      requestedBy: "commander-console" as const,
      requestedPlatformId: approval.binding.requestedPlatformId,
      selectedMapId: approval.binding.selectedMapId,
      taskTemplateId: approval.binding.taskTemplateId,
      activationId: approval.binding.activationId,
      ...(approval.humanGoal ? { humanGoal: approval.humanGoal } : {}),
      ...(approval.maxRounds ? { maxRounds: approval.maxRounds } : {}),
      ...(approval.maxMinutes ? { maxMinutes: approval.maxMinutes } : {}),
    },
  };
};

export async function runTaskStartFlow(request: IncomingMessage, response: ServerResponse, activeWorkbench: GrassEyeWorkbenchHandle): Promise<true> {
  const draft = await buildStartDraft(request);
  const binding = resolveMissionStartBinding({
    taskTemplateId: draft.taskTemplateId,
    requestedPlatformId: draft.requestedPlatformId,
    selectedMapId: draft.selectedMapId,
  });
  const taskTemplateId = binding.ok ? binding.taskTemplateId : draft.taskTemplateId;
  await recordTaskStartDraftEvents(activeWorkbench, draft, taskTemplateId);
  if (!binding.ok) {
    await sendTaskStartBindingFailure({ response, activeWorkbench, draft, taskTemplateId, binding });
    return true;
  }

  const approval = buildApproval(draft, binding);
  await recordTaskStartPreflightStart(activeWorkbench, approval);
  const preflight = await activeWorkbench.getMissionStartPreflight({
    requestedPlatformId: approval.binding.requestedPlatformId,
    selectedMapId: approval.binding.selectedMapId,
  });
  await recordTaskStartLocalAiReadiness(activeWorkbench, approval, preflight.components.find((component) => component.name === "localAi"));
  if (preflight.status === "blocked") {
    await sendBlockedTaskStartPreflight(response, activeWorkbench, approval, preflight);
    return true;
  }

  await activeWorkbench.recordCommanderDebugEvent({
    eventType: "MISSION_PREFLIGHT_PASSED",
    status: "success",
    traceId: approval.traceId,
    spanId: "mission-preflight-passed",
    attemptId: approval.attemptId,
    mapId: approval.binding.selectedMapId,
    taskTemplateId: approval.binding.taskTemplateId,
    reason: preflight.actionableMessage,
    actionableMessage: "Dispatch the governed human command through Commander Console and Nerve Bus.",
    ownerResponsible: "Commander Console / Nerve Bus",
  });
  const result = await activeWorkbench.commanderConsole.execute({
    childCapabilityId: "issue-human-command",
    operatorRef: "commander-console:http",
    input: buildStartMissionInput(approval),
  });
  await writeTaskStartDispatchResult(response, activeWorkbench, approval, result);
  return true;
}