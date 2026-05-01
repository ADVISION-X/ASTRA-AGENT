import type { IncomingMessage, ServerResponse } from "node:http";

import { parseJsonBody, writeJsonResponse } from "../../app/workbench-api-helpers.js";
import { createId } from "../local-runtime/ids.js";
import type { GrassEyeWorkbench } from "../local-runtime/workbench.js";
import {
  normalizePositiveInteger,
  normalizeRequestedPlatformId,
  resolveMissionStartBinding,
  type MissionStartBinding,
  type RequestedPlatformId,
} from "./task-start-binding.js";

type StartTaskBody = {
  commandSource?: string;
  humanGoal?: string;
  taskTemplateId?: string;
  requestedPlatformId?: string;
  selectedMapId?: string;
  maxRounds?: number;
  maxMinutes?: number;
};

type StartDraft = {
  traceId: string;
  attemptId: string;
  commandSource: string;
  humanGoal: string | null;
  taskTemplateId: string | null;
  requestedPlatformId: RequestedPlatformId | null;
  selectedMapId: string | null;
  maxRounds: number | undefined;
  maxMinutes: number | undefined;
};

type StartApproval = StartDraft & {
  binding: Extract<MissionStartBinding, { ok: true }>;
};

const buildStartDraft = async (request: IncomingMessage): Promise<StartDraft> => {
  const body = await parseJsonBody(request) as StartTaskBody;
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

const recordDraftEvents = async (activeWorkbench: GrassEyeWorkbench, draft: StartDraft, taskTemplateId: string | null) => {
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
};

const sendBindingFailure = async (
  response: ServerResponse,
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
  writeJsonResponse(response, 400, {
    error: "mission_start_binding_invalid",
    actionableMessage: binding.actionableMessage,
    failureReason: binding.failureReason,
    nextAction: binding.nextAction,
    ownerResponsible: "Commander Console / Orchestration",
    commandSource: draft.commandSource,
    traceId: draft.traceId,
    attemptId: draft.attemptId,
  });
};

const buildApproval = (draft: StartDraft, binding: Extract<MissionStartBinding, { ok: true }>): StartApproval => {
  return { ...draft, binding };
};

const recordPreflightStart = async (activeWorkbench: GrassEyeWorkbench, approval: StartApproval) => {
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
};

const recordLocalAiReadiness = async (
  activeWorkbench: GrassEyeWorkbench,
  approval: StartApproval,
  component: { ok?: boolean; detail?: string; actionableMessage?: string; ownerResponsible?: string } | undefined,
) => {
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
    failureReason: component.detail,
    actionableMessage: component.actionableMessage,
    ownerResponsible: component.ownerResponsible,
  });
  await activeWorkbench.recordCommanderDebugEvent({
    eventType: "LOCAL_AI_READINESS_BLOCKING_REASON",
    status: "failed",
    traceId: approval.traceId,
    spanId: "local-ai-readiness-blocking-reason",
    attemptId: approval.attemptId,
    mapId: approval.binding.selectedMapId,
    taskTemplateId: approval.binding.taskTemplateId,
    failureReason: component.detail,
    actionableMessage: component.actionableMessage,
    ownerResponsible: component.ownerResponsible,
  });
};

const sendBlockedPreflight = async (
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbench,
  approval: StartApproval,
  preflight: Awaited<ReturnType<GrassEyeWorkbench["getMissionStartPreflight"]>>,
) => {
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
  writeJsonResponse(response, 409, {
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

const writeDispatchResult = async (
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbench,
  approval: StartApproval,
  result: { status: string; output: unknown; failureReason?: string | null; reviewRequiredReason?: string | null },
) => {
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
    writeJsonResponse(response, 200, result);
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
  writeJsonResponse(response, 409, { ...result, traceId: approval.traceId, attemptId: approval.attemptId });
};

export async function runTaskStartFlow(request: IncomingMessage, response: ServerResponse, activeWorkbench: GrassEyeWorkbench): Promise<true> {
  const draft = await buildStartDraft(request);
  const binding = resolveMissionStartBinding({
    taskTemplateId: draft.taskTemplateId,
    requestedPlatformId: draft.requestedPlatformId,
    selectedMapId: draft.selectedMapId,
  });
  const taskTemplateId = binding.ok ? binding.taskTemplateId : draft.taskTemplateId;
  await recordDraftEvents(activeWorkbench, draft, taskTemplateId);
  if (!binding.ok) {
    await sendBindingFailure(response, activeWorkbench, draft, taskTemplateId, binding);
    return true;
  }

  const approval = buildApproval(draft, binding);
  await recordPreflightStart(activeWorkbench, approval);
  const preflight = await activeWorkbench.getMissionStartPreflight({
    requestedPlatformId: approval.binding.requestedPlatformId,
    selectedMapId: approval.binding.selectedMapId,
  });
  await recordLocalAiReadiness(activeWorkbench, approval, preflight.components.find((component) => component.name === "localAi"));
  if (preflight.status === "blocked") {
    await sendBlockedPreflight(response, activeWorkbench, approval, preflight);
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
  await writeDispatchResult(response, activeWorkbench, approval, result);
  return true;
}