import type { MissionState, OperationalMap } from "../contract.js";
import type { OrchestrationRuntimeContext } from "./orchestration-runtime-context.js";
import { buildAiStepResult } from "./step-dispatch-ai.js";
import { findEffectiveOperationalStep } from "./route-plan-resolver.js";
import { buildAbilityDispatchResult, buildAiDispatchRequest } from "./step-dispatch-request-builders.js";
import { buildFinalizeStepResult } from "./step-dispatch-review.js";
import { decodeVisualMissionActionPlan } from "../../../muscle-memory/decoder/action-plan-decoder.js";
import { executeMuscleMemoryPlan } from "../../../muscle-memory/executor/muscle-memory-executor.js";
import {
  allowsPostClickObservationAbilityGroup,
  ensurePostActionVerificationDispatchGate,
} from "./orchestration-post-action-verification.js";
import {
  buildAbilityOutputSchemaRef,
  resolveDispatchChain,
  resolveStepTimeoutMs,
  type AbilityDispatchInput,
  type AbilityDispatchTarget,
  type AbilityStep,
  type AiStep,
  type DispatchChain,
  type FinalizeStep,
  type OperationalStep,
  type StepDispatchResult,
} from "./step-dispatch-shared.js";
import { resolveAiDispatchRequirements } from "./step-dispatch-ai-requirements.js";
import { dispatchWithTimeout } from "./step-dispatch-timeout-gate.js";

function validateAbilityDispatch(input: AbilityDispatchInput): string | null {
  if (!input.step.targetAbilityGroupId || input.step.targetAbilityGroupId === "ai") {
    return `Ability step "${input.step.stepId}" is missing required targetAbilityGroupId.`;
  }

  return null;
}

async function sendAbilityDispatch(input: AbilityDispatchInput, targetAbilityGroupId: AbilityDispatchTarget) {
  const chain = resolveDispatchChain(input.state, input.step.stepId);
  if (!chain.ok) {
    throw new Error(chain.failureReason);
  }
  const timeoutMs = resolveStepTimeoutMs(input.step);

  return dispatchWithTimeout(
    async (_signal) => input.context.nerveBus.sendCommandToAbility({
      missionId: input.missionId,
      mapId: input.map.mapId,
      stepId: input.step.stepId,
      runId: chain.value.runId,
      sessionId: chain.value.sessionId,
      roundId: chain.value.roundId,
      videoVisitId: chain.value.videoVisitId,
      mapPackageId: chain.value.mapPackageId,
      mapPackageVersion: chain.value.mapPackageVersion,
      selectedMapVersion: chain.value.selectedMapVersion,
      activationId: chain.value.activationId,
      activationSnapshotRef: chain.value.activationSnapshotRef,
      targetAbilityGroupId,
      childCapabilityId: input.step.childCapabilityId,
      expectedOutputSchemaRef: buildAbilityOutputSchemaRef(targetAbilityGroupId, input.step.childCapabilityId),
      postClickObservation: allowsPostClickObservationAbilityGroup(targetAbilityGroupId),
      payloadRefs: input.state.payloadRefs,
      sequenceNo: input.sequenceNo,
      idempotencyKey: input.idempotencyKey,
      timeoutMs,
    }),
    timeoutMs,
  );
}

async function dispatchAbilityStep(input: AbilityDispatchInput): Promise<StepDispatchResult> {
  const failureReason = validateAbilityDispatch(input);
  if (failureReason) {
    return { dispatched: false, failureReason };
  }
  const postActionVerificationGateReason = ensurePostActionVerificationDispatchGate(input.map, input.step.stepId);
  if (postActionVerificationGateReason) {
    return { dispatched: false, failureReason: postActionVerificationGateReason };
  }
  const timeoutResult = await sendAbilityDispatch(input, input.step.targetAbilityGroupId as AbilityDispatchTarget);
  if (timeoutResult.timedOut) {
    return { dispatched: false, failureReason: `Ability dispatch timed out after ${resolveStepTimeoutMs(input.step)}ms for step "${input.step.stepId}".` };
  }

  return buildAbilityDispatchResult(input, timeoutResult.result);
}

function prepareAiDispatch(input: {
  state: MissionState;
  step: AiStep;
  map: OperationalMap;
  sequenceNo: number;
  idempotencyKey: string;
  context: Pick<OrchestrationRuntimeContext, "nerveBus">;
  missionId: string;
}) {
  if (!input.step.promptContractId) {
    return { ok: false as const, failureReason: `AI step "${input.step.stepId}" is missing required promptContractId.` };
  }

  const chain = resolveDispatchChain(input.state, input.step.stepId);
  if (!chain.ok) {
    return { ok: false as const, failureReason: chain.failureReason };
  }

  const aiDispatchRequirements = resolveAiDispatchRequirements(input);
  return aiDispatchRequirements.ok
    ? { ok: true as const, value: { chain: chain.value, step: { ...input.step, promptContractId: input.step.promptContractId }, aiDispatchRequirements: aiDispatchRequirements.value } }
    : { ok: false as const, failureReason: aiDispatchRequirements.failureReason };
}

