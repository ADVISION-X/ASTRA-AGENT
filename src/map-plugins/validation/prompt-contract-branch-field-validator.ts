import { findAiOutputSchemaDescriptor } from "../../capabilities/ai/output-schema-catalog-port.js";
import type { MapPackageValidationIssue } from "../shared/map-package-failure.js";
import type { ResolvedPromptStepState } from "./prompt-contract-step-validator.js";

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

const collectBranchFields = (state: ResolvedPromptStepState): string[] => {
  const stepBranchFields = state.transitions
    .filter((transition) => transition.fromStepId === state.step.stepId)
    .map((transition) => transition.condition.leftRef);

  return Array.from(new Set([state.step.successCondition.leftRef, ...stepBranchFields]));
};

const parseSchemaFieldRef = (leftRef: string): { ok: true; fieldName: string } | { ok: false } => {
  if (!leftRef.startsWith("schemaFieldRef:")) return { ok: false };
  const fieldName = leftRef.slice("schemaFieldRef:".length);
  return fieldName.length > 0 ? { ok: true, fieldName } : { ok: false };
};

const createMissingOutputSchemaIssue = (state: ResolvedPromptStepState): MapPackageValidationIssue =>
  createIssue({
    code: "map_validation_failed",
    message: `AI step ${state.step.stepId} references prompt contract ${state.promptContract.promptContractId}, but no output schema descriptor exists for taskType ${state.promptContract.taskType}.`,
    path: `promptBindings.bindings.${state.step.stepId}`,
    severity: "fatal",
  });

const validateDeclaredBranchFields = (
  state: ResolvedPromptStepState,
  declaredOutputFields: Set<string>,
): MapPackageValidationIssue[] =>
  state.promptContract.allowedBranchFields
    .filter((fieldName) => !declaredOutputFields.has(fieldName))
    .map((fieldName) => createIssue({
      code: "map_validation_failed",
      message: `Prompt contract ${state.promptContract.promptContractId} allows branch field ${fieldName}, but ${state.binding.outputSchemaRef} does not declare it.`,
      path: `promptBindings.bindings.${state.step.stepId}`,
      severity: "fatal",
    }));

const isInvalidBranchField = (input: {
  leftRef: string;
  allowedBranchFields: Set<string>;
  declaredOutputFields: Set<string>;
}): boolean => {
  if (input.leftRef === "status") return false;
  const parsedRef = parseSchemaFieldRef(input.leftRef);
  if (!parsedRef.ok) return true;
  return !input.allowedBranchFields.has(parsedRef.fieldName) || !input.declaredOutputFields.has(parsedRef.fieldName);
};

const describeAllowedBranchFields = (state: ResolvedPromptStepState): string =>
  state.promptContract.allowedBranchFields.length > 0
    ? `status or declared branch fields: ${state.promptContract.allowedBranchFields.join(", ")}`
    : "status only";

const validateUsedBranchFields = (
  state: ResolvedPromptStepState,
  allowedBranchFields: Set<string>,
  declaredOutputFields: Set<string>,
): MapPackageValidationIssue[] => {
  const invalidBranchFields = collectBranchFields(state)
    .filter((leftRef) => isInvalidBranchField({ leftRef, allowedBranchFields, declaredOutputFields }));
  const allowedDescription = describeAllowedBranchFields(state);
  return invalidBranchFields.map((leftRef) => createIssue({
    code: "map_validation_failed",
    message: `AI step ${state.step.stepId} branches on ${leftRef} but prompt contract ${state.promptContract.promptContractId} allows ${allowedDescription}.`,
    path: `operationalMap.steps.${state.step.stepId}`,
    severity: "fatal",
  }));
};

export const validateAllowedBranchFields = (state: ResolvedPromptStepState): MapPackageValidationIssue[] => {
  const outputSchemaDescriptor = findAiOutputSchemaDescriptor(state.promptContract.taskType);
  if (!outputSchemaDescriptor) return [createMissingOutputSchemaIssue(state)];
  const declaredOutputFields = new Set(Object.keys(outputSchemaDescriptor.schema.shape));
  const declaredIssues = validateDeclaredBranchFields(state, declaredOutputFields);
  if (declaredIssues.length > 0) return declaredIssues;
  return validateUsedBranchFields(state, new Set(state.promptContract.allowedBranchFields), declaredOutputFields);
};
