import type { MissionExecutionResult, MissionState } from "../contract.js";

import { buildMissionExecutionResult } from "./orchestration-result-builder.js";
import { buildTransitionSuccessProof } from "./orchestration-loop-iteration-dispatch-support.js";
import type { MatchedTransitionRecord } from "./orchestration-loop-iteration-transition-support.js";
import { buildNextMissionRoundState } from "./orchestration-round-state.js";
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
  const directNextItemActionReturnedToObserve = input.currentStepId === "press-next-video-key"
    && input.nextStepId === "observe-current-video-page-state";

  return returnedToInitialStep || directNextItemActionReturnedToObserve
    ? input.currentRoundIndex + 1
    : input.currentRoundIndex;
}

const buildTransitionSuccessState = (
  input: RunMissionLoopIterationInput,
  details: {
    currentStepId: string;
    endedAt: string;
    lastResult: OrchestrationStepResultRecord;
    transition: MatchedTransitionRecord;
    nextHopCount: number;
  },
): MissionState => {
  const nextStatus = details.transition.finalStatus;
  const nextStepId = nextStatus === "running" ? details.transition.toStepId : null;
  const nextRoundIndex = shouldAdvanceMissionRound({
    currentStepId: details.currentStepId,
    nextStepId,
    nextStatus,
    initialStepId: input.map.initialStepId,
    currentRoundIndex: input.state.currentRoundIndex,
  });
  const nextRoundState = buildNextMissionRoundState({
    state: input.state,
    lastResult: details.lastResult,
  });
  return toMissionControlState(input.state, details.endedAt, {
    previousStepId: details.currentStepId,
    currentStepId: nextStepId,
    status: nextStatus,
    hopCount: details.nextHopCount,
    sequenceNo: input.state.sequenceNo + 1,
    currentRoundIndex: nextRoundIndex,
    roundProgress: nextRoundState.roundProgress,
    lastActionSummary: nextRoundState.lastActionSummary,
    reviewRequiredReason: nextStatus === "review_required"
      ? (details.lastResult.reviewRequiredReason ?? details.lastResult.failureReason ?? "review_required")
      : null,
    failureReason: nextStatus === "failed"
      ? (details.lastResult.failureReason ?? details.lastResult.reviewRequiredReason ?? "failed")
      : null,
    lastEnvelopeId: details.lastResult.envelopeId ?? null,
    lastResultRef: details.lastResult.resultRef ?? null,
    payloadRefs: details.lastResult.payloadRefs,
    endedAt: nextStatus === "running" ? null : details.endedAt,
  });
};

export const buildTransitionSuccessOutcome = async (
  input: RunMissionLoopIterationInput,
  details: {
    currentStepId: string;
    stepDispatchCallId: string;
    stepIdempotencyKey: string;
    startedAt: string;
    endedAt: string;
    lastResult: OrchestrationStepResultRecord;
    transition: MatchedTransitionRecord;
    transitionEvaluationDecision: "matched";
    stateRevisionBefore: number;
    stateHashBefore: string | null;
    nextHopCount: number;
    startedMonotonicMs: number;
    endedMonotonicMs: number;
  },
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
    : buildMissionExecutionResult({
      missionState: persistedState,
      currentStepResult: details.lastResult,
      runtimeProof: proof,
    });
  return persistOutcome(input, { state: persistedState, lastResult: details.lastResult, lastProof: proof, result });
};
