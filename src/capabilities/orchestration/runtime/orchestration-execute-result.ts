import type { MissionState, MissionStepResult, OrchestrationExecuteResult } from "../contract.js";
import { buildOrchestrationExecuteResult } from "./orchestration-result-builder.js";
import { buildOrchestrationRuntimeProof } from "./orchestration-proof-builder.js";
import { createFailedMissionState } from "./orchestration-executor-command-support.js";

type ResultStatus = OrchestrationExecuteResult["status"];

type ResultStateDecision =
  | "created"
  | "updated"
  | "paused"
  | "resumed"
  | "stopped"
  | "emergency_stopped"
  | "finalized";

type BuildResultInput = {
  state: MissionState;
  childCapabilityId: string;
  caller: "commander-console" | "orchestration";
  startedAt: string;
  endedAt: string;
  idempotencyKey: string;
  currentStepResult?: MissionStepResult | null;
  failureReason?: string | null;
  reviewRequiredReason?: string | null;
  stateDecision: ResultStateDecision;
  internalOperationKind?: "execute-map-step" | "evaluate-step-transition" | "finalize-mission" | null;
  dataQualityFlags?: string[];
};

type BuildFailureInput = {
  missionId: string | null;
  mapId: string | null;
  requestedPlatform: MissionState["requestedPlatform"];
  humanGoal: string | null;
  childCapabilityId: string;
  caller: "commander-console" | "orchestration";
  startedAt: string;
  endedAt: string;
  failureReason: string;
  internalOperationKind?: "execute-map-step" | "evaluate-step-transition" | "finalize-mission" | null;
  dataQualityFlags?: string[];
};

const COMMAND_KIND_BY_CHILD = {
  "start-mission": "start-mission",
  "pause-mission": "pause-mission",
  "resume-mission": "resume-mission",
  "stop-mission": "stop-mission",
  "emergency-stop": "emergency-stop",
} as const;

function resolveExecuteStatus(state: MissionState, failureReason: string | null | undefined): ResultStatus {
  if (failureReason) {
    return "failed";
  }
  if (state.status === "review_required") {
    return "failed";
  }
  return state.status === "idle" || state.status === "pending" ? "failed" : state.status;
}

function resolveTransitionDecision(status: ResultStatus): "continue" | "finalize" | "failed" {
  if (status === "failed" || status === "review_required") {
    return "failed";
  }
  if (status === "completed" || status === "stopped") {
    return "finalize";
  }
  return "continue";
}

function resolveProofStatus(status: ResultStatus): "completed" | "failed" | "review_required" | "stopped" | "running" | "paused" {
  if (status === "completed" || status === "failed" || status === "review_required" || status === "stopped" || status === "running" || status === "paused") {
    return status;
  }
  return "failed";
}

function resolveCommandKind(state: MissionState, childCapabilityId: string): "start-mission" | "pause-mission" | "resume-mission" | "stop-mission" | "emergency-stop" {
  return COMMAND_KIND_BY_CHILD[childCapabilityId as keyof typeof COMMAND_KIND_BY_CHILD] ?? state.lastHumanCommand ?? "resume-mission";
}

function buildRuntimeProofIdentity(input: BuildResultInput) {
  return {
    missionId: input.state.missionId ?? "unknown-mission",
    runId: input.state.activeTaskRunId ?? `${input.state.missionId ?? "unknown-mission"}:${input.childCapabilityId}:failure-run`,
    mapId: input.state.mapId ?? "recovery",
    taskTemplateId: input.state.taskTemplateId ?? null,
    activationId: input.state.activationId ?? null,
    mapPackageId: input.state.mapPackageId ?? null,
    mapPackageVersion: input.state.mapPackageVersion ?? null,
    selectedMapVersion: input.state.selectedMapVersion ?? null,
    activationSnapshotRef: input.state.activationSnapshotRef ?? null,
    promptContractVersion: input.state.promptContractVersion ?? null,
    capabilityCatalogVersion: input.state.capabilityCatalogVersion ?? null,
    selectedMapSource: input.state.selectedMapSource ?? null,
    stepId: input.state.currentStepId ?? input.childCapabilityId,
    childCapabilityId: input.childCapabilityId,
    commandKind: resolveCommandKind(input.state, input.childCapabilityId),
    internalOperationKind: input.internalOperationKind ?? null,
    caller: input.caller,
    idempotencyKey: input.idempotencyKey,
  };
}

