import type { z } from "zod";
import type { MissionState, OperationalMap } from "../contract.js";
import { MissionStepResultSchema } from "../schema.js";
import type { OrchestrationRuntimeContext } from "./orchestration-runtime-context.js";
import { dispatchWithTimeout } from "./step-dispatch-timeout-gate.js";

const DEFAULT_STEP_TIMEOUT_MS = 30_000;

type OperationalStep = OperationalMap["steps"][number];
type ReviewStep = OperationalStep & { stepKind: "review" };
type FinalizeStep = OperationalStep & { stepKind: "finalize" };
type AiStep = OperationalStep & { stepKind: "ai" };
type AbilityStep = OperationalStep & { stepKind: "ability" };

type StepDispatchResult =
  | { dispatched: true; stepResult: z.output<typeof MissionStepResultSchema> }
  | { dispatched: false; failureReason: string };

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
  const timeoutResult = await dispatchWithTimeout(
    async (_signal) => input.context.nerveBus.sendReviewRequestToCommander({
      missionId: input.missionId,
      mapId: input.map.mapId,
      stepId: input.step.stepId,
      reason: input.reason ?? input.state.reviewRequiredReason ?? "orchestration requires human review",
      payloadRefs: input.state.payloadRefs,
      sequenceNo: input.sequenceNo,
      idempotencyKey: input.idempotencyKey,
    }),
    DEFAULT_STEP_TIMEOUT_MS,
  );

  if (timeoutResult.timedOut) {
    return { dispatched: false, failureReason: `Review dispatch timed out after ${DEFAULT_STEP_TIMEOUT_MS}ms for step "${input.step.stepId}".` };
  }

  const reviewResult = timeoutResult.result;
  return {
    dispatched: true,
    stepResult: MissionStepResultSchema.parse({
      status: "review_required",
      missionId: input.missionId,
      mapId: input.map.mapId,
      stepId: input.step.stepId,
      childCapabilityId: input.step.childCapabilityId,
      targetAbilityGroupId: null,
      envelopeId: reviewResult.reviewDispatchRef,
      resultRef: reviewResult.reviewDispatchRef,
      outputRef: reviewResult.payloadRefs.reviewReasonRef ?? null,
      decision: null,
      failureReason: reviewResult.failureReason,
      reviewRequiredReason: input.reason ?? reviewResult.failureReason,
      payloadRefs: reviewResult.payloadRefs,
    }),
  };
}

function buildFinalizeStepResult(input: {
  map: OperationalMap;
  missionId: string;
  step: FinalizeStep;
}): StepDispatchResult {
  return {
    dispatched: true,
    stepResult: MissionStepResultSchema.parse({
      status: "success",
      missionId: input.missionId,
      mapId: input.map.mapId,
      stepId: input.step.stepId,
      childCapabilityId: input.step.childCapabilityId,
      targetAbilityGroupId: null,
      payloadRefs: {},
    }),
  };
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
  if (!input.step.promptContractId) {
    return { dispatched: false, failureReason: `AI step "${input.step.stepId}" is missing required promptContractId.` };
  }

  const timeoutResult = await dispatchWithTimeout(
    async (_signal) => input.context.nerveBus.sendRequestToAi({
      missionId: input.missionId,
      mapId: input.map.mapId,
      stepId: input.step.stepId,
      promptContractId: input.step.promptContractId!,
      payloadRefs: input.state.payloadRefs,
      sequenceNo: input.sequenceNo,
      idempotencyKey: input.idempotencyKey,
      timeoutMs: DEFAULT_STEP_TIMEOUT_MS,
    }),
    DEFAULT_STEP_TIMEOUT_MS,
  );

  if (timeoutResult.timedOut) {
    return { dispatched: false, failureReason: `AI dispatch timed out after ${DEFAULT_STEP_TIMEOUT_MS}ms for step "${input.step.stepId}".` };
  }

  const dispatchResult = timeoutResult.result;
  return {
    dispatched: true,
    stepResult: MissionStepResultSchema.parse({
      status: dispatchResult.status,
      missionId: input.missionId,
      mapId: input.map.mapId,
      stepId: input.step.stepId,
      childCapabilityId: input.step.childCapabilityId,
      targetAbilityGroupId: null,
      envelopeId: dispatchResult.envelopeId,
      resultRef: dispatchResult.resultRef,
      outputRef: dispatchResult.payloadRefs.aiResultRef ?? null,
      decision: dispatchResult.decision,
      failureReason: dispatchResult.failureReason,
      reviewRequiredReason: dispatchResult.status === "review_required" ? (dispatchResult.failureReason ?? "review required") : null,
      payloadRefs: { ...input.state.payloadRefs, ...dispatchResult.payloadRefs },
    }),
  };
}

