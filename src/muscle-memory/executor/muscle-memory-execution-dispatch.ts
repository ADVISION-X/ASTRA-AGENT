import { buildAbilityOutputSchemaRef } from "../../capabilities/orchestration/runtime/step-dispatch-shared.js";
import type { MuscleMemoryExecutionActionResult } from "./muscle-memory-execution.schema.js";
import type { ExecuteMuscleMemoryPlanInput, ExecutionAction, PayloadRefs } from "./muscle-memory-executor.types.js";

type SyntheticDispatch = {
  stepId: string;
  targetAbilityGroupId: Exclude<Parameters<ExecuteMuscleMemoryPlanInput["nerveBus"]["sendCommandToAbility"]>[0]["targetAbilityGroupId"], null>;
  childCapabilityId: string;
  postClickObservation: boolean;
  timeoutMs: number;
};

const resolveSyntheticDispatch = (action: ExecutionAction): SyntheticDispatch => {
  if (action.childCapabilityId === "write-product-lead-record") {
    return {
      stepId: "write-product-lead-record",
      targetAbilityGroupId: "forensics-persistence",
      childCapabilityId: "write-product-lead-record",
      postClickObservation: false,
      timeoutMs: 60_000,
    };
  }
  if (action.childCapabilityId === "press-key" && action.input.key === "L") {
    return {
      stepId: "like-current-video-keyboard",
      targetAbilityGroupId: "text-input",
      childCapabilityId: "press-key",
      postClickObservation: false,
      timeoutMs: 60_000,
    };
  }
  if (action.childCapabilityId === "press-navigation-key" && action.input.key === "ArrowDown") {
    return {
      stepId: "press-next-video-key",
      targetAbilityGroupId: "text-input",
      childCapabilityId: "press-navigation-key",
      postClickObservation: false,
      timeoutMs: 60_000,
    };
  }
  throw new Error(`Unsupported muscle-memory execution action ${action.sourceActionCode} -> ${action.childCapabilityId}.`);
};

const augmentPayloadRefs = (action: ExecutionAction, payloadRefs: PayloadRefs): PayloadRefs => {
  if (!payloadRefs.abilityResultRef) {
    return payloadRefs;
  }
  if (action.childCapabilityId === "write-product-lead-record") {
    return { ...payloadRefs, productLeadRecordRef: payloadRefs.abilityResultRef };
  }
  if (action.childCapabilityId === "press-navigation-key") {
    return { ...payloadRefs, nextItemAdvanceProofRef: payloadRefs.abilityResultRef };
  }
  return payloadRefs;
};

const buildActionResult = (input: {
  action: ExecutionAction;
  syntheticDispatch: SyntheticDispatch;
  status: MuscleMemoryExecutionActionResult["status"];
  outputRef: string | null;
  failureReason: string | null;
}): MuscleMemoryExecutionActionResult => ({
  resolvedActionId: input.action.resolvedActionId,
  sourceActionCode: input.action.sourceActionCode,
  syntheticStepId: input.syntheticDispatch.stepId,
  status: input.status,
  outputRef: input.outputRef,
  failureReason: input.failureReason,
});

export const resolveFailureStatus = (
  action: ExecutionAction,
  status: Exclude<MuscleMemoryExecutionActionResult["status"], "success">,
): MuscleMemoryExecutionActionResult["status"] => {
  if (status === "review_required" || action.onFailure === "review_required") {
    return "review_required";
  }
  return "failed";
};

export async function dispatchExecutionAction(input: {
  executionInput: ExecuteMuscleMemoryPlanInput;
  action: ExecutionAction;
  actionIndex: number;
  payloadRefs: PayloadRefs;
}) {
  const syntheticDispatch = resolveSyntheticDispatch(input.action);
  const dispatchResult = await input.executionInput.nerveBus.sendCommandToAbility({
    missionId: input.executionInput.missionId,
    mapId: input.executionInput.map.mapId,
    stepId: syntheticDispatch.stepId,
    runId: input.executionInput.chain.runId,
    sessionId: input.executionInput.chain.sessionId,
    roundId: input.executionInput.chain.roundId,
    videoVisitId: input.executionInput.chain.videoVisitId,
    mapPackageId: input.executionInput.chain.mapPackageId,
    mapPackageVersion: input.executionInput.chain.mapPackageVersion,
    selectedMapVersion: input.executionInput.chain.selectedMapVersion,
    activationId: input.executionInput.chain.activationId,
    activationSnapshotRef: input.executionInput.chain.activationSnapshotRef,
    targetAbilityGroupId: syntheticDispatch.targetAbilityGroupId,
    childCapabilityId: syntheticDispatch.childCapabilityId,
    expectedOutputSchemaRef: buildAbilityOutputSchemaRef(syntheticDispatch.targetAbilityGroupId, syntheticDispatch.childCapabilityId),
    postClickObservation: syntheticDispatch.postClickObservation,
    payloadRefs: input.payloadRefs,
    sequenceNo: input.executionInput.sequenceNo + input.actionIndex,
    idempotencyKey: `${input.executionInput.idempotencyKey}:${input.action.resolvedActionId}`,
    timeoutMs: syntheticDispatch.timeoutMs,
  });

  const nextPayloadRefs = augmentPayloadRefs(input.action, dispatchResult.payloadRefs);
  return {
    dispatchResult,
    nextPayloadRefs,
    actionResult: buildActionResult({
      action: input.action,
      syntheticDispatch,
      status: dispatchResult.status,
      outputRef: dispatchResult.payloadRefs.abilityResultRef ?? null,
      failureReason: dispatchResult.failureReason,
    }),
  };
}