import type { z } from "zod";

import type { MissionState, OperationalMap } from "../contract.js";
import { MissionStepResultSchema } from "../schema.js";
import type { OrchestrationRuntimeContext } from "./orchestration-runtime-context.js";
import { findAiPromptContractCatalogEntry } from "../../ai/index.js";
import { getDefaultMapPluginRegistry } from "./orchestration-map-id-list.js";

const DEFAULT_STEP_TIMEOUT_MS = 30_000;

type OperationalStep = OperationalMap["steps"][number];
type ReviewStep = OperationalStep & { stepKind: "review" };
type FinalizeStep = OperationalStep & { stepKind: "finalize" };
type AiStep = OperationalStep & { stepKind: "ai" };
type AbilityStep = OperationalStep & { stepKind: "ability" };

const applyStepOutputRefPolicy = (
  step: OperationalStep,
  payloadRefs: z.output<typeof MissionStepResultSchema>["payloadRefs"],
  outputRef: string | null,
): z.output<typeof MissionStepResultSchema>["payloadRefs"] => {
  if (!outputRef || step.outputRefPolicy.storeAs.length === 0) {
    return payloadRefs;
  }

  const nextPayloadRefs = { ...payloadRefs };
  for (const key of step.outputRefPolicy.storeAs) {
    if (key === "requestedPlatformId") {
      continue;
    }
    nextPayloadRefs[key] = outputRef;
  }
  return nextPayloadRefs;
};

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

type AiDispatchRequirements = {
  taskType: string;
  promptContractVersion: string;
  outputSchemaRef: string;
  aiInputRefs: string[];
  providerPolicyRef: string;
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
      videoVisitId: `${state.missionId}:video-visit:${state.currentRoundIndex}`,
      mapPackageId: state.mapPackageId,
      mapPackageVersion: state.mapPackageVersion,
      selectedMapVersion: state.selectedMapVersion,
      activationId: state.activationId,
      activationSnapshotRef: state.activationSnapshotRef,
    },
  };
};

const buildAbilityOutputSchemaRef = (targetAbilityGroupId: string, childCapabilityId: string) => `${targetAbilityGroupId}.${childCapabilityId}.output`;

const resolvePayloadRefValue = (payloadRefs: MissionState["payloadRefs"], key: string): string | null => {
  const payloadKey = key as keyof MissionState["payloadRefs"];
  const value = payloadRefs[payloadKey];
  return typeof value === "string" && value.length > 0 ? value : null;
};

const buildBranchFieldValues = (input: {
  decision: string | null;
  branchFieldValues: z.output<typeof MissionStepResultSchema>["branchFieldValues"];
}): z.output<typeof MissionStepResultSchema>["branchFieldValues"] => {
  if (input.decision === null) {
    return input.branchFieldValues;
  }

  return {
    ...input.branchFieldValues,
    decision: input.decision,
  };
};

const resolvePromptContractForAiStep = (step: AiStep) => {
  if (!step.promptContractId) {
    return { ok: false as const, failureReason: `AI step "${step.stepId}" is missing promptContractId.` };
  }
  const promptContract = findAiPromptContractCatalogEntry(step.promptContractId);
  return promptContract
    ? { ok: true as const, promptContract }
    : { ok: false as const, failureReason: `AI step "${step.stepId}" prompt_contract_resolution_failed for ${step.promptContractId}.` };
};

const resolveAiPromptBinding = (input: {
  registration: NonNullable<ReturnType<ReturnType<typeof getDefaultMapPluginRegistry>["active"]["getRegistration"]>>;
  step: AiStep;
  outputSchemaRef: string;
}) => {
  const binding = input.registration.mapPackage.promptBindings.bindings.find((candidate) => candidate.stepId === input.step.stepId);
  if (!binding) {
    return { ok: false as const, failureReason: `AI step "${input.step.stepId}" is missing governed prompt binding.` };
  }
  return binding.outputSchemaRef === input.outputSchemaRef
    ? { ok: true as const, binding }
    : { ok: false as const, failureReason: `AI step "${input.step.stepId}" prompt contract output schema mismatch.` };
};

const resolveRequiredAiInputRefs = (input: {
  state: MissionState;
  step: AiStep;
  requiredInputRefs: string[];
}) => {
  const aiInputRefs = input.requiredInputRefs.map((key) => resolvePayloadRefValue(input.state.payloadRefs, key));
  return aiInputRefs.some((value) => value === null)
    ? { ok: false as const, failureReason: `AI step "${input.step.stepId}" is missing required aiInputRefs from payloadRefs.` }
    : { ok: true as const, aiInputRefs: aiInputRefs as string[] };
};

