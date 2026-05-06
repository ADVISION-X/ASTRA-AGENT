import type { MapPackageValidationIssue } from "../shared/map-package-failure.js";
import type { MapPackage } from "../shared/map-package-types.js";
import {
  getExpectedPromptTaskType,
  getPromptContractCatalogEntry,
  type PromptContractCatalogEntry,
} from "./prompt-contract-catalog-port.js";
import { validateAllowedBranchFields } from "./prompt-contract-branch-field-validator.js";

type PromptBinding = MapPackage["promptBindings"]["bindings"][number];
type MapStep = MapPackage["operationalMap"]["steps"][number];
type Transition = MapPackage["operationalMap"]["transitions"][number];

type PromptStepValidationInput = {
  step: MapStep;
  binding: PromptBinding | undefined;
  producedRefs: Set<string>;
  transitions: Transition[];
};

export type ResolvedPromptStepState = {
  step: MapStep;
  binding: PromptBinding;
  promptContract: PromptContractCatalogEntry;
  expectedTaskType: string;
  producedRefs: Set<string>;
  transitions: Transition[];
};

const createIssue = (input: {
  code: MapPackageValidationIssue["code"];
  message: string;
  path: string;
  severity: MapPackageValidationIssue["severity"];
}): MapPackageValidationIssue => ({
  code: input.code,
  message: input.message,
  path: input.path,
  severity: input.severity,
});

const resolvePromptBinding = (input: PromptStepValidationInput): {
  issues: MapPackageValidationIssue[];
  binding: PromptBinding | null;
} => {
  if (input.binding && input.binding.promptContractId === input.step.promptContractId) {
    return { issues: [], binding: input.binding };
  }

  return {
    issues: [createIssue({
      code: "missing_prompt_contract",
      message: `AI step ${input.step.stepId} is missing a matching prompt binding.`,
      path: `operationalMap.steps.${input.step.stepId}`,
      severity: "error",
    })],
    binding: null,
  };
};

const resolvePromptContract = (step: MapStep, binding: PromptBinding): {
  issues: MapPackageValidationIssue[];
  promptContract: PromptContractCatalogEntry | null;
} => {
  const promptContract = getPromptContractCatalogEntry(binding.promptContractId);
  if (promptContract !== null) {
    return { issues: [], promptContract };
  }

  return {
    issues: [createIssue({
      code: "missing_prompt_contract",
      message: `AI step ${step.stepId} references unknown prompt contract ${binding.promptContractId}.`,
      path: `promptBindings.bindings.${step.stepId}`,
      severity: "fatal",
    })],
    promptContract: null,
  };
};

const resolveExpectedTaskType = (step: MapStep): {
  issues: MapPackageValidationIssue[];
  expectedTaskType: string | null;
} => {
  const expectedTaskType = getExpectedPromptTaskType(step.childCapabilityId);
  if (expectedTaskType) {
    return { issues: [], expectedTaskType };
  }

  return {
    issues: [createIssue({
      code: "map_validation_failed",
      message: `AI step ${step.stepId} uses unsupported childCapabilityId ${step.childCapabilityId}.`,
      path: `operationalMap.steps.${step.stepId}`,
      severity: "fatal",
    })],
    expectedTaskType: null,
  };
};

const resolvePromptStepState = (input: PromptStepValidationInput): {
  issues: MapPackageValidationIssue[];
  state: ResolvedPromptStepState | null;
} => {
  const bindingResult = resolvePromptBinding(input);
  if (!bindingResult.binding) {
    return { issues: bindingResult.issues, state: null };
  }

  const promptContractResult = resolvePromptContract(input.step, bindingResult.binding);
  if (!promptContractResult.promptContract) {
    return { issues: promptContractResult.issues, state: null };
  }

  const taskTypeResult = resolveExpectedTaskType(input.step);
  if (!taskTypeResult.expectedTaskType) {
    return { issues: taskTypeResult.issues, state: null };
  }

  return {
    issues: [],
    state: {
      step: input.step,
      binding: bindingResult.binding,
      promptContract: promptContractResult.promptContract,
      expectedTaskType: taskTypeResult.expectedTaskType,
      producedRefs: input.producedRefs,
      transitions: input.transitions,
    },
  };
};

const validateTaskType = (state: ResolvedPromptStepState): MapPackageValidationIssue[] =>
  state.promptContract.taskType === state.expectedTaskType
    ? []
    : [createIssue({
      code: "missing_prompt_contract",
      message: `AI step ${state.step.stepId} expects taskType ${state.expectedTaskType}, but prompt contract ${state.promptContract.promptContractId} declares ${state.promptContract.taskType}.`,
      path: `promptBindings.bindings.${state.step.stepId}`,
      severity: "fatal",
    })];

