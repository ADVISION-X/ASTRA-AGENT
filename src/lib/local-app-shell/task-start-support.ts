import type { ServerResponse } from "node:http";

import type { GrassEyeWorkbenchHandle } from "../local-runtime/workbench-handle.js";
import { writeTaskJsonResponse } from "./task-http-helpers.js";
import { recordTaskStartDebugEvent } from "./task-start-debug-writer.js";
import type { MissionStartBinding } from "./task-start-binding-contract.js";
import type { StartApproval, StartDraft } from "./task-start-types.js";

const toNullableString = (value: string | undefined): string | null => value ?? null;

export async function recordTaskStartDraftEvents(activeWorkbench: GrassEyeWorkbenchHandle, draft: StartDraft, taskTemplateId: string | null) {
  recordTaskStartDebugEvent(activeWorkbench, {
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
  recordTaskStartDebugEvent(activeWorkbench, {
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
  activeWorkbench: GrassEyeWorkbenchHandle,
  draft: StartDraft,
  taskTemplateId: string | null,
  binding: Extract<MissionStartBinding, { ok: false }>,
) => {
  recordTaskStartDebugEvent(activeWorkbench, {
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
  activeWorkbench: GrassEyeWorkbenchHandle;
  draft: StartDraft;
  taskTemplateId: string | null;
  binding: Extract<MissionStartBinding, { ok: false }>;
}) {
  await recordBindingFailureEvent(input.activeWorkbench, input.draft, input.taskTemplateId, input.binding);
  writeBindingFailureResponse(input.response, input.draft, input.binding);
}

export async function recordTaskStartPreflightStart(activeWorkbench: GrassEyeWorkbenchHandle, approval: StartApproval) {
  recordTaskStartDebugEvent(activeWorkbench, {
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
  recordTaskStartDebugEvent(activeWorkbench, {
    eventType: "MISSION_READINESS_CHECK_STARTED",
    status: "started",
    traceId: approval.traceId,
    spanId: "mission-readiness-check-started",
    attemptId: approval.attemptId,
    mapId: approval.binding.selectedMapId,
    taskTemplateId: approval.binding.taskTemplateId,
    reason: "MissionReadiness is scoped to the selected task binding, not the app shell.",
    actionableMessage: "Check selected task map binding, browser, local AI, platform target, human goal, and run limits.",
    ownerResponsible: "Commander Console / Orchestration / Map Plugin Registry",
  });
  recordTaskStartDebugEvent(activeWorkbench, {
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

export async function recordCommanderEnvelopeBuilt(activeWorkbench: GrassEyeWorkbenchHandle, approval: StartApproval) {
  recordTaskStartDebugEvent(activeWorkbench, {
    eventType: "COMMANDER_COMMAND_ENVELOPE_BUILT",
    status: "success",
    traceId: approval.traceId,
    spanId: "commander-command-envelope-built",
    attemptId: approval.attemptId,
    mapId: approval.binding.selectedMapId,
    taskTemplateId: approval.binding.taskTemplateId,
    reason: `taskTemplateId resolved to requestedPlatformId=${approval.binding.requestedPlatformId}; selectedMapId=${approval.binding.selectedMapId}; activationSnapshotRef=${approval.binding.activationSnapshotRef}`,
    actionableMessage: "Send the governed command through CommandTransportPort and Nerve Bus.",
    ownerResponsible: "Commander Console",
  });
}

export async function recordTaskStartCommandAccepted(activeWorkbench: GrassEyeWorkbenchHandle, approval: StartApproval) {
  recordTaskStartDebugEvent(activeWorkbench, {
    eventType: "COMMAND_DISPATCH_READY",
    status: "success",
    traceId: approval.traceId,
    spanId: "command-accepted",
    attemptId: approval.attemptId,
    mapId: approval.binding.selectedMapId,
    taskTemplateId: approval.binding.taskTemplateId,
    reason: `selectedMapId=${approval.binding.selectedMapId}; activationSnapshotRef=${approval.binding.activationSnapshotRef}`,
    actionableMessage: "Dispatch the validated human command through the governed command transport.",
    ownerResponsible: "Commander Console / Nerve Bus / Orchestration",
  });
}

export async function recordTaskStartLocalAiReadiness(
  activeWorkbench: GrassEyeWorkbenchHandle,
  approval: StartApproval,
  component: { ok?: boolean; detail?: string; actionableMessage?: string; ownerResponsible?: string } | undefined,
) {
  recordTaskStartDebugEvent(activeWorkbench, {
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

  recordTaskStartDebugEvent(activeWorkbench, {
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
  recordTaskStartDebugEvent(activeWorkbench, {
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
  activeWorkbench: GrassEyeWorkbenchHandle,
  approval: StartApproval,
  preflight: Awaited<ReturnType<GrassEyeWorkbenchHandle["getMissionStartPreflight"]>>,
) {
  recordTaskStartDebugEvent(activeWorkbench, {
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
  recordTaskStartDebugEvent(activeWorkbench, {
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
