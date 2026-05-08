import type { MissionExecutionResult, MissionState, OperationalMap } from "../contract.js";
import type { ActiveOperationalMapRecord } from "../ports/orchestration-map-store-port.js";
import { buildMissionExecutionResult } from "./orchestration-result-builder.js";
import type { OrchestrationRuntimeContext } from "./orchestration-runtime-context.js";
import {
  buildTransitionSuccessProof,
  checkCanDispatchStep,
  evaluateLoopGuard,
} from "./orchestration-loop-iteration-dispatch-support.js";
import {
  recordPreconditionCheck,
  recordStepSelected,
} from "./orchestration-loop-iteration-events-gateway.js";
import type { OperationalStep } from "./step-dispatch-shared.js";
import { dispatchOperationalStep } from "./step-dispatcher.js";
import {
  buildDispatchGateFailureProof,
  buildLoopGuardFailureProof,
  buildStepDispatchFailureProof,
  buildTransitionFailureProof,
  type OrchestrationLoopProofContext,
} from "./orchestration-loop-proof-builders.js";
import type { MatchedTransitionRecord } from "./orchestration-loop-iteration-transition-support.js";
import { toMissionControlState } from "./orchestration-state-support.js";
import { findEffectiveOperationalStep } from "./route-plan-resolver.js";

type StepDispatchResult = Awaited<ReturnType<typeof dispatchOperationalStep>>;
type OrchestrationStepResultRecord = Extract<StepDispatchResult, { dispatched: true }>["stepResult"];
type RuntimeProofRecord = ReturnType<typeof buildDispatchGateFailureProof>;

type MissionLoopIterationOutcome = {
  state: MissionState;
  lastResult: OrchestrationStepResultRecord | null;
  lastProof: RuntimeProofRecord | null;
  result: MissionExecutionResult | null;
};

type RunMissionLoopIterationInput = {
  state: MissionState;
  map: OperationalMap;
  mapRecord: ActiveOperationalMapRecord | null;
  context: OrchestrationRuntimeContext;
  commandKind: "start-mission" | "resume-mission";
  caller: "commander-console" | "orchestration";
  idempotencyKey: string;
  selectedMapSource: "preferred_map_id" | "initial_payload_map_id" | "task_template_id" | "activation_id";
  proofContext: OrchestrationLoopProofContext;
  lastResult: OrchestrationStepResultRecord | null;
  stepDispatchCallId: string;
};

type PreparedMissionLoopIteration =
  | {
    kind: "missing_step";
    currentProofContext: OrchestrationLoopProofContext;
    currentStepId: string;
    nowIsoTimestamp: string;
    stateHashBefore: string | null;
    stateRevisionBefore: number;
  }
  | {
    kind: "dispatch_gate_failure";
    currentProofContext: OrchestrationLoopProofContext;
    currentStepId: string;
    dispatchGateReason: string;
    endedAt: string;
    stateHashBefore: string | null;
    stateRevisionBefore: number;
    step: OperationalStep;
  }
  | {
    kind: "loop_guard_stop";
    currentProofContext: OrchestrationLoopProofContext;
    currentStepId: string;
    endedAt: string;
    loopGuardDecision: "stop_failed" | "stop_completed";
    loopGuardReason: "completed_by_run_limit" | "completed_by_time_limit" | "blocked_by_loop_guard";
    nextHopCount: number;
    stateHashBefore: string | null;
    stateRevisionBefore: number;
    step: OperationalStep;
  }
  | {
    kind: "ready";
    currentProofContext: OrchestrationLoopProofContext;
    currentStepId: string;
    nextHopCount: number;
    stateHashBefore: string | null;
    stateRevisionBefore: number;
    step: OperationalStep;
  };

type PreparedMissionLoopIterationContext = {
  currentProofContext: OrchestrationLoopProofContext;
  currentStepId: string;
  stateHashBefore: string | null;
  stateRevisionBefore: number;
};

const getRuntimeProofId = (value: RuntimeProofRecord): string => value.proofId;

const persistOutcome = async (
  input: RunMissionLoopIterationInput,
  details: { state: MissionState; lastResult: OrchestrationStepResultRecord | null; lastProof: RuntimeProofRecord | null; result: MissionExecutionResult | null; },
): Promise<MissionLoopIterationOutcome> => {
  await input.context.statePort.putMissionState(details.state);
  return { state: details.state, lastResult: details.lastResult, lastProof: details.lastProof, result: details.result };
};

const createCurrentProofContext = (input: RunMissionLoopIterationInput): OrchestrationLoopProofContext => ({
  ...input.proofContext,
  missionId: input.state.missionId ?? input.proofContext.missionId,
  mapId: input.state.mapId ?? input.proofContext.mapId,
});

