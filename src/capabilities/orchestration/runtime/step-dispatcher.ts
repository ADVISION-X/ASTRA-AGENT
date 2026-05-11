import type { MissionState, RuntimePlan as RuntimePlan } from "../contract.js";
import type { OrchestrationRuntimeContext } from "./orchestration-runtime-context.js";
import { buildAiStepResult, executeAiDispatchActionPlan } from "./step-dispatch-ai.js";
import { findEffectiveOperationalStep } from "./route-plan-resolver.js";
import { buildAbilityDispatchResult, buildAiDispatchRequest } from "./step-dispatch-request-builders.js";
import { buildFinalizeStepResult } from "./step-dispatch-review.js";
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
  map: RuntimePlan;
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

async function dispatchAiStep(input: {
  state: MissionState;
  map: RuntimePlan;
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
  map: RuntimePlan;
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
  map: RuntimePlan;
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
