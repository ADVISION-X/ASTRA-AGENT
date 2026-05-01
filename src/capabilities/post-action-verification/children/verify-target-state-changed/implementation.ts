import { POST_ACTION_VERIFICATION_ABILITY_GROUP_ID, type PostActionObservation } from "../../contract.js";
import type { PostActionVerificationChildCapability, PostActionVerificationRuntimeContext } from "../../runtime/post-action-verification-runtime-context.js";
import { VerifyTargetStateChangedOutputSchema } from "./schema.js";

function getObservationsByKind<K extends PostActionObservation["kind"]>(
  observations: PostActionObservation[],
  kind: K,
): Array<PostActionObservation & { kind: K; payload: Extract<PostActionObservation["payload"], { kind: K }> }> {
  return observations.filter((observation): observation is PostActionObservation & { kind: K; payload: Extract<PostActionObservation["payload"], { kind: K }> } => observation.kind === kind && observation.payload.kind === kind);
}

function buildTargetStateChangedUnknownResult(input: {
  evidenceRefs: string[];
  observationRefs: string[];
  sourceProofRefs: string[];
}) {
  return VerifyTargetStateChangedOutputSchema.parse({
    observedOutcome: "target_state_unknown",
    verificationDecision: "review_required",
    confidence: 0,
    failureReason: "insufficient_evidence",
    reviewRequiredReason: "Target-state verification requires governed before/after visual or page-state evidence.",
    statusMessage: "Target-state verification could not determine whether the target changed state.",
    dataQualityFlags: ["target_state_unknown"],
    supportingEvidenceRefs: input.evidenceRefs,
    supportingObservationRefs: input.observationRefs,
    supportingSourceProofRefs: input.sourceProofRefs,
    verifiedByEvidenceKinds: ["visual_target", "screenshot_diff", "page_state"],
    confidenceSource: "before_after_target_state_alignment",
  });
}

function buildTargetStateChangedResult(input: {
  changed: boolean;
  observedTargetType: string;
  evidenceRefs: string[];
  observationRefs: string[];
  sourceProofRefs: string[];
}) {
  return VerifyTargetStateChangedOutputSchema.parse({
    observedOutcome: input.changed ? `target_state_changed:${input.observedTargetType}` : `target_state_unchanged:${input.observedTargetType}`,
    verificationDecision: input.changed ? "verified" : "failed",
    confidence: input.changed ? 0.9 : 0.88,
    failureReason: input.changed ? null : "unexpected_state",
    reviewRequiredReason: null,
    statusMessage: input.changed ? "Target state changed after the click." : "Target state did not change after the click.",
    dataQualityFlags: [],
    supportingEvidenceRefs: input.evidenceRefs,
    supportingObservationRefs: input.observationRefs,
    supportingSourceProofRefs: input.sourceProofRefs,
    verifiedByEvidenceKinds: ["visual_target", "screenshot_diff", "page_state"],
    confidenceSource: "before_after_target_state_alignment",
  });
}

function resolveTargetStateChangedResult(input: {
  observations: PostActionObservation[];
  beforeEvidenceRef: string | null;
  afterEvidenceRef: string | null;
  expectedTargetType: string;
}) {
  const visualTarget = getObservationsByKind(input.observations, "visual_target")[0] ?? null;
  const screenshotDiff = getObservationsByKind(input.observations, "screenshot_diff")[0] ?? null;
  const pageState = getObservationsByKind(input.observations, "page_state")[0] ?? null;
  const screenshotSignal = screenshotDiff?.payload.targetStateChanged ?? null;
  const visualSignal = visualTarget?.payload.targetStateChanged ?? null;
  const pageSignal = pageState?.payload.targetStateChanged ?? null;
  const evidenceRefs = [input.beforeEvidenceRef, input.afterEvidenceRef].filter((value): value is string => value !== null);
  const observationRefs = [visualTarget?.ref, screenshotDiff?.ref, pageState?.ref].filter((value): value is string => value !== null);
  const sourceProofRefs = [visualTarget?.source.sourceProofRef, screenshotDiff?.source.sourceProofRef, pageState?.source.sourceProofRef].filter((value): value is string => value !== null);
  const changed = screenshotSignal === true && (visualSignal === true || pageSignal === true)
    ? true
    : screenshotSignal === false && visualSignal === false
      ? false
      : null;

  if (changed === null) {
    return buildTargetStateChangedUnknownResult({ evidenceRefs, observationRefs, sourceProofRefs });
  }

  const observedTargetType = visualTarget?.payload.targetType ?? pageState?.payload.targetType ?? input.expectedTargetType;
  return buildTargetStateChangedResult({ changed, observedTargetType, evidenceRefs, observationRefs, sourceProofRefs });
}

export function createVerifyTargetStateChangedCapability(): PostActionVerificationChildCapability {
  return {
    abilityGroupId: POST_ACTION_VERIFICATION_ABILITY_GROUP_ID,
    childCapabilityId: "verify-target-state-changed" as const,
    async execute(input, context: PostActionVerificationRuntimeContext) {
      return resolveTargetStateChangedResult({
        observations: context.evidenceReadPort.listObservations(input),
        beforeEvidenceRef: input.beforeAfterEvidence.beforeEvidence?.evidenceRef ?? null,
        afterEvidenceRef: input.beforeAfterEvidence.afterEvidence?.evidenceRef ?? null,
        expectedTargetType: input.expectedOutcome.expectedTargetType,
      });
    },
  };
}
