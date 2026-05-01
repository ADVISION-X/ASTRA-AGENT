import type { ServerResponse } from "node:http";

import { GrassEyeWorkbench } from "../lib/local-runtime/workbench.js";
import { sendJson } from "./task-api-response.js";
import type { TaskStartDraft } from "./task-start-request-draft.js";
import type { MissionStartBindingFailure, MissionStartBindingSuccess } from "./task-start-types.js";

type MissionStartPreflight = Awaited<ReturnType<GrassEyeWorkbench["getMissionStartPreflight"]>>;

const getRejectedBinding = (draft: TaskStartDraft): MissionStartBindingFailure => draft.resolvedBinding as MissionStartBindingFailure;

const recordCommandRejected = async (input: {
  activeWorkbench: GrassEyeWorkbench;
  draft: TaskStartDraft;
  failureReason: string;
  actionableMessage: string;
  ownerResponsible: string;
}) => {
  await input.activeWorkbench.recordCommanderDebugEvent({
    eventType: "COMMAND_REJECTED",
    status: "failed",
    traceId: input.draft.traceId,
    spanId: "command-rejected",
    attemptId: input.draft.attemptId,
    mapId: input.draft.mapId,
    taskTemplateId: input.draft.resolvedTaskTemplateId,
    failureReason: input.failureReason,
    actionableMessage: input.actionableMessage,
    ownerResponsible: input.ownerResponsible,
  });
};

export async function recordTaskStartDraftEvents(activeWorkbench: GrassEyeWorkbench, draft: TaskStartDraft): Promise<void> {
  await activeWorkbench.recordCommanderDebugEvent({
    eventType: "HUMAN_COMMAND_DRAFTED",
    status: "started",
    traceId: draft.traceId,
    spanId: "human-command-drafted",
    attemptId: draft.attemptId,
    mapId: draft.mapId,
    taskTemplateId: draft.resolvedTaskTemplateId,
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
    mapId: draft.mapId,
    taskTemplateId: draft.resolvedTaskTemplateId,
    reason: `Commander Console received a start-mission request from source=${draft.commandSource}.`,
    actionableMessage: "Validate the human command payload before dispatching it.",
    ownerResponsible: "Commander Console / Local App Shell",
  });
}

export async function handleBindingFailure(response: ServerResponse, activeWorkbench: GrassEyeWorkbench, draft: TaskStartDraft): Promise<true> {
  const failure = getRejectedBinding(draft);
  await recordCommandRejected({
    activeWorkbench,
    draft,
    failureReason: failure.failureReason,
    actionableMessage: failure.nextAction,
    ownerResponsible: "Commander Console / Orchestration",
  });
  sendJson(response, 400, {
    error: "mission_start_binding_invalid",
    actionableMessage: failure.actionableMessage,
    failureReason: failure.failureReason,
    nextAction: failure.nextAction,
    ownerResponsible: "Commander Console / Orchestration",
    commandSource: draft.commandSource,
    traceId: draft.traceId,
    attemptId: draft.attemptId,
  });
  return true;
}

const recordPreflightStarted = async (activeWorkbench: GrassEyeWorkbench, draft: TaskStartDraft, binding: MissionStartBindingSuccess) => {
  await activeWorkbench.recordCommanderDebugEvent({
    eventType: "HUMAN_COMMAND_VALIDATED",
    status: "success",
    traceId: draft.traceId,
    spanId: "human-command-validated",
    attemptId: draft.attemptId,
    mapId: binding.selectedMapId,
    taskTemplateId: binding.taskTemplateId,
    reason: `requestedPlatformId=${binding.requestedPlatformId}; selectedMapId=${binding.selectedMapId}`,
    actionableMessage: "Run mission preflight before dispatching the governed human command.",
    ownerResponsible: "Commander Console",
  });
  await activeWorkbench.recordCommanderDebugEvent({
    eventType: "MISSION_PREFLIGHT_STARTED",
    status: "started",
    traceId: draft.traceId,
    spanId: "mission-preflight-started",
    attemptId: draft.attemptId,
    mapId: binding.selectedMapId,
    taskTemplateId: binding.taskTemplateId,
    reason: "Mission preflight is checking readiness before command dispatch.",
    actionableMessage: "Verify browser session, local AI, map binding, and Forensics storage before mission start.",
    ownerResponsible: "Commander Console / Orchestration",
  });
};