const createPreparedMissionLoopIterationContext = (
  input: RunMissionLoopIterationInput,
): PreparedMissionLoopIterationContext => ({
  currentProofContext: createCurrentProofContext(input),
  currentStepId: input.state.currentStepId ?? "unknown-step",
  stateHashBefore: input.state.stateHash ?? null,
  stateRevisionBefore: input.state.stateRevision ?? 0,
});

const findOperationalStep = (map: OperationalMap, stepId: string): OperationalStep | null =>
  findEffectiveOperationalStep(map, stepId);

const buildDispatchGateFailureOutcome = async (
  input: RunMissionLoopIterationInput,
  details: { currentStepId: string; stateRevisionBefore: number; stateHashBefore: string | null; proofContext: OrchestrationLoopProofContext; dispatchGateReason: string; endedAt: string; },
): Promise<MissionLoopIterationOutcome> => {
  const state = toMissionControlState(input.state, details.endedAt, { status: "failed", failureReason: details.dispatchGateReason, endedAt: details.endedAt });
  const proof = buildDispatchGateFailureProof({ context: details.proofContext, currentStepId: details.currentStepId, stateRevisionBefore: details.stateRevisionBefore, stateRevisionAfter: state.stateRevision, stateHashBefore: details.stateHashBefore, stateHashAfter: state.stateHash ?? null, startedAt: details.endedAt, endedAt: details.endedAt, failureReason: details.dispatchGateReason, state });
  const runtimeProofId = getRuntimeProofId(proof);
  const persistedState = toMissionControlState(state, details.endedAt, { lastRuntimeProofRef: runtimeProofId, runtimeProofRefs: [...state.runtimeProofRefs, runtimeProofId] });
  const result = buildMissionExecutionResult({ missionState: persistedState, currentStepResult: input.lastResult, runtimeProof: proof, failureReason: details.dispatchGateReason });
  return persistOutcome(input, { state: persistedState, lastResult: input.lastResult, lastProof: proof, result });
};

const buildLoopGuardFailureOutcome = async (
  input: RunMissionLoopIterationInput,
  details: { currentStepId: string; stateRevisionBefore: number; stateHashBefore: string | null; proofContext: OrchestrationLoopProofContext; loopGuardDecision: "stop_failed" | "stop_completed"; loopGuardReason: "completed_by_run_limit" | "completed_by_time_limit" | "blocked_by_loop_guard"; nextHopCount: number; failureReason: string | null; reviewRequiredReason: string | null; endedAt: string; },
): Promise<MissionLoopIterationOutcome> => {
  const nextStatus = details.loopGuardDecision === "stop_failed"
    ? "failed"
    : "completed";
  const state = toMissionControlState(input.state, details.endedAt, {
    hopCount: details.nextHopCount,
    status: nextStatus,
    failureReason: details.loopGuardDecision === "stop_failed" ? (details.failureReason ?? details.loopGuardReason) : null,
    reviewRequiredReason: null,
    endedAt: details.endedAt,
  });
  const proof = buildLoopGuardFailureProof({ context: details.proofContext, currentStepId: details.currentStepId, stateRevisionBefore: details.stateRevisionBefore, stateRevisionAfter: state.stateRevision, stateHashBefore: details.stateHashBefore, stateHashAfter: state.stateHash ?? null, startedAt: details.endedAt, endedAt: details.endedAt, state, loopDecision: details.loopGuardDecision, failureReason: state.failureReason ?? details.loopGuardReason, reviewRequiredReason: state.reviewRequiredReason });
  const runtimeProofId = getRuntimeProofId(proof);
  const persistedState = toMissionControlState(state, details.endedAt, { lastRuntimeProofRef: runtimeProofId, runtimeProofRefs: [...state.runtimeProofRefs, runtimeProofId] });
  const result = buildMissionExecutionResult({ missionState: persistedState, currentStepResult: input.lastResult, runtimeProof: proof, failureReason: state.failureReason, reviewRequiredReason: null });
  return persistOutcome(input, { state: persistedState, lastResult: input.lastResult, lastProof: proof, result });
};

