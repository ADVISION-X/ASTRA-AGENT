import type { MissionExecutionResult, MissionState, OperationalMap } from "../contract.js";
import type { ActiveOperationalMapRecord } from "../ports/orchestration-map-store-port.js";
import { buildMissionExecutionResult } from "./orchestration-result-builder.js";
import { evaluateLoopGuard } from "./loop-guard.js";
import { dispatchOperationalStep } from "./step-dispatcher.js";
import type { OperationalStep } from "./step-dispatch-shared.js";
import { evaluateStepTransition } from "./transition-evaluator.js";
import type { OrchestrationRuntimeContext } from "./orchestration-runtime-context.js";
import { checkCanDispatchStep } from "./mission-state-policy-gate.js";
import { buildTransitionSuccessProof } from "./orchestration-transition-success-proof.js";
import {
  recordMissionRuntimeEvent,
  recordPostActionVerificationActionLog,
} from "./orchestration-step-trace-recorder.js";
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
type PostActionVerificationActionLogRecord = Awaited<ReturnType<typeof recordPostActionVerificationActionLog>>;
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
    leftRef: string;
    operator: "equals" | "notEquals" | "exists" | "notExists" | "greaterThan" | "lessThan" | "confidenceAbove" | "confidenceBelow" | "statusIs" | "reviewRequired";
    rightValue: string | number | boolean | null;
  };
};

