import type { MissionExecutionResult, MissionState, OrchestrationExecuteResult } from "../contract.js";
import { parseMissionControlCommand, parseMissionReviewDecision } from "./mission-command-gate.js";
import { checkCanEmergencyStop, checkCanPause, checkCanStop } from "./mission-state-policy-gate.js";
import type { OrchestrationRuntimeContext } from "./orchestration-runtime-context.js";
import { buildFailureExecuteResult, buildStateBackedExecuteResult } from "./orchestration-execute-result.js";
import { buildResumeCheckpointRef } from "./orchestration-frozen-activation.js";
import { resumeMissionCommand } from "./orchestration-executor-commands.js";
import { toMissionControlState } from "./orchestration-state-support.js";

export { executeMissionCommand } from "./orchestration-executor-commands.js";
export { resumeMissionCommand } from "./orchestration-executor-commands.js";

function buildControlFailureResult(input: {
  childCapabilityId: string;
  missionId: string | null;
  state: MissionState | null;
  failureReason: string;
  now: string;
}): OrchestrationExecuteResult {
  return buildFailureExecuteResult({
    missionId: input.missionId,
    mapId: input.state?.mapId ?? null,
    requestedPlatform: input.state?.requestedPlatform ?? null,
    humanGoal: input.state?.humanGoal ?? null,
    childCapabilityId: input.childCapabilityId,
    caller: "commander-console",
    startedAt: input.now,
    endedAt: input.now,
    failureReason: input.failureReason,
  });
}

function buildControlSuccessResult(input: {
  state: MissionState;
  childCapabilityId: "pause-mission" | "stop-mission" | "emergency-stop" | "request-human-review";
  now: string;
  stateDecision: "paused" | "stopped" | "emergency_stopped" | "updated";
}): OrchestrationExecuteResult {
  return buildStateBackedExecuteResult({
    state: input.state,
    childCapabilityId: input.childCapabilityId,
    caller: "commander-console",
    startedAt: input.now,
    endedAt: input.now,
    idempotencyKey: `${input.childCapabilityId}:${input.state.missionId ?? "unknown"}:${input.state.stateRevision}`,
    stateDecision: input.stateDecision,
  });
}

export async function pauseMissionCommand(input: { command: unknown; context: OrchestrationRuntimeContext }): Promise<OrchestrationExecuteResult> {
  const command = parseMissionControlCommand(input.command);
  const now = input.context.clock.now().isoTimestamp;
  const state = await input.context.statePort.getMissionState(command.missionId);
  if (!state) {
    return buildControlFailureResult({ childCapabilityId: "pause-mission", missionId: command.missionId, state: null, failureReason: `Mission ${command.missionId} not found for pause.`, now });
  }
  const policyCheck = checkCanPause(state);
  if (!policyCheck.allowed) {
    return buildControlFailureResult({ childCapabilityId: "pause-mission", missionId: command.missionId, state, failureReason: policyCheck.reason ?? `Pause rejected for mission ${command.missionId}.`, now });
  }
  const nextState = toMissionControlState(state, now, {
    status: "paused",
    pausedAt: now,
    resumeCheckpointRef: buildResumeCheckpointRef(state),
    lastHumanCommand: "pause-mission",
  });
  await input.context.statePort.putMissionState(nextState);
  return buildControlSuccessResult({ state: nextState, childCapabilityId: "pause-mission", now, stateDecision: "paused" });
}

export async function stopMissionCommand(input: { command: unknown; context: OrchestrationRuntimeContext }): Promise<OrchestrationExecuteResult> {
  const command = parseMissionControlCommand(input.command);
  const now = input.context.clock.now().isoTimestamp;
  const state = await input.context.statePort.getMissionState(command.missionId);
  if (!state) {
    return buildControlFailureResult({ childCapabilityId: "stop-mission", missionId: command.missionId, state: null, failureReason: `Mission ${command.missionId} not found for stop.`, now });
  }
  const policyCheck = checkCanStop(state);
  if (!policyCheck.allowed) {
    return buildControlFailureResult({ childCapabilityId: "stop-mission", missionId: command.missionId, state, failureReason: policyCheck.reason ?? `Stop rejected for mission ${command.missionId}.`, now });
  }
  const nextState = toMissionControlState(state, now, {
    status: "stopped",
    failureReason: command.reason ?? null,
    endedAt: now,
    lastHumanCommand: "stop-mission",
  });
  await input.context.statePort.putMissionState(nextState);
  return buildControlSuccessResult({ state: nextState, childCapabilityId: "stop-mission", now, stateDecision: "stopped" });
}

export async function emergencyStopMissionCommand(input: { command: unknown; context: OrchestrationRuntimeContext }): Promise<OrchestrationExecuteResult> {
  const command = parseMissionControlCommand(input.command);
  const now = input.context.clock.now().isoTimestamp;
  const state = await input.context.statePort.getMissionState(command.missionId);
  if (!state) {
    return buildControlFailureResult({ childCapabilityId: "emergency-stop", missionId: command.missionId, state: null, failureReason: `Mission ${command.missionId} not found for emergency-stop.`, now });
  }
  const policyCheck = checkCanEmergencyStop(state);
  if (!policyCheck.allowed) {
    return buildControlFailureResult({ childCapabilityId: "emergency-stop", missionId: command.missionId, state, failureReason: policyCheck.reason ?? `Emergency stop rejected for mission ${command.missionId}.`, now });
  }
  const nextState = toMissionControlState(state, now, {
    status: "stopped",
    failureReason: command.reason ?? "emergency stop requested",
    endedAt: now,
    emergencyStopLatched: true,
    lastHumanCommand: "emergency-stop",
  });
  await input.context.statePort.putMissionState(nextState);
  return buildControlSuccessResult({ state: nextState, childCapabilityId: "emergency-stop", now, stateDecision: "emergency_stopped" });
}

export async function submitMissionReviewDecision(input: {
  command: unknown;
  caller: "commander-console" | "orchestration";
  context: OrchestrationRuntimeContext;
}): Promise<OrchestrationExecuteResult | MissionExecutionResult> {
  const command = parseMissionReviewDecision(input.command);
  if (command.decision === "hold") {
    const now = input.context.clock.now().isoTimestamp;
    const state = await input.context.statePort.getMissionState(command.missionId);
    if (!state) {
      return buildControlFailureResult({ childCapabilityId: "request-human-review", missionId: command.missionId, state: null, failureReason: `Mission ${command.missionId} not found for review decision.`, now });
    }
    const nextState = toMissionControlState(state, now, {
      status: "review_required",
      reviewRequiredReason: command.note ?? "review hold requested",
      resumeCheckpointRef: buildResumeCheckpointRef(state),
    });
    await input.context.statePort.putMissionState(nextState);
    return buildControlSuccessResult({ state: nextState, childCapabilityId: "request-human-review", now, stateDecision: "updated" });
  }
  if (command.decision === "stop") {
    return stopMissionCommand({ command: { missionId: command.missionId, reason: command.note ?? "review stop requested" }, context: input.context });
  }
  return resumeMissionCommand({ command: { missionId: command.missionId, note: command.note }, caller: input.caller, context: input.context });
}
