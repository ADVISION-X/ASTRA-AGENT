import { MissionStepResultSchema } from "../schema.js";
import type { MissionState, OperationalMap } from "../contract.js";
import type { OrchestrationRuntimeContext } from "./orchestration-runtime-context.js";
import {
  applyStepOutputRefPolicy,
  buildAbilityOutputSchemaRef,
  buildBranchFieldValues,
  mergeDispatchPayloadRefs,
  resolvePersistentMissionPayloadRefKeys,
  resolveStepTimeoutMs,
  type AbilityDispatchInput,
  type AiStep,
  type DispatchChain,
  type StepDispatchResult,
} from "./step-dispatch-shared.js";

export function buildAiDispatchRequest(input: {
  state: MissionState;
  map: OperationalMap;
  step: AiStep & { promptContractId: string };
  capabilityCallId: string;
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
    capabilityCallId: input.capabilityCallId,
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

export function buildAbilityDispatchResult(
  input: AbilityDispatchInput,
  dispatchResult: Awaited<ReturnType<OrchestrationRuntimeContext["nerveBus"]["sendCommandToAbility"]>>,
): StepDispatchResult {
  const outputRef = dispatchResult.payloadRefs.abilityResultRef ?? null;
  const persistentPayloadRefKeys = resolvePersistentMissionPayloadRefKeys(input.map);
  const mergedPayloadRefs = mergeDispatchPayloadRefs(input.state.payloadRefs, dispatchResult.payloadRefs, persistentPayloadRefKeys);
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
      reviewRequiredReason: dispatchResult.status === "review_required" ? dispatchResult.failureReason : null,
      payloadRefs: applyStepOutputRefPolicy(input.step, mergedPayloadRefs, outputRef, persistentPayloadRefKeys),
    }),
  };
}
