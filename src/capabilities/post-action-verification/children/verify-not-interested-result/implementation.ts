import { POST_ACTION_VERIFICATION_ABILITY_GROUP_ID, type PostActionObservation } from "../../contract.js";
import type { PostActionVerificationChildCapability, PostActionVerificationRuntimeContext } from "../../runtime/post-action-verification-runtime-context.js";
import { VerifyNotInterestedResultOutputSchema } from "./schema.js";

function getObservationsByKind<K extends PostActionObservation["kind"]>(
  observations: PostActionObservation[],
  kind: K,
): Array<PostActionObservation & { kind: K; payload: Extract<PostActionObservation["payload"], { kind: K }> }> {
  return observations.filter((observation): observation is PostActionObservation & { kind: K; payload: Extract<PostActionObservation["payload"], { kind: K }> } => observation.kind === kind && observation.payload.kind === kind);
}

function buildNotInterestedUnknownResult(input: {
  supportingObservationRefs: string[];
  supportingSourceProofRefs: string[];
}) {
  return VerifyNotInterestedResultOutputSchema.parse({
    observedOutcome: "recommendation_change_unknown",
    verificationDecision: "review_required",
    confidence: 0,
    failureReason: "insufficient_evidence",
    reviewRequiredReason: "Not-interested verification requires governed feed mutation evidence.",
    statusMessage: "Recommendation mutation is not observable from the governed evidence.",
    dataQualityFlags: ["recommendation_change_unknown"],
    supportingEvidenceRefs: [],
    supportingObservationRefs: input.supportingObservationRefs,
    supportingSourceProofRefs: input.supportingSourceProofRefs,
    verifiedByEvidenceKinds: ["page_state", "screenshot_diff", "video_identity"],
    confidenceSource: "feed_mutation_evidence",
  });
}

function buildNotInterestedRuntimeSignalOnlyResult(input: {
  runtimeSignal: ReturnType<typeof getObservationsByKind<PostActionObservation["kind"]>>[number] | null;
  supportingObservationRefs: string[];
  supportingSourceProofRefs: string[];
}) {
  return VerifyNotInterestedResultOutputSchema.parse({
    observedOutcome: input.runtimeSignal?.payload.summary ?? "runtime_signal_only",
    verificationDecision: "review_required",
    confidence: 0.3,
    failureReason: "self_reported_success_only",
    reviewRequiredReason: "Runtime signal alone cannot establish a governed not-interested result.",
    statusMessage: "Not-interested verification requires corroborated before/after evidence.",
    dataQualityFlags: ["self_reported_only"],
    supportingEvidenceRefs: [],
    supportingObservationRefs: input.supportingObservationRefs,
    supportingSourceProofRefs: input.supportingSourceProofRefs,
    verifiedByEvidenceKinds: ["runtime_signal"],
    confidenceSource: "runtime_signal_only",
  });
}

function buildNotInterestedResult(input: {
  changed: boolean;
  pageState: ReturnType<typeof getObservationsByKind<PostActionObservation["kind"]>>[number] | null;
  runtimeSignal: ReturnType<typeof getObservationsByKind<PostActionObservation["kind"]>>[number] | null;
  screenshotDiff: ReturnType<typeof getObservationsByKind<PostActionObservation["kind"]>>[number] | null;
  videoAfter: ReturnType<typeof getObservationsByKind<PostActionObservation["kind"]>>[number] | null;
  supportingEvidenceRefs: string[];
  supportingObservationRefs: string[];
  supportingSourceProofRefs: string[];
}) {
  return VerifyNotInterestedResultOutputSchema.parse({
    observedOutcome: input.changed ? (input.pageState?.payload.changeSummary ?? input.runtimeSignal?.payload.summary ?? "recommendation_changed") : "recommendation_unchanged",
    verificationDecision: input.changed ? "verified" : "failed",
    confidence: input.changed ? 0.86 : 0.9,
    failureReason: input.changed ? null : "unexpected_state",
    reviewRequiredReason: null,
    statusMessage: input.changed ? "Recommendation feed changed after the not-interested action." : "Recommendation feed did not change after the not-interested action.",
    dataQualityFlags: [],
    supportingEvidenceRefs: input.supportingEvidenceRefs,
    supportingObservationRefs: input.supportingObservationRefs,
    supportingSourceProofRefs: input.supportingSourceProofRefs,
    verifiedByEvidenceKinds: ["page_state", "screenshot_diff", "video_identity"],
    confidenceSource: "feed_mutation_evidence",
  });
}

function resolveNotInterestedResult(input: {
  observations: PostActionObservation[];
  supportingEvidenceRefs: string[];
}) {
  const pageState = getObservationsByKind(input.observations, "page_state")[0] ?? null;
  const runtimeSignal = getObservationsByKind(input.observations, "runtime_signal")[0] ?? null;
  const screenshotDiff = getObservationsByKind(input.observations, "screenshot_diff")[0] ?? null;
  const videoAfter = getObservationsByKind(input.observations, "video_identity").find((observation) => observation.payload.role === "after") ?? null;
  const supportingObservationRefs = [pageState?.ref, runtimeSignal?.ref, screenshotDiff?.ref, videoAfter?.ref].filter((value): value is string => value !== null);
  const supportingSourceProofRefs = [pageState?.source.sourceProofRef, runtimeSignal?.source.sourceProofRef, screenshotDiff?.source.sourceProofRef, videoAfter?.source.sourceProofRef].filter((value): value is string => value !== null);
  const changed = pageState?.payload.recommendationChanged
    ?? (screenshotDiff?.payload.changed === true ? true : null)
    ?? (videoAfter?.payload.confirmed === true ? true : null)
    ?? null;

  if (changed === null) {
    return buildNotInterestedUnknownResult({ supportingObservationRefs, supportingSourceProofRefs });
  }

  if (pageState?.payload.recommendationChanged !== true && (runtimeSignal?.payload.recommendationChanged ?? null) === true) {
    return buildNotInterestedRuntimeSignalOnlyResult({ runtimeSignal, supportingObservationRefs: runtimeSignal ? [runtimeSignal.ref] : [], supportingSourceProofRefs: runtimeSignal ? [runtimeSignal.source.sourceProofRef] : [] });
  }

  return buildNotInterestedResult({
    changed: changed,
    pageState,
    runtimeSignal,
    screenshotDiff,
    videoAfter,
    supportingEvidenceRefs: input.supportingEvidenceRefs,
    supportingObservationRefs,
    supportingSourceProofRefs,
  });
}

async function executeVerifyNotInterestedResult(input: {
  observations: PostActionObservation[];
  supportingEvidenceRefs: string[];
}) {
  return resolveNotInterestedResult(input);
}

export function createVerifyNotInterestedResultCapability(): PostActionVerificationChildCapability {
  return {
    abilityGroupId: POST_ACTION_VERIFICATION_ABILITY_GROUP_ID,
    childCapabilityId: "verify-not-interested-result" as const,
    async execute(input, context: PostActionVerificationRuntimeContext) {
      return VerifyNotInterestedResultOutputSchema.parse(await executeVerifyNotInterestedResult({
        observations: context.evidenceReadPort.listObservations(input),
        supportingEvidenceRefs: [input.beforeAfterEvidence.beforeEvidence?.evidenceRef, input.beforeAfterEvidence.afterEvidence?.evidenceRef].filter((value): value is string => value !== null),
      }));
    },
  };
}