const buildStepDispatchFailureOutcome = async (
  input: RunMissionLoopIterationInput,
  details: { currentStepId: string; stepDispatchCallId: string; stateRevisionBefore: number; stateHashBefore: string | null; proofContext: OrchestrationLoopProofContext; startedAt: string; endedAt: string; failureReason: string; },
): Promise<MissionLoopIterationOutcome> => {
  const state = toMissionControlState(input.state, details.endedAt, { status: "failed", failureReason: details.failureReason, endedAt: details.endedAt });
  const proof = buildStepDispatchFailureProof({ context: details.proofContext, currentStepId: details.currentStepId, stepDispatchCallId: details.stepDispatchCallId, stateRevisionBefore: details.stateRevisionBefore, stateRevisionAfter: state.stateRevision, stateHashBefore: details.stateHashBefore, stateHashAfter: state.stateHash ?? null, startedAt: details.startedAt, endedAt: details.endedAt, state, failureReason: details.failureReason });
  const runtimeProofId = getRuntimeProofId(proof);
  const persistedState = toMissionControlState(state, details.endedAt, { lastRuntimeProofRef: runtimeProofId, runtimeProofRefs: [...state.runtimeProofRefs, runtimeProofId] });
  const result = buildMissionExecutionResult({ missionState: persistedState, currentStepResult: null, runtimeProof: proof, failureReason: details.failureReason });
  return persistOutcome(input, { state: persistedState, lastResult: null, lastProof: proof, result });
};

const buildTransitionFailureOutcome = async (
  input: RunMissionLoopIterationInput,
  details: { currentStepId: string; stepDispatchCallId: string; nerveBusEnvelopeId: string | null; transitionEvaluationDecision: string; stateRevisionBefore: number; stateHashBefore: string | null; proofContext: OrchestrationLoopProofContext; startedAt: string; endedAt: string; failureReason: string; },
): Promise<MissionLoopIterationOutcome> => {
  const state = toMissionControlState(input.state, details.endedAt, { status: "failed", failureReason: details.failureReason, endedAt: details.endedAt });
  const proof = buildTransitionFailureProof({ context: details.proofContext, currentStepId: details.currentStepId, stepDispatchCallId: details.stepDispatchCallId, nerveBusEnvelopeId: details.nerveBusEnvelopeId, transitionEvaluationDecision: details.transitionEvaluationDecision, stateRevisionBefore: details.stateRevisionBefore, stateRevisionAfter: state.stateRevision, stateHashBefore: details.stateHashBefore, stateHashAfter: state.stateHash ?? null, startedAt: details.startedAt, endedAt: details.endedAt, state, failureReason: details.failureReason });
  const runtimeProofId = getRuntimeProofId(proof);
  const persistedState = toMissionControlState(state, details.endedAt, { lastRuntimeProofRef: runtimeProofId, runtimeProofRefs: [...state.runtimeProofRefs, runtimeProofId] });
  const result = buildMissionExecutionResult({ missionState: persistedState, currentStepResult: input.lastResult, runtimeProof: proof, failureReason: details.failureReason });
  return persistOutcome(input, { state: persistedState, lastResult: input.lastResult, lastProof: proof, result });
};

const buildTransitionSuccessState = (
  input: RunMissionLoopIterationInput,
  details: { currentStepId: string; startedAt: string; endedAt: string; lastResult: OrchestrationStepResultRecord; transition: MatchedTransitionRecord; nextHopCount: number; },
): MissionState => {
  const nextStatus = details.transition.finalStatus === "review_required" ? "failed" : details.transition.finalStatus;
  const nextStepId = nextStatus === "running" ? details.transition.toStepId : null;
  const nextRoundIndex = shouldAdvanceMissionRound({
    currentStepId: details.currentStepId,
    nextStepId,
    nextStatus,
    initialStepId: input.map.initialStepId,
    currentRoundIndex: input.state.currentRoundIndex,
  });
  return toMissionControlState(input.state, details.endedAt, { previousStepId: details.currentStepId, currentStepId: nextStepId, status: nextStatus, hopCount: details.nextHopCount, sequenceNo: input.state.sequenceNo + 1, currentRoundIndex: nextRoundIndex, reviewRequiredReason: null, failureReason: nextStatus === "failed" ? (details.lastResult.failureReason ?? details.lastResult.reviewRequiredReason ?? "review_required_normalized_to_failed") : null, lastEnvelopeId: details.lastResult.envelopeId ?? null, lastResultRef: details.lastResult.resultRef ?? null, payloadRefs: details.lastResult.payloadRefs, endedAt: nextStatus === "running" ? null : details.endedAt });
};

function shouldAdvanceMissionRound(input: {
  currentStepId: string;
  nextStepId: string | null;
  nextStatus: MissionState["status"];
  initialStepId: string;
  currentRoundIndex: number;
}): number {
  if (input.nextStatus !== "running" || input.nextStepId === null) {
    return input.currentRoundIndex;
  }

  const returnedToInitialStep = input.nextStepId === input.initialStepId
    && input.currentStepId !== input.initialStepId;
  const verifiedNextItemReturnedToCapture = input.currentStepId === "verify-next-item-advanced"
    && input.nextStepId === "capture-video-viewport";

  return returnedToInitialStep || verifiedNextItemReturnedToCapture
    ? input.currentRoundIndex + 1
    : input.currentRoundIndex;
}

