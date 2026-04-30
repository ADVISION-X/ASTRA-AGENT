import type {
  MissionCommand,
  MissionExecutionResult,
  MissionState,
  OperationalMap,
} from "../contract.js";
import type { ActiveOperationalMapRecord } from "../ports/orchestration-map-store-port.js";
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
import type { OrchestrationRuntimeContext } from "./orchestration-runtime-context.js";
import {
  checkCanDispatchStep,
  checkCanEmergencyStop,
  checkCanPause,
  checkCanResume,
  checkCanStop,
} from "./mission-state-policy-gate.js";
import { randomUUID } from "node:crypto";

const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000; // 5 minutes

function createInitialMissionState(command: MissionCommand, map: OperationalMap, startedAt: string): MissionState {
  return buildMissionStateUpdate({
    missionId: command.missionId,
    mapId: map.mapId,
    requestedPlatform: command.requestedPlatform,
    humanGoal: command.humanGoal,
    configuredMaxRounds: command.maxRounds ?? null,
    configuredMaxMinutes: command.maxMinutes ?? null,
    status: "running",
    currentStepId: map.initialStepId,
    previousStepId: null,
    activeTaskRunId: `${command.missionId}:${map.mapId}`,
    currentRoundIndex: 0,
    sequenceNo: 0,
    stateRevision: 0,
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
  const next = buildMissionStateUpdate({
    ...state,
    ...updates,
    updatedAt,
    stateRevision: (state.stateRevision ?? 0) + 1,
  });
  return next;
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

function toMapProofMetadata(record: ActiveOperationalMapRecord | null | undefined) {
  return {
    taskTemplateId: record?.taskTemplateId ?? null,
    activationId: record?.activationId ?? null,
    mapPackageId: record?.packageId ?? null,
    mapPackageVersion: record?.packageVersion ?? null,
    mapVersion: record?.mapVersion ?? null,
  };
}

async function runMissionLoop(input: {
  state: MissionState;
  map: OperationalMap;
  mapRecord: ActiveOperationalMapRecord | null;
  context: OrchestrationRuntimeContext;
  commandKind: "start-mission" | "resume-mission";
  caller: "commander-console" | "orchestration";
  idempotencyKey: string;
  selectedMapSource: "preferred_map_id" | "initial_payload_map_id" | "task_template_id" | "activation_id";
}): Promise<MissionExecutionResult> {
  let state = input.state;
  let lastResult: import("../contract.js").MissionStepResult | null = null;
  let lastProof: import("../contract.js").RuntimeProof | null = null;

  while (state.currentStepId && state.status === "running") {
    const currentStepId = state.currentStepId;
    const stateRevisionBefore = state.stateRevision ?? 0;
    const stateHashBefore = state.stateHash ?? null;

    const dispatchGate = checkCanDispatchStep(state);
    if (!dispatchGate.allowed) {
      const endedAt = input.context.clock.now().isoTimestamp;
      state = toMissionControlState(state, endedAt, {
        status: "failed",
        failureReason: dispatchGate.reason,
        endedAt,
      });
      lastProof = buildOrchestrationRuntimeProof({
        missionId: state.missionId ?? "unknown-mission",
        mapId: state.mapId ?? input.map.mapId,
        ...toMapProofMetadata(input.mapRecord),
        selectedMapSource: input.selectedMapSource,
        stepId: currentStepId,
        childCapabilityId: "dispatch-gate",
        commandKind: input.commandKind,
        caller: input.caller,
        idempotencyKey: input.idempotencyKey,
        sequenceNo: state.sequenceNo,
        stateRevisionBefore,
        stateRevisionAfter: state.stateRevision,
        stateHashBefore,
        stateHashAfter: state.stateHash ?? null,
        startedAt: endedAt,
        endedAt,
        durationMs: 0,
        status: "failed",
        failureReason: dispatchGate.reason,
        mapDecision: "selected",
        transitionDecision: "failed",
        loopDecision: "stop_failed",
        stateDecision: "updated",
        emergencyDecision: state.emergencyStopLatched ? "latched" : "none",
        dataQualityFlags: ["state_machine_violation"],
      });
      state = toMissionControlState(state, endedAt, {
        lastRuntimeProofRef: lastProof.proofId,
        runtimeProofRefs: [...state.runtimeProofRefs, lastProof.proofId],
      });
      await input.context.statePort.putMissionState(state);
      return buildMissionExecutionResult({ missionState: state, currentStepResult: lastResult, runtimeProof: lastProof, failureReason: dispatchGate.reason });
    }

    const loopGuard = evaluateLoopGuard({ state, map: input.map, nowIsoTimestamp: input.context.clock.now().isoTimestamp });
    if (loopGuard.loopDecision !== "continue") {
      const endedAt = input.context.clock.now().isoTimestamp;
      const nextStatus = loopGuard.loopDecision === "stop_failed"
        ? "failed"
        : loopGuard.loopDecision === "stop_review_required"
          ? "review_required"
          : "completed";
      state = toMissionControlState(state, endedAt, {
        hopCount: loopGuard.nextHopCount,
        status: nextStatus,
        failureReason: loopGuard.loopDecision === "stop_failed" ? "loop_guard_triggered" : null,
        reviewRequiredReason: loopGuard.loopDecision === "stop_review_required" ? "loop guard requested human review" : null,
        endedAt,
      });
      lastProof = buildOrchestrationRuntimeProof({
        missionId: state.missionId ?? "unknown-mission",
        mapId: state.mapId ?? input.map.mapId,
        ...toMapProofMetadata(input.mapRecord),
        selectedMapSource: input.selectedMapSource,
        stepId: currentStepId,
        childCapabilityId: "loop-guard",
        commandKind: input.commandKind,
        caller: input.caller,
        idempotencyKey: input.idempotencyKey,
        sequenceNo: state.sequenceNo,
        stateRevisionBefore,
        stateRevisionAfter: state.stateRevision,
        stateHashBefore,
        stateHashAfter: state.stateHash ?? null,
        startedAt: endedAt,
        endedAt,
        durationMs: 0,
        status: toRuntimeProofStatus(state.status),
        failureReason: state.failureReason,
        reviewRequiredReason: state.reviewRequiredReason,
        mapDecision: "selected",
        transitionDecision: state.status === "failed" ? "failed" : state.status === "review_required" ? "review_required" : "finalize",
        loopDecision: loopGuard.loopDecision,
        stateDecision: "finalized",
        emergencyDecision: state.emergencyStopLatched ? "latched" : "none",
        dataQualityFlags: loopGuard.loopDecision === "stop_completed" ? [] : ["loop_guard_triggered"],
      });
      state = toMissionControlState(state, endedAt, {
        lastRuntimeProofRef: lastProof.proofId,
        runtimeProofRefs: [...state.runtimeProofRefs, lastProof.proofId],
      });
      await input.context.statePort.putMissionState(state);
      return buildMissionExecutionResult({ missionState: state, currentStepResult: lastResult, runtimeProof: lastProof });
    }

    const startedSnapshot = input.context.clock.now();
    const stepDispatchCallId = randomUUID();
    const stepIdempotencyKey = `${input.idempotencyKey}:step:${currentStepId}:${state.sequenceNo}`;

    const stepDispatch = await dispatchOperationalStep({
      state,
      map: input.map,
      stepId: currentStepId,
      sequenceNo: state.sequenceNo,
      idempotencyKey: stepIdempotencyKey,
      context: input.context,
    });

    const endedSnapshot = input.context.clock.now();

    if (!stepDispatch.dispatched) {
      state = toMissionControlState(state, endedSnapshot.isoTimestamp, {
        status: "failed",
        failureReason: stepDispatch.failureReason,
        endedAt: endedSnapshot.isoTimestamp,
      });
      lastProof = buildOrchestrationRuntimeProof({
        missionId: state.missionId ?? "unknown-mission",
        mapId: input.map.mapId,
        ...toMapProofMetadata(input.mapRecord),
        selectedMapSource: input.selectedMapSource,
        stepId: currentStepId,
        childCapabilityId: currentStepId,
        commandKind: input.commandKind,
        caller: input.caller,
        idempotencyKey: stepIdempotencyKey,
        sequenceNo: state.sequenceNo,
        stateRevisionBefore,
        stateRevisionAfter: state.stateRevision,
        stateHashBefore,
        stateHashAfter: state.stateHash ?? null,
        stepDispatchCallId,
        startedAt: startedSnapshot.isoTimestamp,
        endedAt: endedSnapshot.isoTimestamp,
        durationMs: Math.max(0, Math.round(endedSnapshot.monotonicMs - startedSnapshot.monotonicMs)),
        status: "failed",
        failureReason: stepDispatch.failureReason,
        mapDecision: "selected",
        transitionDecision: "failed",
        loopDecision: "stop_failed",
        stateDecision: "updated",
        emergencyDecision: state.emergencyStopLatched ? "latched" : "none",
        dataQualityFlags: ["step_dispatch_failure"],
      });
      state = toMissionControlState(state, endedSnapshot.isoTimestamp, {
        lastRuntimeProofRef: lastProof.proofId,
        runtimeProofRefs: [...state.runtimeProofRefs, lastProof.proofId],
      });
      await input.context.statePort.putMissionState(state);
      return buildMissionExecutionResult({ missionState: state, currentStepResult: null, runtimeProof: lastProof, failureReason: stepDispatch.failureReason });
    }

    lastResult = stepDispatch.stepResult;

    const transitionResult = evaluateStepTransition({ map: input.map, currentStepId, result: lastResult });

    if (transitionResult.decision !== "matched") {
      const failureReason = transitionResult.failureReason;
      state = toMissionControlState(state, endedSnapshot.isoTimestamp, {
        status: "failed",
        failureReason,
        endedAt: endedSnapshot.isoTimestamp,
      });
      lastProof = buildOrchestrationRuntimeProof({
        missionId: state.missionId ?? "unknown-mission",
        mapId: input.map.mapId,
        ...toMapProofMetadata(input.mapRecord),
        selectedMapSource: input.selectedMapSource,
        stepId: currentStepId,
        childCapabilityId: lastResult.childCapabilityId,
        commandKind: input.commandKind,
        caller: input.caller,
        idempotencyKey: stepIdempotencyKey,
        sequenceNo: state.sequenceNo + 1,
        stateRevisionBefore,
        stateRevisionAfter: state.stateRevision,
        stateHashBefore,
        stateHashAfter: state.stateHash ?? null,
        stepDispatchCallId,
        nerveBusEnvelopeId: lastResult.envelopeId ?? null,
        transitionEvaluationDecision: transitionResult.decision,
        startedAt: startedSnapshot.isoTimestamp,
        endedAt: endedSnapshot.isoTimestamp,
        durationMs: Math.max(0, Math.round(endedSnapshot.monotonicMs - startedSnapshot.monotonicMs)),
        status: "failed",
        failureReason,
        mapDecision: "selected",
        transitionDecision: "failed",
        loopDecision: "stop_failed",
        stateDecision: "updated",
        emergencyDecision: state.emergencyStopLatched ? "latched" : "none",
        dataQualityFlags: ["transition_evaluation_failure"],
      });
      state = toMissionControlState(state, endedSnapshot.isoTimestamp, {
        lastRuntimeProofRef: lastProof.proofId,
        runtimeProofRefs: [...state.runtimeProofRefs, lastProof.proofId],
      });
      await input.context.statePort.putMissionState(state);
      return buildMissionExecutionResult({ missionState: state, currentStepResult: lastResult, runtimeProof: lastProof, failureReason });
    }

    const transition = transitionResult.transition;
    const nextStatus = transition.finalStatus ?? "running";
    const nextStepId = nextStatus === "running" ? transition.toStepId : null;

    lastProof = buildOrchestrationRuntimeProof({
      missionId: state.missionId ?? "unknown-mission",
      mapId: input.map.mapId,
      ...toMapProofMetadata(input.mapRecord),
      selectedMapSource: input.selectedMapSource,
      stepId: currentStepId,
      childCapabilityId: lastResult.childCapabilityId,
      commandKind: input.commandKind,
      caller: input.caller,
      idempotencyKey: stepIdempotencyKey,
      sequenceNo: state.sequenceNo + 1,
      stateRevisionBefore,
      stateHashBefore,
      nerveBusEnvelopeId: lastResult.envelopeId ?? null,
      outputRef: lastResult.outputRef ?? null,
      abilityResultRef: lastResult.resultRef ?? null,
      transitionId: transition.transitionId,
      transitionEvaluationDecision: "matched",
      transitionConditionSource: transition.condition.source,
      transitionConditionExpected: transition.condition.equals,
      transitionConditionActual: transition.condition.source === "status" ? lastResult.status : (lastResult.decision ?? null),
      stepDispatchCallId,
      previousStepId: state.previousStepId ?? null,
      nextStepId: nextStepId ?? null,
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
      previousStepId: currentStepId,
      currentStepId: nextStepId ?? null,
      status: nextStatus,
      hopCount: loopGuard.nextHopCount,
      sequenceNo: state.sequenceNo + 1,
      currentRoundIndex: state.currentRoundIndex + 1,
      stateRevision: (stateRevisionBefore + 2), // two increments: dispatch + state update
      reviewRequiredReason: nextStatus === "review_required" ? lastResult.reviewRequiredReason : null,
      failureReason: nextStatus === "failed" ? lastResult.failureReason : null,
      lastEnvelopeId: lastResult.envelopeId ?? null,
      lastResultRef: lastResult.resultRef ?? null,
      lastRuntimeProofRef: lastProof.proofId,
      runtimeProofRefs: [...state.runtimeProofRefs, lastProof.proofId],
      payloadRefs: lastResult.payloadRefs,
      endedAt: nextStatus === "running" ? null : endedSnapshot.isoTimestamp,
    });

    // Fix stateRevision from the double-increment above
    // toMissionControlState increments by 1 so we just use what it produced
    lastProof = buildOrchestrationRuntimeProof({
      ...lastProof,
      stateRevisionAfter: state.stateRevision,
      stateHashAfter: state.stateHash ?? null,
    });

    await input.context.statePort.putMissionState(state);
  }

  if (!lastProof) {
    const now = input.context.clock.now().isoTimestamp;
    lastProof = buildOrchestrationRuntimeProof({
      missionId: state.missionId ?? "unknown-mission",
      mapId: state.mapId ?? input.map.mapId,
      ...toMapProofMetadata(input.mapRecord),
      selectedMapSource: input.selectedMapSource,
      stepId: state.currentStepId ?? "finalize-mission",
      childCapabilityId: "finalize-mission",
      commandKind: input.commandKind,
      caller: input.caller,
      idempotencyKey: input.idempotencyKey,
      sequenceNo: state.sequenceNo,
      abilityResultRef: state.lastResultRef ?? null,
      previousStepId: state.previousStepId ?? null,
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
  context: OrchestrationRuntimeContext;
}): Promise<MissionExecutionResult> {
  const startedSnapshot = input.context.clock.now();
  let fallbackIdempotencyKey = `start:failed:${startedSnapshot.isoTimestamp}`;

  try {
    const command = parseMissionCommand(input.command);
    fallbackIdempotencyKey = `start:${command.missionId}:${startedSnapshot.isoTimestamp}`;

    const mapSelection = await selectOperationalMap({ command, mapStore: input.context.mapStore });
    if (!mapSelection.selected) {
      return buildDispatchFailure({
        state: buildMissionStateUpdate({ missionId: command.missionId, mapId: null, requestedPlatform: command.requestedPlatform, humanGoal: command.humanGoal, status: "failed", currentStepId: null, previousStepId: null, activeTaskRunId: null, currentRoundIndex: 0, sequenceNo: 0, hopCount: 0, reviewRequiredReason: null, failureReason: mapSelection.failureReason, lastHumanCommand: "start-mission", lastEnvelopeId: null, lastResultRef: null, lastRuntimeProofRef: null, runtimeProofRefs: [], payloadRefs: createEmptyPayloadRefs(), emergencyStopLatched: false, startedAt: startedSnapshot.isoTimestamp, updatedAt: startedSnapshot.isoTimestamp, pausedAt: null, endedAt: startedSnapshot.isoTimestamp }),
        commandKind: "start-mission",
        caller: input.caller,
        stepId: "map-selection",
        childCapabilityId: "map-selection",
        failureReason: mapSelection.failureReason,
        startedAt: startedSnapshot.isoTimestamp,
        endedAt: input.context.clock.now().isoTimestamp,
        durationMs: 0,
        idempotencyKey: fallbackIdempotencyKey,
        selectedMapSource: mapSelection.selectedMapSource,
      });
    }

    const mapValidation = validateOperationalMapGate(mapSelection.map);
    if (!mapValidation.valid) {
      return buildDispatchFailure({
        state: buildMissionStateUpdate({ missionId: command.missionId, mapId: mapSelection.map.mapId, requestedPlatform: command.requestedPlatform, humanGoal: command.humanGoal, status: "failed", currentStepId: null, previousStepId: null, activeTaskRunId: null, currentRoundIndex: 0, sequenceNo: 0, hopCount: 0, reviewRequiredReason: null, failureReason: mapValidation.failureReason, lastHumanCommand: "start-mission", lastEnvelopeId: null, lastResultRef: null, lastRuntimeProofRef: null, runtimeProofRefs: [], payloadRefs: createEmptyPayloadRefs(), emergencyStopLatched: false, startedAt: startedSnapshot.isoTimestamp, updatedAt: startedSnapshot.isoTimestamp, pausedAt: null, endedAt: startedSnapshot.isoTimestamp }),
        commandKind: "start-mission",
        caller: input.caller,
        stepId: "map-validation",
        childCapabilityId: "map-validation",
        failureReason: mapValidation.failureReason,
        startedAt: startedSnapshot.isoTimestamp,
        endedAt: input.context.clock.now().isoTimestamp,
        durationMs: 0,
        idempotencyKey: fallbackIdempotencyKey,
        mapRecord: mapSelection.record,
        selectedMapSource: mapSelection.selectedMapSource,
      });
    }

    const { map } = mapValidation;
    const idempotencyKey = `start:${command.missionId}:${map.mapId}`;
    const reservation = await input.context.idempotency.reserve(idempotencyKey, IDEMPOTENCY_TTL_MS);
    if (!reservation.reserved) {
      return buildDispatchFailure({
        state: buildMissionStateUpdate({ missionId: command.missionId, mapId: map.mapId, requestedPlatform: command.requestedPlatform, humanGoal: command.humanGoal, status: "failed", currentStepId: null, previousStepId: null, activeTaskRunId: null, currentRoundIndex: 0, sequenceNo: 0, hopCount: 0, reviewRequiredReason: null, failureReason: `Mission ${command.missionId} idempotency conflict.`, lastHumanCommand: "start-mission", lastEnvelopeId: null, lastResultRef: null, lastRuntimeProofRef: null, runtimeProofRefs: [], payloadRefs: createEmptyPayloadRefs(), emergencyStopLatched: false, startedAt: startedSnapshot.isoTimestamp, updatedAt: startedSnapshot.isoTimestamp, pausedAt: null, endedAt: startedSnapshot.isoTimestamp }),
        commandKind: "start-mission",
        caller: input.caller,
        stepId: "idempotency-gate",
        childCapabilityId: "idempotency-gate",
        failureReason: `Mission ${command.missionId} idempotency conflict.`,
        startedAt: startedSnapshot.isoTimestamp,
        endedAt: input.context.clock.now().isoTimestamp,
        durationMs: 0,
        idempotencyKey,
        mapRecord: mapSelection.record,
        selectedMapSource: mapSelection.selectedMapSource,
      });
    }

    const initialState = createInitialMissionState(command, map, startedSnapshot.isoTimestamp);
    await input.context.statePort.putMissionState(initialState);
    return await runMissionLoop({
      state: initialState,
      map,
      mapRecord: mapSelection.record,
      context: input.context,
      commandKind: "start-mission",
      caller: input.caller,
      idempotencyKey,
      selectedMapSource: mapSelection.selectedMapSource,
    });
  } catch (error) {
    const endedAt = input.context.clock.now().isoTimestamp;
    return buildDispatchFailure({
      state: buildMissionStateUpdate({ missionId: null, mapId: null, requestedPlatform: null, humanGoal: null, status: "failed", currentStepId: null, previousStepId: null, activeTaskRunId: null, currentRoundIndex: 0, sequenceNo: 0, hopCount: 0, reviewRequiredReason: null, failureReason: null, lastHumanCommand: "start-mission", lastEnvelopeId: null, lastResultRef: null, lastRuntimeProofRef: null, runtimeProofRefs: [], payloadRefs: createEmptyPayloadRefs(), emergencyStopLatched: false, startedAt: startedSnapshot.isoTimestamp, updatedAt: startedSnapshot.isoTimestamp, pausedAt: null, endedAt }),
      commandKind: "start-mission",
      caller: input.caller,
      stepId: "start-mission",
      childCapabilityId: "start-mission",
      failureReason: error instanceof Error ? error.message : "Unknown mission dispatch failure",
      startedAt: startedSnapshot.isoTimestamp,
      endedAt,
      durationMs: Math.max(0, Math.round(input.context.clock.now().monotonicMs - startedSnapshot.monotonicMs)),
      idempotencyKey: fallbackIdempotencyKey,
    });
  }
}

export async function resumeMissionCommand(input: {
  command: unknown;
  caller: "commander-console" | "orchestration";
  context: OrchestrationRuntimeContext;
}): Promise<MissionExecutionResult> {
  const startedSnapshot = input.context.clock.now();
  try {
    const command = parseMissionControlCommand(input.command);
    const state = await input.context.statePort.getMissionState(command.missionId);
    if (!state) {
      return buildDispatchFailure({
        state: buildMissionStateUpdate({ missionId: command.missionId, mapId: null, requestedPlatform: null, humanGoal: null, status: "failed", currentStepId: null, previousStepId: null, activeTaskRunId: null, currentRoundIndex: 0, sequenceNo: 0, hopCount: 0, reviewRequiredReason: null, failureReason: `Mission ${command.missionId} not found.`, lastHumanCommand: "resume-mission", lastEnvelopeId: null, lastResultRef: null, lastRuntimeProofRef: null, runtimeProofRefs: [], payloadRefs: createEmptyPayloadRefs(), emergencyStopLatched: false, startedAt: startedSnapshot.isoTimestamp, updatedAt: startedSnapshot.isoTimestamp, pausedAt: null, endedAt: startedSnapshot.isoTimestamp }),
        commandKind: "resume-mission",
        caller: input.caller,
        stepId: "state-lookup",
        childCapabilityId: "state-lookup",
        failureReason: `Mission ${command.missionId} not found.`,
        startedAt: startedSnapshot.isoTimestamp,
        endedAt: input.context.clock.now().isoTimestamp,
        durationMs: 0,
        idempotencyKey: `resume:${command.missionId}:notfound`,
      });
    }

    const policyCheck = checkCanResume(state);
    if (!policyCheck.allowed) {
      return buildDispatchFailure({
        state,
        commandKind: "resume-mission",
        caller: input.caller,
        stepId: "policy-gate",
        childCapabilityId: "policy-gate",
        failureReason: policyCheck.reason!,
        startedAt: startedSnapshot.isoTimestamp,
        endedAt: input.context.clock.now().isoTimestamp,
        durationMs: 0,
        idempotencyKey: `resume:${command.missionId}:policy-rejected`,
        stateRevisionBefore: state.stateRevision ?? 0,
      });
    }

    if (!state.mapId) {
      return buildDispatchFailure({
        state,
        commandKind: "resume-mission",
        caller: input.caller,
        stepId: "map-lookup",
        childCapabilityId: "map-lookup",
        failureReason: `Mission ${command.missionId} has no mapId.`,
        startedAt: startedSnapshot.isoTimestamp,
        endedAt: input.context.clock.now().isoTimestamp,
        durationMs: 0,
        idempotencyKey: `resume:${command.missionId}:no-map`,
        stateRevisionBefore: state.stateRevision ?? 0,
      });
    }

    const mapRecord = await input.context.mapStore.getActiveMapRecord(state.mapId);
    if (!mapRecord) {
      return buildDispatchFailure({
        state,
        commandKind: "resume-mission",
        caller: input.caller,
        stepId: "map-lookup",
        childCapabilityId: "map-lookup",
        failureReason: `Map "${state.mapId}" is not active for resume of mission ${command.missionId}.`,
        startedAt: startedSnapshot.isoTimestamp,
        endedAt: input.context.clock.now().isoTimestamp,
        durationMs: 0,
        idempotencyKey: `resume:${command.missionId}:map-missing`,
        stateRevisionBefore: state.stateRevision ?? 0,
      });
    }

    const mapValidation = validateOperationalMapGate(mapRecord.operationalMap);
    if (!mapValidation.valid) {
      return buildDispatchFailure({
        state,
        commandKind: "resume-mission",
        caller: input.caller,
        stepId: "map-validation",
        childCapabilityId: "map-validation",
        failureReason: mapValidation.failureReason,
        startedAt: startedSnapshot.isoTimestamp,
        endedAt: input.context.clock.now().isoTimestamp,
        durationMs: 0,
        idempotencyKey: `resume:${command.missionId}:map-invalid`,
        stateRevisionBefore: state.stateRevision ?? 0,
        mapRecord,
      });
    }

    const { map } = mapValidation;
    const resumedAt = input.context.clock.now().isoTimestamp;
    const resumedState = toMissionControlState(state, resumedAt, {
      status: "running",
      pausedAt: null,
      lastHumanCommand: "resume-mission",
    });
    await input.context.statePort.putMissionState(resumedState);
    const idempotencyKey = `resume:${state.missionId}:${state.sequenceNo}`;
    await input.context.idempotency.reserve(idempotencyKey, IDEMPOTENCY_TTL_MS);
    return runMissionLoop({
      state: resumedState,
      map,
      mapRecord,
      context: input.context,
      commandKind: "resume-mission",
      caller: input.caller,
      idempotencyKey,
      selectedMapSource: "preferred_map_id",
    });
  } catch (error) {
    const endedAt = input.context.clock.now().isoTimestamp;
    return buildDispatchFailure({
      state: buildMissionStateUpdate({ missionId: null, mapId: null, requestedPlatform: null, humanGoal: null, status: "failed", currentStepId: null, previousStepId: null, activeTaskRunId: null, currentRoundIndex: 0, sequenceNo: 0, hopCount: 0, reviewRequiredReason: null, failureReason: null, lastHumanCommand: "resume-mission", lastEnvelopeId: null, lastResultRef: null, lastRuntimeProofRef: null, runtimeProofRefs: [], payloadRefs: createEmptyPayloadRefs(), emergencyStopLatched: false, startedAt: startedSnapshot.isoTimestamp, updatedAt: startedSnapshot.isoTimestamp, pausedAt: null, endedAt }),
      commandKind: "resume-mission",
      caller: input.caller,
      stepId: "resume-mission",
      childCapabilityId: "resume-mission",
      failureReason: error instanceof Error ? error.message : "Unknown resume failure",
      startedAt: startedSnapshot.isoTimestamp,
      endedAt,
      durationMs: Math.max(0, Math.round(input.context.clock.now().monotonicMs - startedSnapshot.monotonicMs)),
      idempotencyKey: `resume:failed:${startedSnapshot.isoTimestamp}`,
    });
  }
}

export async function pauseMissionCommand(input: { command: unknown; context: OrchestrationRuntimeContext }): Promise<MissionState> {
  const command = parseMissionControlCommand(input.command);
  const now = input.context.clock.now().isoTimestamp;
  const state = await input.context.statePort.getMissionState(command.missionId);
  if (!state) {
    throw new Error(`Mission ${command.missionId} not found for pause.`);
  }
  const policyCheck = checkCanPause(state);
  if (!policyCheck.allowed) {
    throw new Error(policyCheck.reason!);
  }
  const nextState = toMissionControlState(state, now, {
    status: "paused",
    pausedAt: now,
    lastHumanCommand: "pause-mission",
  });
  await input.context.statePort.putMissionState(nextState);
  return nextState;
}

export async function stopMissionCommand(input: { command: unknown; context: OrchestrationRuntimeContext }): Promise<MissionState> {
  const command = parseMissionControlCommand(input.command);
  const now = input.context.clock.now().isoTimestamp;
  const state = await input.context.statePort.getMissionState(command.missionId);
  if (!state) {
    throw new Error(`Mission ${command.missionId} not found for stop.`);
  }
  const policyCheck = checkCanStop(state);
  if (!policyCheck.allowed) {
    throw new Error(policyCheck.reason!);
  }
  const nextState = toMissionControlState(state, now, {
    status: "stopped",
    failureReason: command.reason ?? null,
    endedAt: now,
    lastHumanCommand: "stop-mission",
  });
  await input.context.statePort.putMissionState(nextState);
  return nextState;
}

export async function emergencyStopMissionCommand(input: { command: unknown; context: OrchestrationRuntimeContext }): Promise<MissionState> {
  const command = parseMissionControlCommand(input.command);
  const now = input.context.clock.now().isoTimestamp;
  const state = await input.context.statePort.getMissionState(command.missionId);
  if (!state) {
    throw new Error(`Mission ${command.missionId} not found for emergency-stop.`);
  }
  const policyCheck = checkCanEmergencyStop(state);
  if (!policyCheck.allowed) {
    throw new Error(policyCheck.reason!);
  }
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
  context: OrchestrationRuntimeContext;
}): Promise<MissionState | MissionExecutionResult> {
  const command = parseMissionReviewDecision(input.command);
  if (command.decision === "hold") {
    const now = input.context.clock.now().isoTimestamp;
    const state = await input.context.statePort.getMissionState(command.missionId);
    if (!state) {
      throw new Error(`Mission ${command.missionId} not found for review decision.`);
    }
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
  return resumeMissionCommand({ command: { missionId: command.missionId, note: command.note }, caller: input.caller, context: input.context });
}

