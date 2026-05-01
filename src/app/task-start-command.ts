import type { ServerResponse } from "node:http";

import { GrassEyeWorkbench } from "../lib/local-runtime/workbench.js";
import { sendJson } from "./task-api-response.js";
import type { MissionStartBindingSuccess } from "./task-start-binding.js";
import type { TaskStartDraft } from "./task-start-request-draft.js";

type CommanderExecuteResult = Awaited<ReturnType<GrassEyeWorkbench["commanderConsole"]["execute"]>>;

type TaskStartExecution = {
  result: CommanderExecuteResult;
  resultMessage: string;
  targetMissionId: string | null;
};

const getResultMessage = (result: CommanderExecuteResult): string => {
  return result.output !== null
    && typeof result.output === "object"
    && "message" in result.output
    && typeof result.output.message === "string"
    ? result.output.message
    : "Commander Console completed the governed human command dispatch.";
};

const getTargetMissionId = (result: CommanderExecuteResult): string | null => {
  return result.output !== null
    && typeof result.output === "object"
    && "targetMissionId" in result.output
    && typeof result.output.targetMissionId === "string"
    ? result.output.targetMissionId
    : null;
};

export async function executeTaskStartCommand(activeWorkbench: GrassEyeWorkbench, draft: TaskStartDraft, binding: MissionStartBindingSuccess): Promise<TaskStartExecution> {
  const result = await activeWorkbench.commanderConsole.execute({
    childCapabilityId: "issue-human-command",
    operatorRef: "commander-console:http",
    input: {
      commandType: "start-mission",
      requestedPlatformId: binding.requestedPlatformId,
      selectedMapId: binding.selectedMapId,
      humanGoal: draft.humanGoal,
      maxRounds: draft.maxRounds,
      maxMinutes: draft.maxMinutes,
      initialPayload: {
        kind: "start-mission",
        requestedBy: "commander-console",
        requestedPlatformId: binding.requestedPlatformId,
        selectedMapId: binding.selectedMapId,
        taskTemplateId: binding.taskTemplateId,
        activationId: binding.activationId,
        ...(draft.humanGoal ? { humanGoal: draft.humanGoal } : {}),
        ...(draft.maxRounds ? { maxRounds: draft.maxRounds } : {}),
        ...(draft.maxMinutes ? { maxMinutes: draft.maxMinutes } : {}),
      },
    },
  });

  return {
    result,
    resultMessage: getResultMessage(result),
    targetMissionId: getTargetMissionId(result),
  };
}

const recordAcceptedCommand = async (activeWorkbench: GrassEyeWorkbench, draft: TaskStartDraft, binding: MissionStartBindingSuccess, execution: TaskStartExecution) => {
  await activeWorkbench.recordCommanderDebugEvent({
    eventType: "COMMAND_ACCEPTED",
    status: "success",
    traceId: draft.traceId,
    spanId: "command-accepted",
    attemptId: draft.attemptId,
    missionId: execution.targetMissionId,
    mapId: binding.selectedMapId,
    taskTemplateId: binding.taskTemplateId,
    reason: execution.resultMessage,
    actionableMessage: "Mission dispatch succeeded. Monitor the mission page and runtime proof timeline.",
    ownerResponsible: "Commander Console / Nerve Bus / Orchestration",
  });
};

const recordRejectedCommand = async (activeWorkbench: GrassEyeWorkbench, draft: TaskStartDraft, binding: MissionStartBindingSuccess, execution: TaskStartExecution) => {
  await activeWorkbench.recordCommanderDebugEvent({
    eventType: "COMMAND_REJECTED",
    status: execution.result.status === "review_required" ? "review_required" : "failed",
    traceId: draft.traceId,
    spanId: "command-rejected",
    attemptId: draft.attemptId,
    missionId: execution.targetMissionId,
    mapId: binding.selectedMapId,
    taskTemplateId: binding.taskTemplateId,
    failureReason: execution.result.failureReason ?? execution.result.reviewRequiredReason ?? execution.resultMessage,
    actionableMessage: execution.result.reviewRequiredReason
      ? "Open the review queue and inspect the guarded command result before retrying."
      : "Inspect the latest debug bundle and fix the blocking dependency before retrying.",
    ownerResponsible: "Commander Console / Nerve Bus / Orchestration",
  });
};

export async function handleTaskStartOutcome(input: {
  response: ServerResponse;
  activeWorkbench: GrassEyeWorkbench;
  draft: TaskStartDraft;
  binding: MissionStartBindingSuccess;
  execution: TaskStartExecution;
}): Promise<true> {
  if (input.execution.result.status === "success") {
    await recordAcceptedCommand(input.activeWorkbench, input.draft, input.binding, input.execution);
    sendJson(input.response, 200, input.execution.result);
    return true;
  }

  await recordRejectedCommand(input.activeWorkbench, input.draft, input.binding, input.execution);
  sendJson(input.response, 409, { ...input.execution.result, traceId: input.draft.traceId, attemptId: input.draft.attemptId });
  return true;
}