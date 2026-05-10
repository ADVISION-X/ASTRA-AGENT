import { buildAbilityOutputSchemaRef } from "../../capabilities/orchestration/runtime/step-dispatch-shared.js";
import type { MuscleMemoryExecutionActionResult } from "./muscle-memory-execution.schema.js";
import type { ExecuteMuscleMemoryPlanInput, ExecutionAction, PayloadRefs } from "./muscle-memory-executor.types.js";

type SyntheticDispatch = {
  mode: "nerve-bus" | "local-review-required";
  stepId: string;
  targetAbilityGroupId: Exclude<Parameters<ExecuteMuscleMemoryPlanInput["nerveBus"]["sendCommandToAbility"]>[0]["targetAbilityGroupId"], null>;
  childCapabilityId: string;
  postClickObservation: boolean;
  timeoutMs: number;
};

const toSyntheticStepId = (action: ExecutionAction): string =>
  `muscle-memory:${action.sourceActionCode.toLowerCase().replaceAll("_", "-")}:${action.resolvedActionId}`;

const resolveSyntheticDispatch = (action: ExecutionAction): SyntheticDispatch => {
  if (action.sourceActionCode === "STOP_REVIEW_REQUIRED" || (action.abilityGroupId === "orchestration" && action.childCapabilityId === "emergency-stop")) {
    return {
      mode: "local-review-required",
      stepId: "stop-review-required",
      targetAbilityGroupId: "orchestration",
      childCapabilityId: "emergency-stop",
      postClickObservation: false,
      timeoutMs: 0,
    };
  }

  return {
    mode: "nerve-bus",
    stepId: toSyntheticStepId(action),
    targetAbilityGroupId: action.abilityGroupId,
    childCapabilityId: action.childCapabilityId,
    postClickObservation: action.requiresPostActionVerification,
    timeoutMs: 60_000,
  };
};

const augmentPayloadRefs = (action: ExecutionAction, payloadRefs: PayloadRefs): PayloadRefs => {
  if (!payloadRefs.abilityResultRef) {
    return payloadRefs;
  }
  let nextPayloadRefs = payloadRefs;
  for (const refKey of action.successOutputRefs) {
    if (refKey === "abilityResultRef" || nextPayloadRefs[refKey] != null) {
      continue;
    }
    nextPayloadRefs = {
      ...nextPayloadRefs,
      [refKey]: payloadRefs.abilityResultRef,
    };
  }
  return nextPayloadRefs;
};

const buildLocalReviewRequiredResult = (input: {
  action: ExecutionAction;
  payloadRefs: PayloadRefs;
  syntheticDispatch: SyntheticDispatch;
}) => {
  const failureReason = "Muscle-memory action STOP_REVIEW_REQUIRED requested fail-closed human review.";
  const reviewRequiredRef = `${input.action.resolvedActionId}:review-required`;
  const nextPayloadRefs = {
    ...input.payloadRefs,
    reviewRequiredRef,
  };

  return {
    dispatchResult: {
      status: "review_required" as const,
      failureReason,
      payloadRefs: nextPayloadRefs,
    },
    nextPayloadRefs,
    actionResult: buildActionResult({
      action: input.action,
      syntheticDispatch: input.syntheticDispatch,
      status: "review_required",
      outputRef: reviewRequiredRef,
      failureReason,
    }),
  };
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

const buildSyntheticDispatchCommandInput = (input: {
  executionInput: ExecuteMuscleMemoryPlanInput;
  action: ExecutionAction;
  actionIndex: number;
  payloadRefs: PayloadRefs;
  syntheticDispatch: SyntheticDispatch;
}) => ({
  missionId: input.executionInput.missionId,
  mapId: input.executionInput.map.mapId,
  stepId: input.syntheticDispatch.stepId,
  runId: input.executionInput.chain.runId,
  sessionId: input.executionInput.chain.sessionId,
  roundId: input.executionInput.chain.roundId,
  videoVisitId: input.executionInput.chain.videoVisitId,
  mapPackageId: input.executionInput.chain.mapPackageId,
  mapPackageVersion: input.executionInput.chain.mapPackageVersion,
  selectedMapVersion: input.executionInput.chain.selectedMapVersion,
  activationId: input.executionInput.chain.activationId,
  activationSnapshotRef: input.executionInput.chain.activationSnapshotRef,
  targetAbilityGroupId: input.syntheticDispatch.targetAbilityGroupId,
  childCapabilityId: input.syntheticDispatch.childCapabilityId,
  expectedOutputSchemaRef: input.action.outputSchemaRef || buildAbilityOutputSchemaRef(input.syntheticDispatch.targetAbilityGroupId, input.syntheticDispatch.childCapabilityId),
  postClickObservation: input.syntheticDispatch.postClickObservation,
  payloadRefs: input.payloadRefs,
  sequenceNo: input.executionInput.sequenceNo + input.actionIndex,
  idempotencyKey: `${input.executionInput.idempotencyKey}:${input.action.resolvedActionId}`,
  timeoutMs: input.syntheticDispatch.timeoutMs,
});

export async function dispatchExecutionAction(input: {
  executionInput: ExecuteMuscleMemoryPlanInput;
  action: ExecutionAction;
  actionIndex: number;
  payloadRefs: PayloadRefs;
}) {
  const syntheticDispatch = resolveSyntheticDispatch(input.action);
  if (syntheticDispatch.mode === "local-review-required") {
    return buildLocalReviewRequiredResult({
      action: input.action,
      payloadRefs: input.payloadRefs,
      syntheticDispatch,
    });
  }

  const dispatchResult = await input.executionInput.nerveBus.sendCommandToAbility(
    buildSyntheticDispatchCommandInput({
      executionInput: input.executionInput,
      action: input.action,
      actionIndex: input.actionIndex,
      payloadRefs: input.payloadRefs,
      syntheticDispatch,
    }),
  );

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