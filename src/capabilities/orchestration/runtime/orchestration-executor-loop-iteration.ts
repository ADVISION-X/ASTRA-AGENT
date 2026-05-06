import type { MissionState } from "../contract.js";
import { buildMissionExecutionResult } from "./orchestration-result-builder.js";
import type { OperationalStep } from "./step-dispatch-shared.js";
import {
  recordPostActionVerificationActionLog,
  recordDispatchStarted,
  recordStepDispatchFailure,
  recordStepResult,
  recordTerminalOutcome,
  recordTransitionEvaluation,
} from "./orchestration-loop-iteration-events-gateway.js";
import {
  buildTransitionSuccessProof,
  dispatchOperationalStep,
  evaluateStepTransition,
} from "./orchestration-loop-iteration-dispatch-support.js";
import type { OrchestrationLoopProofContext } from "./orchestration-loop-proof-builders.js";
import {
  buildDispatchGateFailureOutcome,
  buildLoopGuardFailureOutcome,
  buildStepDispatchFailureOutcome,
  buildTransitionFailureOutcome,
  type MissionLoopIterationOutcome,
  type OrchestrationStepResultRecord,
  prepareMissionLoopIteration,
  type PreparedMissionLoopIteration,
  type RunMissionLoopIterationInput,
  type RuntimeProofRecord,
} from "./orchestration-executor-loop-iteration-support.js";
import {
  buildTransitionFailureDetails,
  buildTransitionSuccessDetails,
  type HandleDispatchedStepDetails,
  type MatchedTransitionRecord,
} from "./orchestration-loop-iteration-transition-support.js";
import { toMissionControlState } from "./orchestration-state-support.js";

function getRuntimeProofId(value: RuntimeProofRecord): string {
  return value.proofId;
}

function toUnexpectedPostStepFailureReason(currentStepId: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `Unexpected orchestration post-step error after step "${currentStepId}": ${message}`;
}

function buildTransitionSuccessState(input: RunMissionLoopIterationInput, details: { currentStepId: string; startedAt: string; endedAt: string; lastResult: OrchestrationStepResultRecord; transition: MatchedTransitionRecord; nextHopCount: number; }): MissionState {
  const nextStatus = details.transition.finalStatus;
  const nextStepId = nextStatus === "running" ? details.transition.toStepId : null;
  const nextRoundIndex = nextStatus === "running"
    && nextStepId === input.map.initialStepId
    && details.currentStepId !== input.map.initialStepId
    ? input.state.currentRoundIndex + 1
    : input.state.currentRoundIndex;
  return toMissionControlState(input.state, details.endedAt, { previousStepId: details.currentStepId, currentStepId: nextStepId, status: nextStatus, hopCount: details.nextHopCount, sequenceNo: input.state.sequenceNo + 1, currentRoundIndex: nextRoundIndex, reviewRequiredReason: nextStatus === "review_required" ? details.lastResult.reviewRequiredReason : null, failureReason: nextStatus === "failed" ? details.lastResult.failureReason : null, lastEnvelopeId: details.lastResult.envelopeId ?? null, lastResultRef: details.lastResult.resultRef ?? null, payloadRefs: details.lastResult.payloadRefs, endedAt: nextStatus === "running" ? null : details.endedAt });
}

async function buildTransitionSuccessOutcome(input: RunMissionLoopIterationInput, details: { currentStepId: string; stepDispatchCallId: string; stepIdempotencyKey: string; startedAt: string; endedAt: string; lastResult: OrchestrationStepResultRecord; transition: MatchedTransitionRecord; transitionEvaluationDecision: "matched"; stateRevisionBefore: number; stateHashBefore: string | null; nextHopCount: number; startedMonotonicMs: number; endedMonotonicMs: number; }): Promise<MissionLoopIterationOutcome> {
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
}

async function handleMissingStep(
  input: RunMissionLoopIterationInput,
  details: { currentStepId: string; stateRevisionBefore: number; stateHashBefore: string | null; proofContext: OrchestrationLoopProofContext; nowIsoTimestamp: string; },
): Promise<MissionLoopIterationOutcome> {
  return buildStepDispatchFailureOutcome(input, {
    currentStepId: details.currentStepId,
    stepDispatchCallId: input.stepDispatchCallId,
    stateRevisionBefore: details.stateRevisionBefore,
    stateHashBefore: details.stateHashBefore,
    proofContext: details.proofContext,
    startedAt: details.nowIsoTimestamp,
    endedAt: details.nowIsoTimestamp,
    failureReason: `Map "${input.map.mapId}" is missing step "${details.currentStepId}".`,
  });
}

