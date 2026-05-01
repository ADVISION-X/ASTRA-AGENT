import type { z } from "zod";
import type { MissionState, OperationalMap } from "../contract.js";
import { MissionStepResultSchema } from "../schema.js";
import type { OrchestrationRuntimeContext } from "./orchestration-runtime-context.js";
import { dispatchWithTimeout } from "./step-dispatch-timeout-gate.js";

const DEFAULT_STEP_TIMEOUT_MS = 30_000;

type StepDispatchResult =
  | { dispatched: true; stepResult: z.output<typeof MissionStepResultSchema> }
  | { dispatched: false; failureReason: string };

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

  const stepTimeoutMs = DEFAULT_STEP_TIMEOUT_MS;

  if (step.stepKind === "review") {
    const timeoutResult = await dispatchWithTimeout(
      async (_signal) => {
        return input.context.nerveBus.sendReviewRequestToCommander({
          missionId,
          mapId: input.map.mapId,
          stepId: step.stepId,
          reason: input.reason ?? input.state.reviewRequiredReason ?? "orchestration requires human review",
          payloadRefs: input.state.payloadRefs,
          sequenceNo: input.sequenceNo,
          idempotencyKey: input.idempotencyKey,
        });
      },
      stepTimeoutMs,
    );

    if (timeoutResult.timedOut) {
      return { dispatched: false, failureReason: `Review dispatch timed out after ${stepTimeoutMs}ms for step "${step.stepId}".` };
    }

    const reviewResult = timeoutResult.result;
    return {
      dispatched: true,
      stepResult: MissionStepResultSchema.parse({
        status: "review_required",
        missionId,
        mapId: input.map.mapId,
        stepId: step.stepId,
        childCapabilityId: step.childCapabilityId,
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

  if (step.stepKind === "finalize") {
    return {
      dispatched: true,
      stepResult: MissionStepResultSchema.parse({
        status: "success",
        missionId,
        mapId: input.map.mapId,
        stepId: step.stepId,
        childCapabilityId: step.childCapabilityId,
        targetAbilityGroupId: null,
        payloadRefs: input.state.payloadRefs,
      }),
    };
  }

  if (step.stepKind === "ai") {
    if (!step.promptContractId) {
      return {
        dispatched: false,
        failureReason: `AI step "${step.stepId}" is missing required promptContractId.`,
      };
    }
    const timeoutResult = await dispatchWithTimeout(
      async (_signal) =>
        input.context.nerveBus.sendRequestToAi({
          missionId,
          mapId: input.map.mapId,
          stepId: step.stepId,
          promptContractId: step.promptContractId!,
          payloadRefs: input.state.payloadRefs,
          sequenceNo: input.sequenceNo,
          idempotencyKey: input.idempotencyKey,
          timeoutMs: stepTimeoutMs,
        }),
      stepTimeoutMs,
    );

    if (timeoutResult.timedOut) {
      return { dispatched: false, failureReason: `AI dispatch timed out after ${stepTimeoutMs}ms for step "${step.stepId}".` };
    }

    const dispatchResult = timeoutResult.result;
    return {
      dispatched: true,
      stepResult: MissionStepResultSchema.parse({
        status: dispatchResult.status,
        missionId,
        mapId: input.map.mapId,
        stepId: step.stepId,
        childCapabilityId: step.childCapabilityId,
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

  // ability step
  if (!step.targetAbilityGroupId) {
    return {
      dispatched: false,
      failureReason: `Ability step "${step.stepId}" is missing required targetAbilityGroupId.`,
    };
  }

  const timeoutResult = await dispatchWithTimeout(
    async (_signal) =>
      input.context.nerveBus.sendCommandToAbility({
        missionId,
        mapId: input.map.mapId,
        stepId: step.stepId,
        targetAbilityGroupId: step.targetAbilityGroupId as Exclude<typeof step.targetAbilityGroupId, "ai" | null | undefined>,
        childCapabilityId: step.childCapabilityId,
        payloadRefs: input.state.payloadRefs,
        sequenceNo: input.sequenceNo,
        idempotencyKey: input.idempotencyKey,
        timeoutMs: stepTimeoutMs,
      }),
    stepTimeoutMs,
  );

  if (timeoutResult.timedOut) {
    return { dispatched: false, failureReason: `Ability dispatch timed out after ${stepTimeoutMs}ms for step "${step.stepId}".` };
  }

  const dispatchResult = timeoutResult.result;
  return {
    dispatched: true,
    stepResult: MissionStepResultSchema.parse({
      status: dispatchResult.status,
      missionId,
      mapId: input.map.mapId,
      stepId: step.stepId,
      childCapabilityId: step.childCapabilityId,
      targetAbilityGroupId: step.targetAbilityGroupId,
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
