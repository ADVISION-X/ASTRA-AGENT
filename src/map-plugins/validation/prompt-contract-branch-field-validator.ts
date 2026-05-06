import { z } from "zod";

import {
  findAiOutputSchemaDescriptor,
  findAiOutputSchemaDescriptorBySchemaVersion,
} from "../../capabilities/ai/output-schema-catalog-port.js";
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

const createUnknownOutputSchemaRefIssue = (state: ResolvedPromptStepState): MapPackageValidationIssue =>
  createIssue({
    code: "map_validation_failed",
    message: `AI step ${state.step.stepId} references outputSchemaRef ${state.binding.outputSchemaRef}, but the runtime AI output schema catalog does not declare it.`,
    path: `promptBindings.bindings.${state.step.stepId}`,
    severity: "fatal",
  });

const createTaskSchemaMismatchIssue = (
  state: ResolvedPromptStepState,
  runtimeSchemaVersion: string,
): MapPackageValidationIssue =>
  createIssue({
    code: "map_validation_failed",
    message: `AI step ${state.step.stepId} taskType ${state.promptContract.taskType} resolves to runtime output schema ${runtimeSchemaVersion}, but the prompt binding declares ${state.binding.outputSchemaRef}.`,
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
  if (!findAiOutputSchemaDescriptorBySchemaVersion(state.binding.outputSchemaRef)) {
    return [createUnknownOutputSchemaRefIssue(state)];
  }
  if (outputSchemaDescriptor.schemaVersion !== state.binding.outputSchemaRef) {
    return [createTaskSchemaMismatchIssue(state, outputSchemaDescriptor.schemaVersion)];
  }
  const declaredOutputFields = new Set(Object.keys(outputSchemaDescriptor.schema.shape));
  const declaredIssues = validateDeclaredBranchFields(state, declaredOutputFields);
  if (declaredIssues.length > 0) return declaredIssues;
  return [
    ...validateUsedBranchFields(state, new Set(state.promptContract.allowedBranchFields), declaredOutputFields),
    ...validateBranchEnumValues(state, outputSchemaDescriptor.schema.shape),
  ];
};

const unwrapSchema = (schema: z.ZodTypeAny): z.ZodTypeAny => {
  if (schema instanceof z.ZodDefault || schema instanceof z.ZodNullable || schema instanceof z.ZodOptional) {
    return unwrapSchema(schema._def.innerType);
  }
  if (schema instanceof z.ZodEffects) {
    return unwrapSchema(schema._def.schema);
  }
  return schema;
};

const readLiteralValues = (schema: z.ZodTypeAny): string[] | null => {
  const unwrapped = unwrapSchema(schema);
  if (unwrapped instanceof z.ZodEnum) {
    return [...unwrapped.options];
  }
  if (unwrapped instanceof z.ZodLiteral && typeof unwrapped._def.value === "string") {
    return [unwrapped._def.value];
  }
  return null;
};

const validateBranchEnumValues = (
  state: ResolvedPromptStepState,
  schemaShape: z.ZodRawShape,
): MapPackageValidationIssue[] => {
  const issues: MapPackageValidationIssue[] = [];
  for (const transition of state.transitions.filter((t) => t.fromStepId === state.step.stepId)) {
    const parsedRef = parseSchemaFieldRef(transition.condition.leftRef);
    if (!parsedRef.ok) continue;
    const schema = schemaShape[parsedRef.fieldName];
    if (!schema) continue;
    const literalValues = readLiteralValues(schema);
    if (!literalValues || literalValues.includes(String(transition.condition.rightValue))) continue;
    issues.push(createIssue({
      code: "map_validation_failed",
      message: `AI step ${state.step.stepId} transition ${transition.transitionId} compares ${parsedRef.fieldName} to "${transition.condition.rightValue}", which is not allowed by ${state.binding.outputSchemaRef}. Allowed values: ${literalValues.join(", ")}.`,
      path: `operationalMap.transitions.${transition.transitionId}`,
      severity: "fatal",
    }));
  }
  return issues;
};

export const validateAiStepSuccessConditionConflict = (state: ResolvedPromptStepState): MapPackageValidationIssue[] => {
  const successConditionRef = state.step.successCondition.leftRef;

  // If successCondition uses status, no semantic conflict is possible.
  if (successConditionRef === "status") return [];

  // If successCondition is not a schemaFieldRef, skip (other validators handle bad refs).
  if (!successConditionRef.startsWith("schemaFieldRef:")) return [];

  // Count onStatus:success transitions that branch on schemaFieldRef:* fields.
  const schemaFieldSuccessTransitions = state.transitions
    .filter((t) => t.fromStepId === state.step.stepId && t.onStatus === "success")
    .filter((t) => typeof t.condition.leftRef === "string" && t.condition.leftRef.startsWith("schemaFieldRef:"));

  // A single schemaFieldRef success transition is unambiguous; multiple means a multi-decision branch.
  if (schemaFieldSuccessTransitions.length <= 1) return [];

  return [createIssue({
    code: "map_validation_failed",
    message: `AI step ${state.step.stepId} has ${schemaFieldSuccessTransitions.length} success transitions branching on schema fields but successCondition also gates on a specific field value (${successConditionRef}). Set successCondition leftRef="status" rightValue="success" so that product_no and product_uncertain transitions remain reachable.`,
    path: `operationalMap.steps.${state.step.stepId}`,
    severity: "fatal",
  })];
};
