import type { ParsedPostActionVerificationAbilityInput, PostActionFailureReason } from "../contract.js";
import type { PostActionChildObservation, PostActionVerificationRuntimeContext } from "./post-action-verification-runtime-context.js";

const VISUAL_EVIDENCE_KINDS = new Set(["screenshot", "screenshot_diff", "visual_target"]);
const VISUAL_OBSERVATION_KINDS = new Set(["screenshot_diff", "visual_target"]);

export type PostActionObservationBundleGateResult = {
  status: "success" | "failed";
  failureReason: PostActionFailureReason | null;
  reviewRequiredReason: string | null;
  dataQualityFlags: string[];
};

const dedupeStrings = (values: readonly string[]) => [...new Set(values)];

const requiresBeforeAfterComparison = (request: ParsedPostActionVerificationAbilityInput) => (
  request.verificationPolicy.requireBeforeAfterComparison || request.expectedOutcome.requiresBeforeAfterComparison
);

const hasVisualEvidence = (request: ParsedPostActionVerificationAbilityInput) => (
  request.observationSet.observations.some((observation) => VISUAL_OBSERVATION_KINDS.has(observation.kind))
  || [request.beforeAfterEvidence.beforeEvidence, request.beforeAfterEvidence.afterEvidence].some((evidence) => evidence !== null && VISUAL_EVIDENCE_KINDS.has(evidence.evidenceKind))
);

const buildGateResult = (input: {
  status: "success" | "failed";
  failureReason: PostActionFailureReason | null;
  reviewRequiredReason: string | null;
  dataQualityFlags: string[];
}): PostActionObservationBundleGateResult => ({
  ...input,
  dataQualityFlags: dedupeStrings(input.dataQualityFlags),
});

const buildFailedGateResult = (input: {
  childObservation: PostActionChildObservation;
  failureReason: PostActionFailureReason | null;
  reviewRequiredReason: string | null;
  dataQualityFlags: string[];
}): PostActionObservationBundleGateResult => buildGateResult({
  status: "failed",
  failureReason: input.failureReason,
  reviewRequiredReason: input.reviewRequiredReason,
  dataQualityFlags: input.dataQualityFlags,
});

const buildSuccessfulGateResult = (input: { childObservation: PostActionChildObservation }): PostActionObservationBundleGateResult => buildGateResult({
  status: "success",
  failureReason: null,
  reviewRequiredReason: null,
  dataQualityFlags: input.childObservation.dataQualityFlags,
});

const buildObservationBundleFailure = (input: {
  childObservation: PostActionChildObservation;
  dataQualityFlags: string[];
  flag: string;
  failureReason: PostActionFailureReason;
}) => buildFailedGateResult({
  childObservation: input.childObservation,
  failureReason: input.failureReason,
  reviewRequiredReason: null,
  dataQualityFlags: [...input.dataQualityFlags, input.flag],
});

const evaluateObservationSupportGate = (input: {
  childObservation: PostActionChildObservation;
  dataQualityFlags: string[];
}) => input.childObservation.supportingObservationRefs.length === 0
  ? buildObservationBundleFailure({
    childObservation: input.childObservation,
    dataQualityFlags: input.dataQualityFlags,
    flag: "missing_observation",
    failureReason: "missing_observation_support",
  })
  : null;

const evaluateSourceProofGate = (input: {
  request: ParsedPostActionVerificationAbilityInput;
  context: PostActionVerificationRuntimeContext;
  childObservation: PostActionChildObservation;
  dataQualityFlags: string[];
}) => {
  if (input.childObservation.supportingSourceProofRefs.length === 0) {
    return buildObservationBundleFailure({
      childObservation: input.childObservation,
      dataQualityFlags: input.dataQualityFlags,
      flag: "missing_source_proof",
      failureReason: "insufficient_evidence",
    });
  }

  return !input.childObservation.supportingSourceProofRefs.every((ref) => input.context.evidenceReadPort.verifyProofRef(input.request, ref))
    ? buildObservationBundleFailure({
      childObservation: input.childObservation,
      dataQualityFlags: input.dataQualityFlags,
      flag: "invalid_source_proof",
      failureReason: "insufficient_evidence",
    })
    : null;
};