function buildRuntimeProofState(input: BuildResultInput) {
  return {
    sequenceNo: input.state.sequenceNo,
    stateRevisionBefore: input.state.stateRevision,
    stateRevisionAfter: input.state.stateRevision,
    stateHashBefore: input.state.stateHash ?? null,
    stateHashAfter: input.state.stateHash ?? null,
    nerveBusEnvelopeId: input.state.lastEnvelopeId ?? null,
    abilityResultRef: input.state.lastResultRef ?? null,
    previousStepId: input.state.previousStepId ?? null,
    nextStepId: input.state.currentStepId ?? null,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
  };
}

function buildRuntimeProofDecision(input: BuildResultInput, status: ResultStatus) {
  return {
    durationMs: Math.max(0, Date.parse(input.endedAt) - Date.parse(input.startedAt)),
    status: resolveProofStatus(status),
    failureReason: input.failureReason ?? input.state.failureReason ?? null,
    reviewRequiredReason: input.reviewRequiredReason ?? input.state.reviewRequiredReason ?? null,
    mapDecision: input.state.activationSnapshotRef ? ("selected" as const) : ("rejected" as const),
    transitionDecision: resolveTransitionDecision(status),
    loopDecision: "continue" as const,
    stateDecision: input.stateDecision,
    emergencyDecision: input.state.emergencyStopLatched ? ("latched" as const) : ("none" as const),
    dataQualityFlags: input.dataQualityFlags ?? [],
  };
}

function buildRuntimeProof(input: BuildResultInput, status: ResultStatus) {
  return buildOrchestrationRuntimeProof({
    ...buildRuntimeProofIdentity(input),
    ...buildRuntimeProofState(input),
    ...buildRuntimeProofDecision(input, status),
  });
}

export function buildStateBackedExecuteResult(input: BuildResultInput): OrchestrationExecuteResult {
  const status = resolveExecuteStatus(input.state, input.failureReason);
  const runtimeProof = buildRuntimeProof(input, status);
  return buildOrchestrationExecuteResult({
    missionState: input.state,
    currentStepResult: input.currentStepResult ?? null,
    runtimeProof,
    failureReason: input.failureReason ?? input.state.failureReason ?? null,
    reviewRequiredReason: input.reviewRequiredReason ?? input.state.reviewRequiredReason ?? null,
    dataQualityFlags: input.dataQualityFlags ?? [],
  });
}

export function buildFailureExecuteResult(input: BuildFailureInput): OrchestrationExecuteResult {
  const state = createFailedMissionState({
    missionId: input.missionId,
    runId: `${input.childCapabilityId}:${input.missionId ?? "unknown-mission"}:failure-run`,
    mapId: input.mapId,
    requestedPlatform: input.requestedPlatform,
    humanGoal: input.humanGoal,
    lastHumanCommand: "resume-mission",
    failureReason: input.failureReason,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
  });
  return buildStateBackedExecuteResult({
    state,
    childCapabilityId: input.childCapabilityId,
    caller: input.caller,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    idempotencyKey: `${input.childCapabilityId}:${input.missionId ?? "unknown"}:failure`,
    failureReason: input.failureReason,
    stateDecision: "updated",
    internalOperationKind: input.internalOperationKind ?? null,
    dataQualityFlags: input.dataQualityFlags ?? ["typed_failure_boundary"],
  });
}
