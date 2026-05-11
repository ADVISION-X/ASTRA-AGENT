import type { MissionCommand, MissionExecutionResult, MissionState, OperationalMap } from "../contract.js";
import type { ActiveOperationalMapRecord } from "../ports/orchestration-map-store-port.js";
import { buildDispatchFailure } from "./orchestration-dispatch-failure.js";
import { runMissionLoop } from "./orchestration-executor-loop.js";
import {
  IDEMPOTENCY_TTL_MS,
  createFailedMissionState,
  createInitialMissionState,
} from "./orchestration-executor-command-support.js";
import type { MapSelectionResult, SelectedMapSource } from "./map-selection-gate.js";
import { parseMissionCommand } from "./mission-command-gate.js";
import { selectOperationalMap } from "./map-selection-gate.js";
import type { MapValidationResult } from "./map-validation-gate.js";
import { validateOperationalMapGate } from "./map-validation-gate.js";
import type { OrchestrationRuntimeContext } from "./orchestration-runtime-context.js";

type SuccessfulMapSelection = Extract<MapSelectionResult, { selected: true }>;
type FailedMapSelection = Extract<MapSelectionResult, { selected: false }>;
type FailedMapValidation = Extract<MapValidationResult, { valid: false }>;

type StartMissionCommandInput = {
  command: unknown;
  caller: "commander-console" | "orchestration";
  context: OrchestrationRuntimeContext;
};

type StartMissionFailureDetails = {
  stepId: string;
  childCapabilityId: string;
  failureReason: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  idempotencyKey: string;
  selectedMapSource?: SelectedMapSource | null;
  mapRecord?: ActiveOperationalMapRecord | null;
};

type StartMapSelectionFailureDetails = {
  startedAt: string;
  fallbackIdempotencyKey: string;
  mapSelection: FailedMapSelection;
};

type StartMapValidationFailureDetails = {
  startedAt: string;
  fallbackIdempotencyKey: string;
  mapSelection: SuccessfulMapSelection;
  mapValidation: FailedMapValidation;
};

type StartIdempotencyFailureDetails = {
  startedAt: string;
  idempotencyKey: string;
  map: OperationalMap;
  selectedMapSource: SelectedMapSource | null;
  mapRecord: ActiveOperationalMapRecord;
};

type StartFailureStateInput = {
  missionId: string | null;
  mapId: string | null;
  requestedPlatform: MissionState["requestedPlatform"];
  humanGoal: string | null;
  failureReason: string;
  startedAt: string;
  endedAt: string;
};

function buildStartFailureState(input: StartFailureStateInput): MissionState {
  return createFailedMissionState({
    missionId: input.missionId,
    mapId: input.mapId,
    requestedPlatform: input.requestedPlatform,
    humanGoal: input.humanGoal,
    lastHumanCommand: "start-mission",
    failureReason: input.failureReason,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
  });
}

function buildStartFailureResult(input: StartMissionCommandInput, state: MissionState, details: StartMissionFailureDetails): MissionExecutionResult {
  const dispatchFailureInput = {
    state,
    commandKind: "start-mission",
    caller: input.caller,
    stepId: details.stepId,
    childCapabilityId: details.childCapabilityId,
    failureReason: details.failureReason,
    startedAt: details.startedAt,
    endedAt: details.endedAt,
    durationMs: details.durationMs,
    idempotencyKey: details.idempotencyKey,
  } as const;

  return buildDispatchFailure({
    ...dispatchFailureInput,
    ...(details.selectedMapSource === undefined ? {} : { selectedMapSource: details.selectedMapSource }),
    ...(details.mapRecord === undefined ? {} : { mapRecord: details.mapRecord }),
  });
}

function buildStartMapSelectionFailure(
  input: StartMissionCommandInput,
  command: MissionCommand,
  details: StartMapSelectionFailureDetails,
): MissionExecutionResult {
  const endedAt = input.context.clock.now().isoTimestamp;
  const { startedAt, fallbackIdempotencyKey, mapSelection } = details;
  return buildStartFailureResult(
    input,
    buildStartFailureState({
      missionId: command.missionId,
      mapId: null,
      requestedPlatform: command.requestedPlatform,
      humanGoal: command.humanGoal,
      failureReason: mapSelection.failureReason,
      startedAt,
      endedAt,
    }),
    {
      stepId: "runtime-plan-resolution",
      childCapabilityId: "runtime-plan-resolution",
      failureReason: mapSelection.failureReason,
      startedAt,
      endedAt,
      durationMs: 0,
      idempotencyKey: fallbackIdempotencyKey,
      selectedMapSource: mapSelection.selectedMapSource,
    },
  );
}

function buildStartMapValidationFailure(
  input: StartMissionCommandInput,
  command: MissionCommand,
  details: StartMapValidationFailureDetails,
): MissionExecutionResult {
  const endedAt = input.context.clock.now().isoTimestamp;
  const { startedAt, fallbackIdempotencyKey, mapSelection, mapValidation } = details;
  const failureReason = `Stored runtime plan validation failed: ${mapValidation.failureReason}`;
  return buildStartFailureResult(
    input,
    buildStartFailureState({
      missionId: command.missionId,
      mapId: mapSelection.record.mapId,
      requestedPlatform: command.requestedPlatform,
      humanGoal: command.humanGoal,
      failureReason,
      startedAt,
      endedAt,
    }),
    {
      stepId: "runtime-plan-validation",
      childCapabilityId: "runtime-plan-validation",
      failureReason,
      startedAt,
      endedAt,
      durationMs: 0,
      idempotencyKey: fallbackIdempotencyKey,
      selectedMapSource: mapSelection.selectedMapSource,
      mapRecord: mapSelection.record,
    },
  );
}

