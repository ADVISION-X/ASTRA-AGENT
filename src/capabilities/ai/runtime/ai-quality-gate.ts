import type { ParsedAiAbilityInput } from "../contract.js";

export function evaluateAiQualityGate(input: {
  request: ParsedAiAbilityInput;
  confidence: number | null;
  schemaIssues: string[];
  policyReason: string | null;
}): { decision: "pass" | "review_required" | "blocked"; reason: string | null; schemaValidationStatus: "valid" | "invalid" | "not_applicable"; flags: string[] } {
  if (input.schemaIssues.length > 0) {
    return {
      decision: input.request.safetyPolicy.reviewOnSchemaFailure ? "review_required" : "blocked",
      reason: "schema_validation_failed",
      schemaValidationStatus: "invalid",
      flags: input.schemaIssues,
    };
  }

  if (input.policyReason) {
    return {
      decision: input.request.safetyPolicy.reviewOnPolicyViolation ? "review_required" : "blocked",
      reason: input.policyReason,
      schemaValidationStatus: "valid",
      flags: [],
    };
  }

  const minimumConfidence = input.request.qualityPolicy.minimumConfidence;
  if (minimumConfidence !== null && input.confidence === null) {
    return {
      decision: input.request.safetyPolicy.reviewOnLowConfidence ? "review_required" : "blocked",
      reason: "confidence_missing",
      schemaValidationStatus: "valid",
      flags: ["confidence:null"],
    };
  }

  if (minimumConfidence !== null && input.confidence !== null && input.confidence < minimumConfidence) {
    return {
      decision: input.request.safetyPolicy.reviewOnLowConfidence ? "review_required" : "blocked",
      reason: "quality_gate_blocked",
      schemaValidationStatus: "valid",
      flags: [`confidence:${input.confidence}`],
    };
  }

  return {
    decision: "pass",
    reason: null,
    schemaValidationStatus: input.request.qualityPolicy.requireSchemaValidation ? "valid" : "not_applicable",
    flags: [],
  };
}