async function handleDispatchGateFailure(
  input: RunMissionLoopIterationInput,
  step: OperationalStep,
  details: { currentStepId: string; stateRevisionBefore: number; stateHashBefore: string | null; proofContext: OrchestrationLoopProofContext; dispatchGateReason: string; endedAt: string; },
): Promise<MissionLoopIterationOutcome> {
  await recordPreconditionCheck(input, step, {
    status: "failed",
    reason: `Dispatch gate rejected step "${details.currentStepId}".`,
    failureReason: details.dispatchGateReason,
  });
  const outcome = await buildDispatchGateFailureOutcome(input, details);
  await recordTerminalOutcome(input, step, outcome);
  return outcome;
}

async function handleLoopGuardStop(
  input: RunMissionLoopIterationInput,
  step: OperationalStep,
  details: { currentStepId: string; stateRevisionBefore: number; stateHashBefore: string | null; proofContext: OrchestrationLoopProofContext; loopGuardDecision: "stop_failed" | "stop_review_required" | "stop_completed"; nextHopCount: number; endedAt: string; },
): Promise<MissionLoopIterationOutcome> {
  await recordPreconditionCheck(input, step, {
    status: "failed",
    reason: `Loop guard prevented step "${details.currentStepId}" from dispatching.`,
    failureReason: details.loopGuardDecision === "stop_failed" ? "loop_guard_triggered" : "loop guard prevented dispatch",
  });
  const outcome = await buildLoopGuardFailureOutcome(input, {
    ...details,
    failureReason: details.loopGuardDecision === "stop_failed" ? "loop_guard_triggered" : null,
    reviewRequiredReason: details.loopGuardDecision === "stop_review_required" ? "loop guard requested human review" : null,
  });
  await recordTerminalOutcome(input, step, outcome);
  return outcome;
}

async function handleDispatchFailure(
  input: RunMissionLoopIterationInput,
  step: OperationalStep,
  details: { currentStepId: string; stepDispatchCallId: string; stateRevisionBefore: number; stateHashBefore: string | null; proofContext: OrchestrationLoopProofContext; startedAt: string; endedAt: string; failureReason: string; },
): Promise<MissionLoopIterationOutcome> {
  const outcome = await buildStepDispatchFailureOutcome(input, details);
  if (outcome.lastProof) {
    await recordStepDispatchFailure(input, step, details.failureReason, outcome.lastProof.proofId);
    await recordTerminalOutcome(input, step, outcome);
  }
  return outcome;
}

async function handleTransitionFailure(
  input: RunMissionLoopIterationInput,
  step: OperationalStep,
  details: { currentStepId: string; stepDispatchCallId: string; lastResult: OrchestrationStepResultRecord; transitionEvaluationDecision: string; stateRevisionBefore: number; stateHashBefore: string | null; proofContext: OrchestrationLoopProofContext; startedAt: string; endedAt: string; failureReason: string; },
): Promise<MissionLoopIterationOutcome> {
  const outcome = await buildTransitionFailureOutcome(input, {
    ...details,
    nerveBusEnvelopeId: details.lastResult.envelopeId ?? null,
  });
  if (outcome.lastProof) {
    await recordTransitionEvaluation(input, step, {
      status: "failed",
      decision: details.transitionEvaluationDecision,
      reason: `Transition evaluation failed for step "${details.currentStepId}".`,
      failureReason: details.failureReason,
      proofId: outcome.lastProof.proofId,
      capabilityCallId: details.lastResult.envelopeId ?? input.stepDispatchCallId,
    });
    await recordTerminalOutcome(input, step, outcome);
  }
  return outcome;
}

async function handleTransitionSuccess(
  input: RunMissionLoopIterationInput,
  step: OperationalStep,
  details: { currentStepId: string; stepDispatchCallId: string; stepIdempotencyKey: string; startedAt: string; endedAt: string; lastResult: OrchestrationStepResultRecord; transition: MatchedTransitionRecord; stateRevisionBefore: number; stateHashBefore: string | null; nextHopCount: number; startedMonotonicMs: number; endedMonotonicMs: number; },
): Promise<MissionLoopIterationOutcome> {
  const outcome = await buildTransitionSuccessOutcome(input, {
    ...details,
    transitionEvaluationDecision: "matched",
  });
  if (outcome.lastProof) {
    await recordTransitionEvaluation(input, step, {
      status: "success",
      decision: details.transition.transitionId,
      reason: `Transition "${details.transition.transitionId}" matched for step "${details.currentStepId}".`,
      proofId: outcome.lastProof.proofId,
      capabilityCallId: details.lastResult.envelopeId ?? input.stepDispatchCallId,
    });
  }
  if (outcome.result) {
    await recordTerminalOutcome(input, step, outcome);
  }
  return outcome;
}