const buildAiDispatchRequirements = (input: {
  taskType: string;
  promptContractVersion: string;
  outputSchemaRef: string;
  aiInputRefs: string[];
  stepId: string;
}): { ok: true; value: AiDispatchRequirements } => ({
  ok: true,
  value: {
    taskType: input.taskType,
    promptContractVersion: input.promptContractVersion,
    outputSchemaRef: input.outputSchemaRef,
    aiInputRefs: input.aiInputRefs,
    providerPolicyRef: `orchestration:${input.stepId}:provider-policy`,
  },
});

const PRODUCTION_STEP_TIMEOUT_MS_BY_KIND = {
  ability: 30_000,
  ai: 120_000,
  review: 1_000,
  finalize: 10_000,
} as const;

const PRODUCTION_STEP_TIMEOUT_MS_BY_ABILITY: Partial<Record<Exclude<OperationalStep["targetAbilityGroupId"], null>, number>> = {
  ai: PRODUCTION_STEP_TIMEOUT_MS_BY_KIND.ai,
  open: 30_000,
  screenshot: 20_000,
  "visual-target": 15_000,
  "geometry-guard": 10_000,
  "mouse-click": 15_000,
  "mouse-scroll": 30_000,
  "text-input": 20_000,
  "post-action-verification": 20_000,
  "page-state": 10_000,
  "forensics-persistence": 10_000,
} as const;

const resolveStepTimeoutMs = (step: OperationalStep): number => {
  if (step.stepKind === "ai") {
    return PRODUCTION_STEP_TIMEOUT_MS_BY_KIND.ai;
  }
  if (step.stepKind === "review") {
    return PRODUCTION_STEP_TIMEOUT_MS_BY_KIND.review;
  }
  if (step.stepKind === "finalize") {
    return PRODUCTION_STEP_TIMEOUT_MS_BY_KIND.finalize;
  }
  return step.targetAbilityGroupId
    ? PRODUCTION_STEP_TIMEOUT_MS_BY_ABILITY[step.targetAbilityGroupId] ?? DEFAULT_STEP_TIMEOUT_MS
    : DEFAULT_STEP_TIMEOUT_MS;
};

const resolveAiStepContractBinding = (input: { map: OperationalMap; step: AiStep }) => {
  const registration = getDefaultMapPluginRegistry().active.getRegistration(input.map.mapId);
  if (!registration) {
    return { ok: false as const, failureReason: `AI step "${input.step.stepId}" has no active map registration.` };
  }
  const promptContractResult = resolvePromptContractForAiStep(input.step);
  if (!promptContractResult.ok) {
    return promptContractResult;
  }
  const bindingResult = resolveAiPromptBinding({
    registration,
    step: input.step,
    outputSchemaRef: promptContractResult.promptContract.outputSchemaRef,
  });
  return bindingResult.ok
    ? { ok: true as const, promptContract: promptContractResult.promptContract, binding: bindingResult.binding }
    : bindingResult;
};

const resolveAiDispatchRequirements = (input: {
  state: MissionState;
  map: OperationalMap;
  step: AiStep;
}): { ok: true; value: AiDispatchRequirements } | { ok: false; failureReason: string } => {
  const contractBinding = resolveAiStepContractBinding({ map: input.map, step: input.step });
  if (!contractBinding.ok) {
    return contractBinding;
  }
  if (!input.state.promptContractVersion) {
    return { ok: false, failureReason: `AI step "${input.step.stepId}" is missing promptContractVersion.` };
  }
  const aiInputRefsResult = resolveRequiredAiInputRefs({
    state: input.state,
    step: input.step,
    requiredInputRefs: contractBinding.binding.requiredInputRefs,
  });
  if (!aiInputRefsResult.ok) {
    return aiInputRefsResult;
  }

  return buildAiDispatchRequirements({
    taskType: contractBinding.promptContract.taskType,
    promptContractVersion: input.state.promptContractVersion,
    outputSchemaRef: contractBinding.binding.outputSchemaRef,
    aiInputRefs: aiInputRefsResult.aiInputRefs,
    stepId: input.step.stepId,
  });
};

export {
  applyStepOutputRefPolicy,
  DEFAULT_STEP_TIMEOUT_MS,
  buildAbilityOutputSchemaRef,
  buildBranchFieldValues,
  resolveAiDispatchRequirements,
  resolveDispatchChain,
  resolveStepTimeoutMs,
};

export type {
  AbilityDispatchInput,
  AbilityDispatchTarget,
  AbilityStep,
  AiStep,
  DispatchChain,
  FinalizeStep,
  OperationalStep,
  ReviewStep,
  StepDispatchResult,
};
