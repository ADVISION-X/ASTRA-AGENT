import type { AiAbilityInput, AiAbilityResult, AiChildCapabilityId, AiPromptContract } from "../contract.js";
import {
  AiSchemaValidationOnlyInputSchema,
  resolveAiExpectedOutputTask,
  safeParseAiTaskOutput,
} from "../schema-validation.js";
import { parseExtractedJson } from "../shared/ai-json-extract.js";
import { buildAiExecutionResult } from "./ai-runtime-result-builder.js";

function normalizeSchemaValidationCandidate(candidate: unknown): unknown {
  if (typeof candidate !== "string") {
    return candidate;
  }

  const trimmed = candidate.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }

  return parseExtractedJson<unknown>(candidate);
}

export function inspectAiOutputSchema(input: {
  request: AiAbilityInput;
  output: unknown;
}): { issues: string[]; normalizedOutput: AiAbilityResult["output"] | null } {
  const issues: string[] = [];
  const schemaTargetTaskType = resolveAiExpectedOutputTask(input.request);

  if (schemaTargetTaskType !== null && schemaTargetTaskType !== input.request.taskType) {
    issues.push(`expectedOutputSchema resolves to ${schemaTargetTaskType}, but request taskType is ${input.request.taskType}.`);
  }

  const outputValidation = safeParseAiTaskOutput(input.request.taskType, input.output);
  if (!outputValidation.success) {
    issues.push(...outputValidation.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "output";
      return `${path}: ${issue.message}`;
    }));
    return { issues, normalizedOutput: null };
  }

  return {
    issues,
    normalizedOutput: outputValidation.data as AiAbilityResult["output"],
  };
}

export function executeAiSchemaValidationOnly(input: {
  request: AiAbilityInput;
  promptContract: AiPromptContract;
  childCapabilityId: AiChildCapabilityId;
  startedAt: string;
}): AiAbilityResult {
  const endedAt = new Date().toISOString();
  const targetTaskType = resolveAiExpectedOutputTask(input.request);

  if (targetTaskType === null) {
    const reason = `No governed schema target matches expectedOutputSchema=${input.request.expectedOutputSchema} or promptContractId=${input.request.promptContractId}.`;
    return buildAiExecutionResult({
      request: input.request,
      childCapabilityId: input.childCapabilityId,
      promptContract: input.promptContract,
      modelProvider: "internal",
      modelName: "schema-validator",
      runtime: "internal",
      implementationStatus: "schema_target_missing",
      output: { valid: false, issues: [reason] },
      status: input.request.safetyPolicy.reviewOnSchemaFailure ? "review_required" : "failed",
      schemaValidationStatus: "invalid",
      confidence: 0,
      failureReason: reason,
      reviewRequiredReason: input.request.safetyPolicy.reviewOnSchemaFailure ? reason : null,
      startedAt: input.startedAt,
      endedAt,
      dataQualityFlags: ["schema_invalid"],
      reason: "schema_validation_failed",
      createdAt: endedAt,
    });
  }

  let normalizedCandidate: unknown;
  try {
    normalizedCandidate = normalizeSchemaValidationCandidate(AiSchemaValidationOnlyInputSchema.parse(input.request.input).candidate);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return buildAiExecutionResult({
      request: input.request,
      childCapabilityId: input.childCapabilityId,
      promptContract: input.promptContract,
      modelProvider: "internal",
      modelName: "schema-validator",
      runtime: "internal",
      implementationStatus: "schema_parse_failed",
      output: { valid: false, issues: [reason] },
      status: input.request.safetyPolicy.reviewOnSchemaFailure ? "review_required" : "failed",
      schemaValidationStatus: "invalid",
      confidence: 0,
      failureReason: reason,
      reviewRequiredReason: input.request.safetyPolicy.reviewOnSchemaFailure ? reason : null,
      startedAt: input.startedAt,
      endedAt,
      dataQualityFlags: ["schema_invalid"],
      reason: "schema_validation_failed",
      createdAt: endedAt,
    });
  }

  const validation = safeParseAiTaskOutput(targetTaskType, normalizedCandidate);
  const issues = validation.success
    ? []
    : validation.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "candidate";
      return `${path}: ${issue.message}`;
    });
  const status = validation.success ? "success" : (input.request.safetyPolicy.reviewOnSchemaFailure ? "review_required" : "failed");
  const reason = validation.success ? "schema_validation_completed" : issues.join(" ");

  return buildAiExecutionResult({
    request: input.request,
    childCapabilityId: input.childCapabilityId,
    promptContract: input.promptContract,
    modelProvider: "internal",
    modelName: "schema-validator",
    runtime: "internal",
    implementationStatus: validation.success ? "validated" : "schema_invalid",
    output: { valid: validation.success, issues },
    status,
    schemaValidationStatus: validation.success ? "valid" : "invalid",
    confidence: validation.success ? 1 : 0,
    failureReason: validation.success ? null : reason,
    reviewRequiredReason: status === "review_required" ? reason : null,
    startedAt: input.startedAt,
    endedAt,
    dataQualityFlags: validation.success ? [] : ["schema_invalid"],
    reason: validation.success ? "schema_validation_completed" : "schema_validation_failed",
    createdAt: endedAt,
  });
}