function buildStartIdempotencyFailure(
  input: StartMissionCommandInput,
  command: MissionCommand,
  details: StartIdempotencyFailureDetails,
): MissionExecutionResult {
  const endedAt = input.context.clock.now().isoTimestamp;
  const { startedAt, idempotencyKey, map, selectedMapSource, mapRecord } = details;
  const failureReason = `Mission ${command.missionId} idempotency conflict.`;
  return buildStartFailureResult(
    input,
    buildStartFailureState({
      missionId: command.missionId,
      mapId: map.mapId,
      requestedPlatform: command.requestedPlatform,
      humanGoal: command.humanGoal,
      failureReason,
      startedAt,
      endedAt,
    }),
    {
      stepId: "idempotency-gate",
      childCapabilityId: "idempotency-gate",
      failureReason,
      startedAt,
      endedAt,
      durationMs: 0,
      idempotencyKey,
      selectedMapSource,
      mapRecord,
    },
  );
}

function buildStartUnexpectedFailure(
  input: StartMissionCommandInput,
  startedSnapshot: { isoTimestamp: string; monotonicMs: number },
  fallbackIdempotencyKey: string,
  error: unknown,
): MissionExecutionResult {
  const endedAt = input.context.clock.now().isoTimestamp;
  const failureReason = error instanceof Error ? error.message : "Unknown mission dispatch failure";
  return buildStartFailureResult(
    input,
    buildStartFailureState({
      missionId: null,
      mapId: null,
      requestedPlatform: null,
      humanGoal: null,
      failureReason,
      startedAt: startedSnapshot.isoTimestamp,
      endedAt,
    }),
    {
      stepId: "start-mission",
      childCapabilityId: "start-mission",
      failureReason,
      startedAt: startedSnapshot.isoTimestamp,
      endedAt,
      durationMs: Math.max(0, Math.round(input.context.clock.now().monotonicMs - startedSnapshot.monotonicMs)),
      idempotencyKey: fallbackIdempotencyKey,
    },
  );
}

async function runStartMissionPlan(
  input: StartMissionCommandInput,
  startedSnapshot: { isoTimestamp: string; monotonicMs: number },
  updateFallbackIdempotencyKey: (value: string) => void,
): Promise<MissionExecutionResult> {
  const command = parseMissionCommand(input.command);
  updateFallbackIdempotencyKey(`start:${command.missionId}:${startedSnapshot.isoTimestamp}`);

  const mapSelection = await selectOperationalMap({ command, mapStore: input.context.mapStore });
  if (!mapSelection.selected) {
    return buildStartMapSelectionFailure(input, command, {
      startedAt: startedSnapshot.isoTimestamp,
      fallbackIdempotencyKey: `start:${command.missionId}:${startedSnapshot.isoTimestamp}`,
      mapSelection,
    });
  }

  const mapValidation = validateOperationalMapGate(mapSelection.map);
  if (!mapValidation.valid) {
    return buildStartMapValidationFailure(input, command, {
      startedAt: startedSnapshot.isoTimestamp,
      fallbackIdempotencyKey: `start:${command.missionId}:${startedSnapshot.isoTimestamp}`,
      mapSelection,
      mapValidation,
    });
  }

  const { map } = mapValidation;
  const idempotencyKey = `start:${command.missionId}:${map.mapId}`;
  const reservation = await input.context.idempotency.reserve(idempotencyKey, IDEMPOTENCY_TTL_MS);
  if (!reservation.reserved) {
    return buildStartIdempotencyFailure(input, command, {
      startedAt: startedSnapshot.isoTimestamp,
      idempotencyKey,
      map,
      selectedMapSource: mapSelection.selectedMapSource,
      mapRecord: mapSelection.record,
    });
  }

  const initialState = createInitialMissionState(command, mapSelection.record, mapSelection.selectedMapSource, startedSnapshot.isoTimestamp);
  await input.context.statePort.putMissionState(initialState);
  return runMissionLoop({
    state: initialState,
    map,
    mapRecord: mapSelection.record,
    context: input.context,
    commandKind: "start-mission",
    caller: input.caller,
    idempotencyKey,
    selectedMapSource: mapSelection.selectedMapSource,
  });
}

export async function executeMissionCommand(input: StartMissionCommandInput): Promise<MissionExecutionResult> {
  const startedSnapshot = input.context.clock.now();
  let fallbackIdempotencyKey = `start:failed:${startedSnapshot.isoTimestamp}`;

  try {
    return await runStartMissionPlan(input, startedSnapshot, (value) => {
      fallbackIdempotencyKey = value;
    });
  } catch (error) {
    return buildStartUnexpectedFailure(input, startedSnapshot, fallbackIdempotencyKey, error);
  }
}
