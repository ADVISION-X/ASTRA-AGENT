import type {
  MissionCommand,
  MissionControlCommand,
  MissionExecutionResult,
  MissionReviewDecisionInput,
  MissionState,
  OperationalMap,
  OrchestrationExecutionContext,
} from "../contract.js";
import { PayloadRefBundleSchema } from "../schema.js";
import { buildDispatchFailure } from "./orchestration-dispatch-failure.js";
import { buildOrchestrationRuntimeProof } from "./orchestration-proof-builder.js";
import { buildMissionExecutionResult, buildMissionStateUpdate } from "./orchestration-result-builder.js";
import { evaluateLoopGuard } from "./loop-guard.js";
import { parseMissionCommand, parseMissionControlCommand, parseMissionReviewDecision } from "./mission-command-gate.js";
import { selectOperationalMap } from "./map-selection-gate.js";
import { validateOperationalMapGate } from "./map-validation-gate.js";
import { dispatchOperationalStep } from "./step-dispatcher.js";
import { evaluateStepTransition } from "./transition-evaluator.js";

function createInitialMissionState(command: MissionCommand, map: OperationalMap, startedAt: string): MissionState {
  return buildMissionStateUpdate({
    missionId: command.missionId,
    mapId: map.mapId,
    requestedPlatform: command.requestedPlatform,
    humanGoal: command.humanGoal,
    status: "running",
    currentStepId: map.initialStepId,
    previousStepId: null,
    activeTaskRunId: `${command.missionId}:${map.mapId}`,
    currentRoundIndex: 0,
    sequenceNo: 0,
    hopCount: 0,
    reviewRequiredReason: null,
    failureReason: null,
    lastHumanCommand: "start-mission",
    lastEnvelopeId: null,
    lastResultRef: null,
    lastRuntimeProofRef: null,
    runtimeProofRefs: [],
    payloadRefs: PayloadRefBundleSchema.parse({
      requestedPlatformId: command.requestedPlatform,
      selectedMapId: map.mapId,
      operatorNote: command.initialPayload.operatorNote,
      targetUrl: command.initialPayload.targetUrl,
      targetTitle: command.initialPayload.targetTitle,
      sourceEvidenceRef: command.initialPayload.sourceEvidenceRef,
      sourceTargetRef: command.initialPayload.sourceTargetRef,
      promptInputRef: command.initialPayload.promptInputRef,
      commandInputRef: command.initialPayload.commandInputRef,
    }),
    emergencyStopLatched: false,
    startedAt,
    updatedAt: startedAt,
    pausedAt: null,
    endedAt: null,
  });
}

function toMissionControlState(state: MissionState, updatedAt: string, updates: Partial<MissionState>): MissionState {
  return buildMissionStateUpdate({
    ...state,
    ...updates,
    updatedAt,
  });
}

function createEmptyPayloadRefs() {
  return PayloadRefBundleSchema.parse({});
}

function toRuntimeProofStatus(status: MissionState["status"]): "completed" | "failed" | "review_required" | "stopped" {
  if (status === "failed" || status === "review_required" || status === "completed" || status === "stopped") {
    return status;
  }

  return status === "running" ? "completed" : "stopped";
}

