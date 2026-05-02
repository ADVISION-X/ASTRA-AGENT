import type { MissionExecutionResult, MissionState, OperationalMap } from "../contract.js";
import type { ActiveOperationalMapRecord } from "../ports/orchestration-map-store-port.js";
import { buildMissionExecutionResult } from "./orchestration-result-builder.js";
import { evaluateLoopGuard } from "./loop-guard.js";
import { dispatchOperationalStep } from "./step-dispatcher.js";
import { evaluateStepTransition } from "./transition-evaluator.js";
import type { OrchestrationRuntimeContext } from "./orchestration-runtime-context.js";
import { checkCanDispatchStep } from "./mission-state-policy-gate.js";
import { buildTransitionSuccessProof } from "./orchestration-transition-success-proof.js";
import {
  buildDispatchGateFailureProof,
  buildLoopGuardFailureProof,
  buildStepDispatchFailureProof,
  buildTransitionFailureProof,
  type OrchestrationLoopProofContext,
} from "./orchestration-loop-proof-builders.js";
import { toMissionControlState } from "./orchestration-state-support.js";

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

function getRuntimeProofId(value: RuntimeProofRecord): string {
  return value.proofId;
}

type MatchedTransitionRecord = {
  transitionId: string;
  finalStatus: "running" | "completed" | "stopped" | "review_required" | "failed";
  toStepId: string | null;
  condition: {
    leftRef: "status" | "decision";
    operator: "equals" | "notEquals" | "exists" | "notExists" | "greaterThan" | "lessThan" | "confidenceAbove" | "confidenceBelow" | "statusIs" | "reviewRequired";
    rightValue: string | number | boolean | null;
  };
};

function normalizeMatchedTransition(transition: Extract<ReturnType<typeof evaluateStepTransition>, { decision: "matched" }>['transition']): MatchedTransitionRecord {
  return {
    transitionId: transition.transitionId,
    finalStatus: transition.finalStatus ?? "running",
    toStepId: transition.toStepId,
    condition: {
      leftRef: transition.condition.leftRef,
      operator: transition.condition.operator,
      rightValue: transition.condition.rightValue,
    },
  };
}

function createCurrentProofContext(input: RunMissionLoopIterationInput): OrchestrationLoopProofContext {
  return { ...input.proofContext, missionId: input.state.missionId ?? input.proofContext.missionId, mapId: input.state.mapId ?? input.proofContext.mapId };
}

async function persistOutcome(input: RunMissionLoopIterationInput, details: { state: MissionState; lastResult: OrchestrationStepResultRecord | null; lastProof: RuntimeProofRecord | null; result: MissionExecutionResult | null; }): Promise<MissionLoopIterationOutcome> {
  await input.context.statePort.putMissionState(details.state);
  return { state: details.state, lastResult: details.lastResult, lastProof: details.lastProof, result: details.result };
}

async function buildDispatchGateFailureOutcome(input: RunMissionLoopIterationInput, details: { currentStepId: string; stateRevisionBefore: number; stateHashBefore: string | null; proofContext: OrchestrationLoopProofContext; dispatchGateReason: string; endedAt: string; }): Promise<MissionLoopIterationOutcome> {
  const state = toMissionControlState(input.state, details.endedAt, { status: "failed", failureReason: details.dispatchGateReason, endedAt: details.endedAt });
  const proof = buildDispatchGateFailureProof({ context: details.proofContext, currentStepId: details.currentStepId, stateRevisionBefore: details.stateRevisionBefore, stateRevisionAfter: state.stateRevision, stateHashBefore: details.stateHashBefore, stateHashAfter: state.stateHash ?? null, startedAt: details.endedAt, endedAt: details.endedAt, failureReason: details.dispatchGateReason, state });
  const runtimeProofId = getRuntimeProofId(proof);
  const persistedState = toMissionControlState(state, details.endedAt, { lastRuntimeProofRef: runtimeProofId, runtimeProofRefs: [...state.runtimeProofRefs, runtimeProofId] });
  const result = buildMissionExecutionResult({ missionState: persistedState, currentStepResult: input.lastResult, runtimeProof: proof, failureReason: details.dispatchGateReason });
  return persistOutcome(input, { state: persistedState, lastResult: input.lastResult, lastProof: proof, result });
}

