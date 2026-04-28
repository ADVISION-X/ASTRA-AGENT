import {
  POST_ACTION_VERIFICATION_ABILITY_GROUP_ID,
  type PostActionVerificationChildCapability,
} from "../../contract.js";
import { getObservationByKind, readBooleanPayload, readStringPayload } from "../../shared/observation-utils.js";
import { buildExecutionFailure, buildVerificationResult } from "../../shared/verification-result.js";
import { validateVerificationInput } from "../../shared/verification-policy.js";

export function createVerifyNotInterestedResultCapability(): PostActionVerificationChildCapability {
  return {
    abilityGroupId: POST_ACTION_VERIFICATION_ABILITY_GROUP_ID,
    childCapabilityId: "verify-not-interested-result",
    async execute(input) {
      const startedAt = new Date().toISOString();
      const invalidReason = validateVerificationInput(input);
      if (invalidReason) {
        return buildExecutionFailure({
          verificationInput: input,
          observedOutcome: "input_invalid",
          failureReason: invalidReason,
          reviewRequiredReason: null,
          startedAt,
          endedAt: new Date().toISOString(),
        });
      }

      const pageStateObservation = getObservationByKind(input, "page_state")[0] ?? null;
      const aiObservation = getObservationByKind(input, "ai_observation")[0] ?? null;
      const changed = [
        pageStateObservation ? readBooleanPayload(pageStateObservation, "recommendationChanged") : null,
        aiObservation ? readBooleanPayload(aiObservation, "recommendationChanged") : null,
      ].find((value) => value !== null) ?? null;

      if (changed === null) {
        return buildVerificationResult({
          input,
          observedOutcome: "not_interested_state_unknown",
          verificationDecision: "review_required",
          confidence: 0,
          failureReason: "insufficient_evidence",
          reviewRequiredReason: "not-interested verification requires page-state or AI observation evidence",
          startedAt,
          endedAt: new Date().toISOString(),
          dataQualityFlags: ["review_required"],
        });
      }

      const observationLabel = changed
        ? readStringPayload(pageStateObservation ?? aiObservation!, "changeSummary") ?? "recommendation_changed"
        : "recommendation_unchanged";

      return buildVerificationResult({
        input,
        observedOutcome: observationLabel,
        verificationDecision: changed ? "verified" : "failed",
        confidence: 0.82,
        failureReason: changed ? null : "unexpected_state",
        reviewRequiredReason: null,
        startedAt,
        endedAt: new Date().toISOString(),
      });
    },
  };
}