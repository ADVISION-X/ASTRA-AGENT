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

function buildPayloadBudgetFailure(statusMessage: string, payloadBudgetDecision: string) {
  return {
    ok: false as const,
    status: "failed" as const,
    failureReason: "payload_budget_exceeded" as const,
    reviewRequiredReason: null,
    statusMessage,
    dataQualityFlags: ["payload_budget_exceeded"],
    payloadBudgetDecision: payloadBudgetDecision as "failed:observation_budget_exceeded" | "failed:evidence_budget_exceeded" | "failed:payload_field_budget_exceeded" | "failed:internal_payload_budget_invalid",
  };
}

function doesObservationExceedSummaryBudget(observation: ParsedPostActionVerificationAbilityInput["observationSet"]["observations"][number]): boolean {
  return exceedsLimit(observation.payload.kind === "ai_observation" ? observation.payload.summary : null, POST_ACTION_MAX_SUMMARY_LENGTH)
    || exceedsLimit(observation.payload.kind === "page_state" ? observation.payload.changeSummary : null, POST_ACTION_MAX_SUMMARY_LENGTH)
    || exceedsLimit(observation.payload.kind === "runtime_signal" ? observation.payload.summary : null, POST_ACTION_MAX_SUMMARY_LENGTH);
}

function doesObservationExceedSignalBudget(observation: ParsedPostActionVerificationAbilityInput["observationSet"]["observations"][number]): boolean {
  return exceedsLimit(observation.payload.kind === "runtime_signal" ? observation.payload.signalType : null, POST_ACTION_MAX_SIGNAL_TYPE_LENGTH)
    || exceedsLimit("targetType" in observation.payload ? observation.payload.targetType : null, POST_ACTION_MAX_TARGET_TYPE_LENGTH);
}

function isObservationWithinBudget(observation: ParsedPostActionVerificationAbilityInput["observationSet"]["observations"][number]): boolean {
  return !(doesObservationExceedSummaryBudget(observation) || doesObservationExceedSignalBudget(observation));
}

function resolvePostActionPayloadBudget(request: ParsedPostActionVerificationAbilityInput) {
  if (request.observationSet.observations.length > POST_ACTION_MAX_OBSERVATIONS) {
    return buildPayloadBudgetFailure("Observation budget exceeded.", "failed:observation_budget_exceeded");
  }

  const evidenceRefCount = Number(request.beforeAfterEvidence.beforeEvidence !== null) + Number(request.beforeAfterEvidence.afterEvidence !== null);
  if (evidenceRefCount > POST_ACTION_MAX_EVIDENCE_REFS) {
    return buildPayloadBudgetFailure("Evidence budget exceeded.", "failed:evidence_budget_exceeded");
  }

  for (const observation of request.observationSet.observations) {
    if (!isObservationWithinBudget(observation)) {
      return buildPayloadBudgetFailure(`Observation ${observation.ref} exceeded payload limits.`, "failed:payload_field_budget_exceeded");
    }
  }

  if (request.confidencePolicy.allowReviewRequired && POST_ACTION_MAX_DATA_QUALITY_FLAGS < 1) {
    return buildPayloadBudgetFailure("Internal data quality budget is invalid.", "failed:internal_payload_budget_invalid");
  }

  return {
    ok: true as const,
    payloadBudgetDecision: "allow" as const,
  };
}

export function validatePostActionPayloadBudget(request: ParsedPostActionVerificationAbilityInput) {
  return resolvePostActionPayloadBudget(request);
}