async function runStepDispatch(
  input: RunMissionLoopIterationInput,
  step: OperationalStep,
  currentStepId: string,
): Promise<{
  durationMs: number;
  endedSnapshot: ReturnType<RunMissionLoopIterationInput["context"]["clock"]["now"]>;
  startedSnapshot: ReturnType<RunMissionLoopIterationInput["context"]["clock"]["now"]>;
  stepDispatch: Awaited<ReturnType<typeof dispatchOperationalStep>>;
  stepDispatchCallId: string;
  stepIdempotencyKey: string;
}> {
  const startedSnapshot = input.context.clock.now();
  const stepDispatchCallId = input.stepDispatchCallId;
  const stepIdempotencyKey = `${input.idempotencyKey}:step:${currentStepId}:${input.state.sequenceNo}`;
  await recordDispatchStarted(input, step);
  const stepDispatch = await dispatchOperationalStep({ state: input.state, map: input.map, stepId: currentStepId, sequenceNo: input.state.sequenceNo, idempotencyKey: stepIdempotencyKey, context: input.context });
  const endedSnapshot = input.context.clock.now();
  const durationMs = Math.max(0, Math.round(endedSnapshot.monotonicMs - startedSnapshot.monotonicMs));
  return { durationMs, endedSnapshot, startedSnapshot, stepDispatch, stepDispatchCallId, stepIdempotencyKey };
}

async function handleDispatchedStep(
  input: RunMissionLoopIterationInput,
  step: OperationalStep,
  details: HandleDispatchedStepDetails,
): Promise<MissionLoopIterationOutcome> {
  try {
  const actionLog = await recordPostActionVerificationActionLog({
    context: input.context,
    state: input.state,
    mapRecord: input.mapRecord,
    step,
    stepResult: details.lastResult,
    createdAt: details.endedSnapshot.isoTimestamp,
    durationMs: details.durationMs,
  });
  await recordStepResult(input, step, {
    lastResult: details.lastResult,
    durationMs: details.durationMs,
    actionLog,
  });
  const transitionResult = evaluateStepTransition({ map: input.map, currentStepId: details.currentStepId, result: details.lastResult });
  if (transitionResult.decision !== "matched") {
    return handleTransitionFailure(input, step, buildTransitionFailureDetails(details, transitionResult));
  }

  return handleTransitionSuccess(input, step, buildTransitionSuccessDetails(details, transitionResult.transition));
  } catch (error) {
    return handleTransitionFailure(input, step, {
      currentStepId: details.currentStepId,
      stepDispatchCallId: details.stepDispatchCallId,
      lastResult: details.lastResult,
      transitionEvaluationDecision: "invalid_decision",
      stateRevisionBefore: details.stateRevisionBefore,
      stateHashBefore: details.stateHashBefore,
      proofContext: details.currentProofContext,
      startedAt: details.startedSnapshot.isoTimestamp,
      endedAt: details.endedSnapshot.isoTimestamp,
      failureReason: toUnexpectedPostStepFailureReason(details.currentStepId, error),
    });
  }
}

export async function runMissionLoopIteration(input: RunMissionLoopIterationInput): Promise<MissionLoopIterationOutcome> {
  const prepared = await prepareMissionLoopIteration(input);
  if (prepared.kind === "missing_step") {
    return handleMissingStep(input, prepared);
  }
  if (prepared.kind === "dispatch_gate_failure") {
    return handleDispatchGateFailure(input, prepared.step, prepared);
  }
  if (prepared.kind === "loop_guard_stop") {
    return handleLoopGuardStop(input, prepared.step, prepared);
  }

  return runPreparedMissionLoopIteration(input, prepared);
}

async function runPreparedMissionLoopIteration(
  input: RunMissionLoopIterationInput,
  prepared: Extract<PreparedMissionLoopIteration, { kind: "ready" }>,
): Promise<MissionLoopIterationOutcome> {
  const dispatchExecution = await runStepDispatch(input, prepared.step, prepared.currentStepId);
  if (!dispatchExecution.stepDispatch.dispatched) {
    return handleDispatchFailure(input, prepared.step, {
      currentStepId: prepared.currentStepId,
      stepDispatchCallId: dispatchExecution.stepDispatchCallId,
      stateRevisionBefore: prepared.stateRevisionBefore,
      stateHashBefore: prepared.stateHashBefore,
      proofContext: prepared.currentProofContext,
      startedAt: dispatchExecution.startedSnapshot.isoTimestamp,
      endedAt: dispatchExecution.endedSnapshot.isoTimestamp,
      failureReason: dispatchExecution.stepDispatch.failureReason,
    });
  }

  return handleDispatchedStep(input, prepared.step, {
    currentProofContext: prepared.currentProofContext,
    currentStepId: prepared.currentStepId,
    durationMs: dispatchExecution.durationMs,
    endedSnapshot: dispatchExecution.endedSnapshot,
    lastResult: dispatchExecution.stepDispatch.stepResult,
    loopGuardNextHopCount: prepared.nextHopCount,
    startedSnapshot: dispatchExecution.startedSnapshot,
    stateHashBefore: prepared.stateHashBefore,
    stateRevisionBefore: prepared.stateRevisionBefore,
    stepDispatchCallId: dispatchExecution.stepDispatchCallId,
    stepIdempotencyKey: dispatchExecution.stepIdempotencyKey,
  });
}
