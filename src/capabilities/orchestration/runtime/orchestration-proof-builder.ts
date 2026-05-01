import type { z } from "zod";
import {
  RuntimeProofSchema,
  type MissionHumanCommandKindSchema,
  type MissionInternalOperationKindSchema,
  type SelectedMapSourceSchema,
  type AllowedAbilityGroupIdSchema,
  type AbortDecisionSchema,
  type NerveBusDispatchDecisionSchema,
  type TransitionEvaluationDecisionSchema,
  type TransitionConditionSourceSchema,
} from "../schema.js";

import type { OperationalMapId } from "../contract.js";

export type BuildProofInput = {
  missionId: string;
  mapId: OperationalMapId;
  taskTemplateId?: string | null;
  activationId?: string | null;
  mapPackageId?: string | null;
  mapPackageVersion?: string | null;
  mapVersion?: string | null;
  selectedMapSource?: z.output<typeof SelectedMapSourceSchema> | null;
  stepId: string;
  targetAbilityGroupId?: z.output<typeof AllowedAbilityGroupIdSchema> | null;
  targetChildCapabilityId?: string | null;
  childCapabilityId: string;
  commandKind: z.output<typeof MissionHumanCommandKindSchema>;
  internalOperationKind?: z.output<typeof MissionInternalOperationKindSchema> | null;
  caller: "commander-console" | "orchestration";
  idempotencyKey: string;
  sequenceNo: number;
  stateRevisionBefore?: number | null;
  stateRevisionAfter?: number | null;
  stateHashBefore?: string | null;
  stateHashAfter?: string | null;
  stepDispatchCallId?: string | null;
  stepTimeoutMs?: number | null;
  timeoutDecision?: z.output<typeof AbortDecisionSchema> | null;
  abortDecision?: z.output<typeof AbortDecisionSchema> | null;
  nerveBusEnvelopeId?: string | null;
  nerveBusDispatchDecision?: z.output<typeof NerveBusDispatchDecisionSchema> | null;
  transitionId?: string | null;
  transitionEvaluationDecision?: z.output<typeof TransitionEvaluationDecisionSchema> | null;
  transitionConditionSource?: z.output<typeof TransitionConditionSourceSchema> | null;
  transitionConditionExpected?: string | boolean | null;
  transitionConditionActual?: string | boolean | null;
  inputRef?: string | null;
  outputRef?: string | null;
  abilityResultRef?: string | null;
  reviewDispatchEnvelopeId?: string | null;
  finalizationDecision?: "finalized" | "pending" | "skipped" | null;
  structuredRuntimeEventRef?: string | null;
  previousStepId?: string | null;
  nextStepId?: string | null;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  status: "completed" | "failed" | "review_required" | "stopped";
  failureReason?: string | null;
  reviewRequiredReason?: string | null;
  mapDecision: "selected" | "rejected";
  transitionDecision: "continue" | "finalize" | "review_required" | "failed";
  loopDecision: "continue" | "stop_completed" | "stop_failed" | "stop_review_required";
  stateDecision: "created" | "updated" | "paused" | "resumed" | "stopped" | "emergency_stopped" | "finalized";
  emergencyDecision: "none" | "latched" | "executed";
  dataQualityFlags?: string[];
};

function buildOrchestrationProofIdentityFields(input: BuildProofInput): Pick<z.output<typeof RuntimeProofSchema>,
  | "proofId"
  | "missionId"
  | "mapId"
  | "taskTemplateId"
  | "activationId"
  | "mapPackageId"
  | "mapPackageVersion"
  | "mapVersion"
  | "selectedMapSource"
  | "stepId"
  | "targetAbilityGroupId"
  | "targetChildCapabilityId"
  | "childCapabilityId"
  | "commandKind"
  | "internalOperationKind"
  | "caller"
  | "idempotencyKey"
  | "sequenceNo"> {
  return { proofId: `${input.missionId}:${input.sequenceNo}:${input.stepId}`, missionId: input.missionId, mapId: input.mapId, taskTemplateId: input.taskTemplateId ?? null, activationId: input.activationId ?? null, mapPackageId: input.mapPackageId ?? null, mapPackageVersion: input.mapPackageVersion ?? null, mapVersion: input.mapVersion ?? null, selectedMapSource: input.selectedMapSource ?? null, stepId: input.stepId, targetAbilityGroupId: input.targetAbilityGroupId ?? null, targetChildCapabilityId: input.targetChildCapabilityId ?? null, childCapabilityId: input.childCapabilityId, commandKind: input.commandKind, internalOperationKind: input.internalOperationKind ?? null, caller: input.caller, idempotencyKey: input.idempotencyKey, sequenceNo: input.sequenceNo };
}

