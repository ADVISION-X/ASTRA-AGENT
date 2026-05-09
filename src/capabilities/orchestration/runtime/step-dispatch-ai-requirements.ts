import type { MissionState, OperationalMap } from "../contract.js";
import { findAiPromptContractCatalogEntry } from "../../ai/index.js";
import { getDefaultMapPluginRegistry } from "./orchestration-map-id-list.js";
import type { AiStep } from "./step-dispatch-shared.js";

type AiDispatchRequirements = {
  taskType: string;
  promptContractVersion: string;
  outputSchemaRef: string;
  aiInputRefs: string[];
  providerPolicyRef: string;
};

const resolvePayloadRefValue = (payloadRefs: MissionState["payloadRefs"], key: string): string | null => {
  const payloadKey = key as keyof MissionState["payloadRefs"];
  const value = payloadRefs[payloadKey];
  return typeof value === "string" && value.length > 0 ? value : null;
};

const buildAiInputRefsForStep = (input: {
  state: MissionState;
  step: AiStep;
  aiInputRefs: string[];
}) => {
  if (input.step.promptContractId !== "vision.nextItemAdvanced.v1") {
    return Array.from(new Set(input.aiInputRefs));
  }

  const previousPromptInputRef = resolvePayloadRefValue(input.state.payloadRefs, "previousPromptInputRef");
  const nextItemVerificationPromptInputRef = resolvePayloadRefValue(input.state.payloadRefs, "nextItemVerificationPromptInputRef");

  return Array.from(new Set([
    previousPromptInputRef,
    nextItemVerificationPromptInputRef,
    ...input.aiInputRefs,
  ].filter((value): value is string => typeof value === "string" && value.length > 0)));
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
    return {
      ok: true as const,
      binding: {
        stepId: input.step.stepId,
        promptContractId: input.step.promptContractId,
        requiredInputRefs: input.step.inputRefs,
        outputSchemaRef: input.outputSchemaRef,
      },
    };
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
    : { ok: true as const, aiInputRefs: buildAiInputRefsForStep({ state: input.state, step: input.step, aiInputRefs: aiInputRefs as string[] }) };
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

export const resolveAiDispatchRequirements = (input: {
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

export type { AiDispatchRequirements };