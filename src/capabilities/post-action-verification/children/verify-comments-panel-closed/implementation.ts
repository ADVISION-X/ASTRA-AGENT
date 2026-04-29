import { POST_ACTION_VERIFICATION_ABILITY_GROUP_ID, type PostActionObservation, type PostActionVerificationAbilityContext, type PostActionVerificationChildCapability } from "../../contract.js";
import { VerifyCommentsPanelClosedOutputSchema } from "./schema.js";

function getObservationsByKind<K extends PostActionObservation["kind"]>(
  observations: PostActionObservation[],
  kind: K,
): Array<PostActionObservation & { kind: K; payload: Extract<PostActionObservation["payload"], { kind: K }> }> {
  return observations.filter((observation): observation is PostActionObservation & { kind: K; payload: Extract<PostActionObservation["payload"], { kind: K }> } => observation.kind === kind && observation.payload.kind === kind);
}

export function createVerifyCommentsPanelClosedCapability(): PostActionVerificationChildCapability {
  return {
    abilityGroupId: POST_ACTION_VERIFICATION_ABILITY_GROUP_ID,
    childCapabilityId: "verify-comments-panel-closed" as const,
    async execute(input: Parameters<PostActionVerificationAbilityContext["evidenceReadPort"]["listObservations"]>[0], context: PostActionVerificationAbilityContext) {
      const observations = context.evidenceReadPort.listObservations(input);
      const pageState = getObservationsByKind(observations, "page_state")[0] ?? null;
      const visualTarget = getObservationsByKind(observations, "visual_target")[0] ?? null;
      const isOpen = [
        pageState?.payload.commentsPanelOpen ?? null,
        visualTarget?.payload.commentsPanelOpen ?? null,
        visualTarget?.payload.targetType === "comments_panel" ? true : null,
      ].find((value) => value !== null) ?? null;

      if (isOpen === null) {
        return VerifyCommentsPanelClosedOutputSchema.parse({
          observedOutcome: "comments_panel_unknown",
          verificationDecision: "review_required",
          confidence: 0,
          failureReason: "insufficient_evidence",
          reviewRequiredReason: "Comments panel close state is not observable from the governed after evidence.",
          statusMessage: "Comments panel close verification requires stronger after evidence.",
          dataQualityFlags: ["comments_state_unknown"],
        });
      }

      return VerifyCommentsPanelClosedOutputSchema.parse({
        observedOutcome: isOpen ? "comments_panel_open" : "comments_panel_closed",
        verificationDecision: isOpen ? "failed" : "verified",
        confidence: isOpen ? 0.88 : 0.92,
        failureReason: isOpen ? "unexpected_state" : null,
        reviewRequiredReason: null,
        statusMessage: isOpen ? "Comments panel remained open after the close action." : "Comments panel closed successfully.",
        dataQualityFlags: [],
      });
    },
  };
}
