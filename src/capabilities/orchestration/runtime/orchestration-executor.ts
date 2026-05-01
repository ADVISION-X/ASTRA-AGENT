import type { MissionExecutionResult, MissionState } from "../contract.js";
import { parseMissionControlCommand, parseMissionReviewDecision } from "./mission-command-gate.js";
import { checkCanEmergencyStop, checkCanPause, checkCanStop } from "./mission-state-policy-gate.js";
import type { OrchestrationRuntimeContext } from "./orchestration-runtime-context.js";
import { resumeMissionCommand } from "./orchestration-executor-commands.js";
import { toMissionControlState } from "./orchestration-state-support.js";

export { executeMissionCommand } from "./orchestration-executor-commands.js";
export { resumeMissionCommand } from "./orchestration-executor-commands.js";

export async function pauseMissionCommand(input: { command: unknown; context: OrchestrationRuntimeContext }): Promise<MissionState> {
  const command = parseMissionControlCommand(input.command);
  const now = input.context.clock.now().isoTimestamp;
  const state = await input.context.statePort.getMissionState(command.missionId);
  if (!state) {
    throw new Error(`Mission ${command.missionId} not found for pause.`);
  }
  const policyCheck = checkCanPause(state);
  if (!policyCheck.allowed) {
    throw new Error(policyCheck.reason!);
  }
  const nextState = toMissionControlState(state, now, {
    status: "paused",
    pausedAt: now,
    lastHumanCommand: "pause-mission",
  });
  await input.context.statePort.putMissionState(nextState);
  return nextState;
}

export async function stopMissionCommand(input: { command: unknown; context: OrchestrationRuntimeContext }): Promise<MissionState> {
  const command = parseMissionControlCommand(input.command);
  const now = input.context.clock.now().isoTimestamp;
  const state = await input.context.statePort.getMissionState(command.missionId);
  if (!state) {
    throw new Error(`Mission ${command.missionId} not found for stop.`);
  }
  const policyCheck = checkCanStop(state);
  if (!policyCheck.allowed) {
    throw new Error(policyCheck.reason!);
  }
  const nextState = toMissionControlState(state, now, {
    status: "stopped",
    failureReason: command.reason ?? null,
    endedAt: now,
    lastHumanCommand: "stop-mission",
  });
  await input.context.statePort.putMissionState(nextState);
  return nextState;
}

export async function emergencyStopMissionCommand(input: { command: unknown; context: OrchestrationRuntimeContext }): Promise<MissionState> {
  const command = parseMissionControlCommand(input.command);
  const now = input.context.clock.now().isoTimestamp;
  const state = await input.context.statePort.getMissionState(command.missionId);
  if (!state) {
    throw new Error(`Mission ${command.missionId} not found for emergency-stop.`);
  }
  const policyCheck = checkCanEmergencyStop(state);
  if (!policyCheck.allowed) {
    throw new Error(policyCheck.reason!);
  }
  const nextState = toMissionControlState(state, now, {
    status: "stopped",
    failureReason: command.reason ?? "emergency stop requested",
    endedAt: now,
    emergencyStopLatched: true,
    lastHumanCommand: "emergency-stop",
  });
  await input.context.statePort.putMissionState(nextState);
  return nextState;
}

export async function submitMissionReviewDecision(input: {
  command: unknown;
  caller: "commander-console" | "orchestration";
  context: OrchestrationRuntimeContext;
}): Promise<MissionState | MissionExecutionResult> {
  const command = parseMissionReviewDecision(input.command);
  if (command.decision === "hold") {
    const now = input.context.clock.now().isoTimestamp;
    const state = await input.context.statePort.getMissionState(command.missionId);
    if (!state) {
      throw new Error(`Mission ${command.missionId} not found for review decision.`);
    }
    const nextState = toMissionControlState(state, now, {
      status: "review_required",
      reviewRequiredReason: command.note ?? "review hold requested",
    });
    await input.context.statePort.putMissionState(nextState);
    return nextState;
  }
  if (command.decision === "stop") {
    return stopMissionCommand({ command: { missionId: command.missionId, reason: command.note ?? "review stop requested" }, context: input.context });
  }
  return resumeMissionCommand({ command: { missionId: command.missionId, note: command.note }, caller: input.caller, context: input.context });
}