const recordLocalAiDegradation = async (activeWorkbench: GrassEyeWorkbench, draft: TaskStartDraft, binding: MissionStartBindingSuccess, preflight: MissionStartPreflight) => {
  const localAiComponent = preflight.components.find((component) => component.name === "localAi");
  await activeWorkbench.recordCommanderDebugEvent({
    eventType: "LOCAL_AI_READINESS_STARTED",
    status: "started",
    traceId: draft.traceId,
    spanId: "local-ai-readiness-started",
    attemptId: draft.attemptId,
    mapId: binding.selectedMapId,
    taskTemplateId: binding.taskTemplateId,
    reason: "Mission preflight is evaluating local AI readiness.",
    actionableMessage: "Confirm Ollama reachability and local model availability.",
    ownerResponsible: "AI Capability / Local AI Runtime",
  });
  if (!localAiComponent || localAiComponent.ok) {
    return;
  }

  await activeWorkbench.recordCommanderDebugEvent({
    eventType: "LOCAL_AI_READINESS_DEGRADED",
    status: "failed",
    traceId: draft.traceId,
    spanId: "local-ai-readiness-degraded",
    attemptId: draft.attemptId,
    mapId: binding.selectedMapId,
    taskTemplateId: binding.taskTemplateId,
    failureReason: localAiComponent.detail,
    actionableMessage: localAiComponent.actionableMessage,
    ownerResponsible: localAiComponent.ownerResponsible,
  });
  await activeWorkbench.recordCommanderDebugEvent({
    eventType: "LOCAL_AI_READINESS_BLOCKING_REASON",
    status: "failed",
    traceId: draft.traceId,
    spanId: "local-ai-readiness-blocking-reason",
    attemptId: draft.attemptId,
    mapId: binding.selectedMapId,
    taskTemplateId: binding.taskTemplateId,
    failureReason: localAiComponent.detail,
    actionableMessage: localAiComponent.actionableMessage,
    ownerResponsible: localAiComponent.ownerResponsible,
  });
}

const recordBlockedPreflight = async (activeWorkbench: GrassEyeWorkbench, draft: TaskStartDraft, binding: MissionStartBindingSuccess, preflight: MissionStartPreflight) => {
  await activeWorkbench.recordCommanderDebugEvent({
    eventType: "MISSION_PREFLIGHT_FAILED",
    status: "failed",
    traceId: draft.traceId,
    spanId: "mission-preflight-failed",
    attemptId: draft.attemptId,
    mapId: binding.selectedMapId,
    taskTemplateId: binding.taskTemplateId,
    failureReason: preflight.failureReason,
    actionableMessage: preflight.nextAction,
    ownerResponsible: preflight.ownerResponsible,
  });
  await recordCommandRejected({
    activeWorkbench,
    draft,
    failureReason: preflight.failureReason,
    actionableMessage: preflight.nextAction,
    ownerResponsible: preflight.ownerResponsible,
  });
};

export async function runTaskStartPreflight(activeWorkbench: GrassEyeWorkbench, draft: TaskStartDraft, binding: MissionStartBindingSuccess): Promise<MissionStartPreflight> {
  await recordPreflightStarted(activeWorkbench, draft, binding);
  const preflight = await activeWorkbench.getMissionStartPreflight({
    requestedPlatformId: binding.requestedPlatformId,
    selectedMapId: binding.selectedMapId,
  });
  await recordLocalAiDegradation(activeWorkbench, draft, binding, preflight);
  if (preflight.status === "blocked") {
    await recordBlockedPreflight(activeWorkbench, draft, binding, preflight);
    return preflight;
  }

  await activeWorkbench.recordCommanderDebugEvent({
    eventType: "MISSION_PREFLIGHT_PASSED",
    status: "success",
    traceId: draft.traceId,
    spanId: "mission-preflight-passed",
    attemptId: draft.attemptId,
    mapId: binding.selectedMapId,
    taskTemplateId: binding.taskTemplateId,
    reason: preflight.actionableMessage,
    actionableMessage: "Dispatch the governed human command through Commander Console and Nerve Bus.",
    ownerResponsible: "Commander Console / Nerve Bus",
  });
  return preflight;
}

export function sendBlockedPreflightResponse(response: ServerResponse, draft: TaskStartDraft, preflight: MissionStartPreflight): true {
  sendJson(response, 409, {
    error: "mission_preflight_failed",
    actionableMessage: preflight.actionableMessage,
    failureReason: preflight.failureReason,
    nextAction: preflight.nextAction,
    ownerResponsible: preflight.ownerResponsible,
    readinessStatus: "degraded",
    primaryBlockingReason: preflight.components.find((component) => component.ok !== true) ?? null,
    blockingReasons: preflight.components.filter((component) => component.ok !== true),
    commandSource: draft.commandSource,
    traceId: draft.traceId,
    attemptId: draft.attemptId,
    components: preflight.components,
  });
  return true;
}