async function buildLoopGuardFailureOutcome(input: RunMissionLoopIterationInput, details: { currentStepId: string; stateRevisionBefore: number; stateHashBefore: string | null; proofContext: OrchestrationLoopProofContext; loopGuardDecision: "stop_failed" | "stop_review_required" | "stop_completed"; nextHopCount: number; failureReason: string | null; reviewRequiredReason: string | null; endedAt: string; }): Promise<MissionLoopIterationOutcome> {
  const nextStatus = details.loopGuardDecision === "stop_failed" ? "failed" : details.loopGuardDecision === "stop_review_required" ? "review_required" : "completed";
  const state = toMissionControlState(input.state, details.endedAt, { hopCount: details.nextHopCount, status: nextStatus, failureReason: details.loopGuardDecision === "stop_failed" ? "loop_guard_triggered" : null, reviewRequiredReason: details.loopGuardDecision === "stop_review_required" ? "loop guard requested human review" : null, endedAt: details.endedAt });
  const proof = buildLoopGuardFailureProof({ context: details.proofContext, currentStepId: details.currentStepId, stateRevisionBefore: details.stateRevisionBefore, stateRevisionAfter: state.stateRevision, stateHashBefore: details.stateHashBefore, stateHashAfter: state.stateHash ?? null, startedAt: details.endedAt, endedAt: details.endedAt, state, loopDecision: details.loopGuardDecision, failureReason: state.failureReason, reviewRequiredReason: state.reviewRequiredReason });
  const runtimeProofId = getRuntimeProofId(proof);
  const persistedState = toMissionControlState(state, details.endedAt, { lastRuntimeProofRef: runtimeProofId, runtimeProofRefs: [...state.runtimeProofRefs, runtimeProofId] });
  const result = buildMissionExecutionResult({ missionState: persistedState, currentStepResult: input.lastResult, runtimeProof: proof });
  return persistOutcome(input, { state: persistedState, lastResult: input.lastResult, lastProof: proof, result });
}

async function buildStepDispatchFailureOutcome(input: RunMissionLoopIterationInput, details: { currentStepId: string; stepDispatchCallId: string; stateRevisionBefore: number; stateHashBefore: string | null; proofContext: OrchestrationLoopProofContext; startedAt: string; endedAt: string; failureReason: string; }): Promise<MissionLoopIterationOutcome> {
  const state = toMissionControlState(input.state, details.endedAt, { status: "failed", failureReason: details.failureReason, endedAt: details.endedAt });
  const proof = buildStepDispatchFailureProof({ context: details.proofContext, currentStepId: details.currentStepId, stepDispatchCallId: details.stepDispatchCallId, stateRevisionBefore: details.stateRevisionBefore, stateRevisionAfter: state.stateRevision, stateHashBefore: details.stateHashBefore, stateHashAfter: state.stateHash ?? null, startedAt: details.startedAt, endedAt: details.endedAt, state, failureReason: details.failureReason });
  const runtimeProofId = getRuntimeProofId(proof);
  const persistedState = toMissionControlState(state, details.endedAt, { lastRuntimeProofRef: runtimeProofId, runtimeProofRefs: [...state.runtimeProofRefs, runtimeProofId] });
  const result = buildMissionExecutionResult({ missionState: persistedState, currentStepResult: null, runtimeProof: proof, failureReason: details.failureReason });
  return persistOutcome(input, { state: persistedState, lastResult: null, lastProof: proof, result });
}

async function buildTransitionFailureOutcome(input: RunMissionLoopIterationInput, details: { currentStepId: string; stepDispatchCallId: string; nerveBusEnvelopeId: string | null; transitionEvaluationDecision: string; stateRevisionBefore: number; stateHashBefore: string | null; proofContext: OrchestrationLoopProofContext; startedAt: string; endedAt: string; failureReason: string; }): Promise<MissionLoopIterationOutcome> {
  const state = toMissionControlState(input.state, details.endedAt, { status: "failed", failureReason: details.failureReason, endedAt: details.endedAt });
  const proof = buildTransitionFailureProof({ context: details.proofContext, currentStepId: details.currentStepId, stepDispatchCallId: details.stepDispatchCallId, nerveBusEnvelopeId: details.nerveBusEnvelopeId, transitionEvaluationDecision: details.transitionEvaluationDecision, stateRevisionBefore: details.stateRevisionBefore, stateRevisionAfter: state.stateRevision, stateHashBefore: details.stateHashBefore, stateHashAfter: state.stateHash ?? null, startedAt: details.startedAt, endedAt: details.endedAt, state, failureReason: details.failureReason });
  const runtimeProofId = getRuntimeProofId(proof);
  const persistedState = toMissionControlState(state, details.endedAt, { lastRuntimeProofRef: runtimeProofId, runtimeProofRefs: [...state.runtimeProofRefs, runtimeProofId] });
  const result = buildMissionExecutionResult({ missionState: persistedState, currentStepResult: input.lastResult, runtimeProof: proof, failureReason: details.failureReason });
  return persistOutcome(input, { state: persistedState, lastResult: input.lastResult, lastProof: proof, result });
}

function buildTransitionSuccessState(input: RunMissionLoopIterationInput, details: { currentStepId: string; startedAt: string; endedAt: string; lastResult: OrchestrationStepResultRecord; transition: MatchedTransitionRecord; nextHopCount: number; }): MissionState {
  const nextStatus = details.transition.finalStatus;
  const nextStepId = nextStatus === "running" ? details.transition.toStepId : null;
  return toMissionControlState(input.state, details.endedAt, { previousStepId: details.currentStepId, currentStepId: nextStepId, status: nextStatus, hopCount: details.nextHopCount, sequenceNo: input.state.sequenceNo + 1, currentRoundIndex: input.state.currentRoundIndex + 1, reviewRequiredReason: nextStatus === "review_required" ? details.lastResult.reviewRequiredReason : null, failureReason: nextStatus === "failed" ? details.lastResult.failureReason : null, lastEnvelopeId: details.lastResult.envelopeId ?? null, lastResultRef: details.lastResult.resultRef ?? null, payloadRefs: details.lastResult.payloadRefs, endedAt: nextStatus === "running" ? null : details.endedAt });
}