const validateOutputSchema = (state: ResolvedPromptStepState): MapPackageValidationIssue[] =>
  state.binding.outputSchemaRef === state.promptContract.outputSchemaRef
    ? []
    : [createIssue({
      code: "map_validation_failed",
      message: `AI step ${state.step.stepId} outputSchemaRef must match prompt contract ${state.promptContract.promptContractId}.`,
      path: `promptBindings.bindings.${state.step.stepId}`,
      severity: "fatal",
    })];

const validateRequiredInputRefs = (state: ResolvedPromptStepState): MapPackageValidationIssue[] => {
  const issues: MapPackageValidationIssue[] = [];
  const missingStepInputRefs = state.binding.requiredInputRefs.filter((inputRef) => !state.step.inputRefs.some((candidate) => candidate === inputRef));
  if (missingStepInputRefs.length > 0) {
    issues.push(createIssue({
      code: "missing_dependency",
      message: `AI step ${state.step.stepId} is missing required input refs: ${missingStepInputRefs.join(", ")}.`,
      path: `operationalMap.steps.${state.step.stepId}`,
      severity: "fatal",
    }));
  }

  const missingProducedRefs = state.binding.requiredInputRefs.filter((inputRef) => !state.producedRefs.has(inputRef));
  if (missingProducedRefs.length > 0) {
    issues.push(createIssue({
      code: "missing_dependency",
      message: `AI step ${state.step.stepId} requires refs that are not produced before execution: ${missingProducedRefs.join(", ")}.`,
      path: `promptBindings.bindings.${state.step.stepId}`,
      severity: "fatal",
    }));
  }

  const missingContractRefs = state.promptContract.requiredInputRefs.filter((inputRef) => !state.binding.requiredInputRefs.includes(inputRef));
  if (missingContractRefs.length > 0) {
    issues.push(createIssue({
      code: "missing_dependency",
      message: `AI step ${state.step.stepId} binding omits prompt contract requiredInputRefs: ${missingContractRefs.join(", ")}.`,
      path: `promptBindings.bindings.${state.step.stepId}`,
      severity: "fatal",
    }));
  }

  return issues;
};

const validateReviewPolicy = (state: ResolvedPromptStepState): MapPackageValidationIssue[] => {
  const declaredPolicies = [
    state.binding.reviewPolicy.toLowerCase(),
    state.promptContract.reviewPolicy.requiredWhen.length === 0 ? "none" : "review_required",
  ];
  if (!state.promptContract.sensitiveOperation || !declaredPolicies.includes("none")) {
    return [];
  }

  return [createIssue({
    code: "security_violation",
    message: `Sensitive prompt contract ${state.promptContract.promptContractId} must not use reviewPolicy=none.`,
    path: `promptBindings.bindings.${state.step.stepId}`,
    severity: "fatal",
  })];
};

const validatePromptRestrictions = (state: ResolvedPromptStepState): MapPackageValidationIssue[] => {
  const issues: MapPackageValidationIssue[] = [];
  const blocksActionExecution = state.promptContract.prohibitedActions.includes("dispatch_action") || state.promptContract.prohibitedActions.includes("open_page");
  if (!blocksActionExecution) {
    issues.push(createIssue({
      code: "security_violation",
      message: `Prompt contract ${state.promptContract.promptContractId} must explicitly prohibit delegated action execution.`,
      path: `promptBindings.bindings.${state.step.stepId}`,
      severity: "error",
    }));
  }
  if (!state.promptContract.restrictedDataAccess.includes("credentials")) {
    issues.push(createIssue({
      code: "security_violation",
      message: `Prompt contract ${state.promptContract.promptContractId} must explicitly restrict credential access.`,
      path: `promptBindings.bindings.${state.step.stepId}`,
      severity: "error",
    }));
  }
  return issues;
};

export const validatePromptContractStep = (input: PromptStepValidationInput): MapPackageValidationIssue[] => {
  const resolved = resolvePromptStepState(input);
  if (!resolved.state) {
    return resolved.issues;
  }

  return [
    ...validateTaskType(resolved.state),
    ...validateOutputSchema(resolved.state),
    ...validateRequiredInputRefs(resolved.state),
    ...validateAllowedBranchFields(resolved.state),
    ...validateReviewPolicy(resolved.state),
    ...validatePromptRestrictions(resolved.state),
  ];
};
