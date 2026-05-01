import type { MissionState } from "../contract.js";
import { buildOrchestrationRuntimeProof, type BuildProofInput } from "./orchestration-proof-builder.js";
import { toMapProofMetadata, toRuntimeProofStatus } from "./orchestration-state-support.js";
import type { ActiveOperationalMapRecord } from "../ports/orchestration-map-store-port.js";

export type OrchestrationLoopProofContext = {
  missionId: string;
  mapId: string;
  selectedMapSource: "preferred_map_id" | "initial_payload_map_id" | "task_template_id" | "activation_id";
  commandKind: "start-mission" | "resume-mission";
  caller: "commander-console" | "orchestration";
  idempotencyKey: string;
  mapRecord: ActiveOperationalMapRecord | null;
};

type ProofTiming = {
  startedAt: string;
  endedAt: string;
  durationMs: number;
};

type LoopDecisionState = {
  status: MissionState["status"];
  failureReason: string | null;
  reviewRequiredReason: string | null;
  loopDecision: "stop_failed" | "stop_review_required" | "stop_completed" | "continue";
  stateDecision: "updated" | "finalized";
  emergencyDecision: "latched" | "none";
};

function buildProofBase(input: OrchestrationLoopProofContext, currentStepId: string) {
  return {
    missionId: input.missionId,
    mapId: input.mapId,
    ...toMapProofMetadata(input.mapRecord),
    selectedMapSource: input.selectedMapSource,
    stepId: currentStepId,
    commandKind: input.commandKind,
    caller: input.caller,
    idempotencyKey: input.idempotencyKey,
  };
}

function buildFailureProof(input: OrchestrationLoopProofContext, details: {
  timing: ProofTiming;
  stateRevisionBefore: number;
  stateRevisionAfter: number;
  stateHashBefore: string | null;
  stateHashAfter: string | null;
  currentStepId: string;
  childCapabilityId: string;
  failureReason: string;
  loopDecision: LoopDecisionState["loopDecision"];
  stateDecision: LoopDecisionState["stateDecision"];
  dataQualityFlags: string[];
  extra: Record<string, unknown>;
}) {
  const { timing, stateRevisionBefore, stateRevisionAfter, stateHashBefore, stateHashAfter, currentStepId, childCapabilityId, failureReason, loopDecision, stateDecision, dataQualityFlags, extra } = details;
  return buildOrchestrationRuntimeProof({
    ...buildProofBase(input, currentStepId),
    childCapabilityId,
    sequenceNo: extra.sequenceNo as number,
    stateRevisionBefore,
    stateRevisionAfter,
    stateHashBefore,
    stateHashAfter,
    startedAt: timing.startedAt,
    endedAt: timing.endedAt,
    durationMs: timing.durationMs,
    status: extra.status as MissionState["status"],
    failureReason,
    mapDecision: "selected",
    transitionDecision: extra.transitionDecision as BuildProofInput["transitionDecision"],
    loopDecision,
    stateDecision,
    emergencyDecision: extra.emergencyDecision as "latched" | "none",
    dataQualityFlags,
    ...extra,
  });
}

export function buildDispatchGateFailureProof(input: {
  context: OrchestrationLoopProofContext;
  currentStepId: string;
  stateRevisionBefore: number;
  stateRevisionAfter: number;
  stateHashBefore: string | null;
  stateHashAfter: string | null;
  startedAt: string;
  endedAt: string;
  failureReason: string;
  state: MissionState;
}) {
  return buildFailureProof(
    input.context,
    { timing: { startedAt: input.startedAt, endedAt: input.endedAt, durationMs: 0 }, stateRevisionBefore: input.stateRevisionBefore, stateRevisionAfter: input.stateRevisionAfter, stateHashBefore: input.stateHashBefore, stateHashAfter: input.stateHashAfter, currentStepId: input.currentStepId, childCapabilityId: "dispatch-gate", failureReason: input.failureReason, loopDecision: "stop_failed", stateDecision: "updated", dataQualityFlags: ["state_machine_violation"], extra: { sequenceNo: input.state.sequenceNo, status: "failed", emergencyDecision: input.state.emergencyStopLatched ? "latched" : "none", transitionDecision: "failed" } },
  );
}

