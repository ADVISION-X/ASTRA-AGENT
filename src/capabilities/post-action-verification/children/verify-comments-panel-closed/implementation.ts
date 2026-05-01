import {
  POST_ACTION_VERIFICATION_ABILITY_GROUP_ID,
  type ParsedPostActionVerificationAbilityInput,
  type PostActionObservation,
} from "../../contract.js";
import type { PostActionVerificationChildCapability, PostActionVerificationRuntimeContext } from "../../runtime/post-action-verification-runtime-context.js";
import { VerifyCommentsPanelClosedOutputSchema } from "./schema.js";

function getObservationsByKind<K extends PostActionObservation["kind"]>(
  observations: PostActionObservation[],
  kind: K,
): Array<PostActionObservation & { kind: K; payload: Extract<PostActionObservation["payload"], { kind: K }> }> {
  return observations.filter((observation): observation is PostActionObservation & { kind: K; payload: Extract<PostActionObservation["payload"], { kind: K }> } => observation.kind === kind && observation.payload.kind === kind);
}

function buildCommentsPanelClosedUnknownResult(alignedObservationRefs: string[], alignedSourceProofRefs: string[], afterEvidenceRef: string | null) {
  return VerifyCommentsPanelClosedOutputSchema.parse({
    observedOutcome: "comments_panel_unknown",
    verificationDecision: "review_required",
    confidence: 0,
    failureReason: "insufficient_evidence",
    reviewRequiredReason: "Comments panel close state is not observable from the governed after evidence.",
    statusMessage: "Comments panel close verification requires stronger after evidence.",
    dataQualityFlags: ["comments_state_unknown"],
    supportingEvidenceRefs: afterEvidenceRef ? [afterEvidenceRef] : [],
    supportingObservationRefs: alignedObservationRefs,
    supportingSourceProofRefs: alignedSourceProofRefs,
    verifiedByEvidenceKinds: ["page_state", "visual_target"],
    confidenceSource: "page_state_visual_target_alignment",
  });
}

function buildCommentsPanelClosedConflictResult(alignedObservationRefs: string[], alignedSourceProofRefs: string[], afterEvidenceRef: string | null) {
  return VerifyCommentsPanelClosedOutputSchema.parse({
    observedOutcome: "comments_panel_conflict",
    verificationDecision: "review_required",
    confidence: 0.3,
    failureReason: "conflicting_observation",
    reviewRequiredReason: "Page-state and visual-target evidence disagree on comments panel close state.",
    statusMessage: "Comments panel close verification encountered conflicting after evidence.",
    dataQualityFlags: ["conflicting_observation"],
    supportingEvidenceRefs: afterEvidenceRef ? [afterEvidenceRef] : [],
    supportingObservationRefs: alignedObservationRefs,
    supportingSourceProofRefs: alignedSourceProofRefs,
    verifiedByEvidenceKinds: ["page_state", "visual_target"],
    confidenceSource: "page_state_visual_target_alignment",
  });
}

function buildCommentsPanelClosedResult(pageStateSignal: boolean, alignedObservationRefs: string[], alignedSourceProofRefs: string[], afterEvidenceRef: string | null) {
  return VerifyCommentsPanelClosedOutputSchema.parse({
    observedOutcome: pageStateSignal ? "comments_panel_open" : "comments_panel_closed",
    verificationDecision: pageStateSignal ? "failed" : "verified",
    confidence: pageStateSignal ? 0.88 : 0.92,
    failureReason: pageStateSignal ? "unexpected_state" : null,
    reviewRequiredReason: null,
    statusMessage: pageStateSignal ? "Comments panel remained open after the close action." : "Comments panel closed successfully.",
    dataQualityFlags: [],
    supportingEvidenceRefs: afterEvidenceRef ? [afterEvidenceRef] : [],
    supportingObservationRefs: alignedObservationRefs,
    supportingSourceProofRefs: alignedSourceProofRefs,
    verifiedByEvidenceKinds: ["page_state", "visual_target"],
    confidenceSource: "page_state_visual_target_alignment",
  });
}

function resolveCommentsPanelClosedResult(input: {
  observations: PostActionObservation[];
  afterEvidenceRef: string | null;
}) {
  const pageState = getObservationsByKind(input.observations, "page_state")[0] ?? null;
  const visualTarget = getObservationsByKind(input.observations, "visual_target")[0] ?? null;
  const pageStateSignal = pageState?.payload.commentsPanelOpen ?? null;
  const visualSignal = visualTarget?.payload.commentsPanelOpen ?? (visualTarget?.payload.targetType === "comments_panel" ? true : null);
  const alignedObservationRefs = [pageState?.ref, visualTarget?.ref].filter((value): value is string => value !== null);
  const alignedSourceProofRefs = [pageState?.source.sourceProofRef, visualTarget?.source.sourceProofRef].filter((value): value is string => value !== null);

  if (pageStateSignal === null || visualSignal === null) {
    return buildCommentsPanelClosedUnknownResult(alignedObservationRefs, alignedSourceProofRefs, input.afterEvidenceRef);
  }

  if (pageStateSignal !== visualSignal) {
    return buildCommentsPanelClosedConflictResult(alignedObservationRefs, alignedSourceProofRefs, input.afterEvidenceRef);
  }

  return buildCommentsPanelClosedResult(pageStateSignal, alignedObservationRefs, alignedSourceProofRefs, input.afterEvidenceRef);
}

async function executeVerifyCommentsPanelClosed(
  input: ParsedPostActionVerificationAbilityInput,
  context: PostActionVerificationRuntimeContext,
  afterEvidenceRef: string | null,
) {
  return resolveCommentsPanelClosedResult({ observations: context.evidenceReadPort.listObservations(input), afterEvidenceRef });
}

export function createVerifyCommentsPanelClosedCapability(): PostActionVerificationChildCapability {
  return {
    abilityGroupId: POST_ACTION_VERIFICATION_ABILITY_GROUP_ID,
    childCapabilityId: "verify-comments-panel-closed" as const,
    async execute(input, context: PostActionVerificationRuntimeContext) {
      return executeVerifyCommentsPanelClosed(input, context, input.beforeAfterEvidence.afterEvidence?.evidenceRef ?? null);
    },
  };
}