const evaluateEvidenceBindingGate = (input: {
  request: ParsedPostActionVerificationAbilityInput;
  context: PostActionVerificationRuntimeContext;
  childObservation: PostActionChildObservation;
  dataQualityFlags: string[];
}) => !input.childObservation.supportingEvidenceRefs.every((ref) => input.context.evidenceReadPort.verifyEvidenceBinding(input.request, ref))
  ? buildObservationBundleFailure({
    childObservation: input.childObservation,
    dataQualityFlags: input.dataQualityFlags,
    flag: "invalid_evidence_binding",
    failureReason: "insufficient_evidence",
  })
  : null;

const evaluateEvidencePolicyGate = (input: {
  request: ParsedPostActionVerificationAbilityInput;
  childObservation: PostActionChildObservation;
  dataQualityFlags: string[];
}) => {
  const hasBeforeEvidence = input.request.beforeAfterEvidence.beforeEvidence !== null;
  const hasAfterEvidence = input.request.beforeAfterEvidence.afterEvidence !== null;

  if (input.request.actionProof.selfReportedOnly && !input.request.verificationPolicy.allowSelfReportedSuccess) {
    return buildObservationBundleFailure({
      childObservation: input.childObservation,
      dataQualityFlags: input.dataQualityFlags,
      flag: "self_reported_only",
      failureReason: "insufficient_evidence",
    });
  }
  if (input.request.verificationPolicy.requireAfterEvidence && !hasAfterEvidence) {
    return buildObservationBundleFailure({
      childObservation: input.childObservation,
      dataQualityFlags: input.dataQualityFlags,
      flag: "missing_after_evidence",
      failureReason: "insufficient_evidence",
    });
  }
  return requiresBeforeAfterComparison(input.request) && (!hasBeforeEvidence || !hasAfterEvidence)
    ? buildObservationBundleFailure({
      childObservation: input.childObservation,
      dataQualityFlags: input.dataQualityFlags,
      flag: "missing_before_after_evidence",
      failureReason: "insufficient_evidence",
    })
    : null;
};

const evaluateVisualEvidenceGate = (input: {
  request: ParsedPostActionVerificationAbilityInput;
  childObservation: PostActionChildObservation;
  dataQualityFlags: string[];
}) => input.request.expectedOutcome.requiresVisualEvidence && !hasVisualEvidence(input.request)
  ? buildObservationBundleFailure({
    childObservation: input.childObservation,
    dataQualityFlags: input.dataQualityFlags,
    flag: "missing_visual_evidence",
    failureReason: "insufficient_evidence",
  })
  : null;

export function evaluatePostActionObservationBundleGate(input: {
  request: ParsedPostActionVerificationAbilityInput;
  context: PostActionVerificationRuntimeContext;
  childObservation: PostActionChildObservation;
}): PostActionObservationBundleGateResult {
  const dataQualityFlags = [...input.childObservation.dataQualityFlags];
  const failedGate = evaluateObservationSupportGate({ childObservation: input.childObservation, dataQualityFlags })
    ?? evaluateSourceProofGate({ ...input, dataQualityFlags })
    ?? evaluateEvidenceBindingGate({ ...input, dataQualityFlags })
    ?? evaluateEvidencePolicyGate({ request: input.request, childObservation: input.childObservation, dataQualityFlags })
    ?? evaluateVisualEvidenceGate({ request: input.request, childObservation: input.childObservation, dataQualityFlags });

  if (failedGate) {
    return failedGate;
  }

  return buildSuccessfulGateResult({ childObservation: input.childObservation });
}