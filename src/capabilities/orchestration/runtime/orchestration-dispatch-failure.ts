import type { MissionState } from "../contract.js";
import type { z } from "zod";
import type { ActiveRuntimePlanRecord } from "../ports/orchestration-runtime-plan-store-port.js";
import type { MissionHumanCommandKindSchema, RuntimePlanSourceSchema } from "../schema.js";
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
  runtimePlanSource?: z.output<typeof RuntimePlanSourceSchema> | null;
  stateRevisionBefore?: number | null;
  mapRecord?: ActiveRuntimePlanRecord | null;
}) => buildOrchestrationRuntimeProof({
  missionId: input.missionState.missionId ?? "unknown-mission",
  runId: input.missionState.activeTaskRunId ?? input.idempotencyKey,
  mapId: input.missionState.mapId ?? "recovery",
  bindingActivationRef: input.mapRecord?.bindingActivationRef ?? null,
  bindingPackageId: input.mapRecord?.packageId ?? null,
  bindingPackageVersion: input.mapRecord?.packageVersion ?? null,
  mapVersion: input.mapRecord?.mapVersion ?? null,
  runtimePlanSource: input.runtimePlanSource ?? null,
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
  runtimePlanSource?: z.output<typeof RuntimePlanSourceSchema> | null;
  stateRevisionBefore?: number | null;
  mapRecord?: ActiveRuntimePlanRecord | null;
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
    runtimePlanSource: input.runtimePlanSource ?? null,
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
