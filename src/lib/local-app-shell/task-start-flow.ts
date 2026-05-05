import type { IncomingMessage, ServerResponse } from "node:http";

import { createId } from "../local-runtime/ids.js";
import type { GrassEyeWorkbenchHandle } from "../local-runtime/workbench-handle.js";
import { parseTaskJsonBody } from "./task-http-helpers.js";
import {
  clampStartRunLimits,
  normalizePositiveInteger,
  normalizeRequestedPlatformId,
  resolveMissionStartBinding,
  type MissionStartBinding,
} from "./task-start-binding.js";
import {
  recordTaskStartDraftEvents,
  recordTaskStartLocalAiReadiness,
  recordTaskStartPreflightStart,
  recordCommanderEnvelopeBuilt,
  recordTaskStartCommandAccepted,
  sendBlockedTaskStartPreflight,
  sendTaskStartBindingFailure,
} from "./task-start-support.js";
import { writeTaskStartDispatchResult } from "./task-start-dispatch-result.js";
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
    operatorNote: body.operatorNote?.trim() || null,
  };
};

const buildApproval = (draft: StartDraft, binding: Extract<MissionStartBinding, { ok: true }>): StartApproval => {
  const runLimit = clampStartRunLimits(binding.taskTemplateId, {
    maxRounds: draft.maxRounds,
    maxMinutes: draft.maxMinutes,
  });
  return { ...draft, ...runLimit, binding };
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
      activationSnapshotRef: approval.binding.activationSnapshotRef,
      targetProfileRef: approval.binding.targetProfileRef,
      ...(approval.humanGoal ? { humanGoal: approval.humanGoal } : {}),
      ...(approval.maxRounds ? { maxRounds: approval.maxRounds } : {}),
      ...(approval.maxMinutes ? { maxMinutes: approval.maxMinutes } : {}),
      ...(approval.operatorNote ? { operatorNote: approval.operatorNote } : {}),
    },
  };
};

const getApprovedTaskStartPreflight = async (
  activeWorkbench: GrassEyeWorkbenchHandle,
  approval: StartApproval,
) => {
  await recordTaskStartPreflightStart(activeWorkbench, approval);
  const preflight = await activeWorkbench.getMissionStartPreflight({
    requestedPlatformId: approval.binding.requestedPlatformId,
    selectedMapId: approval.binding.selectedMapId,
    taskTemplateId: approval.binding.taskTemplateId,
    activationId: approval.binding.activationId,
    activationSnapshotRef: approval.binding.activationSnapshotRef,
    targetProfileRef: approval.binding.targetProfileRef,
  });
  await recordTaskStartLocalAiReadiness(activeWorkbench, approval, preflight.components.find((component) => component.name === "localAi"));
  return preflight;
};

const recordMissionPreflightPassed = async (
  activeWorkbench: GrassEyeWorkbenchHandle,
  approval: StartApproval,
  reason: string,
) => {
  await activeWorkbench.recordCommanderDebugEvent({
    eventType: "MISSION_PREFLIGHT_PASSED",
    status: "success",
    traceId: approval.traceId,
    spanId: "mission-preflight-passed",
    attemptId: approval.attemptId,
    mapId: approval.binding.selectedMapId,
    taskTemplateId: approval.binding.taskTemplateId,
    reason,
    actionableMessage: "Dispatch the governed human command through Commander Console and Nerve Bus.",
    ownerResponsible: "Commander Console / Nerve Bus",
  });
};

const executeApprovedTaskStart = async (
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
  approval: StartApproval,
  preflightReason: string,
) => {
  await recordMissionPreflightPassed(activeWorkbench, approval, preflightReason);
  await recordTaskStartCommandAccepted(activeWorkbench, approval);
  await recordCommanderEnvelopeBuilt(activeWorkbench, approval);
  const result = await activeWorkbench.commanderConsole.execute({
    childCapabilityId: "issue-human-command",
    operatorRef: "commander-console:http",
    input: buildStartMissionInput(approval),
  });
  await writeTaskStartDispatchResult(response, activeWorkbench, approval, result);
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
  const preflight = await getApprovedTaskStartPreflight(activeWorkbench, approval);
  if (preflight.status === "blocked") {
    await sendBlockedTaskStartPreflight(response, activeWorkbench, approval, preflight);
    return true;
  }

  await executeApprovedTaskStart(response, activeWorkbench, approval, preflight.actionableMessage);
  return true;
}