export function buildLoopGuardFailureProof(input: {
  context: OrchestrationLoopProofContext;
  currentStepId: string;
  stateRevisionBefore: number;
  stateRevisionAfter: number;
  stateHashBefore: string | null;
  stateHashAfter: string | null;
  startedAt: string;
  endedAt: string;
  state: MissionState;
  loopDecision: "stop_failed" | "stop_review_required" | "stop_completed";
  failureReason: string | null;
  reviewRequiredReason: string | null;
}) {
  return buildFailureProof(
    input.context,
    { timing: { startedAt: input.startedAt, endedAt: input.endedAt, durationMs: 0 }, stateRevisionBefore: input.stateRevisionBefore, stateRevisionAfter: input.stateRevisionAfter, stateHashBefore: input.stateHashBefore, stateHashAfter: input.stateHashAfter, currentStepId: input.currentStepId, childCapabilityId: "loop-guard", failureReason: input.failureReason ?? "loop_guard_triggered", loopDecision: input.loopDecision, stateDecision: "finalized", dataQualityFlags: input.loopDecision === "stop_completed" ? [] : ["loop_guard_triggered"], extra: { sequenceNo: input.state.sequenceNo, status: toRuntimeProofStatus(input.state.status), reviewRequiredReason: input.reviewRequiredReason, transitionDecision: input.state.status === "failed" ? "failed" : input.state.status === "review_required" ? "review_required" : "finalize", emergencyDecision: input.state.emergencyStopLatched ? "latched" : "none" } },
  );
}

export function buildStepDispatchFailureProof(input: {
  context: OrchestrationLoopProofContext;
  currentStepId: string;
  stepDispatchCallId: string;
  stateRevisionBefore: number;
  stateRevisionAfter: number;
  stateHashBefore: string | null;
  stateHashAfter: string | null;
  startedAt: string;
  endedAt: string;
  state: MissionState;
  failureReason: string;
}) {
  return buildFailureProof(
    input.context,
    { timing: { startedAt: input.startedAt, endedAt: input.endedAt, durationMs: 0 }, stateRevisionBefore: input.stateRevisionBefore, stateRevisionAfter: input.stateRevisionAfter, stateHashBefore: input.stateHashBefore, stateHashAfter: input.stateHashAfter, currentStepId: input.currentStepId, childCapabilityId: input.currentStepId, failureReason: input.failureReason, loopDecision: "stop_failed", stateDecision: "updated", dataQualityFlags: ["step_dispatch_failure"], extra: { sequenceNo: input.state.sequenceNo, stepDispatchCallId: input.stepDispatchCallId, status: "failed", transitionDecision: "failed", emergencyDecision: input.state.emergencyStopLatched ? "latched" : "none" } },
  );
}

export function buildTransitionFailureProof(input: {
  context: OrchestrationLoopProofContext;
  currentStepId: string;
  stepDispatchCallId: string;
  nerveBusEnvelopeId: string | null;
  transitionEvaluationDecision: string;
  stateRevisionBefore: number;
  stateRevisionAfter: number;
  stateHashBefore: string | null;
  stateHashAfter: string | null;
  startedAt: string;
  endedAt: string;
  state: MissionState;
  failureReason: string;
}) {
  return buildFailureProof(
    input.context,
    { timing: { startedAt: input.startedAt, endedAt: input.endedAt, durationMs: Math.max(0, new Date(input.endedAt).getTime() - new Date(input.startedAt).getTime()) }, stateRevisionBefore: input.stateRevisionBefore, stateRevisionAfter: input.stateRevisionAfter, stateHashBefore: input.stateHashBefore, stateHashAfter: input.stateHashAfter, currentStepId: input.currentStepId, childCapabilityId: input.currentStepId, failureReason: input.failureReason, loopDecision: "stop_failed", stateDecision: "updated", dataQualityFlags: ["transition_evaluation_failure"], extra: { sequenceNo: input.state.sequenceNo + 1, stepDispatchCallId: input.stepDispatchCallId, nerveBusEnvelopeId: input.nerveBusEnvelopeId, transitionEvaluationDecision: input.transitionEvaluationDecision, status: "failed", transitionDecision: "failed", emergencyDecision: input.state.emergencyStopLatched ? "latched" : "none" } },
  );
}
