import type { ParsedAiAbilityInput } from "../contract.js";

function buildReviewOrBlockedDecision(input: {
  request: ParsedAiAbilityInput;
  reviewFlag: boolean;
  reason: string;
  flags: string[];
  schemaValidationStatus: "valid" | "invalid";
}) {
  return {
    decision: input.reviewFlag ? "review_required" : "blocked",
    reason: input.reason,
    schemaValidationStatus: input.schemaValidationStatus,
    flags: input.flags,
  } as const;
}

function isDefinitiveNonProductOutput(output: unknown): boolean {
  if (typeof output !== "object" || output === null || Array.isArray(output)) {
    return false;
  }

  const candidate = output as {
    decision?: unknown;
    mustReview?: unknown;
    visibleProductTypes?: unknown;
    uncertainty?: unknown;
    suggestedNextAction?: unknown;
  };
  const visibleProductTypes = Array.isArray(candidate.visibleProductTypes) ? candidate.visibleProductTypes : [];
  const uncertainty = Array.isArray(candidate.uncertainty) ? candidate.uncertainty : [];
  const onlyFrameCoverageUncertainty = uncertainty.every((entry) =>
    entry === "single_frame_fallback" || entry === "reduced_frame_coverage"
  );
  return candidate.decision === "product_no"
    && candidate.mustReview === false
    && visibleProductTypes.length === 0
    && candidate.suggestedNextAction === "scroll_next"
    && onlyFrameCoverageUncertainty;
}

function resolveSchemaIssueDecision(input: Parameters<typeof evaluateAiQualityGate>[0]) {
  if (input.schemaIssues.length === 0) {
    return null;
  }
  return buildReviewOrBlockedDecision({
    request: input.request,
    reviewFlag: input.request.safetyPolicy.reviewOnSchemaFailure,
    reason: "schema_validation_failed",
    flags: input.schemaIssues,
    schemaValidationStatus: "invalid",
  });
}

function resolvePolicyReasonDecision(input: Parameters<typeof evaluateAiQualityGate>[0]) {
  if (!input.policyReason) {
    return null;
  }
  return buildReviewOrBlockedDecision({
    request: input.request,
    reviewFlag: input.request.safetyPolicy.reviewOnPolicyViolation,
    reason: input.policyReason,
    flags: [],
    schemaValidationStatus: "valid",
  });
}

function resolveConfidenceDecision(input: Parameters<typeof evaluateAiQualityGate>[0]) {
  const minimumConfidence = input.request.qualityPolicy.minimumConfidence;
  if (minimumConfidence === null) {
    return null;
  }
  if (isDefinitiveNonProductOutput(input.output)) {
    return null;
  }
  if (input.confidence === null) {
    return buildReviewOrBlockedDecision({
      request: input.request,
      reviewFlag: input.request.safetyPolicy.reviewOnLowConfidence,
      reason: "confidence_missing",
      flags: ["confidence:null"],
      schemaValidationStatus: "valid",
    });
  }
  if (input.confidence < minimumConfidence) {
    return buildReviewOrBlockedDecision({
      request: input.request,
      reviewFlag: input.request.safetyPolicy.reviewOnLowConfidence,
      reason: "quality_gate_blocked",
      flags: [`confidence:${input.confidence}`],
      schemaValidationStatus: "valid",
    });
  }
  return null;
}

export function evaluateAiQualityGate(input: {
  request: ParsedAiAbilityInput;
  confidence: number | null;
  output: unknown;
  schemaIssues: string[];
  policyReason: string | null;
}): { decision: "pass" | "review_required" | "blocked"; reason: string | null; schemaValidationStatus: "valid" | "invalid" | "not_applicable"; flags: string[] } {
  const schemaDecision = resolveSchemaIssueDecision(input);
  if (schemaDecision) {
    return schemaDecision;
  }

  const policyDecision = resolvePolicyReasonDecision(input);
  if (policyDecision) {
    return policyDecision;
  }

  const confidenceDecision = resolveConfidenceDecision(input);
  if (confidenceDecision) {
    return confidenceDecision;
  }

  return {
    decision: "pass",
    reason: null,
    schemaValidationStatus: input.request.qualityPolicy.requireSchemaValidation ? "valid" : "not_applicable",
    flags: [],
  };
}
