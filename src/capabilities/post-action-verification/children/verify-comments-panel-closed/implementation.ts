import {
  POST_ACTION_VERIFICATION_ABILITY_GROUP_ID,
  type PostActionVerificationChildCapability,
} from "../../contract.js";
import { getObservationByKind, readBooleanPayload, readStringPayload } from "../../shared/observation-utils.js";
import { buildExecutionFailure, buildVerificationResult } from "../../shared/verification-result.js";
import { validateVerificationInput } from "../../shared/verification-policy.js";

export function createVerifyCommentsPanelClosedCapability(): PostActionVerificationChildCapability {
  return {
    abilityGroupId: POST_ACTION_VERIFICATION_ABILITY_GROUP_ID,
    childCapabilityId: "verify-comments-panel-closed",
    async execute(input) {
      const startedAt = new Date().toISOString();
      const invalidReason = validateVerificationInput(input);
      if (invalidReason) {
        return buildExecutionFailure({
          verificationInput: input,
          observedOutcome: "input_invalid",
          failureReason: invalidReason,
          reviewRequiredReason: invalidReason === "missing_after_evidence" ? "comments-panel-closed verification requires after evidence or observations" : null,
          startedAt,
          endedAt: new Date().toISOString(),
        });
      }

      const pageStateObservation = getObservationByKind(input, "page_state")[0] ?? null;
      const targetObservation = getObservationByKind(input, "visual_target")[0] ?? null;
      const aiObservation = getObservationByKind(input, "ai_observation")[0] ?? null;
      const isOpen = [
        pageStateObservation ? readBooleanPayload(pageStateObservation, "commentsPanelOpen") : null,
        aiObservation ? readBooleanPayload(aiObservation, "commentsPanelOpen") : null,
        targetObservation ? readStringPayload(targetObservation, "targetType") === "comments_panel" : null,
      ].find((value) => value !== null) ?? null;

      if (isOpen === null) {
        return buildVerificationResult({
          input,
          observedOutcome: "comments_panel_state_unknown",
          verificationDecision: "review_required",
          confidence: 0,
          failureReason: "insufficient_evidence",
          reviewRequiredReason: "comments panel close state is not observable from current evidence",
          startedAt,
          endedAt: new Date().toISOString(),
          dataQualityFlags: ["review_required"],
        });
      }

      return buildVerificationResult({
        input,
        observedOutcome: isOpen ? "comments_panel_open" : "comments_panel_closed",
        verificationDecision: isOpen ? "failed" : "verified",
        confidence: 0.9,
        failureReason: isOpen ? "unexpected_state" : null,
        reviewRequiredReason: null,
        startedAt,
        endedAt: new Date().toISOString(),
      });
    },
  };
}