import {
  POST_ACTION_VERIFICATION_ABILITY_GROUP_ID,
  type PostActionVerificationChildCapability,
} from "../../contract.js";
import { getObservationByKind, readBooleanPayload, readStringPayload } from "../../shared/observation-utils.js";
import { buildExecutionFailure, buildVerificationResult } from "../../shared/verification-result.js";
import { validateVerificationInput } from "../../shared/verification-policy.js";

export function createVerifyVideoChangedAfterScrollCapability(): PostActionVerificationChildCapability {
  return {
    abilityGroupId: POST_ACTION_VERIFICATION_ABILITY_GROUP_ID,
    childCapabilityId: "verify-video-changed-after-scroll",
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

      const videoObservations = getObservationByKind(input, "video_identity");
      const beforeObservation = videoObservations.find((observation) => readStringPayload(observation, "role") === "before") ?? null;
      const afterObservation = videoObservations.find((observation) => readStringPayload(observation, "role") === "after") ?? null;
      const beforeVideoId = beforeObservation ? readStringPayload(beforeObservation, "videoId") : null;
      const afterVideoId = afterObservation ? readStringPayload(afterObservation, "videoId") : null;
      const beforeSignature = beforeObservation ? readStringPayload(beforeObservation, "visualSignature") : null;
      const afterSignature = afterObservation ? readStringPayload(afterObservation, "visualSignature") : null;
      const afterConfirmed = afterObservation ? readBooleanPayload(afterObservation, "confirmed") : null;

      if ((!beforeVideoId || !afterVideoId) && (!beforeSignature || !afterSignature)) {
        return buildVerificationResult({
          input,
          observedOutcome: "missing_video_identity_observation",
          verificationDecision: "review_required",
          confidence: 0,
          failureReason: "missing_observation_support",
          reviewRequiredReason: "video-change verification requires before and after video identity observations",
          startedAt,
          endedAt: new Date().toISOString(),
          dataQualityFlags: ["review_required"],
        });
      }

      const changed = beforeVideoId !== null && afterVideoId !== null
        ? beforeVideoId !== afterVideoId
        : beforeSignature !== afterSignature;

      if (changed && afterConfirmed === false) {
        return buildVerificationResult({
          input,
          observedOutcome: "video_change_unconfirmed",
          verificationDecision: "review_required",
          confidence: 0.4,
          failureReason: "conflicting_observation",
          reviewRequiredReason: "video changed in the first observation but could not be confirmed on the second check",
          startedAt,
          endedAt: new Date().toISOString(),
          dataQualityFlags: ["review_required"],
        });
      }

      return buildVerificationResult({
        input,
        observedOutcome: changed ? "video_changed" : "video_unchanged",
        verificationDecision: changed ? "verified" : "failed",
        confidence: 0.96,
        failureReason: changed ? null : "unexpected_state",
        reviewRequiredReason: null,
        startedAt,
        endedAt: new Date().toISOString(),
      });
    },
  };
}