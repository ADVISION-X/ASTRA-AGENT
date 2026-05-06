import { MissionStepResultSchema } from "../schema.js";
import type { MissionState, OperationalMap } from "../contract.js";
import type { OrchestrationRuntimeContext } from "./orchestration-runtime-context.js";
import {
  applyStepOutputRefPolicy,
  buildAbilityOutputSchemaRef,
  buildBranchFieldValues,
  resolveStepTimeoutMs,
  type AbilityDispatchInput,
  type AiStep,
  type DispatchChain,
  type ReviewStep,
  type StepDispatchResult,
} from "./step-dispatch-shared.js";

export function buildAiDispatchRequest(input: {
  state: MissionState;
  map: OperationalMap;
  step: AiStep & { promptContractId: string };
  sequenceNo: number;
  idempotencyKey: string;
  missionId: string;
  chain: DispatchChain;
  aiDispatchRequirements: {
    taskType: string;
    promptContractVersion: string;
    outputSchemaRef: string;
    aiInputRefs: string[];
    providerPolicyRef: string;
  };
}) {
  return {
    missionId: input.missionId,
    mapId: input.map.mapId,
    stepId: input.step.stepId,
    runId: input.chain.runId,
    sessionId: input.chain.sessionId,
    roundId: input.chain.roundId,
    videoVisitId: input.chain.videoVisitId,
    mapPackageId: input.chain.mapPackageId,
    mapPackageVersion: input.chain.mapPackageVersion,
    selectedMapVersion: input.chain.selectedMapVersion,
    activationId: input.chain.activationId,
    activationSnapshotRef: input.chain.activationSnapshotRef,
    taskType: input.aiDispatchRequirements.taskType,
    promptContractId: input.step.promptContractId,
    promptContractVersion: input.aiDispatchRequirements.promptContractVersion,
    outputSchemaRef: input.aiDispatchRequirements.outputSchemaRef,
    aiInputRefs: input.aiDispatchRequirements.aiInputRefs,
    providerPolicyRef: input.aiDispatchRequirements.providerPolicyRef,
    payloadRefs: input.state.payloadRefs,
    sequenceNo: input.sequenceNo,
    idempotencyKey: input.idempotencyKey,
    timeoutMs: resolveStepTimeoutMs(input.step),
  };
}

export function buildReviewDispatchRequest(input: {
  state: MissionState;
  map: OperationalMap;
  step: ReviewStep;
  reason: string | undefined;
  sequenceNo: number;
  idempotencyKey: string;
  missionId: string;
  chain: DispatchChain;
}) {
  return {
    missionId: input.missionId,
    mapId: input.map.mapId,
    stepId: input.step.stepId,
    runId: input.chain.runId,
    sessionId: input.chain.sessionId,
    roundId: input.chain.roundId,
    videoVisitId: input.chain.videoVisitId,
    mapPackageId: input.chain.mapPackageId,
    mapPackageVersion: input.chain.mapPackageVersion,
    selectedMapVersion: input.chain.selectedMapVersion,
    activationId: input.chain.activationId,
    activationSnapshotRef: input.chain.activationSnapshotRef,
    reason: input.reason ?? input.state.reviewRequiredReason ?? "orchestration requires human review",
    payloadRefs: input.state.payloadRefs,
    sequenceNo: input.sequenceNo,
    idempotencyKey: input.idempotencyKey,
  };
}

export function buildAbilityDispatchResult(
  input: AbilityDispatchInput,
  dispatchResult: Awaited<ReturnType<OrchestrationRuntimeContext["nerveBus"]["sendCommandToAbility"]>>,
): StepDispatchResult {
  const outputRef = dispatchResult.payloadRefs.abilityResultRef ?? null;
  return {
    dispatched: true,
    stepResult: MissionStepResultSchema.parse({
      status: dispatchResult.status,
      missionId: input.missionId,
      mapId: input.map.mapId,
      stepId: input.step.stepId,
      childCapabilityId: input.step.childCapabilityId,
      targetAbilityGroupId: input.step.targetAbilityGroupId,
      envelopeId: dispatchResult.envelopeId,
      resultRef: dispatchResult.resultRef,
      outputRef,
      decision: dispatchResult.decision,
      branchFieldValues: buildBranchFieldValues({
        decision: dispatchResult.decision,
        branchFieldValues: dispatchResult.branchFieldValues,
      }),
      failureReason: dispatchResult.failureReason,
      reviewRequiredReason: dispatchResult.status === "review_required" ? (dispatchResult.failureReason ?? "review required") : null,
      payloadRefs: applyStepOutputRefPolicy(input.step, { ...input.state.payloadRefs, ...dispatchResult.payloadRefs }, outputRef),
    }),
  };
}
