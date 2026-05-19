import type { ServerResponse } from "node:http";

import type { GrassEyeWorkbenchHandle } from "../local-runtime/workbench-handle.js";
import { writeTaskJsonResponse } from "./task-http-helpers.js";
import { recordTaskStartDebugEvent } from "./task-start-debug-writer.js";
import type { MissionStartBinding } from "./task-start-binding-contract.js";
import type { StartApproval, StartDraft } from "./task-start-types.js";

const toNullableString = (value: string | null | undefined): string | null => value ?? null;

type LocalAiReadinessComponent = {
  ok?: boolean;
  detail?: string | null;
  actionableMessage?: string | null;
  ownerResponsible?: string | null;
  [key: string]: unknown;
} | undefined;

type MissionStartPreflight = Awaited<
  ReturnType<GrassEyeWorkbenchHandle["getMissionStartPreflight"]>
>;

export async function recordTaskStartDraftEvents(activeWorkbench: GrassEyeWorkbenchHandle, draft: StartDraft) {
  recordTaskStartDebugEvent(activeWorkbench, {
    eventType: "HUMAN_COMMAND_DRAFTED",
    status: "started",
    traceId: draft.traceId,
    spanId: "human-command-drafted",
    attemptId: draft.attemptId,
    missionId: draft.traceId,
    runId: draft.traceId,
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
    missionId: draft.traceId,
    runId: draft.traceId,
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
  binding: Extract<MissionStartBinding, { ok: false }>,
) => {
  recordTaskStartDebugEvent(activeWorkbench, {
    eventType: "COMMAND_REJECTED",
    status: "failed",
    traceId: draft.traceId,
    spanId: "command-rejected",
    attemptId: draft.attemptId,
    missionId: draft.traceId,
    runId: draft.traceId,
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
  binding: Extract<MissionStartBinding, { ok: false }>;
}) {
  await recordBindingFailureEvent(input.activeWorkbench, input.draft, input.binding);
  writeBindingFailureResponse(input.response, input.draft, input.binding);
}

export async function recordTaskStartPreflightStart(activeWorkbench: GrassEyeWorkbenchHandle, approval: StartApproval) {
  recordTaskStartDebugEvent(activeWorkbench, {
    eventType: "HUMAN_COMMAND_VALIDATED",
    status: "success",
    traceId: approval.traceId,
    spanId: "human-command-validated",
    attemptId: approval.attemptId,
    missionId: approval.traceId,
    runId: approval.traceId,
    reason: `requestedPlatformId=${approval.binding.requestedPlatformId}; targetProfileRef=${approval.binding.targetProfileRef}`,
    actionableMessage: "Run mission preflight before dispatching the governed human command.",
    ownerResponsible: "Commander Console",
  });
  recordTaskStartDebugEvent(activeWorkbench, {
    eventType: "MISSION_READINESS_CHECK_STARTED",
    status: "started",
    traceId: approval.traceId,
    spanId: "mission-readiness-check-started",
    attemptId: approval.attemptId,
    missionId: approval.traceId,
    runId: approval.traceId,
    reason: "MissionReadiness is scoped to the selected task binding, not the app shell.",
    actionableMessage: "Check platform target binding, browser, local AI, human goal, and run limits.",
    ownerResponsible: "Commander Console / Orchestration / PlatformRegistry",
  });
  recordTaskStartDebugEvent(activeWorkbench, {
    eventType: "MISSION_PREFLIGHT_STARTED",
    status: "started",
    traceId: approval.traceId,
    spanId: "mission-preflight-started",
    attemptId: approval.attemptId,
    missionId: approval.traceId,
    runId: approval.traceId,
    reason: "Mission preflight is checking readiness before command dispatch.",
    actionableMessage: "Verify browser session, local AI, platform binding, and Forensics storage before mission start.",
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
    missionId: approval.traceId,
    runId: approval.traceId,
    reason: `requestedPlatformId=${approval.binding.requestedPlatformId}; targetProfileRef=${approval.binding.targetProfileRef}; targetTitle=${approval.binding.targetTitle}`,
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
    missionId: approval.traceId,
    runId: approval.traceId,
    reason: `requestedPlatformId=${approval.binding.requestedPlatformId}; targetProfileRef=${approval.binding.targetProfileRef}`,
    actionableMessage: "Dispatch the validated human command through the governed command transport.",
    ownerResponsible: "Commander Console / Nerve Bus / Orchestration",
  });
}

const buildLocalAiReadinessFailureEvent = (
  approval: StartApproval,
  component: LocalAiReadinessComponent,
) => ({
  traceId: approval.traceId,
  attemptId: approval.attemptId,
  missionId: approval.traceId,
  runId: approval.traceId,
  failureReason: toNullableString(component?.detail),
  actionableMessage: toNullableString(component?.actionableMessage),
  ownerResponsible: toNullableString(component?.ownerResponsible),
});

const recordLocalAiReadinessStarted = (
  activeWorkbench: GrassEyeWorkbenchHandle,
  approval: StartApproval,
) => {
  recordTaskStartDebugEvent(activeWorkbench, {
    eventType: "ONLINE_AI_READINESS_STARTED",
    status: "started",
    traceId: approval.traceId,
    spanId: "online-ai-readiness-started",
    attemptId: approval.attemptId,
    missionId: approval.traceId,
    runId: approval.traceId,
    reason: "Mission preflight is evaluating online AI readiness.",
    actionableMessage: "Confirm the Google Gemini API key and selected online model in Settings.",
    ownerResponsible: "AI Capability / Online AI Runtime",
  });
};

export async function recordTaskStartLocalAiReadiness(
  activeWorkbench: GrassEyeWorkbenchHandle,
  approval: StartApproval,
  component: LocalAiReadinessComponent,
) {
  const baseFailureEvent = buildLocalAiReadinessFailureEvent(approval, component);

  recordLocalAiReadinessStarted(activeWorkbench, approval);
  if (!component || component.ok) {
    return;
  }

  recordTaskStartDebugEvent(activeWorkbench, {
    ...baseFailureEvent,
    eventType: "ONLINE_AI_READINESS_DEGRADED",
    status: "failed",
    spanId: "online-ai-readiness-degraded",
  });
  recordTaskStartDebugEvent(activeWorkbench, {
    ...baseFailureEvent,
    eventType: "LOCAL_AI_READINESS_BLOCKING_REASON",
    status: "failed",
    spanId: "local-ai-readiness-blocking-reason",
  });
}

const buildBlockedPreflightPayload = (
  approval: StartApproval,
  preflight: MissionStartPreflight,
) => ({
  error: "mission_preflight_failed",
  actionableMessage: preflight.actionableMessage,
  failureReason: preflight.failureReason,
  nextAction: preflight.nextAction,
  ownerResponsible: preflight.ownerResponsible,
  readinessStatus: "degraded" as const,
  primaryBlockingReason:
    preflight.components.find((component) => component.ok !== true) ?? null,
  blockingReasons: preflight.components.filter((component) => component.ok !== true),
  commandSource: approval.commandSource,
  traceId: approval.traceId,
  attemptId: approval.attemptId,
  components: preflight.components,
});

const recordBlockedPreflightEvents = (
  activeWorkbench: GrassEyeWorkbenchHandle,
  approval: StartApproval,
  preflight: MissionStartPreflight,
) => {
  const baseFailureEvent = {
    status: "failed" as const,
    traceId: approval.traceId,
    attemptId: approval.attemptId,
    missionId: approval.traceId,
    runId: approval.traceId,
    failureReason: preflight.failureReason,
    actionableMessage: preflight.nextAction,
    ownerResponsible: preflight.ownerResponsible,
  };

  recordTaskStartDebugEvent(activeWorkbench, {
    ...baseFailureEvent,
    eventType: "MISSION_PREFLIGHT_FAILED",
    spanId: "mission-preflight-failed",
  });
  recordTaskStartDebugEvent(activeWorkbench, {
    ...baseFailureEvent,
    eventType: "COMMAND_REJECTED",
    spanId: "command-rejected",
  });
};

export async function sendBlockedTaskStartPreflight(
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
  approval: StartApproval,
  preflight: MissionStartPreflight,
) {
  recordBlockedPreflightEvents(activeWorkbench, approval, preflight);
  writeTaskJsonResponse(response, 409, buildBlockedPreflightPayload(approval, preflight));
}