const buildTransitionSuccessOutcome = async (
  input: RunMissionLoopIterationInput,
  details: { currentStepId: string; stepDispatchCallId: string; stepIdempotencyKey: string; startedAt: string; endedAt: string; lastResult: OrchestrationStepResultRecord; transition: MatchedTransitionRecord; transitionEvaluationDecision: "matched"; stateRevisionBefore: number; stateHashBefore: string | null; nextHopCount: number; startedMonotonicMs: number; endedMonotonicMs: number; },
): Promise<MissionLoopIterationOutcome> => {
  const state = buildTransitionSuccessState(input, details);
  const proof = buildTransitionSuccessProof(input, state, details);
  const runtimeProofId = getRuntimeProofId(proof);
  const persistedState = toMissionControlState(state, details.endedAt, {
    lastRuntimeProofRef: runtimeProofId,
    runtimeProofRefs: [...state.runtimeProofRefs, runtimeProofId],
  });
  const result = persistedState.status === "running"
    ? null
    : buildMissionExecutionResult({ missionState: persistedState, currentStepResult: details.lastResult, runtimeProof: proof });
  return persistOutcome(input, { state: persistedState, lastResult: details.lastResult, lastProof: proof, result });
};

const buildMissingStepPreparation = (
  context: PreparedMissionLoopIterationContext,
  nowIsoTimestamp: string,
): Extract<PreparedMissionLoopIteration, { kind: "missing_step" }> => ({
  kind: "missing_step",
  currentProofContext: context.currentProofContext,
  currentStepId: context.currentStepId,
  nowIsoTimestamp,
  stateHashBefore: context.stateHashBefore,
  stateRevisionBefore: context.stateRevisionBefore,
});

const prepareResolvedMissionLoopIteration = async (
  input: RunMissionLoopIterationInput,
  step: OperationalStep,
  context: PreparedMissionLoopIterationContext,
): Promise<Exclude<PreparedMissionLoopIteration, { kind: "missing_step" }>> => {
  await recordStepSelected(input, step, context.currentStepId);
  const dispatchGate = checkCanDispatchStep(input.state);
  if (!dispatchGate.allowed) {
    return {
      kind: "dispatch_gate_failure",
      currentProofContext: context.currentProofContext,
      currentStepId: context.currentStepId,
      dispatchGateReason: dispatchGate.reason ?? "dispatch gate rejected",
      endedAt: input.context.clock.now().isoTimestamp,
      stateHashBefore: context.stateHashBefore,
      stateRevisionBefore: context.stateRevisionBefore,
      step,
    };
  }

  const loopGuard = evaluateLoopGuard({ state: input.state, map: input.map, nowIsoTimestamp: input.context.clock.now().isoTimestamp });
  if (loopGuard.loopDecision !== "continue") {
    return {
      kind: "loop_guard_stop",
      currentProofContext: context.currentProofContext,
      currentStepId: context.currentStepId,
      endedAt: input.context.clock.now().isoTimestamp,
      loopGuardDecision: loopGuard.loopDecision,
      loopGuardReason: loopGuard.reason,
      nextHopCount: loopGuard.nextHopCount,
      stateHashBefore: context.stateHashBefore,
      stateRevisionBefore: context.stateRevisionBefore,
      step,
    };
  }

  await recordPreconditionCheck(input, step, {
    status: "success",
    reason: `Step "${context.currentStepId}" passed dispatch and loop guard checks.`,
  });
  return {
    kind: "ready",
    currentProofContext: context.currentProofContext,
    currentStepId: context.currentStepId,
    nextHopCount: loopGuard.nextHopCount,
    stateHashBefore: context.stateHashBefore,
    stateRevisionBefore: context.stateRevisionBefore,
    step,
  };
};

const prepareMissionLoopIteration = async (input: RunMissionLoopIterationInput): Promise<PreparedMissionLoopIteration> => {
  const context = createPreparedMissionLoopIterationContext(input);
  const step = findOperationalStep(input.map, context.currentStepId);
  if (!step) {
    return buildMissingStepPreparation(context, input.context.clock.now().isoTimestamp);
  }
  return prepareResolvedMissionLoopIteration(input, step, context);
};

export type {
  MissionLoopIterationOutcome,
  OrchestrationStepResultRecord,
  PreparedMissionLoopIteration,
  RunMissionLoopIterationInput,
  RuntimeProofRecord,
};

export {
  buildDispatchGateFailureOutcome,
  buildLoopGuardFailureOutcome,
  buildStepDispatchFailureOutcome,
  buildTransitionFailureOutcome,
  buildTransitionSuccessOutcome,
  createCurrentProofContext,
  findOperationalStep,
  prepareMissionLoopIteration,
};
