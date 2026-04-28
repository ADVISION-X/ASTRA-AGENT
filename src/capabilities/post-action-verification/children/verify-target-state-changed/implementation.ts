import {
  POST_ACTION_VERIFICATION_ABILITY_GROUP_ID,
  type PostActionVerificationChildCapability,
} from "../../contract.js";
import { getObservationByKind, readBooleanPayload, readStringPayload } from "../../shared/observation-utils.js";
import { buildExecutionFailure, buildVerificationResult } from "../../shared/verification-result.js";
import { validateVerificationInput } from "../../shared/verification-policy.js";

export function createVerifyTargetStateChangedCapability(): PostActionVerificationChildCapability {
  return {
    abilityGroupId: POST_ACTION_VERIFICATION_ABILITY_GROUP_ID,
    childCapabilityId: "verify-target-state-changed",
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

      const targetObservation = getObservationByKind(input, "visual_target")[0] ?? null;
      const pageStateObservation = getObservationByKind(input, "page_state")[0] ?? null;
      const changed = [
        targetObservation ? readBooleanPayload(targetObservation, "targetStateChanged") : null,
        pageStateObservation ? readBooleanPayload(pageStateObservation, "targetStateChanged") : null,
      ].find((value) => value !== null) ?? null;

      if (changed === null) {
        return buildVerificationResult({
          input,
          observedOutcome: "target_state_unknown",
          verificationDecision: "review_required",
          confidence: 0,
          failureReason: "insufficient_evidence",
          reviewRequiredReason: "target-state verification requires visual-target or page-state observation",
          startedAt,
          endedAt: new Date().toISOString(),
          dataQualityFlags: ["review_required"],
        });
      }

      const observedTargetType = targetObservation ? readStringPayload(targetObservation, "targetType") : null;

      return buildVerificationResult({
        input,
        observedOutcome: changed ? `target_state_changed:${observedTargetType ?? "unknown"}` : `target_state_unchanged:${observedTargetType ?? "unknown"}`,
        verificationDecision: changed ? "verified" : "failed",
        confidence: 0.86,
        failureReason: changed ? null : "unexpected_state",
        reviewRequiredReason: null,
        startedAt,
        endedAt: new Date().toISOString(),
      });
    },
  };
}