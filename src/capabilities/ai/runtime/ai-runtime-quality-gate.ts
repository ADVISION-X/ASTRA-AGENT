import type { AiAbilityInput, AiExecutionStatus, AiSchemaValidationStatus } from "../contract.js";

export type AiQualityGateDecision = {
  status: AiExecutionStatus;
  primaryReason: string | null;
  schemaValidationStatus: AiSchemaValidationStatus;
  dataQualityFlags: string[];
};

export function evaluateAiQualityGate(input: {
  request: AiAbilityInput;
  policyViolations: string[];
  schemaIssues: string[];
  confidence: number | null;
}): AiQualityGateDecision {
  const dataQualityFlags: string[] = [];
  let status: AiExecutionStatus = "success";
  let primaryReason: string | null = null;
  let schemaValidationStatus: AiSchemaValidationStatus = input.schemaIssues.length > 0 ? "invalid" : "valid";

  if (input.policyViolations.length > 0) {
    dataQualityFlags.push("policy_violation");
    primaryReason = input.policyViolations.join(" ");
    status = input.request.safetyPolicy.reviewOnPolicyViolation ? "review_required" : "failed";
  }

  if (primaryReason === null && input.schemaIssues.length > 0) {
    dataQualityFlags.push("schema_invalid");
    primaryReason = input.schemaIssues.join(" ");
    schemaValidationStatus = "invalid";
    status = input.request.safetyPolicy.reviewOnSchemaFailure ? "review_required" : "failed";
  }

  if (
    primaryReason === null
    && input.request.qualityPolicy.minimumConfidence !== null
    && input.confidence !== null
    && input.confidence < input.request.qualityPolicy.minimumConfidence
  ) {
    dataQualityFlags.push("low_confidence");
    primaryReason = `confidence ${input.confidence.toFixed(2)} is below minimumConfidence ${input.request.qualityPolicy.minimumConfidence.toFixed(2)}.`;
    status = input.request.safetyPolicy.reviewOnLowConfidence ? "review_required" : "failed";
  }

  return {
    status,
    primaryReason,
    schemaValidationStatus,
    dataQualityFlags,
  };
}