async function runMissionLoop(input: {
  state: MissionState;
  map: OperationalMap;
  context: OrchestrationExecutionContext;
  commandKind: "start-mission" | "resume-mission";
  caller: "commander-console" | "orchestration";
  idempotencyKey: string;
}): Promise<MissionExecutionResult> {
  let state = input.state;
  let lastResult: import("../contract.js").MissionStepResult | null = null;
  let lastProof: import("../contract.js").RuntimeProof | null = null;

  while (state.currentStepId && state.status === "running") {
    const currentStepId = state.currentStepId;
    const loopGuard = evaluateLoopGuard({ state, map: input.map });
    if (loopGuard.loopDecision !== "continue") {
      const endedAt = input.context.clock.now().isoTimestamp;
      state = toMissionControlState(state, endedAt, {
        hopCount: loopGuard.nextHopCount,
        status: loopGuard.loopDecision === "stop_failed" ? "failed" : "review_required",
        failureReason: loopGuard.loopDecision === "stop_failed" ? "loop_guard_triggered" : null,
        reviewRequiredReason: loopGuard.loopDecision === "stop_review_required" ? "loop guard requested human review" : null,
        endedAt,
      });
      lastProof = buildOrchestrationRuntimeProof({
        missionId: state.missionId ?? "unknown-mission",
        mapId: state.mapId ?? input.map.mapId,
        stepId: currentStepId,
        childCapabilityId: "loop-guard",
        commandKind: input.commandKind,
        caller: input.caller,
        idempotencyKey: input.idempotencyKey,
        sequenceNo: state.sequenceNo,
        inputRef: state.payloadRefs.commandInputRef,
        outputRef: null,
        nerveBusEnvelopeId: null,
        abilityResultRef: null,
        transitionId: null,
        previousStepId: state.previousStepId,
        nextStepId: null,
        startedAt: endedAt,
        endedAt,
        durationMs: 0,
        status: toRuntimeProofStatus(state.status),
        failureReason: state.failureReason,
        reviewRequiredReason: state.reviewRequiredReason,
        mapDecision: "selected",
        transitionDecision: state.status === "failed" ? "failed" : "review_required",
        loopDecision: loopGuard.loopDecision,
        stateDecision: "updated",
        emergencyDecision: state.emergencyStopLatched ? "latched" : "none",
        dataQualityFlags: ["loop_guard_triggered"],
      });
      state = toMissionControlState(state, endedAt, {
        lastRuntimeProofRef: lastProof.proofId,
        runtimeProofRefs: [...state.runtimeProofRefs, lastProof.proofId],
      });
      await input.context.statePort.putMissionState(state);
      return buildMissionExecutionResult({ missionState: state, currentStepResult: lastResult, runtimeProof: lastProof });
    }

    const startedSnapshot = input.context.clock.now();
    lastResult = await dispatchOperationalStep({
      state,
      map: input.map,
      stepId: currentStepId,
      context: input.context,
    });
    const transition = evaluateStepTransition({ map: input.map, currentStepId: currentStepId, result: lastResult });
    const endedSnapshot = input.context.clock.now();
    const nextStatus = transition.finalStatus ?? "running";
    const nextStepId = nextStatus === "running" ? transition.toStepId : null;
    lastProof = buildOrchestrationRuntimeProof({
      missionId: state.missionId ?? "unknown-mission",
      mapId: input.map.mapId,
      stepId: state.currentStepId,
      childCapabilityId: lastResult.childCapabilityId,
      commandKind: input.commandKind,
      caller: input.caller,
      idempotencyKey: input.idempotencyKey,
      sequenceNo: state.sequenceNo + 1,
      inputRef: state.payloadRefs.commandInputRef,
      outputRef: lastResult.outputRef,
      nerveBusEnvelopeId: lastResult.envelopeId,
      abilityResultRef: lastResult.resultRef,
      transitionId: transition.transitionId,
      previousStepId: state.previousStepId,
      nextStepId,
      startedAt: startedSnapshot.isoTimestamp,
      endedAt: endedSnapshot.isoTimestamp,
      durationMs: Math.max(0, Math.round(endedSnapshot.monotonicMs - startedSnapshot.monotonicMs)),
      status: toRuntimeProofStatus(nextStatus),
      failureReason: nextStatus === "failed" ? (lastResult.failureReason ?? "transition_invalid") : null,
      reviewRequiredReason: nextStatus === "review_required" ? (lastResult.reviewRequiredReason ?? "review required") : null,
      mapDecision: "selected",
      transitionDecision: nextStatus === "running" ? "continue" : nextStatus === "completed" || nextStatus === "stopped" ? "finalize" : nextStatus === "review_required" ? "review_required" : "failed",
      loopDecision: "continue",
      stateDecision: nextStatus === "completed" || nextStatus === "failed" || nextStatus === "review_required" ? "finalized" : "updated",
      emergencyDecision: state.emergencyStopLatched ? "latched" : "none",
      dataQualityFlags: [],
    });

    state = toMissionControlState(state, endedSnapshot.isoTimestamp, {
      previousStepId: state.currentStepId,
      currentStepId: nextStepId,
      status: nextStatus,
      hopCount: loopGuard.nextHopCount,
      sequenceNo: state.sequenceNo + 1,
      currentRoundIndex: state.currentRoundIndex + 1,
      reviewRequiredReason: nextStatus === "review_required" ? lastResult.reviewRequiredReason : null,
      failureReason: nextStatus === "failed" ? lastResult.failureReason : null,
      lastEnvelopeId: lastResult.envelopeId,
      lastResultRef: lastResult.resultRef,
      lastRuntimeProofRef: lastProof.proofId,
      runtimeProofRefs: [...state.runtimeProofRefs, lastProof.proofId],
      payloadRefs: lastResult.payloadRefs,
      endedAt: nextStatus === "running" ? null : endedSnapshot.isoTimestamp,
    });
    await input.context.statePort.putMissionState(state);
  }

  if (!lastProof) {
    const now = input.context.clock.now().isoTimestamp;
    lastProof = buildOrchestrationRuntimeProof({
      missionId: state.missionId ?? "unknown-mission",
      mapId: state.mapId ?? input.map.mapId,
      stepId: state.currentStepId ?? "finalize-mission",
      childCapabilityId: "finalize-mission",
      commandKind: input.commandKind,
      caller: input.caller,
      idempotencyKey: input.idempotencyKey,
      sequenceNo: state.sequenceNo,
      inputRef: state.payloadRefs.commandInputRef,
      outputRef: null,
      nerveBusEnvelopeId: null,
      abilityResultRef: state.lastResultRef,
      transitionId: null,
      previousStepId: state.previousStepId,
      nextStepId: null,
      startedAt: now,
      endedAt: now,
      durationMs: 0,
      status: toRuntimeProofStatus(state.status),
      failureReason: state.failureReason,
      reviewRequiredReason: state.reviewRequiredReason,
      mapDecision: "selected",
      transitionDecision: "finalize",
      loopDecision: "continue",
      stateDecision: "finalized",
      emergencyDecision: state.emergencyStopLatched ? "latched" : "none",
      dataQualityFlags: [],
    });
  }

  return buildMissionExecutionResult({ missionState: state, currentStepResult: lastResult, runtimeProof: lastProof });
}

