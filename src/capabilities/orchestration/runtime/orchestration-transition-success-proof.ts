import type { MissionState } from "../contract.js";
import type { ActiveOperationalMapRecord } from "../ports/orchestration-map-store-port.js";
import { buildOrchestrationRuntimeProof, type BuildProofInput } from "./orchestration-proof-builder.js";
import { toMapProofMetadata, toRuntimeProofStatus } from "./orchestration-state-support.js";

type TransitionSuccessProofInput = {
  state: MissionState;
  map: { mapId: string };
  mapRecord: ActiveOperationalMapRecord | null;
  selectedMapSource: "preferred_map_id" | "initial_payload_map_id" | "task_template_id" | "activation_id";
  commandKind: "start-mission" | "resume-mission";
  caller: "commander-console" | "orchestration";
};

type TransitionResultRecord = {
  childCapabilityId: string;
  envelopeId: string | null;
  outputRef: string | null;
  resultRef: string | null;
  status: string;
  decision?: string | boolean | null;
  branchFieldValues: Record<string, string | number | boolean | null>;
  failureReason?: string | null;
  reviewRequiredReason?: string | null;
};

type MatchedTransitionRecord = {
  transitionId: string;
  finalStatus: "running" | "completed" | "stopped" | "review_required" | "failed";
  toStepId: string | null;
  condition: null;
};

type TransitionSuccessProofDetails = {
  currentStepId: string;
  stepDispatchCallId: string;
  stepIdempotencyKey: string;
  startedAt: string;
  endedAt: string;
  lastResult: TransitionResultRecord;
  transition: MatchedTransitionRecord;
  transitionEvaluationDecision: "matched";
  stateRevisionBefore: number;
  stateHashBefore: string | null;
  startedMonotonicMs: number;
  endedMonotonicMs: number;
};

type RuntimeProofRecord = ReturnType<typeof buildOrchestrationRuntimeProof>;

function toBuildProofValue(value: RuntimeProofRecord): BuildProofInput {
  return value as BuildProofInput;
}

function buildTransitionSuccessIdentityFields(input: TransitionSuccessProofInput, details: TransitionSuccessProofDetails) {
  return {
    missionId: input.state.missionId ?? "unknown-mission",
    runId: input.state.activeTaskRunId ?? `${input.state.missionId ?? "unknown-mission"}:transition-run`,
    mapId: input.map.mapId,
    selectedMapSource: input.selectedMapSource,
    stepId: details.currentStepId,
    childCapabilityId: details.lastResult.childCapabilityId,
    commandKind: input.commandKind,
    caller: input.caller,
    idempotencyKey: details.stepIdempotencyKey,
    sequenceNo: input.state.sequenceNo + 1,
    stateRevisionBefore: details.stateRevisionBefore,
    stateHashBefore: details.stateHashBefore,
  };
}

function buildTransitionSuccessTimingFields(details: TransitionSuccessProofDetails) {
  return {
    startedAt: details.startedAt,
    endedAt: details.endedAt,
    durationMs: Math.max(0, Math.round(details.endedMonotonicMs - details.startedMonotonicMs)),
  };
}

function buildTransitionSuccessEnvelopeFields(input: TransitionSuccessProofInput, details: TransitionSuccessProofDetails) {
  return {
    nerveBusEnvelopeId: details.lastResult.envelopeId ?? null,
    outputRef: details.lastResult.outputRef ?? null,
    abilityResultRef: details.lastResult.resultRef ?? null,
    stepDispatchCallId: details.stepDispatchCallId,
    previousStepId: input.state.previousStepId ?? null,
    nextStepId: details.transition.finalStatus === "running" ? details.transition.toStepId : null,
  };
}

function buildTransitionSuccessRoutingFields(details: TransitionSuccessProofDetails) {
  return {
    transitionId: details.transition.transitionId,
    transitionEvaluationDecision: details.transitionEvaluationDecision,
    transitionConditionSource: "route-only",
    transitionConditionExpected: details.transition.transitionId,
    transitionConditionActual: details.lastResult.decision ?? details.lastResult.status,
  };
}

function buildTransitionSuccessStatusFields(details: TransitionSuccessProofDetails) {
  const nextStatus = details.transition.finalStatus === "review_required" ? "failed" : details.transition.finalStatus;
  return {
    status: toRuntimeProofStatus(nextStatus),
    failureReason: nextStatus === "failed" ? (details.lastResult.failureReason ?? details.lastResult.reviewRequiredReason ?? "transition_invalid") : null,
    reviewRequiredReason: null,
  };
}

function toTransitionDecision(finalStatus: MatchedTransitionRecord["finalStatus"]): BuildProofInput["transitionDecision"] {
  if (finalStatus === "running") {
    return "continue";
  }
  if (finalStatus === "completed" || finalStatus === "stopped") {
    return "finalize";
  }
  return "failed";
}

function toStateDecision(finalStatus: MatchedTransitionRecord["finalStatus"]): BuildProofInput["stateDecision"] {
  return finalStatus === "completed" || finalStatus === "failed" || finalStatus === "review_required" ? "finalized" : "updated";
}

function buildTransitionSuccessFlowFields(details: TransitionSuccessProofDetails) {
  return {
    mapDecision: "selected" as const,
    transitionDecision: toTransitionDecision(details.transition.finalStatus),
    loopDecision: "continue" as const,
    stateDecision: toStateDecision(details.transition.finalStatus),
  };
}

function buildTransitionSuccessSafetyFields(input: TransitionSuccessProofInput) {
  return {
    emergencyDecision: input.state.emergencyStopLatched ? "latched" as const : "none" as const,
    dataQualityFlags: [] as never[],
  };
}

function buildTransitionSuccessBaseProof(input: TransitionSuccessProofInput, details: TransitionSuccessProofDetails): RuntimeProofRecord {
  return buildOrchestrationRuntimeProof({
    ...buildTransitionSuccessIdentityFields(input, details),
    ...toMapProofMetadata(input.mapRecord),
    ...buildTransitionSuccessTimingFields(details),
    ...buildTransitionSuccessEnvelopeFields(input, details),
    ...buildTransitionSuccessRoutingFields(details),
    ...buildTransitionSuccessStatusFields(details),
    ...buildTransitionSuccessFlowFields(details),
    ...buildTransitionSuccessSafetyFields(input),
  });
}

function finalizeTransitionSuccessProof(proof: RuntimeProofRecord, state: MissionState): RuntimeProofRecord {
  return buildOrchestrationRuntimeProof({
    ...toBuildProofValue(proof),
    stateRevisionAfter: state.stateRevision,
    stateHashAfter: state.stateHash ?? null,
  });
}

export function buildTransitionSuccessProof(
  input: TransitionSuccessProofInput,
  state: MissionState,
  details: TransitionSuccessProofDetails,
): RuntimeProofRecord {
  return finalizeTransitionSuccessProof(buildTransitionSuccessBaseProof(input, details), state);
}