type StepDispatchFailureEvent = {
  eventType: "CAPABILITY_CALL_FAILED" | "POST_ACTION_VERIFICATION_FAILED";
  ownerResponsible: string;
  reason: string;
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

function findOperationalStep(map: OperationalMap, stepId: string): OperationalStep | null {
  return map.steps.find((candidate) => candidate.stepId === stepId) ?? null;
}

function getTerminalEventType(status: MissionState["status"]): "MISSION_FAILED" | "MISSION_FINALIZED" | "MISSION_REVIEW_REQUIRED" | "MISSION_STOPPED" | null {
  if (status === "failed") {
    return "MISSION_FAILED";
  }
  if (status === "review_required") {
    return "MISSION_REVIEW_REQUIRED";
  }
  if (status === "stopped") {
    return "MISSION_STOPPED";
  }
  return status === "completed" ? "MISSION_FINALIZED" : null;
}

function collectLastResultRefs(lastResult: OrchestrationStepResultRecord): string[] {
  return [
    ...(lastResult.resultRef ? [lastResult.resultRef] : []),
    ...(lastResult.outputRef ? [lastResult.outputRef] : []),
  ];
}

async function recordStepSelected(input: RunMissionLoopIterationInput, step: OperationalStep, currentStepId: string): Promise<void> {
  await recordMissionRuntimeEvent({
    context: input.context,
    state: input.state,
    mapRecord: input.mapRecord,
    step,
    eventType: "MAP_STEP_SELECTED",
    status: "success",
    reason: `Orchestration selected governed step "${currentStepId}" from the frozen operational map.`,
    actionableMessage: "Evaluate governed dispatch gates before sending the step through Nerve Bus.",
    ownerResponsible: "Orchestration",
    capabilityCallId: input.stepDispatchCallId,
    refs: [currentStepId, step.stepKind, step.targetAbilityGroupId ?? "no-target"],
  });
}

async function recordPreconditionCheck(input: RunMissionLoopIterationInput, step: OperationalStep, status: "success" | "failed", reason: string, failureReason?: string): Promise<void> {
  await recordMissionRuntimeEvent({
    context: input.context,
    state: input.state,
    mapRecord: input.mapRecord,
    step,
    eventType: "STEP_PRECONDITION_CHECKED",
    status,
    reason,
    failureReason: failureReason ?? null,
    actionableMessage: status === "success" ? "Dispatch the governed step through Nerve Bus." : "Repair the blocking step gate before retrying this mission step.",
    ownerResponsible: "Orchestration",
    capabilityCallId: input.stepDispatchCallId,
  });
}

async function recordDispatchStarted(input: RunMissionLoopIterationInput, step: OperationalStep): Promise<void> {
  await recordMissionRuntimeEvent({
    context: input.context,
    state: input.state,
    mapRecord: input.mapRecord,
    step,
    eventType: "STEP_DISPATCH_STARTED",
    status: "started",
    reason: `Dispatching step "${step.stepId}" to ability group "${step.targetAbilityGroupId ?? "orchestration"}".`,
    actionableMessage: "Wait for the governed step result before evaluating transitions.",
    ownerResponsible: "Orchestration / Nerve Bus",
    capabilityCallId: input.stepDispatchCallId,
  });
}

function buildStepDispatchFailureEvent(step: OperationalStep, failureReason: string): StepDispatchFailureEvent {
  if (step.targetAbilityGroupId === "post-action-verification") {
    return {
      eventType: "POST_ACTION_VERIFICATION_FAILED",
      ownerResponsible: "Orchestration / Post-action Verification",
      reason: `Post-action verification step "${step.stepId}" failed before a governed result was returned.`,
    };
  }

  return {
    eventType: "CAPABILITY_CALL_FAILED",
    ownerResponsible: `Orchestration / ${step.targetAbilityGroupId ?? "orchestration"}`,
    reason: `Governed ability call for step "${step.stepId}" failed before transition evaluation.`,
  };
}

async function recordStepDispatchFailure(input: RunMissionLoopIterationInput, step: OperationalStep, failureReason: string, proofId: string): Promise<void> {
  const failureEvent = buildStepDispatchFailureEvent(step, failureReason);
  await recordMissionRuntimeEvent({
    context: input.context,
    state: input.state,
    mapRecord: input.mapRecord,
    step,
    eventType: failureEvent.eventType,
    status: "failed",
    reason: failureEvent.reason,
    failureReason,
    actionableMessage: "Inspect the step dispatch failure and runtime proof before retrying this mission.",
    ownerResponsible: failureEvent.ownerResponsible,
    capabilityCallId: input.stepDispatchCallId,
    proofRefs: [proofId],
  });
}

function buildCapabilityEventType(step: OperationalStep, status: OrchestrationStepResultRecord["status"]) {
  if (step.targetAbilityGroupId === "post-action-verification") {
    if (status === "review_required") {
      return "POST_ACTION_VERIFICATION_REVIEW_REQUIRED" as const;
    }
    return status === "success" ? "POST_ACTION_VERIFICATION_PASSED" : "POST_ACTION_VERIFICATION_FAILED";
  }

  if (status === "review_required") {
    return "CAPABILITY_CALL_REVIEW_REQUIRED" as const;
  }
  return status === "success" ? "CAPABILITY_CALL_COMPLETED" : "CAPABILITY_CALL_FAILED";
}

async function recordStepResult(
  input: RunMissionLoopIterationInput,
  step: OperationalStep,
  lastResult: OrchestrationStepResultRecord,
  durationMs: number,
  actionLog: PostActionVerificationActionLogRecord,
): Promise<void> {
  await recordMissionRuntimeEvent({
    context: input.context,
    state: input.state,
    mapRecord: input.mapRecord,
    step,
    eventType: buildCapabilityEventType(step, lastResult.status),
    status: lastResult.status,
    reason: `Governed step "${step.stepId}" returned status "${lastResult.status}".`,
    failureReason: lastResult.failureReason ?? null,
    reviewRequiredReason: lastResult.reviewRequiredReason ?? null,
    actionableMessage: lastResult.status === "success" ? "Evaluate the declared transition for this step result." : "Inspect the blocking step result and runtime proof before retrying.",
    ownerResponsible: step.targetAbilityGroupId === "post-action-verification"
      ? "Orchestration / Post-action Verification"
      : `Orchestration / ${step.targetAbilityGroupId ?? "orchestration"}`,
    durationMs,
    capabilityCallId: lastResult.envelopeId ?? input.stepDispatchCallId,
    outputRefs: collectLastResultRefs(lastResult),
    actionLogRefs: actionLog ? [actionLog.actionLogId] : [],
    actionRef: actionLog?.actionRef ?? null,
    postActionVerificationRef: actionLog?.postActionVerificationRef ?? null,
  });
}

async function recordTransitionEvaluation(
  input: RunMissionLoopIterationInput,
  step: OperationalStep,
  details: {
    status: "success" | "failed";
    decision: string;
    reason: string;
    failureReason?: string | null;
    proofId: string;
    capabilityCallId: string | null;
  },
): Promise<void> {
  await recordMissionRuntimeEvent({
    context: input.context,
    state: input.state,
    mapRecord: input.mapRecord,
    step,
    eventType: "STEP_TRANSITION_EVALUATED",
    status: details.status,
    reason: details.reason,
    failureReason: details.failureReason ?? null,
    actionableMessage: details.status === "success" ? "Continue the governed mission loop using the matched transition." : "Repair the transition failure before retrying this mission.",
    ownerResponsible: "Orchestration",
    decision: details.decision,
    capabilityCallId: details.capabilityCallId,
    proofRefs: [details.proofId],
  });
}

async function recordTerminalOutcome(
  input: RunMissionLoopIterationInput,
  step: OperationalStep,
  outcome: MissionLoopIterationOutcome,
): Promise<void> {
  const eventType = getTerminalEventType(outcome.state.status);
  if (!eventType || !outcome.lastProof) {
    return;
  }

  await recordMissionRuntimeEvent({
    context: input.context,
    state: outcome.state,
    mapRecord: input.mapRecord,
    step,
    eventType,
    status: outcome.state.status === "review_required" ? "review_required" : outcome.state.status === "failed" ? "failed" : "success",
    reason: `Mission reached terminal status "${outcome.state.status}" after step "${step.stepId}".`,
    failureReason: outcome.state.failureReason ?? null,
    reviewRequiredReason: outcome.state.reviewRequiredReason ?? null,
    actionableMessage: outcome.state.status === "failed"
      ? "Inspect the mission runtime proof and blocking step outcome before retrying."
      : outcome.state.status === "review_required"
        ? "Open Commander review flow and resolve the governed review requirement."
        : "Read the mission proof timeline and persisted records for the completed mission.",
    ownerResponsible: "Orchestration",
    capabilityCallId: outcome.lastResult?.envelopeId ?? input.stepDispatchCallId,
    proofRefs: [outcome.lastProof.proofId],
  });
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

export async function runMissionLoopIteration(input: RunMissionLoopIterationInput): Promise<MissionLoopIterationOutcome> {
  const currentStepId = input.state.currentStepId ?? "unknown-step";
  const stateRevisionBefore = input.state.stateRevision ?? 0;
  const stateHashBefore = input.state.stateHash ?? null;
  const currentProofContext = createCurrentProofContext(input);
  const step = findOperationalStep(input.map, currentStepId);
  if (!step) {
    return buildStepDispatchFailureOutcome(input, {
      currentStepId,
      stepDispatchCallId: input.stepDispatchCallId,
      stateRevisionBefore,
      stateHashBefore,
      proofContext: currentProofContext,
      startedAt: input.context.clock.now().isoTimestamp,
      endedAt: input.context.clock.now().isoTimestamp,
      failureReason: `Map \"${input.map.mapId}\" is missing step \"${currentStepId}\".`,
    });
  }

  await recordStepSelected(input, step, currentStepId);
  const dispatchGate = checkCanDispatchStep(input.state);
  if (!dispatchGate.allowed) {
    await recordPreconditionCheck(input, step, "failed", `Dispatch gate rejected step \"${currentStepId}\".`, dispatchGate.reason ?? "dispatch gate rejected");
    const outcome = await buildDispatchGateFailureOutcome(input, { currentStepId, stateRevisionBefore, stateHashBefore, proofContext: currentProofContext, dispatchGateReason: dispatchGate.reason ?? "dispatch gate rejected", endedAt: input.context.clock.now().isoTimestamp });
    await recordTerminalOutcome(input, step, outcome);
    return outcome;
  }
  const loopGuard = evaluateLoopGuard({ state: input.state, map: input.map, nowIsoTimestamp: input.context.clock.now().isoTimestamp });
  if (loopGuard.loopDecision !== "continue") {
    await recordPreconditionCheck(input, step, "failed", `Loop guard prevented step \"${currentStepId}\" from dispatching.`, loopGuard.loopDecision === "stop_failed" ? "loop_guard_triggered" : "loop guard prevented dispatch");
    const outcome = await buildLoopGuardFailureOutcome(input, { currentStepId, stateRevisionBefore, stateHashBefore, proofContext: currentProofContext, loopGuardDecision: loopGuard.loopDecision, nextHopCount: loopGuard.nextHopCount, failureReason: loopGuard.loopDecision === "stop_failed" ? "loop_guard_triggered" : null, reviewRequiredReason: loopGuard.loopDecision === "stop_review_required" ? "loop guard requested human review" : null, endedAt: input.context.clock.now().isoTimestamp });
    await recordTerminalOutcome(input, step, outcome);
    return outcome;
  }
  await recordPreconditionCheck(input, step, "success", `Step \"${currentStepId}\" passed dispatch and loop guard checks.`);
  const startedSnapshot = input.context.clock.now();
  const stepDispatchCallId = input.stepDispatchCallId;
  const stepIdempotencyKey = `${input.idempotencyKey}:step:${currentStepId}:${input.state.sequenceNo}`;
  await recordDispatchStarted(input, step);
  const stepDispatch = await dispatchOperationalStep({ state: input.state, map: input.map, stepId: currentStepId, sequenceNo: input.state.sequenceNo, idempotencyKey: stepIdempotencyKey, context: input.context });
  const endedSnapshot = input.context.clock.now();
  const durationMs = Math.max(0, Math.round(endedSnapshot.monotonicMs - startedSnapshot.monotonicMs));
  if (!stepDispatch.dispatched) {
    const outcome = await buildStepDispatchFailureOutcome(input, { currentStepId, stepDispatchCallId, stateRevisionBefore, stateHashBefore, proofContext: currentProofContext, startedAt: startedSnapshot.isoTimestamp, endedAt: endedSnapshot.isoTimestamp, failureReason: stepDispatch.failureReason });
    if (outcome.lastProof) {
      await recordStepDispatchFailure(input, step, stepDispatch.failureReason, outcome.lastProof.proofId);
      await recordTerminalOutcome(input, step, outcome);
    }
    return outcome;
  }
  const lastResult = stepDispatch.stepResult;
  const actionLog = await recordPostActionVerificationActionLog({
    context: input.context,
    state: input.state,
    mapRecord: input.mapRecord,
    step,
    stepResult: lastResult,
    createdAt: endedSnapshot.isoTimestamp,
    durationMs,
  });
  await recordStepResult(input, step, lastResult, durationMs, actionLog);
  const transitionResult = evaluateStepTransition({ map: input.map, currentStepId, result: lastResult });
  if (transitionResult.decision !== "matched") {
    const outcome = await buildTransitionFailureOutcome(input, { currentStepId, stepDispatchCallId, nerveBusEnvelopeId: lastResult.envelopeId ?? null, transitionEvaluationDecision: transitionResult.decision, stateRevisionBefore, stateHashBefore, proofContext: currentProofContext, startedAt: startedSnapshot.isoTimestamp, endedAt: endedSnapshot.isoTimestamp, failureReason: transitionResult.failureReason });
    if (outcome.lastProof) {
      await recordTransitionEvaluation(input, step, {
        status: "failed",
        decision: transitionResult.decision,
        reason: `Transition evaluation failed for step "${currentStepId}".`,
        failureReason: transitionResult.failureReason,
        proofId: outcome.lastProof.proofId,
        capabilityCallId: lastResult.envelopeId ?? input.stepDispatchCallId,
      });
      await recordTerminalOutcome(input, step, outcome);
    }
    return outcome;
  }
  const outcome = await buildTransitionSuccessOutcome(input, { currentStepId, stepDispatchCallId, stepIdempotencyKey, startedAt: startedSnapshot.isoTimestamp, endedAt: endedSnapshot.isoTimestamp, lastResult, transition: normalizeMatchedTransition(transitionResult.transition), transitionEvaluationDecision: "matched", stateRevisionBefore, stateHashBefore, nextHopCount: loopGuard.nextHopCount, startedMonotonicMs: startedSnapshot.monotonicMs, endedMonotonicMs: endedSnapshot.monotonicMs });
  if (outcome.lastProof) {
    await recordTransitionEvaluation(input, step, {
      status: "success",
      decision: transitionResult.transition.transitionId,
      reason: `Transition "${transitionResult.transition.transitionId}" matched for step "${currentStepId}".`,
      proofId: outcome.lastProof.proofId,
      capabilityCallId: lastResult.envelopeId ?? input.stepDispatchCallId,
    });
  }
  if (outcome.result) {
    await recordTerminalOutcome(input, step, outcome);
  }
  return outcome;
}
