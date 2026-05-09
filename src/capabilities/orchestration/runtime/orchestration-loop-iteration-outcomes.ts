import type { MissionExecutionResult, MissionState } from "../contract.js";

import { buildMissionExecutionResult } from "./orchestration-result-builder.js";
import {
  buildDispatchGateFailureProof,
  buildLoopGuardFailureProof,
  buildStepDispatchFailureProof,
  buildTransitionFailureProof,
} from "./orchestration-loop-proof-builders.js";
import { toMissionControlState } from "./orchestration-state-support.js";
import type {
  MissionLoopIterationOutcome,
  OrchestrationStepResultRecord,
  RunMissionLoopIterationInput,
  RuntimeProofRecord,
} from "./orchestration-executor-loop-iteration-support.js";

type PersistOutcomeDetails = {
  state: MissionState;
  lastResult: OrchestrationStepResultRecord | null;
  lastProof: RuntimeProofRecord | null;
  result: MissionExecutionResult | null;
};

const getRuntimeProofId = (value: RuntimeProofRecord): string => value.proofId;

const persistOutcome = async (
  input: RunMissionLoopIterationInput,
  details: PersistOutcomeDetails,
): Promise<MissionLoopIterationOutcome> => {
  await input.context.statePort.putMissionState(details.state);
  return { state: details.state, lastResult: details.lastResult, lastProof: details.lastProof, result: details.result };
};

export const buildDispatchGateFailureOutcome = async (
  input: RunMissionLoopIterationInput,
  details: {
    currentStepId: string;
    stateRevisionBefore: number;
    stateHashBefore: string | null;
    proofContext: RunMissionLoopIterationInput["proofContext"];
    dispatchGateReason: string;
    endedAt: string;
  },
): Promise<MissionLoopIterationOutcome> => {
  const state = toMissionControlState(input.state, details.endedAt, {
    status: "failed",
    failureReason: details.dispatchGateReason,
    endedAt: details.endedAt,
  });
  const proof = buildDispatchGateFailureProof({
    context: details.proofContext,
    currentStepId: details.currentStepId,
    stateRevisionBefore: details.stateRevisionBefore,
    stateRevisionAfter: state.stateRevision,
    stateHashBefore: details.stateHashBefore,
    stateHashAfter: state.stateHash ?? null,
    startedAt: details.endedAt,
    endedAt: details.endedAt,
    failureReason: details.dispatchGateReason,
    state,
  });
  const runtimeProofId = getRuntimeProofId(proof);
  const persistedState = toMissionControlState(state, details.endedAt, {
    lastRuntimeProofRef: runtimeProofId,
    runtimeProofRefs: [...state.runtimeProofRefs, runtimeProofId],
  });
  const result = buildMissionExecutionResult({
    missionState: persistedState,
    currentStepResult: input.lastResult,
    runtimeProof: proof,
    failureReason: details.dispatchGateReason,
  });
  return persistOutcome(input, { state: persistedState, lastResult: input.lastResult, lastProof: proof, result });
};

export const buildLoopGuardFailureOutcome = async (
  input: RunMissionLoopIterationInput,
  details: {
    currentStepId: string;
    stateRevisionBefore: number;
    stateHashBefore: string | null;
    proofContext: RunMissionLoopIterationInput["proofContext"];
    loopGuardDecision: "stop_failed" | "stop_completed";
    loopGuardReason: "completed_by_run_limit" | "completed_by_time_limit" | "blocked_by_loop_guard";
    nextHopCount: number;
    failureReason: string | null;
    reviewRequiredReason: string | null;
    endedAt: string;
  },
): Promise<MissionLoopIterationOutcome> => {
  const nextStatus = details.loopGuardDecision === "stop_failed" ? "failed" : "completed";
  const state = toMissionControlState(input.state, details.endedAt, {
    hopCount: details.nextHopCount,
    status: nextStatus,
    failureReason: details.loopGuardDecision === "stop_failed"
      ? (details.failureReason ?? details.loopGuardReason)
      : null,
    reviewRequiredReason: null,
    endedAt: details.endedAt,
  });
  const proof = buildLoopGuardFailureProof({
    context: details.proofContext,
    currentStepId: details.currentStepId,
    stateRevisionBefore: details.stateRevisionBefore,
    stateRevisionAfter: state.stateRevision,
    stateHashBefore: details.stateHashBefore,
    stateHashAfter: state.stateHash ?? null,
    startedAt: details.endedAt,
    endedAt: details.endedAt,
    state,
    loopDecision: details.loopGuardDecision,
    failureReason: state.failureReason ?? details.loopGuardReason,
    reviewRequiredReason: state.reviewRequiredReason,
  });
  const runtimeProofId = getRuntimeProofId(proof);
  const persistedState = toMissionControlState(state, details.endedAt, {
    lastRuntimeProofRef: runtimeProofId,
    runtimeProofRefs: [...state.runtimeProofRefs, runtimeProofId],
  });
  const result = buildMissionExecutionResult({
    missionState: persistedState,
    currentStepResult: input.lastResult,
    runtimeProof: proof,
    failureReason: state.failureReason,
    reviewRequiredReason: null,
  });
  return persistOutcome(input, { state: persistedState, lastResult: input.lastResult, lastProof: proof, result });
};