export async function executeMissionCommand(input: {
  command: unknown;
  caller: "commander-console" | "orchestration";
  context: OrchestrationExecutionContext;
}): Promise<MissionExecutionResult> {
  const startedSnapshot = input.context.clock.now();
  try {
    const command = parseMissionCommand(input.command);
    const map = validateOperationalMapGate(await selectOperationalMap({ command, mapStore: input.context.mapStore }));
    const idempotencyKey = `start:${command.missionId}:${map.mapId}`;
    const reserved = await input.context.idempotency.reserve(idempotencyKey);
    if (!reserved) {
      throw new Error(`Mission command idempotency conflict for ${command.missionId}.`);
    }
    const initialState = createInitialMissionState(command, map, startedSnapshot.isoTimestamp);
    await input.context.statePort.putMissionState(initialState);
    return runMissionLoop({
      state: initialState,
      map,
      context: input.context,
      commandKind: "start-mission",
      caller: input.caller,
      idempotencyKey,
    });
  } catch (error) {
    return buildDispatchFailure({
      state: buildMissionStateUpdate({ missionId: null, mapId: null, requestedPlatform: null, humanGoal: null, status: "failed", currentStepId: null, previousStepId: null, activeTaskRunId: null, currentRoundIndex: 0, sequenceNo: 0, hopCount: 0, reviewRequiredReason: null, failureReason: null, lastHumanCommand: "start-mission", lastEnvelopeId: null, lastResultRef: null, lastRuntimeProofRef: null, runtimeProofRefs: [], payloadRefs: createEmptyPayloadRefs(), emergencyStopLatched: false, startedAt: startedSnapshot.isoTimestamp, updatedAt: startedSnapshot.isoTimestamp, pausedAt: null, endedAt: startedSnapshot.isoTimestamp }),
      commandKind: "start-mission",
      caller: input.caller,
      stepId: "start-mission",
      childCapabilityId: "start-mission",
      failureReason: error instanceof Error ? error.message : "Unknown mission dispatch failure",
      startedAt: startedSnapshot.isoTimestamp,
      endedAt: input.context.clock.now().isoTimestamp,
      durationMs: Math.max(0, Math.round(input.context.clock.now().monotonicMs - startedSnapshot.monotonicMs)),
      idempotencyKey: `start:failed:${startedSnapshot.isoTimestamp}`,
    });
  }
}

