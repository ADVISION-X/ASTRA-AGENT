import type { MissionState } from "../contract.js";
import type { z } from "zod";
import type { ActiveOperationalMapRecord } from "../ports/orchestration-map-store-port.js";
import type { MissionHumanCommandKindSchema, SelectedMapSourceSchema } from "../schema.js";
import { buildMissionExecutionResult, buildMissionStateUpdate } from "./orchestration-result-builder.js";
import { buildOrchestrationRuntimeProof } from "./orchestration-proof-builder.js";

const buildDispatchFailureMissionState = (input: {
  state: MissionState;
  failureReason: string;
  endedAt: string;
}): MissionState => buildMissionStateUpdate({
  ...input.state,
  status: "failed",
  failureReason: input.failureReason,
  endedAt: input.endedAt,
  updatedAt: input.endedAt,
  stateRevision: (input.state.stateRevision ?? 0) + 1,
});

const buildDispatchFailureRuntimeProof = (input: {
  missionState: MissionState;
  commandKind: z.output<typeof MissionHumanCommandKindSchema>;
  caller: "commander-console" | "orchestration";
  stepId: string;
  childCapabilityId: string;
  failureReason: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  idempotencyKey: string;
  selectedMapSource?: z.output<typeof SelectedMapSourceSchema> | null;
  stateRevisionBefore?: number | null;
  mapRecord?: ActiveOperationalMapRecord | null;
}) => buildOrchestrationRuntimeProof({
  missionId: input.missionState.missionId ?? "unknown-mission",
  mapId: input.missionState.mapId ?? "recovery",
  taskTemplateId: input.mapRecord?.taskTemplateId ?? null,
  activationId: input.mapRecord?.activationId ?? null,
  mapPackageId: input.mapRecord?.packageId ?? null,
  mapPackageVersion: input.mapRecord?.packageVersion ?? null,
  mapVersion: input.mapRecord?.mapVersion ?? null,
  selectedMapSource: input.selectedMapSource ?? null,
  stepId: input.stepId,
  childCapabilityId: input.childCapabilityId,
  commandKind: input.commandKind,
  caller: input.caller,
  idempotencyKey: input.idempotencyKey,
  sequenceNo: input.missionState.sequenceNo,
  stateRevisionBefore: input.stateRevisionBefore ?? null,
  stateRevisionAfter: input.missionState.stateRevision,
  stateHashBefore: input.missionState.stateHash ?? null,
  stateHashAfter: input.missionState.stateHash ?? null,
  nerveBusEnvelopeId: input.missionState.lastEnvelopeId ?? null,
  abilityResultRef: input.missionState.lastResultRef ?? null,
  transitionId: null,
  previousStepId: input.missionState.previousStepId ?? null,
  nextStepId: null,
  startedAt: input.startedAt,
  endedAt: input.endedAt,
  durationMs: input.durationMs,
  status: "failed",
  failureReason: input.failureReason,
  reviewRequiredReason: null,
  mapDecision: "selected",
  transitionDecision: "failed",
  loopDecision: "continue",
  stateDecision: "updated",
  emergencyDecision: input.missionState.emergencyStopLatched ? "latched" : "none",
  dataQualityFlags: ["dispatch_failure"],
});

export function buildDispatchFailure(input: {
  state: MissionState;
  commandKind: z.output<typeof MissionHumanCommandKindSchema>;
  caller: "commander-console" | "orchestration";
  stepId: string;
  childCapabilityId: string;
  failureReason: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  idempotencyKey: string;
  selectedMapSource?: z.output<typeof SelectedMapSourceSchema> | null;
  stateRevisionBefore?: number | null;
  mapRecord?: ActiveOperationalMapRecord | null;
}) {
  const missionState = buildDispatchFailureMissionState({
    state: input.state,
    failureReason: input.failureReason,
    endedAt: input.endedAt,
  });
  const runtimeProof = buildDispatchFailureRuntimeProof({
    missionState,
    commandKind: input.commandKind,
    caller: input.caller,
    stepId: input.stepId,
    childCapabilityId: input.childCapabilityId,
    failureReason: input.failureReason,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: input.durationMs,
    idempotencyKey: input.idempotencyKey,
    selectedMapSource: input.selectedMapSource ?? null,
    stateRevisionBefore: input.stateRevisionBefore ?? null,
    mapRecord: input.mapRecord ?? null,
  });
  return buildMissionExecutionResult({
    missionState,
    currentStepResult: null,
    runtimeProof,
    failureReason: input.failureReason,
  });
}
