import type { ServerResponse } from "node:http";

import type { GrassEyeWorkbench } from "../local-runtime/workbench.js";
import { writeTaskJsonResponse } from "./task-http-helpers.js";
import type { MissionStartBinding } from "./task-start-binding.js";
import type { StartApproval, StartCommandResult, StartDraft } from "./task-start-types.js";

const toNullableString = (value: string | undefined): string | null => value ?? null;

export async function recordTaskStartDraftEvents(activeWorkbench: GrassEyeWorkbench, draft: StartDraft, taskTemplateId: string | null) {
  await activeWorkbench.recordCommanderDebugEvent({
    eventType: "HUMAN_COMMAND_DRAFTED",
    status: "started",
    traceId: draft.traceId,
    spanId: "human-command-drafted",
    attemptId: draft.attemptId,
    mapId: draft.selectedMapId,
    taskTemplateId,
    reason: `Commander Console start-mission payload drafted from source=${draft.commandSource}.`,
    actionableMessage: "Persist the governed human-command draft before validation.",
    ownerResponsible: "Commander Console / Local App Shell",
  });
  await activeWorkbench.recordCommanderDebugEvent({
    eventType: "HUMAN_COMMAND_RECEIVED",
    status: "started",
    traceId: draft.traceId,
    spanId: "human-command-received",
    attemptId: draft.attemptId,
    mapId: draft.selectedMapId,
    taskTemplateId,
    reason: `Commander Console received a start-mission request from source=${draft.commandSource}.`,
    actionableMessage: "Validate the human command payload before dispatching it.",
    ownerResponsible: "Commander Console / Local App Shell",
  });
}

const buildBindingFailurePayload = (
  draft: StartDraft,
  binding: Extract<MissionStartBinding, { ok: false }>,
) => {
  return {
    error: "mission_start_binding_invalid",
    actionableMessage: binding.actionableMessage,
    failureReason: binding.failureReason,
    nextAction: binding.nextAction,
    ownerResponsible: "Commander Console / Orchestration",
    commandSource: draft.commandSource,
    traceId: draft.traceId,
    attemptId: draft.attemptId,
  };
};

const recordBindingFailureEvent = async (
  activeWorkbench: GrassEyeWorkbench,
  draft: StartDraft,
  taskTemplateId: string | null,
  binding: Extract<MissionStartBinding, { ok: false }>,
) => {
  await activeWorkbench.recordCommanderDebugEvent({
    eventType: "COMMAND_REJECTED",
    status: "failed",
    traceId: draft.traceId,
    spanId: "command-rejected",
    attemptId: draft.attemptId,
    mapId: draft.selectedMapId,
    taskTemplateId,
    failureReason: binding.failureReason,
    actionableMessage: binding.nextAction,
    ownerResponsible: "Commander Console / Orchestration",
  });
};

const writeBindingFailureResponse = (
  response: ServerResponse,
  draft: StartDraft,
  binding: Extract<MissionStartBinding, { ok: false }>,
) => {
  writeTaskJsonResponse(response, 400, buildBindingFailurePayload(draft, binding));
};

export async function sendTaskStartBindingFailure(input: {
  response: ServerResponse;
  activeWorkbench: GrassEyeWorkbench;
  draft: StartDraft;
  taskTemplateId: string | null;
  binding: Extract<MissionStartBinding, { ok: false }>;
}) {
  await recordBindingFailureEvent(input.activeWorkbench, input.draft, input.taskTemplateId, input.binding);
  writeBindingFailureResponse(input.response, input.draft, input.binding);
}

export async function recordTaskStartPreflightStart(activeWorkbench: GrassEyeWorkbench, approval: StartApproval) {
  await activeWorkbench.recordCommanderDebugEvent({
    eventType: "HUMAN_COMMAND_VALIDATED",
    status: "success",
    traceId: approval.traceId,
    spanId: "human-command-validated",
    attemptId: approval.attemptId,
    mapId: approval.binding.selectedMapId,
    taskTemplateId: approval.binding.taskTemplateId,
    reason: `requestedPlatformId=${approval.binding.requestedPlatformId}; selectedMapId=${approval.binding.selectedMapId}`,
    actionableMessage: "Run mission preflight before dispatching the governed human command.",
    ownerResponsible: "Commander Console",
  });
  await activeWorkbench.recordCommanderDebugEvent({
    eventType: "MISSION_PREFLIGHT_STARTED",
    status: "started",
    traceId: approval.traceId,
    spanId: "mission-preflight-started",
    attemptId: approval.attemptId,
    mapId: approval.binding.selectedMapId,
    taskTemplateId: approval.binding.taskTemplateId,
    reason: "Mission preflight is checking readiness before command dispatch.",
    actionableMessage: "Verify browser session, local AI, map binding, and Forensics storage before mission start.",
    ownerResponsible: "Commander Console / Orchestration",
  });
}

