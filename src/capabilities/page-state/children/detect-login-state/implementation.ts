import { PAGE_STATE_ABILITY_GROUP_ID } from "../../contract.js";
import type { DetectLoginStateChildCapability } from "./contract.js";
import { DetectLoginStateChildInputSchema, DetectLoginStateChildOutputSchema } from "./schema.js";

export function createDetectLoginStateCapability(): DetectLoginStateChildCapability {
  return {
    abilityGroupId: PAGE_STATE_ABILITY_GROUP_ID,
    childCapabilityId: "detect-login-state",
    async execute(input) {
      const request = DetectLoginStateChildInputSchema.parse(input);
      const output = (() => {
        switch (request.snapshot.browserLoginState) {
          case "logged_in":
            return {
              childCapabilityId: "detect-login-state" as const,
              pageStateType: "logged_in" as const,
              stateSummary: "Browser session is governed as logged in.",
              confidence: 0.99,
              reviewRequiredReason: null,
              dataQualityFlags: [],
              matchedObservationIds: [],
              supportingEvidenceRefs: [...request.sourceEvidenceRefs],
              supportingReasons: ["snapshot.browserLoginState=logged_in"],
            };
          case "login_required":
            return {
              childCapabilityId: "detect-login-state" as const,
              pageStateType: "login_required" as const,
              stateSummary: "Browser session is blocked by a login wall.",
              confidence: 0.99,
              reviewRequiredReason: "Operator login is required before the page can proceed.",
              dataQualityFlags: [],
              matchedObservationIds: [],
              supportingEvidenceRefs: [...request.sourceEvidenceRefs],
              supportingReasons: ["snapshot.browserLoginState=login_required"],
            };
          case "review_required":
            return {
              childCapabilityId: "detect-login-state" as const,
              pageStateType: "captcha_challenge" as const,
              stateSummary: "Browser session requires challenge or safety review.",
              confidence: 0.98,
              reviewRequiredReason: "Browser login state already requires operator review.",
              dataQualityFlags: [],
              matchedObservationIds: [],
              supportingEvidenceRefs: [...request.sourceEvidenceRefs],
              supportingReasons: ["snapshot.browserLoginState=review_required"],
            };
          default:
            return {
              childCapabilityId: "detect-login-state" as const,
              pageStateType: "unknown_page" as const,
              stateSummary: "Browser login state is unknown.",
              confidence: 0.42,
              reviewRequiredReason: "Login state is unknown and cannot support proceed.",
              dataQualityFlags: ["insufficient_signal"],
              matchedObservationIds: [],
              supportingEvidenceRefs: [...request.sourceEvidenceRefs],
              supportingReasons: ["snapshot.browserLoginState=unknown"],
            };
        }
      })();

      return DetectLoginStateChildOutputSchema.parse(output);
    },
  };
}