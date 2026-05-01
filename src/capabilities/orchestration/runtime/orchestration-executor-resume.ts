import type { MissionExecutionResult, MissionState } from "../contract.js";
import type { ActiveOperationalMapRecord } from "../ports/orchestration-map-store-port.js";
import { buildDispatchFailure } from "./orchestration-dispatch-failure.js";
import { runMissionLoop } from "./orchestration-executor-loop.js";
import { IDEMPOTENCY_TTL_MS, createFailedMissionState } from "./orchestration-executor-command-support.js";
import { parseMissionControlCommand } from "./mission-command-gate.js";
import { checkCanResume } from "./mission-state-policy-gate.js";
import type { OrchestrationRuntimeContext } from "./orchestration-runtime-context.js";
import { toMissionControlState } from "./orchestration-state-support.js";
import { validateOperationalMapGate } from "./map-validation-gate.js";

type ResumeMissionCommandInput = {
  command: unknown;
  caller: "commander-console" | "orchestration";
  context: OrchestrationRuntimeContext;
};

type ResumeMissionFailureDetails = {
  stepId: string;
  childCapabilityId: string;
  failureReason: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  idempotencyKey: string;
  stateRevisionBefore?: number;
  mapRecord?: ActiveOperationalMapRecord;
};

type ResumeStateFailureDetails = {
  startedAt: string;
  missionId: string;
  failureReason: string;
  stepId: string;
  childCapabilityId: string;
  idempotencySuffix: string;
  mapRecord?: ActiveOperationalMapRecord;
};

type ResumeFailureStateInput = {
  missionId: string | null;
  mapId: string | null;
  requestedPlatform: string | null;
  humanGoal: string | null;
  failureReason: string;
  startedAt: string;
  endedAt: string;
};

function buildResumeFailureState(input: ResumeFailureStateInput): MissionState {
  return createFailedMissionState({
    missionId: input.missionId,
    mapId: input.mapId,
    requestedPlatform: input.requestedPlatform,
    humanGoal: input.humanGoal,
    lastHumanCommand: "resume-mission",
    failureReason: input.failureReason,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
  });
}

function buildResumeFailureResult(input: ResumeMissionCommandInput, state: MissionState, details: ResumeMissionFailureDetails): MissionExecutionResult {
  return buildDispatchFailure({
    state,
    commandKind: "resume-mission",
    caller: input.caller,
    stepId: details.stepId,
    childCapabilityId: details.childCapabilityId,
    failureReason: details.failureReason,
    startedAt: details.startedAt,
    endedAt: details.endedAt,
    durationMs: details.durationMs,
    idempotencyKey: details.idempotencyKey,
    stateRevisionBefore: details.stateRevisionBefore,
    mapRecord: details.mapRecord,
  });
}

function buildResumeMissingMissionFailure(input: ResumeMissionCommandInput, missionId: string, startedAt: string): MissionExecutionResult {
  const endedAt = input.context.clock.now().isoTimestamp;
  const failureReason = `Mission ${missionId} not found.`;
  return buildResumeFailureResult(
    input,
    buildResumeFailureState({
      missionId,
      mapId: null,
      requestedPlatform: null,
      humanGoal: null,
      failureReason,
      startedAt,
      endedAt,
    }),
    {
      stepId: "state-lookup",
      childCapabilityId: "state-lookup",
      failureReason,
      startedAt,
      endedAt,
      durationMs: 0,
      idempotencyKey: `resume:${missionId}:notfound`,
    },
  );
}

function buildResumeStateFailure(
  input: ResumeMissionCommandInput,
  state: MissionState,
  details: ResumeStateFailureDetails,
): MissionExecutionResult {
  const endedAt = input.context.clock.now().isoTimestamp;
  const { startedAt, missionId, failureReason, stepId, childCapabilityId, idempotencySuffix, mapRecord } = details;
  return buildResumeFailureResult(input, state, {
    stepId,
    childCapabilityId,
    failureReason,
    startedAt,
    endedAt,
    durationMs: 0,
    idempotencyKey: `resume:${missionId}:${idempotencySuffix}`,
    stateRevisionBefore: state.stateRevision ?? 0,
    mapRecord,
  });
}