export async function recordTaskStartLocalAiReadiness(
  activeWorkbench: GrassEyeWorkbench,
  approval: StartApproval,
  component: { ok?: boolean; detail?: string; actionableMessage?: string; ownerResponsible?: string } | undefined,
) {
  await activeWorkbench.recordCommanderDebugEvent({
    eventType: "LOCAL_AI_READINESS_STARTED",
    status: "started",
    traceId: approval.traceId,
    spanId: "local-ai-readiness-started",
    attemptId: approval.attemptId,
    mapId: approval.binding.selectedMapId,
    taskTemplateId: approval.binding.taskTemplateId,
    reason: "Mission preflight is evaluating local AI readiness.",
    actionableMessage: "Confirm Ollama reachability and local model availability.",
    ownerResponsible: "AI Capability / Local AI Runtime",
  });
  if (!component || component.ok) {
    return;
  }

  await activeWorkbench.recordCommanderDebugEvent({
    eventType: "LOCAL_AI_READINESS_DEGRADED",
    status: "failed",
    traceId: approval.traceId,
    spanId: "local-ai-readiness-degraded",
    attemptId: approval.attemptId,
    mapId: approval.binding.selectedMapId,
    taskTemplateId: approval.binding.taskTemplateId,
    failureReason: toNullableString(component.detail),
    actionableMessage: toNullableString(component.actionableMessage),
    ownerResponsible: toNullableString(component.ownerResponsible),
  });
  await activeWorkbench.recordCommanderDebugEvent({
    eventType: "LOCAL_AI_READINESS_BLOCKING_REASON",
    status: "failed",
    traceId: approval.traceId,
    spanId: "local-ai-readiness-blocking-reason",
    attemptId: approval.attemptId,
    mapId: approval.binding.selectedMapId,
    taskTemplateId: approval.binding.taskTemplateId,
    failureReason: toNullableString(component.detail),
    actionableMessage: toNullableString(component.actionableMessage),
    ownerResponsible: toNullableString(component.ownerResponsible),
  });
}

export async function sendBlockedTaskStartPreflight(
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbench,
  approval: StartApproval,
  preflight: Awaited<ReturnType<GrassEyeWorkbench["getMissionStartPreflight"]>>,
) {
  await activeWorkbench.recordCommanderDebugEvent({
    eventType: "MISSION_PREFLIGHT_FAILED",
    status: "failed",
    traceId: approval.traceId,
    spanId: "mission-preflight-failed",
    attemptId: approval.attemptId,
    mapId: approval.binding.selectedMapId,
    taskTemplateId: approval.binding.taskTemplateId,
    failureReason: preflight.failureReason,
    actionableMessage: preflight.nextAction,
    ownerResponsible: preflight.ownerResponsible,
  });
  await activeWorkbench.recordCommanderDebugEvent({
    eventType: "COMMAND_REJECTED",
    status: "failed",
    traceId: approval.traceId,
    spanId: "command-rejected",
    attemptId: approval.attemptId,
    mapId: approval.binding.selectedMapId,
    taskTemplateId: approval.binding.taskTemplateId,
    failureReason: preflight.failureReason,
    actionableMessage: preflight.nextAction,
    ownerResponsible: preflight.ownerResponsible,
  });
  writeTaskJsonResponse(response, 409, {
    error: "mission_preflight_failed",
    actionableMessage: preflight.actionableMessage,
    failureReason: preflight.failureReason,
    nextAction: preflight.nextAction,
    ownerResponsible: preflight.ownerResponsible,
    readinessStatus: "degraded",
    primaryBlockingReason: preflight.components.find((component) => component.ok !== true) ?? null,
    blockingReasons: preflight.components.filter((component) => component.ok !== true),
    commandSource: approval.commandSource,
    traceId: approval.traceId,
    attemptId: approval.attemptId,
    components: preflight.components,
  });
}

const resolveResultMessage = (output: unknown): string => {
  return output !== null && typeof output === "object" && "message" in output && typeof output.message === "string"
    ? output.message
    : "Commander Console completed the governed human command dispatch.";
};

const resolveTargetMissionId = (output: unknown): string | null => {
  return output !== null && typeof output === "object" && "targetMissionId" in output && typeof output.targetMissionId === "string"
    ? output.targetMissionId
    : null;
};

export async function writeTaskStartDispatchResult(
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbench,
  approval: StartApproval,
  result: StartCommandResult,
) {
  const resultMessage = resolveResultMessage(result.output);
  const targetMissionId = resolveTargetMissionId(result.output);
  const failureReason = result.failureReason ?? result.reviewRequiredReason ?? resultMessage;
  if (result.status === "success") {
    await activeWorkbench.recordCommanderDebugEvent({
      eventType: "COMMAND_ACCEPTED",
      status: "success",
      traceId: approval.traceId,
      spanId: "command-accepted",
      attemptId: approval.attemptId,
      missionId: targetMissionId,
      mapId: approval.binding.selectedMapId,
      taskTemplateId: approval.binding.taskTemplateId,
      reason: resultMessage,
      actionableMessage: "Mission dispatch succeeded. Monitor the mission page and runtime proof timeline.",
      ownerResponsible: "Commander Console / Nerve Bus / Orchestration",
    });
    writeTaskJsonResponse(response, 200, result);
    return;
  }

  await activeWorkbench.recordCommanderDebugEvent({
    eventType: "COMMAND_REJECTED",
    status: result.status === "review_required" ? "review_required" : "failed",
    traceId: approval.traceId,
    spanId: "command-rejected",
    attemptId: approval.attemptId,
    missionId: targetMissionId,
    mapId: approval.binding.selectedMapId,
    taskTemplateId: approval.binding.taskTemplateId,
    failureReason,
    actionableMessage: result.reviewRequiredReason
      ? "Open the review queue and inspect the guarded command result before retrying."
      : "Inspect the latest debug bundle and fix the blocking dependency before retrying.",
    ownerResponsible: "Commander Console / Nerve Bus / Orchestration",
  });
  writeTaskJsonResponse(response, 409, { ...result, traceId: approval.traceId, attemptId: approval.attemptId });
}