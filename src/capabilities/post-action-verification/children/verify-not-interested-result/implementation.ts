import { POST_ACTION_VERIFICATION_ABILITY_GROUP_ID, type PostActionObservation, type PostActionVerificationAbilityContext, type PostActionVerificationChildCapability } from "../../contract.js";
import { VerifyNotInterestedResultOutputSchema } from "./schema.js";

function getObservationsByKind<K extends PostActionObservation["kind"]>(
  observations: PostActionObservation[],
  kind: K,
): Array<PostActionObservation & { kind: K; payload: Extract<PostActionObservation["payload"], { kind: K }> }> {
  return observations.filter((observation): observation is PostActionObservation & { kind: K; payload: Extract<PostActionObservation["payload"], { kind: K }> } => observation.kind === kind && observation.payload.kind === kind);
}

export function createVerifyNotInterestedResultCapability(): PostActionVerificationChildCapability {
  return {
    abilityGroupId: POST_ACTION_VERIFICATION_ABILITY_GROUP_ID,
    childCapabilityId: "verify-not-interested-result" as const,
    async execute(input: Parameters<PostActionVerificationAbilityContext["evidenceReadPort"]["listObservations"]>[0], context: PostActionVerificationAbilityContext) {
      const observations = context.evidenceReadPort.listObservations(input);
      const pageState = getObservationsByKind(observations, "page_state")[0] ?? null;
      const runtimeSignal = getObservationsByKind(observations, "runtime_signal")[0] ?? null;
      const changed = [
        runtimeSignal?.payload.recommendationChanged ?? null,
        pageState?.payload.recommendationChanged ?? null,
      ].find((value) => value !== null) ?? null;

      if (changed === null) {
        return VerifyNotInterestedResultOutputSchema.parse({
          observedOutcome: "recommendation_change_unknown",
          verificationDecision: "review_required",
          confidence: 0,
          failureReason: "insufficient_evidence",
          reviewRequiredReason: "Not-interested verification requires governed feed mutation evidence.",
          statusMessage: "Recommendation mutation is not observable from the governed evidence.",
          dataQualityFlags: ["recommendation_change_unknown"],
        });
      }

      return VerifyNotInterestedResultOutputSchema.parse({
        observedOutcome: changed ? (pageState?.payload.changeSummary ?? runtimeSignal?.payload.summary ?? "recommendation_changed") : "recommendation_unchanged",
        verificationDecision: changed ? "verified" : "failed",
        confidence: changed ? 0.86 : 0.9,
        failureReason: changed ? null : "unexpected_state",
        reviewRequiredReason: null,
        statusMessage: changed ? "Recommendation feed changed after the not-interested action." : "Recommendation feed did not change after the not-interested action.",
        dataQualityFlags: [],
      });
    },
  };
}