function buildResumeUnexpectedFailure(
  input: ResumeMissionCommandInput,
  startedSnapshot: { isoTimestamp: string; monotonicMs: number },
  error: unknown,
): MissionExecutionResult {
  const endedAt = input.context.clock.now().isoTimestamp;
  const failureReason = error instanceof Error ? error.message : "Unknown resume failure";
  return buildResumeFailureResult(
    input,
    buildResumeFailureState({
      missionId: null,
      mapId: null,
      requestedPlatform: null,
      humanGoal: null,
      failureReason,
      startedAt: startedSnapshot.isoTimestamp,
      endedAt,
    }),
    {
      stepId: "resume-mission",
      childCapabilityId: "resume-mission",
      failureReason,
      startedAt: startedSnapshot.isoTimestamp,
      endedAt,
      durationMs: Math.max(0, Math.round(input.context.clock.now().monotonicMs - startedSnapshot.monotonicMs)),
      idempotencyKey: `resume:failed:${startedSnapshot.isoTimestamp}`,
    },
  );
}

async function runResumeMissionPlanWithState(
  input: ResumeMissionCommandInput,
  state: MissionState,
  command: ReturnType<typeof parseMissionControlCommand>,
  startedSnapshot: { isoTimestamp: string; monotonicMs: number },
): Promise<MissionExecutionResult> {
  if (!state.mapId) return buildResumeStateFailure(input, state, { startedAt: startedSnapshot.isoTimestamp, missionId: command.missionId, failureReason: `Mission ${command.missionId} has no mapId.`, stepId: "map-lookup", childCapabilityId: "map-lookup", idempotencySuffix: "no-map" });

  const mapRecord = await input.context.mapStore.getActiveMapRecord(state.mapId);
  if (!mapRecord) return buildResumeStateFailure(input, state, { startedAt: startedSnapshot.isoTimestamp, missionId: command.missionId, failureReason: `Map "${state.mapId}" is not active for resume of mission ${command.missionId}.`, stepId: "map-lookup", childCapabilityId: "map-lookup", idempotencySuffix: "map-missing" });

  const mapValidation = validateOperationalMapGate(mapRecord.operationalMap);
  if (!mapValidation.valid) return buildResumeStateFailure(input, state, { startedAt: startedSnapshot.isoTimestamp, missionId: command.missionId, failureReason: mapValidation.failureReason, stepId: "map-validation", childCapabilityId: "map-validation", idempotencySuffix: "map-invalid", mapRecord });

  const resumedAt = input.context.clock.now().isoTimestamp;
  const resumedState = toMissionControlState(state, resumedAt, { status: "running", pausedAt: null, lastHumanCommand: "resume-mission" });
  await input.context.statePort.putMissionState(resumedState);
  const idempotencyKey = `resume:${state.missionId}:${state.sequenceNo}`;
  await input.context.idempotency.reserve(idempotencyKey, IDEMPOTENCY_TTL_MS);
  return runMissionLoop({ state: resumedState, map: mapValidation.map, mapRecord, context: input.context, commandKind: "resume-mission", caller: input.caller, idempotencyKey, selectedMapSource: "preferred_map_id" });
}

async function runResumeMissionPlan(input: ResumeMissionCommandInput, startedSnapshot: { isoTimestamp: string; monotonicMs: number }): Promise<MissionExecutionResult> {
  const command = parseMissionControlCommand(input.command);
  const state = await input.context.statePort.getMissionState(command.missionId);
  if (!state) return buildResumeMissingMissionFailure(input, command.missionId, startedSnapshot.isoTimestamp);

  const policyCheck = checkCanResume(state);
  if (!policyCheck.allowed) return buildResumeStateFailure(input, state, { startedAt: startedSnapshot.isoTimestamp, missionId: command.missionId, failureReason: policyCheck.reason!, stepId: "policy-gate", childCapabilityId: "policy-gate", idempotencySuffix: "policy-rejected" });

  return runResumeMissionPlanWithState(input, state, command, startedSnapshot);
}

export async function resumeMissionCommand(input: ResumeMissionCommandInput): Promise<MissionExecutionResult> {
  const startedSnapshot = input.context.clock.now();

  try {
    return await runResumeMissionPlan(input, startedSnapshot);
  } catch (error) {
    return buildResumeUnexpectedFailure(input, startedSnapshot, error);
  }
}
