import type { MissionState, OperationalMap } from "../contract.js";
import { ensurePostActionVerificationDispatchGate } from "./orchestration-post-action-verification.js";
import type { OrchestrationRuntimeContext } from "./orchestration-runtime-context.js";
import { buildAiStepResult } from "./step-dispatch-ai.js";
import { buildAbilityDispatchResult, buildAiDispatchRequest, buildReviewDispatchRequest } from "./step-dispatch-request-builders.js";
import { buildFinalizeStepResult, buildReviewStepResult } from "./step-dispatch-review.js";
import {
  buildAbilityOutputSchemaRef,
  DEFAULT_STEP_TIMEOUT_MS,
  resolveAiDispatchRequirements,
  resolveDispatchChain,
  type AbilityDispatchInput,
  type AbilityDispatchTarget,
  type AbilityStep,
  type AiStep,
  type FinalizeStep,
  type OperationalStep,
  type ReviewStep,
  type StepDispatchResult,
} from "./step-dispatch-shared.js";
import { dispatchWithTimeout } from "./step-dispatch-timeout-gate.js";

function validateAbilityDispatch(input: AbilityDispatchInput): string | null {
  if (!input.step.targetAbilityGroupId || input.step.targetAbilityGroupId === "ai") {
    return `Ability step "${input.step.stepId}" is missing required targetAbilityGroupId.`;
  }

  const postActionVerificationReason = ensurePostActionVerificationDispatchGate(input.map, input.step.stepId);
  return postActionVerificationReason;
}

async function sendAbilityDispatch(input: AbilityDispatchInput, targetAbilityGroupId: AbilityDispatchTarget) {
  const chain = resolveDispatchChain(input.state, input.step.stepId);
  if (!chain.ok) {
    throw new Error(chain.failureReason);
  }

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
      postActionVerificationRequired: input.step.postActionVerification !== null,
      payloadRefs: input.state.payloadRefs,
      sequenceNo: input.sequenceNo,
      idempotencyKey: input.idempotencyKey,
      timeoutMs: DEFAULT_STEP_TIMEOUT_MS,
    }),
    DEFAULT_STEP_TIMEOUT_MS,
  );
}

async function dispatchAbilityStep(input: AbilityDispatchInput): Promise<StepDispatchResult> {
  const failureReason = validateAbilityDispatch(input);
  if (failureReason) {
    return { dispatched: false, failureReason };
  }

  const timeoutResult = await sendAbilityDispatch(input, input.step.targetAbilityGroupId as AbilityDispatchTarget);
  if (timeoutResult.timedOut) {
    return { dispatched: false, failureReason: `Ability dispatch timed out after ${DEFAULT_STEP_TIMEOUT_MS}ms for step "${input.step.stepId}".` };
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

async function dispatchAiStep(input: {
  state: MissionState;
  map: OperationalMap;
  step: AiStep;
  sequenceNo: number;
  idempotencyKey: string;
  context: Pick<OrchestrationRuntimeContext, "nerveBus">;
  missionId: string;
}): Promise<StepDispatchResult> {
  const prepared = prepareAiDispatch(input);
  if (!prepared.ok) {
    return { dispatched: false, failureReason: prepared.failureReason };
  }

  const timeoutResult = await dispatchWithTimeout(
    async (_signal) => input.context.nerveBus.sendRequestToAi(buildAiDispatchRequest({ ...input, ...prepared.value })),
    DEFAULT_STEP_TIMEOUT_MS,
  );
  return timeoutResult.timedOut
    ? { dispatched: false, failureReason: `AI dispatch timed out after ${DEFAULT_STEP_TIMEOUT_MS}ms for step "${input.step.stepId}".` }
    : buildAiStepResult({ state: input.state, map: input.map, step: input.step, missionId: input.missionId, dispatchResult: timeoutResult.result });
}

async function dispatchReviewStep(input: {
  state: MissionState;
  map: OperationalMap;
  step: ReviewStep;
  reason: string | undefined;
  sequenceNo: number;
  idempotencyKey: string;
  context: Pick<OrchestrationRuntimeContext, "nerveBus">;
  missionId: string;
}): Promise<StepDispatchResult> {
  const chain = resolveDispatchChain(input.state, input.step.stepId);
  if (!chain.ok) {
    return { dispatched: false, failureReason: chain.failureReason };
  }

  const timeoutResult = await dispatchWithTimeout(
    async (_signal) => input.context.nerveBus.sendReviewRequestToCommander(buildReviewDispatchRequest({ ...input, chain: chain.value })),
    DEFAULT_STEP_TIMEOUT_MS,
  );
  return timeoutResult.timedOut
    ? { dispatched: false, failureReason: `Review dispatch timed out after ${DEFAULT_STEP_TIMEOUT_MS}ms for step "${input.step.stepId}".` }
    : buildReviewStepResult({ map: input.map, missionId: input.missionId, step: input.step, reason: input.reason, reviewResult: timeoutResult.result });
}

async function dispatchOperationalStepCore(input: {
  state: MissionState;
  map: OperationalMap;
  step: OperationalStep;
  reason: string | undefined;
  sequenceNo: number;
  idempotencyKey: string;
  context: Pick<OrchestrationRuntimeContext, "nerveBus">;
  missionId: string;
}): Promise<StepDispatchResult> {
  if (input.step.stepKind === "review") {
    return dispatchReviewStep({
      state: input.state,
      map: input.map,
      step: input.step as ReviewStep,
      reason: input.reason,
      sequenceNo: input.sequenceNo,
      idempotencyKey: input.idempotencyKey,
      context: input.context,
      missionId: input.missionId,
    });
  }

  if (input.step.stepKind === "finalize") {
    return buildFinalizeStepResult({ map: input.map, missionId: input.missionId, step: input.step as FinalizeStep });
  }

  if (input.step.stepKind === "ai") {
    return dispatchAiStep({
      state: input.state,
      map: input.map,
      step: input.step as AiStep,
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
  sequenceNo: number;
  idempotencyKey: string;
  context: Pick<OrchestrationRuntimeContext, "nerveBus">;
}): Promise<StepDispatchResult> {
  const step = input.map.steps.find((candidate) => candidate.stepId === input.stepId);
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
    sequenceNo: input.sequenceNo,
    idempotencyKey: input.idempotencyKey,
    context: input.context,
    missionId,
  });
}
