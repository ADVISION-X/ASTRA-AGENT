import type { IncomingMessage, ServerResponse } from "node:http";

import { createId } from "../local-runtime/ids.js";
import type { GrassEyeWorkbenchHandle } from "../local-runtime/workbench-handle.js";
import { parseTaskJsonBody } from "./task-http-helpers.js";
import {
  normalizePositiveInteger,
  normalizeSelectedPlatforms,
  resolveStartRunLimits,
  resolveVisualMissionStartBinding,
} from "./task-start-visual-mission-binding.js";
import type { MissionStartBinding } from "./task-start-binding-contract.js";
import {
  recordTaskStartDraftEvents,
  recordTaskStartLocalAiReadiness,
  recordTaskStartPreflightStart,
  recordCommanderEnvelopeBuilt,
  recordTaskStartCommandAccepted,
  sendBlockedTaskStartPreflight,
  sendTaskStartBindingFailure,
} from "./task-start-support.js";
import { recordTaskStartDebugEvent } from "./task-start-debug-writer.js";
import { writeTaskStartDispatchResult } from "./task-start-dispatch-result.js";
import type { StartApproval, StartCommandResult, StartDraft, StartVisualMissionBody } from "./task-start-types.js";

const buildStartDraft = async (request: IncomingMessage): Promise<StartDraft> => {
  const body = await parseTaskJsonBody(request) as StartVisualMissionBody;
  return {
    traceId: createId("trace"),
    attemptId: createId("attempt"),
    commandSource: body.commandSource?.trim() || "task-api:http-post",
    userRequirementText: body.userRequirementText?.trim() || "",
    selectedPlatforms: normalizeSelectedPlatforms(body.selectedPlatforms),
    historyEntryId: body.historyEntryId?.trim() || null,
    taskTemplateId: null,
    requestedPlatformId: null,
    selectedMapId: null,
    maxRounds: normalizePositiveInteger(body.maxRounds),
    maxMinutes: normalizePositiveInteger(body.maxMinutes),
    operatorNote: body.operatorNote?.trim() || null,
  };
};

const buildApproval = (
  draft: StartDraft,
  binding: Extract<MissionStartBinding, { ok: true }>,
  settings: Awaited<ReturnType<GrassEyeWorkbenchHandle["getAppRunLimitSettings"]>>,
): StartApproval => {
  const runLimit = resolveStartRunLimits({
    defaultMaxRounds: settings.defaultMaxRounds,
    defaultMaxMinutes: settings.defaultMaxMinutes,
    draft: {
      maxRounds: draft.maxRounds,
      maxMinutes: draft.maxMinutes,
    },
  });
  return {
    ...draft,
    binding,
    maxRounds: runLimit.maxRounds,
    maxMinutes: runLimit.maxMinutes,
  };
};

const buildStartMissionInput = (approval: StartApproval) => {
  return {
    commandType: "start-mission" as const,
    requestedPlatformId: approval.binding.requestedPlatformId,
    selectedMapId: approval.binding.selectedMapId,
    humanGoal: approval.userRequirementText,
    maxRounds: approval.maxRounds,
    maxMinutes: approval.maxMinutes,
    initialPayload: {
      kind: "start-mission" as const,
      requestedBy: "commander-console" as const,
      requestedPlatformId: approval.binding.requestedPlatformId,
      selectedPlatforms: approval.selectedPlatforms,
      primaryPlatformId: approval.binding.requestedPlatformId,
      userRequirementRef: approval.binding.userRequirementRef,
      historyEntryId: approval.historyEntryId,
      targetUrl: approval.binding.targetUrl,
      targetTitle: approval.binding.targetTitle,
      targetProfileRef: approval.binding.targetProfileRef,
      ...(approval.userRequirementText ? { humanGoal: approval.userRequirementText } : {}),
      ...(approval.maxRounds ? { maxRounds: approval.maxRounds } : {}),
      ...(approval.maxMinutes ? { maxMinutes: approval.maxMinutes } : {}),
      ...(approval.operatorNote ? { operatorNote: approval.operatorNote } : {}),
    },
  };
};

const persistSuccessfulRequirementHistory = async (
  activeWorkbench: GrassEyeWorkbenchHandle,
  approval: StartApproval,
  result: StartCommandResult,
) => {
  if (result.status !== "success") {
    return;
  }

  await activeWorkbench.upsertUserRequirementHistory({
    id: approval.historyEntryId,
    userRequirementText: approval.userRequirementText,
    selectedPlatforms: approval.selectedPlatforms,
    maxRounds: approval.maxRounds,
    maxMinutes: approval.maxMinutes,
  });
};

const getApprovedTaskStartPreflight = async (
  activeWorkbench: GrassEyeWorkbenchHandle,
  approval: StartApproval,
) => {
  await recordTaskStartPreflightStart(activeWorkbench, approval);
  const preflight = await activeWorkbench.getMissionStartPreflight({
    requestedPlatformId: approval.binding.requestedPlatformId,
    targetProfileRef: approval.binding.targetProfileRef,
    targetUrl: approval.binding.targetUrl,
    targetTitle: approval.binding.targetTitle,
    userRequirementRef: approval.binding.userRequirementRef,
  });
  await recordTaskStartLocalAiReadiness(activeWorkbench, approval, preflight.components.find((component) => component.name === "localAi"));
  return preflight;
};

const recordMissionPreflightPassed = async (
  activeWorkbench: GrassEyeWorkbenchHandle,
  approval: StartApproval,
  reason: string,
) => {
  recordTaskStartDebugEvent(activeWorkbench, {
    eventType: "MISSION_PREFLIGHT_PASSED",
    status: "success",
    traceId: approval.traceId,
    spanId: "mission-preflight-passed",
    attemptId: approval.attemptId,
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
  await persistSuccessfulRequirementHistory(activeWorkbench, approval, result);
  await writeTaskStartDispatchResult(response, activeWorkbench, approval, result);
};

export async function runTaskStartFlow(request: IncomingMessage, response: ServerResponse, activeWorkbench: GrassEyeWorkbenchHandle): Promise<true> {
  const draft = await buildStartDraft(request);
  const binding = resolveVisualMissionStartBinding({
    selectedPlatforms: draft.selectedPlatforms,
    userRequirementText: draft.userRequirementText,
  });
  await recordTaskStartDraftEvents(activeWorkbench, draft, draft.taskTemplateId);
  if (!binding.ok) {
    await sendTaskStartBindingFailure({ response, activeWorkbench, draft, taskTemplateId: draft.taskTemplateId, binding });
    return true;
  }

  const approval = buildApproval(draft, binding, await activeWorkbench.getAppRunLimitSettings());
  const preflight = await getApprovedTaskStartPreflight(activeWorkbench, approval);
  if (preflight.status === "blocked") {
    await sendBlockedTaskStartPreflight(response, activeWorkbench, approval, preflight);
    return true;
  }

  await executeApprovedTaskStart(response, activeWorkbench, approval, preflight.actionableMessage);
  return true;
}