export const buildStepDispatchFailureOutcome = async (
  input: RunMissionLoopIterationInput,
  details: {
    currentStepId: string;
    stepDispatchCallId: string;
    stateRevisionBefore: number;
    stateHashBefore: string | null;
    proofContext: RunMissionLoopIterationInput["proofContext"];
    startedAt: string;
    endedAt: string;
    failureReason: string;
  },
): Promise<MissionLoopIterationOutcome> => {
  const state = toMissionControlState(input.state, details.endedAt, {
    status: "failed",
    failureReason: details.failureReason,
    endedAt: details.endedAt,
  });
  const proof = buildStepDispatchFailureProof({
    context: details.proofContext,
    currentStepId: details.currentStepId,
    stepDispatchCallId: details.stepDispatchCallId,
    stateRevisionBefore: details.stateRevisionBefore,
    stateRevisionAfter: state.stateRevision,
    stateHashBefore: details.stateHashBefore,
    stateHashAfter: state.stateHash ?? null,
    startedAt: details.startedAt,
    endedAt: details.endedAt,
    state,
    failureReason: details.failureReason,
  });
  const runtimeProofId = getRuntimeProofId(proof);
  const persistedState = toMissionControlState(state, details.endedAt, {
    lastRuntimeProofRef: runtimeProofId,
    runtimeProofRefs: [...state.runtimeProofRefs, runtimeProofId],
  });
  const result = buildMissionExecutionResult({
    missionState: persistedState,
    currentStepResult: null,
    runtimeProof: proof,
    failureReason: details.failureReason,
  });
  return persistOutcome(input, { state: persistedState, lastResult: null, lastProof: proof, result });
};

export const buildTransitionFailureOutcome = async (
  input: RunMissionLoopIterationInput,
  details: {
    currentStepId: string;
    stepDispatchCallId: string;
    nerveBusEnvelopeId: string | null;
    transitionEvaluationDecision: string;
    stateRevisionBefore: number;
    stateHashBefore: string | null;
    proofContext: RunMissionLoopIterationInput["proofContext"];
    startedAt: string;
    endedAt: string;
    failureReason: string;
  },
): Promise<MissionLoopIterationOutcome> => {
  const state = toMissionControlState(input.state, details.endedAt, {
    status: "failed",
    failureReason: details.failureReason,
    endedAt: details.endedAt,
  });
  const proof = buildTransitionFailureProof({
    context: details.proofContext,
    currentStepId: details.currentStepId,
    stepDispatchCallId: details.stepDispatchCallId,
    nerveBusEnvelopeId: details.nerveBusEnvelopeId,
    transitionEvaluationDecision: details.transitionEvaluationDecision,
    stateRevisionBefore: details.stateRevisionBefore,
    stateRevisionAfter: state.stateRevision,
    stateHashBefore: details.stateHashBefore,
    stateHashAfter: state.stateHash ?? null,
    startedAt: details.startedAt,
    endedAt: details.endedAt,
    state,
    failureReason: details.failureReason,
  });
  const runtimeProofId = getRuntimeProofId(proof);
  const persistedState = toMissionControlState(state, details.endedAt, {
    lastRuntimeProofRef: runtimeProofId,
    runtimeProofRefs: [...state.runtimeProofRefs, runtimeProofId],
  });
  const result = buildMissionExecutionResult({
    missionState: persistedState,
    currentStepResult: input.lastResult,
    runtimeProof: proof,
    failureReason: details.failureReason,
  });
  return persistOutcome(input, { state: persistedState, lastResult: input.lastResult, lastProof: proof, result });
};