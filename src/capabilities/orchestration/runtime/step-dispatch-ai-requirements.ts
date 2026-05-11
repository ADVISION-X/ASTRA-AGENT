import type { MissionState, RuntimePlan } from "../contract.js";
import { findAiPromptContractCatalogEntry } from "../../ai/index.js";
import type { AiStep } from "./step-dispatch-shared.js";
import { resolveAiDispatchPayloadRefValue } from "./visual-mission-ai-dispatch-context.js";

type AiDispatchRequirements = {
  taskType: string;
  promptContractVersion: string;
  outputSchemaRef: string;
  aiInputRefs: string[];
  providerPolicyRef: string;
  promptContract: NonNullable<ReturnType<typeof findAiPromptContractCatalogEntry>>;
};

const buildAiInputRefsForStep = (input: {
  state: MissionState;
  step: AiStep;
  aiInputRefs: string[];
}) => Array.from(new Set(input.aiInputRefs));

const normalizeRequiredInputRefs = (inputRefs: string[]) => Array.from(new Set(inputRefs));

const doRequiredInputRefsMatch = (left: string[], right: string[]) => {
  const normalizedLeft = normalizeRequiredInputRefs(left);
  const normalizedRight = normalizeRequiredInputRefs(right);
  return normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((value) => normalizedRight.includes(value));
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
  step: AiStep;
  promptContract: NonNullable<ReturnType<typeof findAiPromptContractCatalogEntry>>;
  outputSchemaRef: string;
}) => {
  if (input.step.inputRefs.length > 0 && !doRequiredInputRefsMatch(input.step.inputRefs, input.promptContract.requiredInputRefs)) {
    return {
      ok: false as const,
      failureReason: `AI step "${input.step.stepId}" inputRefs drift from prompt contract ${input.promptContract.promptContractId}.`,
    };
  }

  return {
    ok: true as const,
    binding: {
      stepId: input.step.stepId,
      promptContractId: input.step.promptContractId,
      requiredInputRefs: input.promptContract.requiredInputRefs,
      outputSchemaRef: input.outputSchemaRef,
    },
  };
};

const resolveRequiredAiInputRefs = (input: {
  state: MissionState;
  step: AiStep;
  promptContract: NonNullable<ReturnType<typeof findAiPromptContractCatalogEntry>>;
  requiredInputRefs: string[];
}) => {
  const aiInputRefs = input.requiredInputRefs.map((key) => resolveAiDispatchPayloadRefValue({
    state: input.state,
    promptContract: input.promptContract,
    key,
  }));
  return aiInputRefs.some((value) => value === null)
    ? { ok: false as const, failureReason: `AI step "${input.step.stepId}" is missing required aiInputRefs from mission state or derived prompt-contract context.` }
    : { ok: true as const, aiInputRefs: buildAiInputRefsForStep({ state: input.state, step: input.step, aiInputRefs: aiInputRefs as string[] }) };
};

const buildAiDispatchRequirements = (input: {
  taskType: string;
  promptContractVersion: string;
  outputSchemaRef: string;
  aiInputRefs: string[];
  stepId: string;
  promptContract: NonNullable<ReturnType<typeof findAiPromptContractCatalogEntry>>;
}): { ok: true; value: AiDispatchRequirements } => ({
  ok: true,
  value: {
    taskType: input.taskType,
    promptContractVersion: input.promptContractVersion,
    outputSchemaRef: input.outputSchemaRef,
    aiInputRefs: input.aiInputRefs,
    providerPolicyRef: `orchestration:${input.stepId}:provider-policy`,
    promptContract: input.promptContract,
  },
});

const resolveAiStepContractBinding = (input: { map: RuntimePlan; step: AiStep }) => {
  const promptContractResult = resolvePromptContractForAiStep(input.step);
  if (!promptContractResult.ok) {
    return promptContractResult;
  }
  const bindingResult = resolveAiPromptBinding({
    step: input.step,
    promptContract: promptContractResult.promptContract,
    outputSchemaRef: promptContractResult.promptContract.outputSchemaRef,
  });
  return bindingResult.ok
    ? { ok: true as const, promptContract: promptContractResult.promptContract, binding: bindingResult.binding }
    : bindingResult;
};

export const resolveAiDispatchRequirements = (input: {
  state: MissionState;
  map: RuntimePlan;
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
    promptContract: contractBinding.promptContract,
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
    promptContract: contractBinding.promptContract,
  });
};

export type { AiDispatchRequirements };