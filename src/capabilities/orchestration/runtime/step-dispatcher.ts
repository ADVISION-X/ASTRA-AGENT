import type { z } from "zod";
import type { MissionState, OperationalMap } from "../contract.js";
import { getDefaultMapPluginRegistry } from "../../../map-plugins/registry/map-plugin-registry.js";
import { MissionStepResultSchema } from "../schema.js";
import type { OrchestrationRuntimeContext } from "./orchestration-runtime-context.js";
import { ensurePostActionVerificationDispatchGate } from "./orchestration-post-action-verification.js";
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

type AbilityDispatchInput = {
  state: MissionState;
  map: OperationalMap;
  step: AbilityStep;
  sequenceNo: number;
  idempotencyKey: string;
  context: Pick<OrchestrationRuntimeContext, "nerveBus">;
  missionId: string;
};

type AbilityDispatchTarget = Exclude<AbilityStep["targetAbilityGroupId"], null | "ai">;

type DispatchChain = {
  runId: string;
  sessionId: string;
  roundId: string;
  videoVisitId: string | null;
  mapPackageId: string;
  mapPackageVersion: string;
  selectedMapVersion: string;
  activationId: string;
  activationSnapshotRef: string;
};

const resolveDispatchChain = (state: MissionState, stepId: string): { ok: true; value: DispatchChain } | { ok: false; failureReason: string } => {
  if (!state.activeTaskRunId) {
    return { ok: false, failureReason: `Step "${stepId}" cannot dispatch without activeTaskRunId.` };
  }

  if (!state.missionId || !state.mapPackageId || !state.mapPackageVersion || !state.selectedMapVersion || !state.activationId || !state.activationSnapshotRef) {
    return { ok: false, failureReason: `Step "${stepId}" is missing frozen activation chain fields.` };
  }

  return {
    ok: true,
    value: {
      runId: state.activeTaskRunId,
      sessionId: state.missionId,
      roundId: String(state.currentRoundIndex),
      videoVisitId: null,
      mapPackageId: state.mapPackageId,
      mapPackageVersion: state.mapPackageVersion,
      selectedMapVersion: state.selectedMapVersion,
      activationId: state.activationId,
      activationSnapshotRef: state.activationSnapshotRef,
    },
  };
};

const buildAbilityOutputSchemaRef = (targetAbilityGroupId: string, childCapabilityId: string) => `${targetAbilityGroupId}.${childCapabilityId}.output`;

const resolvePayloadRefValue = (
  payloadRefs: MissionState["payloadRefs"],
  key: string,
): string | null => {
  const payloadKey = key as keyof MissionState["payloadRefs"];
  const value = payloadRefs[payloadKey];
  return typeof value === "string" && value.length > 0 ? value : null;
};

const resolveAiDispatchRequirements = (input: {
  state: MissionState;
  map: OperationalMap;
  step: AiStep;
}): { ok: true; value: { promptContractVersion: string; outputSchemaRef: string; aiInputRefs: string[]; providerPolicyRef: string } } | { ok: false; failureReason: string } => {
  const registration = getDefaultMapPluginRegistry().active.getRegistration(input.map.mapId);
  if (!registration) {
    return { ok: false, failureReason: `AI step "${input.step.stepId}" has no active map registration.` };
  }

  const binding = registration.mapPackage.promptBindings.bindings.find((candidate) => candidate.stepId === input.step.stepId);
  if (!binding) {
    return { ok: false, failureReason: `AI step "${input.step.stepId}" is missing governed prompt binding.` };
  }

  if (!input.state.promptContractVersion) {
    return { ok: false, failureReason: `AI step "${input.step.stepId}" is missing promptContractVersion.` };
  }

  const aiInputRefs = binding.requiredInputRefs.map((key) => resolvePayloadRefValue(input.state.payloadRefs, key));
  if (aiInputRefs.some((value) => value === null)) {
    return { ok: false, failureReason: `AI step "${input.step.stepId}" is missing required aiInputRefs from payloadRefs.` };
  }

  return {
    ok: true,
    value: {
      promptContractVersion: input.state.promptContractVersion,
      outputSchemaRef: binding.outputSchemaRef,
      aiInputRefs: aiInputRefs as string[],
      providerPolicyRef: `orchestration:${input.step.stepId}:provider-policy`,
    },
  };
};

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
    async (_signal) => input.context.nerveBus.sendReviewRequestToCommander({
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

  const chain = resolveDispatchChain(input.state, input.step.stepId);
  if (!chain.ok) {
    return { dispatched: false, failureReason: chain.failureReason };
  }

  const aiDispatchRequirements = resolveAiDispatchRequirements(input);
  if (!aiDispatchRequirements.ok) {
    return { dispatched: false, failureReason: aiDispatchRequirements.failureReason };
  }

  const timeoutResult = await dispatchWithTimeout(
    async (_signal) => input.context.nerveBus.sendRequestToAi({
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
      promptContractId: input.step.promptContractId!,
      promptContractVersion: aiDispatchRequirements.value.promptContractVersion,
      outputSchemaRef: aiDispatchRequirements.value.outputSchemaRef,
      aiInputRefs: aiDispatchRequirements.value.aiInputRefs,
      providerPolicyRef: aiDispatchRequirements.value.providerPolicyRef,
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

function buildAbilityDispatchResult(input: AbilityDispatchInput, dispatchResult: Awaited<ReturnType<OrchestrationRuntimeContext["nerveBus"]["sendCommandToAbility"]>>): StepDispatchResult {
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
