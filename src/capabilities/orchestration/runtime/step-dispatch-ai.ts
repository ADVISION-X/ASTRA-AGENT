import type { MissionState, RuntimePlan } from "../contract.js";
import { MissionStepResultSchema } from "../schema.js";
import { decodeVisualMissionActionPlan } from "./ai-action-plan-decoder.js";
import { executeAiActionPlan } from "./ai-action-plan-executor.js";
import type { OrchestrationRuntimeContext } from "./orchestration-runtime-context.js";
import { buildMuscleMemoryBranchFieldValues } from "./step-dispatch-muscle-memory-branch-fields.js";
import {
  applyStepOutputRefPolicy,
  buildBranchFieldValues,
  mergeDispatchPayloadRefs,
  resolvePersistentMissionPayloadRefKeys,
  type AiStep,
  type DispatchChain,
  type StepDispatchResult,
} from "./step-dispatch-shared.js";

export async function executeAiDispatchActionPlan(input: {
  state: MissionState;
  map: RuntimePlan;
  step: AiStep;
  missionId: string;
  sequenceNo: number;
  idempotencyKey: string;
  chain: DispatchChain;
  dispatchResult: Awaited<ReturnType<OrchestrationRuntimeContext["nerveBus"]["sendRequestToAi"]>>;
  context: Pick<OrchestrationRuntimeContext, "nerveBus">;
}) {
  const runtimePayloadRefs = {
    ...input.state.payloadRefs,
    ...input.dispatchResult.payloadRefs,
  };
  const decodedPlan = decodeVisualMissionActionPlan({
    plan: input.dispatchResult.actionPlan,
    sourceAiResultRef: input.dispatchResult.payloadRefs.aiResultRef ?? null,
    runtimeContext: {
      payloadRefs: runtimePayloadRefs,
    },
  });
  const executionResult = await executeAiActionPlan({
    state: { payloadRefs: runtimePayloadRefs },
    map: input.map,
    missionId: input.missionId,
    chain: input.chain,
    sequenceNo: input.sequenceNo + 1,
    idempotencyKey: `${input.idempotencyKey}:ai-plan`,
    plan: decodedPlan,
    nerveBus: input.context.nerveBus,
  });

  return {
    ...input.dispatchResult,
    status: executionResult.status,
    failureReason: executionResult.failureReason,
    payloadRefs: executionResult.payloadRefs,
    branchFieldValues: {
      ...input.dispatchResult.branchFieldValues,
      ...buildMuscleMemoryBranchFieldValues(executionResult),
    },
  };
}

export function buildAiStepResult(input: {
  state: MissionState;
  map: RuntimePlan;
  step: AiStep;
  missionId: string;
  dispatchResult: Awaited<ReturnType<OrchestrationRuntimeContext["nerveBus"]["sendRequestToAi"]>>;
}): StepDispatchResult {
  const outputRef = input.dispatchResult.payloadRefs.aiResultRef ?? null;
  const persistentPayloadRefKeys = resolvePersistentMissionPayloadRefKeys(input.map);
  const mergedPayloadRefs = mergeDispatchPayloadRefs(input.state.payloadRefs, input.dispatchResult.payloadRefs, persistentPayloadRefKeys);
  return {
    dispatched: true,
    stepResult: MissionStepResultSchema.parse({
      status: input.dispatchResult.status,
      missionId: input.missionId,
      mapId: input.map.mapId,
      stepId: input.step.stepId,
      childCapabilityId: input.step.childCapabilityId,
      targetAbilityGroupId: null,
      envelopeId: input.dispatchResult.envelopeId,
      resultRef: input.dispatchResult.resultRef,
      outputRef,
      decision: input.dispatchResult.decision,
      branchFieldValues: buildBranchFieldValues({ decision: input.dispatchResult.decision, branchFieldValues: input.dispatchResult.branchFieldValues }),
      failureReason: input.dispatchResult.status === "review_required" ? null : input.dispatchResult.failureReason,
      reviewRequiredReason: input.dispatchResult.status === "review_required" ? input.dispatchResult.failureReason : null,
      payloadRefs: applyStepOutputRefPolicy(input.step, mergedPayloadRefs, outputRef, persistentPayloadRefKeys),
    }),
  };
}
