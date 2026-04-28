import {
  POST_ACTION_VERIFICATION_ABILITY_GROUP_ID,
  type PostActionVerificationChildCapability,
} from "../../contract.js";
import { hasObservationSupport, getObservationByKind, readStringPayload } from "../../shared/observation-utils.js";
import { buildExecutionFailure, buildVerificationResult } from "../../shared/verification-result.js";
import { validateVerificationInput } from "../../shared/verification-policy.js";

export function createVerifyPageOpenedCapability(): PostActionVerificationChildCapability {
  return {
    abilityGroupId: POST_ACTION_VERIFICATION_ABILITY_GROUP_ID,
    childCapabilityId: "verify-page-opened",
    async execute(input) {
      const startedAt = new Date().toISOString();
      const invalidReason = validateVerificationInput(input);
      if (invalidReason) {
        return buildExecutionFailure({
          verificationInput: input,
          observedOutcome: "input_invalid",
          failureReason: invalidReason,
          reviewRequiredReason: invalidReason === "missing_after_evidence" ? "page-open verification requires observation support" : null,
          startedAt,
          endedAt: new Date().toISOString(),
        });
      }

      if (!hasObservationSupport(input)) {
        return buildVerificationResult({
          input,
          observedOutcome: "no_page_state_observation",
          verificationDecision: "review_required",
          confidence: 0,
          failureReason: "missing_observation_support",
          reviewRequiredReason: "page-open verification requires page-state or URL observation",
          startedAt,
          endedAt: new Date().toISOString(),
          dataQualityFlags: ["review_required"],
        });
      }

      const pageStateObservation = getObservationByKind(input, "page_state")[0] ?? null;
      const currentUrl = pageStateObservation ? readStringPayload(pageStateObservation, "currentUrl") : null;
      const loginState = pageStateObservation ? readStringPayload(pageStateObservation, "loginState") : null;

      if (!currentUrl || currentUrl === "about:blank") {
        return buildVerificationResult({
          input,
          observedOutcome: currentUrl ?? "about:blank",
          verificationDecision: "failed",
          confidence: 1,
          failureReason: "unexpected_state",
          reviewRequiredReason: null,
          startedAt,
          endedAt: new Date().toISOString(),
        });
      }

      if (loginState === "login_required" || loginState === "review_required") {
        return buildVerificationResult({
          input,
          observedOutcome: loginState,
          verificationDecision: "failed",
          confidence: 1,
          failureReason: "unexpected_state",
          reviewRequiredReason: null,
          startedAt,
          endedAt: new Date().toISOString(),
        });
      }

      const url = URL.canParse(currentUrl) ? new URL(currentUrl) : null;
      const hostMatches = input.expectedOutcome.expectedUrlHost ? url?.hostname === input.expectedOutcome.expectedUrlHost || url?.hostname.endsWith(`.${input.expectedOutcome.expectedUrlHost}`) : true;
      const prefixMatches = input.expectedOutcome.expectedUrlPrefix ? currentUrl.startsWith(input.expectedOutcome.expectedUrlPrefix) : true;

      return buildVerificationResult({
        input,
        observedOutcome: currentUrl,
        verificationDecision: hostMatches && prefixMatches ? "verified" : "failed",
        confidence: hostMatches && prefixMatches ? 1 : 0.92,
        failureReason: hostMatches && prefixMatches ? null : "unexpected_state",
        reviewRequiredReason: null,
        startedAt,
        endedAt: new Date().toISOString(),
      });
    },
  };
}