async function dispatchAbilityStep(input: {
  state: MissionState;
  map: OperationalMap;
  step: AbilityStep;
  sequenceNo: number;
  idempotencyKey: string;
  context: Pick<OrchestrationRuntimeContext, "nerveBus">;
  missionId: string;
}): Promise<StepDispatchResult> {
  const targetAbilityGroupId = input.step.targetAbilityGroupId;
  if (!targetAbilityGroupId || targetAbilityGroupId === "ai") {
    return { dispatched: false, failureReason: `Ability step "${input.step.stepId}" is missing required targetAbilityGroupId.` };
  }

  const timeoutResult = await dispatchWithTimeout(
    async (_signal) => input.context.nerveBus.sendCommandToAbility({
      missionId: input.missionId,
      mapId: input.map.mapId,
      stepId: input.step.stepId,
      targetAbilityGroupId,
      childCapabilityId: input.step.childCapabilityId,
      payloadRefs: input.state.payloadRefs,
      sequenceNo: input.sequenceNo,
      idempotencyKey: input.idempotencyKey,
      timeoutMs: DEFAULT_STEP_TIMEOUT_MS,
    }),
    DEFAULT_STEP_TIMEOUT_MS,
  );

  if (timeoutResult.timedOut) {
    return { dispatched: false, failureReason: `Ability dispatch timed out after ${DEFAULT_STEP_TIMEOUT_MS}ms for step "${input.step.stepId}".` };
  }

  const dispatchResult = timeoutResult.result;
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
      outputRef: dispatchResult.payloadRefs.abilityResultRef ?? null,
      decision: dispatchResult.decision,
      failureReason: dispatchResult.failureReason,
      reviewRequiredReason: dispatchResult.status === "review_required" ? (dispatchResult.failureReason ?? "review required") : null,
      payloadRefs: { ...input.state.payloadRefs, ...dispatchResult.payloadRefs },
    }),
  };
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
    return dispatchReviewStep({ state: input.state, map: input.map, step: input.step as ReviewStep, reason: input.reason, sequenceNo: input.sequenceNo, idempotencyKey: input.idempotencyKey, context: input.context, missionId: input.missionId });
  }

  if (input.step.stepKind === "finalize") {
    return buildFinalizeStepResult({ map: input.map, missionId: input.missionId, step: input.step as FinalizeStep });
  }

  if (input.step.stepKind === "ai") {
    return dispatchAiStep({ state: input.state, map: input.map, step: input.step as AiStep, sequenceNo: input.sequenceNo, idempotencyKey: input.idempotencyKey, context: input.context, missionId: input.missionId });
  }

  return dispatchAbilityStep({ state: input.state, map: input.map, step: input.step as AbilityStep, sequenceNo: input.sequenceNo, idempotencyKey: input.idempotencyKey, context: input.context, missionId: input.missionId });
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

  return dispatchOperationalStepCore({ state: input.state, map: input.map, step, reason: input.reason, sequenceNo: input.sequenceNo, idempotencyKey: input.idempotencyKey, context: input.context, missionId });
}