async function executeAiDispatchActionPlan(input: {
  state: MissionState;
  map: OperationalMap;
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
  const executionResult = await executeMuscleMemoryPlan({
    state: { payloadRefs: runtimePayloadRefs },
    map: input.map,
    missionId: input.missionId,
    chain: input.chain,
    sequenceNo: input.sequenceNo + 1,
    idempotencyKey: `${input.idempotencyKey}:muscle-memory`,
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
      muscleMemoryExecuted: true,
      actionExecutionCount: executionResult.actionResults.length,
    },
  };
}

async function dispatchAiStep(input: {
  state: MissionState;
  map: OperationalMap;
  step: AiStep;
  capabilityCallId: string;
  sequenceNo: number;
  idempotencyKey: string;
  context: Pick<OrchestrationRuntimeContext, "nerveBus">;
  missionId: string;
}): Promise<StepDispatchResult> {
  const prepared = prepareAiDispatch(input);
  if (!prepared.ok) {
    return { dispatched: false, failureReason: prepared.failureReason };
  }
  const timeoutMs = resolveStepTimeoutMs(input.step);

  const timeoutResult = await dispatchWithTimeout(
    async (signal) => input.context.nerveBus.sendRequestToAi({
      ...buildAiDispatchRequest({ ...input, ...prepared.value }),
      signal,
    }),
    timeoutMs,
  );
  if (timeoutResult.timedOut) {
    return { dispatched: false, failureReason: `AI dispatch timed out after ${timeoutMs}ms for step "${input.step.stepId}".` };
  }

  const dispatchResult = timeoutResult.result;
  if (dispatchResult.actionPlan !== null) {
    const executedDispatchResult = await executeAiDispatchActionPlan({
      state: input.state,
      map: input.map,
      step: input.step,
      missionId: input.missionId,
      sequenceNo: input.sequenceNo,
      idempotencyKey: input.idempotencyKey,
      chain: prepared.value.chain,
      dispatchResult,
      context: input.context,
    });
    return buildAiStepResult({
      state: {
        ...input.state,
        payloadRefs: executedDispatchResult.payloadRefs,
      },
      map: input.map,
      step: input.step,
      missionId: input.missionId,
      dispatchResult: executedDispatchResult,
    });
  }

  return buildAiStepResult({ state: input.state, map: input.map, step: input.step, missionId: input.missionId, dispatchResult });
}

async function dispatchOperationalStepCore(input: {
  state: MissionState;
  map: OperationalMap;
  step: OperationalStep;
  reason: string | undefined;
  capabilityCallId: string;
  sequenceNo: number;
  idempotencyKey: string;
  context: Pick<OrchestrationRuntimeContext, "nerveBus">;
  missionId: string;
}): Promise<StepDispatchResult> {
  if (input.step.stepKind === "finalize") {
    return buildFinalizeStepResult({ map: input.map, missionId: input.missionId, step: input.step as FinalizeStep });
  }

  if (input.step.stepKind === "ai") {
    return dispatchAiStep({
      state: input.state,
      map: input.map,
      step: input.step as AiStep,
      capabilityCallId: input.capabilityCallId,
      sequenceNo: input.sequenceNo,
      idempotencyKey: input.idempotencyKey,
      context: input.context,
      missionId: input.missionId,
    });
  }

  return dispatchAbilityStep({
    state: input.state,
    map: input.map,
    step: input.step as AbilityStep,
    sequenceNo: input.sequenceNo,
    idempotencyKey: input.idempotencyKey,
    context: input.context,
    missionId: input.missionId,
  });
}

export async function dispatchOperationalStep(input: {
  state: MissionState;
  map: OperationalMap;
  stepId: string;
  reason?: string;
  capabilityCallId: string;
  sequenceNo: number;
  idempotencyKey: string;
  context: Pick<OrchestrationRuntimeContext, "nerveBus">;
}): Promise<StepDispatchResult> {
  const step = findEffectiveOperationalStep(input.map, input.stepId);
  if (!step) {
    return {
      dispatched: false,
      failureReason: `Map "${input.map.mapId}" is missing step "${input.stepId}".`,
    };
  }

  const missionId = input.state.missionId;
  if (!missionId) {
    return { dispatched: false, failureReason: "Cannot dispatch step: mission has no missionId." };
  }

  return dispatchOperationalStepCore({
    state: input.state,
    map: input.map,
    step,
    reason: input.reason,
    capabilityCallId: input.capabilityCallId,
    sequenceNo: input.sequenceNo,
    idempotencyKey: input.idempotencyKey,
    context: input.context,
    missionId,
  });
}
