import {
  POST_ACTION_MAX_DATA_QUALITY_FLAGS,
  POST_ACTION_MAX_EVIDENCE_REFS,
  POST_ACTION_MAX_OBSERVATIONS,
  POST_ACTION_MAX_SIGNAL_TYPE_LENGTH,
  POST_ACTION_MAX_SUMMARY_LENGTH,
  POST_ACTION_MAX_TARGET_TYPE_LENGTH,
} from "../shared/post-action-policy.js";
import type { ParsedPostActionVerificationAbilityInput } from "../contract.js";

function exceedsLimit(value: string | null | undefined, limit: number): boolean {
  return typeof value === "string" && value.length > limit;
}

export function validatePostActionPayloadBudget(request: ParsedPostActionVerificationAbilityInput) {
  if (request.observationSet.observations.length > POST_ACTION_MAX_OBSERVATIONS) {
    return {
      ok: false,
      status: "failed" as const,
      failureReason: "payload_budget_exceeded" as const,
      reviewRequiredReason: null,
      statusMessage: "Observation budget exceeded.",
      dataQualityFlags: ["payload_budget_exceeded"],
      payloadBudgetDecision: "failed:observation_budget_exceeded" as const,
    };
  }

  const evidenceRefCount = Number(request.beforeAfterEvidence.beforeEvidence !== null) + Number(request.beforeAfterEvidence.afterEvidence !== null);
  if (evidenceRefCount > POST_ACTION_MAX_EVIDENCE_REFS) {
    return {
      ok: false,
      status: "failed" as const,
      failureReason: "payload_budget_exceeded" as const,
      reviewRequiredReason: null,
      statusMessage: "Evidence budget exceeded.",
      dataQualityFlags: ["payload_budget_exceeded"],
      payloadBudgetDecision: "failed:evidence_budget_exceeded" as const,
    };
  }

  for (const observation of request.observationSet.observations) {
    if (
      exceedsLimit(observation.payload.kind === "ai_observation" ? observation.payload.summary : null, POST_ACTION_MAX_SUMMARY_LENGTH)
      || exceedsLimit(observation.payload.kind === "page_state" ? observation.payload.changeSummary : null, POST_ACTION_MAX_SUMMARY_LENGTH)
      || exceedsLimit(observation.payload.kind === "runtime_signal" ? observation.payload.summary : null, POST_ACTION_MAX_SUMMARY_LENGTH)
      || exceedsLimit(observation.payload.kind === "runtime_signal" ? observation.payload.signalType : null, POST_ACTION_MAX_SIGNAL_TYPE_LENGTH)
      || exceedsLimit("targetType" in observation.payload ? observation.payload.targetType : null, POST_ACTION_MAX_TARGET_TYPE_LENGTH)
    ) {
      return {
        ok: false,
        status: "failed" as const,
        failureReason: "payload_budget_exceeded" as const,
        reviewRequiredReason: null,
        statusMessage: `Observation ${observation.ref} exceeded payload limits.`,
        dataQualityFlags: ["payload_budget_exceeded"],
        payloadBudgetDecision: "failed:payload_field_budget_exceeded" as const,
      };
    }
  }

  if (request.confidencePolicy.allowReviewRequired && POST_ACTION_MAX_DATA_QUALITY_FLAGS < 1) {
    return {
      ok: false,
      status: "failed" as const,
      failureReason: "payload_budget_exceeded" as const,
      reviewRequiredReason: null,
      statusMessage: "Internal data quality budget is invalid.",
      dataQualityFlags: ["payload_budget_exceeded"],
      payloadBudgetDecision: "failed:internal_payload_budget_invalid" as const,
    };
  }

  return {
    ok: true,
    payloadBudgetDecision: "allow" as const,
  };
}