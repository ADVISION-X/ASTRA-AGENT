import { RuntimeProofSchema } from "../schema.js";

export function buildOrchestrationRuntimeProof(input: {
  missionId: string;
  mapId: import("../contract.js").OperationalMapId;
  stepId: string;
  childCapabilityId: string;
  commandKind: import("../schema.js").MissionHumanCommandKindSchema["_output"];
  caller: "commander-console" | "orchestration";
  idempotencyKey: string;
  sequenceNo: number;
  inputRef: string | null;
  outputRef: string | null;
  nerveBusEnvelopeId: string | null;
  abilityResultRef: string | null;
  transitionId: string | null;
  previousStepId: string | null;
  nextStepId: string | null;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  status: "completed" | "failed" | "review_required" | "stopped";
  failureReason: string | null;
  reviewRequiredReason: string | null;
  mapDecision: "selected" | "rejected";
  transitionDecision: "continue" | "finalize" | "review_required" | "failed";
  loopDecision: "continue" | "stop_failed" | "stop_review_required";
  stateDecision: "created" | "updated" | "paused" | "resumed" | "stopped" | "emergency_stopped" | "finalized";
  emergencyDecision: "none" | "latched" | "executed";
  dataQualityFlags: string[];
}) {
  return RuntimeProofSchema.parse({
    proofId: `${input.missionId}:${input.sequenceNo}:${input.stepId}`,
    missionId: input.missionId,
    mapId: input.mapId,
    stepId: input.stepId,
    childCapabilityId: input.childCapabilityId,
    commandKind: input.commandKind,
    caller: input.caller,
    idempotencyKey: input.idempotencyKey,
    sequenceNo: input.sequenceNo,
    inputRef: input.inputRef,
    outputRef: input.outputRef,
    nerveBusEnvelopeId: input.nerveBusEnvelopeId,
    abilityResultRef: input.abilityResultRef,
    transitionId: input.transitionId,
    previousStepId: input.previousStepId,
    nextStepId: input.nextStepId,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: input.durationMs,
    status: input.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    mapDecision: input.mapDecision,
    transitionDecision: input.transitionDecision,
    loopDecision: input.loopDecision,
    stateDecision: input.stateDecision,
    emergencyDecision: input.emergencyDecision,
    dataQualityFlags: input.dataQualityFlags,
  });
}