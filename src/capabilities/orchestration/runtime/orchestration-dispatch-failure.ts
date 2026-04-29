import type { MissionState } from "../contract.js";
import { buildMissionExecutionResult, buildMissionStateUpdate } from "./orchestration-result-builder.js";
import { buildOrchestrationRuntimeProof } from "./orchestration-proof-builder.js";

export function buildDispatchFailure(input: {
  state: MissionState;
  commandKind: "start-mission" | "pause-mission" | "resume-mission" | "stop-mission" | "emergency-stop" | "submit-review-decision";
  caller: "commander-console" | "orchestration";
  stepId: string;
  childCapabilityId: string;
  failureReason: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  idempotencyKey: string;
}) {
  const missionState = buildMissionStateUpdate({
    ...input.state,
    status: "failed",
    failureReason: input.failureReason,
    endedAt: input.endedAt,
    updatedAt: input.endedAt,
  });
  const runtimeProof = buildOrchestrationRuntimeProof({
    missionId: missionState.missionId ?? "unknown-mission",
    mapId: missionState.mapId ?? "recovery",
    stepId: input.stepId,
    childCapabilityId: input.childCapabilityId,
    commandKind: input.commandKind,
    caller: input.caller,
    idempotencyKey: input.idempotencyKey,
    sequenceNo: missionState.sequenceNo,
    inputRef: missionState.payloadRefs.commandInputRef,
    outputRef: null,
    nerveBusEnvelopeId: missionState.lastEnvelopeId,
    abilityResultRef: missionState.lastResultRef,
    transitionId: null,
    previousStepId: missionState.previousStepId,
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
    emergencyDecision: missionState.emergencyStopLatched ? "latched" : "none",
    dataQualityFlags: ["dispatch_failure"],
  });
  return buildMissionExecutionResult({ missionState, currentStepResult: null, runtimeProof });
}