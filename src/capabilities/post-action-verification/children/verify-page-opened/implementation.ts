import { POST_ACTION_VERIFICATION_ABILITY_GROUP_ID, type PostActionObservation } from "../../contract.js";
import { verifyNormalizedPostActionUrl } from "../../shared/post-action-url.js";
import type { PostActionVerificationChildCapability, PostActionVerificationRuntimeContext } from "../../runtime/post-action-verification-runtime-context.js";
import { VerifyPageOpenedOutputSchema } from "./schema.js";

function getObservationsByKind<K extends PostActionObservation["kind"]>(
  observations: PostActionObservation[],
  kind: K,
): Array<PostActionObservation & { kind: K; payload: Extract<PostActionObservation["payload"], { kind: K }> }> {
  return observations.filter((observation): observation is PostActionObservation & { kind: K; payload: Extract<PostActionObservation["payload"], { kind: K }> } => observation.kind === kind && observation.payload.kind === kind);
}

export function createVerifyPageOpenedCapability(): PostActionVerificationChildCapability {
  return {
    abilityGroupId: POST_ACTION_VERIFICATION_ABILITY_GROUP_ID,
    childCapabilityId: "verify-page-opened" as const,
    async execute(input, context: PostActionVerificationRuntimeContext) {
      const pageStateObservation = getObservationsByKind(context.evidenceReadPort.listObservations(input), "page_state")[0] ?? null;
      if (pageStateObservation === null) {
        return VerifyPageOpenedOutputSchema.parse({
          observedOutcome: "page_state_missing",
          verificationDecision: "review_required",
          confidence: 0,
          failureReason: "missing_observation_support",
          reviewRequiredReason: "Page-open verification requires governed page-state evidence.",
          statusMessage: "Page-state evidence is missing for page-open verification.",
          dataQualityFlags: ["page_state_missing"],
          supportingEvidenceRefs: [],
          supportingObservationRefs: [],
          supportingSourceProofRefs: [],
          verifiedByEvidenceKinds: [],
          confidenceSource: "missing_page_state_observation",
        });
      }

      const currentUrl = pageStateObservation.payload.currentUrl;
      const loginState = pageStateObservation.payload.loginState;
      if (!currentUrl || currentUrl === "about:blank") {
        return VerifyPageOpenedOutputSchema.parse({
          observedOutcome: currentUrl ?? "about:blank",
          verificationDecision: "failed",
          confidence: 1,
          failureReason: "unexpected_state",
          reviewRequiredReason: null,
          statusMessage: "Opened page remained blank.",
          dataQualityFlags: ["about_blank"],
          supportingEvidenceRefs: [],
          supportingObservationRefs: [pageStateObservation.ref],
          supportingSourceProofRefs: [pageStateObservation.source.sourceProofRef],
          verifiedByEvidenceKinds: ["page_state"],
          confidenceSource: "page_state_current_url",
        });
      }

      if (loginState === "captcha" || loginState === "security_wall") {
        return VerifyPageOpenedOutputSchema.parse({
          observedOutcome: loginState,
          verificationDecision: "failed",
          confidence: 1,
          failureReason: "policy_blocked",
          reviewRequiredReason: "Security or captcha wall intercepted the opened page.",
          statusMessage: "Page-open verification was blocked by a security wall.",
          dataQualityFlags: ["security_wall"],
          supportingEvidenceRefs: [],
          supportingObservationRefs: [pageStateObservation.ref],
          supportingSourceProofRefs: [pageStateObservation.source.sourceProofRef],
          verifiedByEvidenceKinds: ["page_state"],
          confidenceSource: "page_state_login_state",
        });
      }

      if (loginState === "login_required" || loginState === "review_required") {
        return VerifyPageOpenedOutputSchema.parse({
          observedOutcome: loginState,
          verificationDecision: "review_required",
          confidence: 0.9,
          failureReason: "insufficient_evidence",
          reviewRequiredReason: "Login or safety review is required before the page can be considered opened.",
          statusMessage: "Page-open verification requires review because the platform is not feed-ready.",
          dataQualityFlags: ["login_required"],
          supportingEvidenceRefs: [],
          supportingObservationRefs: [pageStateObservation.ref],
          supportingSourceProofRefs: [pageStateObservation.source.sourceProofRef],
          verifiedByEvidenceKinds: ["page_state"],
          confidenceSource: "page_state_login_state",
        });
      }

      const urlDecision = verifyNormalizedPostActionUrl({
        currentUrl,
        expectedUrlHost: input.expectedOutcome.expectedUrlHost,
        expectedUrlPrefix: input.expectedOutcome.expectedUrlPrefix,
      });

      if (!urlDecision.ok) {
        return VerifyPageOpenedOutputSchema.parse({
          observedOutcome: currentUrl,
          verificationDecision: "failed",
          confidence: 0.94,
          failureReason: "unexpected_state",
          reviewRequiredReason: null,
          statusMessage: "Opened page URL did not match the expected domain or prefix.",
          dataQualityFlags: [urlDecision.reason === "host_mismatch" ? "wrong_domain" : "url_prefix_mismatch"],
          supportingEvidenceRefs: [],
          supportingObservationRefs: [pageStateObservation.ref],
          supportingSourceProofRefs: [pageStateObservation.source.sourceProofRef],
          verifiedByEvidenceKinds: ["page_state"],
          confidenceSource: "page_state_current_url",
        });
      }

      return VerifyPageOpenedOutputSchema.parse({
        observedOutcome: currentUrl,
        verificationDecision: "verified",
        confidence: 1,
        failureReason: null,
        reviewRequiredReason: null,
        statusMessage: "Opened page matched the expected platform target.",
        dataQualityFlags: [],
        supportingEvidenceRefs: [],
        supportingObservationRefs: [pageStateObservation.ref],
        supportingSourceProofRefs: [pageStateObservation.source.sourceProofRef],
        verifiedByEvidenceKinds: ["page_state"],
        confidenceSource: "page_state_current_url",
      });
    },
  };
}