function buildOrchestrationProofStateFields(input: BuildProofInput): Pick<z.output<typeof RuntimeProofSchema>,
  | "stateRevisionBefore"
  | "stateRevisionAfter"
  | "stateHashBefore"
  | "stateHashAfter"
  | "stepDispatchCallId"
  | "stepTimeoutMs"
  | "timeoutDecision"
  | "abortDecision"> {
  return { stateRevisionBefore: input.stateRevisionBefore ?? null, stateRevisionAfter: input.stateRevisionAfter ?? null, stateHashBefore: input.stateHashBefore ?? null, stateHashAfter: input.stateHashAfter ?? null, stepDispatchCallId: input.stepDispatchCallId ?? null, stepTimeoutMs: input.stepTimeoutMs ?? null, timeoutDecision: input.timeoutDecision ?? null, abortDecision: input.abortDecision ?? null };
}

function buildOrchestrationProofRouteFields(input: BuildProofInput): Pick<z.output<typeof RuntimeProofSchema>,
  | "nerveBusEnvelopeId"
  | "nerveBusDispatchDecision"
  | "transitionId"
  | "transitionEvaluationDecision"
  | "transitionConditionSource"
  | "transitionConditionExpected"
  | "transitionConditionActual"> {
  return { nerveBusEnvelopeId: input.nerveBusEnvelopeId ?? null, nerveBusDispatchDecision: input.nerveBusDispatchDecision ?? null, transitionId: input.transitionId ?? null, transitionEvaluationDecision: input.transitionEvaluationDecision ?? null, transitionConditionSource: input.transitionConditionSource ?? null, transitionConditionExpected: input.transitionConditionExpected ?? null, transitionConditionActual: input.transitionConditionActual ?? null };
}

function buildOrchestrationProofArtifactFields(input: BuildProofInput): Pick<z.output<typeof RuntimeProofSchema>,
  | "inputRef"
  | "outputRef"
  | "abilityResultRef"
  | "reviewDispatchEnvelopeId"
  | "finalizationDecision"
  | "structuredRuntimeEventRef"
  | "previousStepId"
  | "nextStepId"> {
  return { inputRef: input.inputRef ?? null, outputRef: input.outputRef ?? null, abilityResultRef: input.abilityResultRef ?? null, reviewDispatchEnvelopeId: input.reviewDispatchEnvelopeId ?? null, finalizationDecision: input.finalizationDecision ?? null, structuredRuntimeEventRef: input.structuredRuntimeEventRef ?? null, previousStepId: input.previousStepId ?? null, nextStepId: input.nextStepId ?? null };
}

function buildOrchestrationProofCoreFields(input: BuildProofInput): Pick<z.output<typeof RuntimeProofSchema>,
  | "proofId"
  | "missionId"
  | "mapId"
  | "taskTemplateId"
  | "activationId"
  | "mapPackageId"
  | "mapPackageVersion"
  | "mapVersion"
  | "selectedMapSource"
  | "stepId"
  | "targetAbilityGroupId"
  | "targetChildCapabilityId"
  | "childCapabilityId"
  | "commandKind"
  | "internalOperationKind"
  | "caller"
  | "idempotencyKey"
  | "sequenceNo"
  | "stateRevisionBefore"
  | "stateRevisionAfter"
  | "stateHashBefore"
  | "stateHashAfter"
  | "stepDispatchCallId"
  | "stepTimeoutMs"
  | "timeoutDecision"
  | "abortDecision"
  | "nerveBusEnvelopeId"
  | "nerveBusDispatchDecision"
  | "transitionId"
  | "transitionEvaluationDecision"
  | "transitionConditionSource"
  | "transitionConditionExpected"
  | "transitionConditionActual"
  | "inputRef"
  | "outputRef"
  | "abilityResultRef"
  | "reviewDispatchEnvelopeId"
  | "finalizationDecision"
  | "structuredRuntimeEventRef"
  | "previousStepId"
  | "nextStepId"> {
  return { ...buildOrchestrationProofIdentityFields(input), ...buildOrchestrationProofStateFields(input), ...buildOrchestrationProofRouteFields(input), ...buildOrchestrationProofArtifactFields(input) };
}

function buildOrchestrationProofDecisionFields(input: BuildProofInput): Pick<z.output<typeof RuntimeProofSchema>,
  | "startedAt"
  | "endedAt"
  | "durationMs"
  | "status"
  | "failureReason"
  | "reviewRequiredReason"
  | "mapDecision"
  | "transitionDecision"
  | "loopDecision"
  | "stateDecision"
  | "emergencyDecision"> {
  return {
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: input.durationMs,
    status: input.status,
    failureReason: input.failureReason ?? null,
    reviewRequiredReason: input.reviewRequiredReason ?? null,
    mapDecision: input.mapDecision,
    transitionDecision: input.transitionDecision,
    loopDecision: input.loopDecision,
    stateDecision: input.stateDecision,
    emergencyDecision: input.emergencyDecision,
  };
}

function buildOrchestrationProofTailFields(input: BuildProofInput): Pick<z.output<typeof RuntimeProofSchema>, "dataQualityFlags"> {
  return {
    dataQualityFlags: input.dataQualityFlags ?? [],
  };
}

export function buildOrchestrationRuntimeProof(input: BuildProofInput): z.output<typeof RuntimeProofSchema> {
  return RuntimeProofSchema.parse({
    ...buildOrchestrationProofCoreFields(input),
    ...buildOrchestrationProofDecisionFields(input),
    ...buildOrchestrationProofTailFields(input),
  });
}