export async function resumeMissionCommand(input: {
  command: unknown;
  caller: "commander-console" | "orchestration";
  context: OrchestrationExecutionContext;
}) {
  const command = parseMissionControlCommand(input.command);
  const state = await input.context.statePort.getMissionState(command.missionId);
  if (!state.missionId || !state.mapId) {
    throw new Error(`Mission ${command.missionId} is not resumable because no governed state exists.`);
  }
  const map = validateOperationalMapGate((await input.context.mapStore.getMap(state.mapId))!);
  const resumedAt = input.context.clock.now().isoTimestamp;
  const resumedState = toMissionControlState(state, resumedAt, {
    status: "running",
    pausedAt: null,
    lastHumanCommand: "resume-mission",
  });
  await input.context.statePort.putMissionState(resumedState);
  const idempotencyKey = `resume:${state.missionId}:${state.sequenceNo}`;
  await input.context.idempotency.reserve(idempotencyKey);
  return runMissionLoop({
    state: resumedState,
    map,
    context: input.context,
    commandKind: "resume-mission",
    caller: input.caller,
    idempotencyKey,
  });
}

export async function pauseMissionCommand(input: { command: unknown; context: OrchestrationExecutionContext }) {
  const command = parseMissionControlCommand(input.command);
  const now = input.context.clock.now().isoTimestamp;
  const state = await input.context.statePort.getMissionState(command.missionId);
  const nextState = toMissionControlState(state, now, {
    status: "paused",
    pausedAt: now,
    lastHumanCommand: "pause-mission",
  });
  await input.context.statePort.putMissionState(nextState);
  return nextState;
}

export async function stopMissionCommand(input: { command: unknown; context: OrchestrationExecutionContext }) {
  const command = parseMissionControlCommand(input.command);
  const now = input.context.clock.now().isoTimestamp;
  const state = await input.context.statePort.getMissionState(command.missionId);
  const nextState = toMissionControlState(state, now, {
    status: "stopped",
    failureReason: command.reason,
    endedAt: now,
    lastHumanCommand: "stop-mission",
  });
  await input.context.statePort.putMissionState(nextState);
  return nextState;
}

export async function emergencyStopMissionCommand(input: { command: unknown; context: OrchestrationExecutionContext }) {
  const command = parseMissionControlCommand(input.command);
  const now = input.context.clock.now().isoTimestamp;
  const state = await input.context.statePort.getMissionState(command.missionId);
  const nextState = toMissionControlState(state, now, {
    status: "stopped",
    failureReason: command.reason ?? "emergency stop requested",
    endedAt: now,
    emergencyStopLatched: true,
    lastHumanCommand: "emergency-stop",
  });
  await input.context.statePort.putMissionState(nextState);
  return nextState;
}

export async function submitMissionReviewDecision(input: {
  command: unknown;
  caller: "commander-console" | "orchestration";
  context: OrchestrationExecutionContext;
}) {
  const command = parseMissionReviewDecision(input.command);
  if (command.decision === "hold") {
    const now = input.context.clock.now().isoTimestamp;
    const state = await input.context.statePort.getMissionState(command.missionId);
    const nextState = toMissionControlState(state, now, {
      status: "review_required",
      reviewRequiredReason: command.note ?? "review hold requested",
    });
    await input.context.statePort.putMissionState(nextState);
    return nextState;
  }
  if (command.decision === "stop") {
    return stopMissionCommand({ command: { missionId: command.missionId, reason: command.note ?? "review stop requested" }, context: input.context });
  }
  const result = await resumeMissionCommand({ command: { missionId: command.missionId, note: command.note }, caller: input.caller, context: input.context });
  return result.missionState;
}