async function buildTransitionSuccessOutcome(input: RunMissionLoopIterationInput, details: { currentStepId: string; stepDispatchCallId: string; stepIdempotencyKey: string; startedAt: string; endedAt: string; lastResult: OrchestrationStepResultRecord; transition: MatchedTransitionRecord; transitionEvaluationDecision: "matched"; stateRevisionBefore: number; stateHashBefore: string | null; nextHopCount: number; startedMonotonicMs: number; endedMonotonicMs: number; }): Promise<MissionLoopIterationOutcome> {
  const state = buildTransitionSuccessState(input, details);
  const proof = buildTransitionSuccessProof(input, state, details);
  const result = buildMissionExecutionResult({ missionState: state, currentStepResult: details.lastResult, runtimeProof: proof });
  return persistOutcome(input, { state, lastResult: details.lastResult, lastProof: proof, result });
}

export async function runMissionLoopIteration(input: RunMissionLoopIterationInput): Promise<MissionLoopIterationOutcome> {
  const currentStepId = input.state.currentStepId ?? "unknown-step";
  const stateRevisionBefore = input.state.stateRevision ?? 0;
  const stateHashBefore = input.state.stateHash ?? null;
  const currentProofContext = createCurrentProofContext(input);
  const dispatchGate = checkCanDispatchStep(input.state);
  if (!dispatchGate.allowed) {
    return buildDispatchGateFailureOutcome(input, { currentStepId, stateRevisionBefore, stateHashBefore, proofContext: currentProofContext, dispatchGateReason: dispatchGate.reason ?? "dispatch gate rejected", endedAt: input.context.clock.now().isoTimestamp });
  }
  const loopGuard = evaluateLoopGuard({ state: input.state, map: input.map, nowIsoTimestamp: input.context.clock.now().isoTimestamp });
  if (loopGuard.loopDecision !== "continue") {
    return buildLoopGuardFailureOutcome(input, { currentStepId, stateRevisionBefore, stateHashBefore, proofContext: currentProofContext, loopGuardDecision: loopGuard.loopDecision, nextHopCount: loopGuard.nextHopCount, failureReason: loopGuard.loopDecision === "stop_failed" ? "loop_guard_triggered" : null, reviewRequiredReason: loopGuard.loopDecision === "stop_review_required" ? "loop guard requested human review" : null, endedAt: input.context.clock.now().isoTimestamp });
  }
  const startedSnapshot = input.context.clock.now();
  const stepDispatchCallId = input.stepDispatchCallId;
  const stepIdempotencyKey = `${input.idempotencyKey}:step:${currentStepId}:${input.state.sequenceNo}`;
  const stepDispatch = await dispatchOperationalStep({ state: input.state, map: input.map, stepId: currentStepId, sequenceNo: input.state.sequenceNo, idempotencyKey: stepIdempotencyKey, context: input.context });
  const endedSnapshot = input.context.clock.now();
  if (!stepDispatch.dispatched) {
    return buildStepDispatchFailureOutcome(input, { currentStepId, stepDispatchCallId, stateRevisionBefore, stateHashBefore, proofContext: currentProofContext, startedAt: startedSnapshot.isoTimestamp, endedAt: endedSnapshot.isoTimestamp, failureReason: stepDispatch.failureReason });
  }
  const lastResult = stepDispatch.stepResult;
  const transitionResult = evaluateStepTransition({ map: input.map, currentStepId, result: lastResult });
  if (transitionResult.decision !== "matched") {
    return buildTransitionFailureOutcome(input, { currentStepId, stepDispatchCallId, nerveBusEnvelopeId: lastResult.envelopeId ?? null, transitionEvaluationDecision: transitionResult.decision, stateRevisionBefore, stateHashBefore, proofContext: currentProofContext, startedAt: startedSnapshot.isoTimestamp, endedAt: endedSnapshot.isoTimestamp, failureReason: transitionResult.failureReason });
  }
  return buildTransitionSuccessOutcome(input, { currentStepId, stepDispatchCallId, stepIdempotencyKey, startedAt: startedSnapshot.isoTimestamp, endedAt: endedSnapshot.isoTimestamp, lastResult, transition: normalizeMatchedTransition(transitionResult.transition), transitionEvaluationDecision: "matched", stateRevisionBefore, stateHashBefore, nextHopCount: loopGuard.nextHopCount, startedMonotonicMs: startedSnapshot.monotonicMs, endedMonotonicMs: endedSnapshot.monotonicMs });
}
