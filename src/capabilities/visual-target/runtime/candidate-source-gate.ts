import type { ParsedVisualTargetAbilityInput, VisualTargetCandidate, VisualTargetDataQualityFlag, VisualTargetFailureReason } from "../contract.js";
import type { ResolvedVisualTargetProfile } from "./visual-target-input-gate.js";
import {
  collectVisualTargetFlags,
  createVisualTargetGateBlocked,
  createVisualTargetGateReviewRequired,
  createVisualTargetGateSuccess,
  type VisualTargetGateBlocked,
  type VisualTargetGateReviewRequired,
  type VisualTargetGateSuccess,
} from "./visual-target-gate-results.js";

type CandidateSourceAllow = VisualTargetGateSuccess<"allow", {
  bindingDecision: "allow";
  candidates: VisualTargetCandidate[];
  rejectedCandidateRefs: string[];
}>;

type CandidateSourceBlocked = VisualTargetGateBlocked<"block", {
  bindingDecision: "block";
  rejectedCandidateRefs: string[];
}>;

type CandidateSourceReviewRequired = VisualTargetGateReviewRequired<"review_required", {
  bindingDecision: "review_required";
  rejectedCandidateRefs: string[];
}>;

type CandidateSourceInspection = {
  acceptedCandidate: VisualTargetCandidate | null;
  rejectedCandidateRef: string | null;
  dataQualityFlag: VisualTargetDataQualityFlag | null;
  failure: CandidateSourceReviewRequired | null;
};

function matchesRequestedBinding(expected: string | null, actual: string | null): boolean {
  return expected === null || actual === expected;
}

function createCandidateSourceBlocked(
  failureReason: VisualTargetFailureReason,
  statusMessage: string,
  rejectedCandidateRefs: string[],
  dataQualityFlags: VisualTargetDataQualityFlag[],
): CandidateSourceBlocked {
  return createVisualTargetGateBlocked({
    decision: "block",
    failureReason,
    statusMessage,
    dataQualityFlags,
    extra: { bindingDecision: "block", rejectedCandidateRefs },
  });
}

function createCandidateSourceReview(
  input: {
    failureReason: VisualTargetFailureReason;
    statusMessage: string;
    reviewRequiredReason: string;
    rejectedCandidateRefs: string[];
    dataQualityFlags: VisualTargetDataQualityFlag[];
  },
): CandidateSourceReviewRequired {
  return createVisualTargetGateReviewRequired({
    decision: "review_required",
    failureReason: input.failureReason,
    statusMessage: input.statusMessage,
    reviewRequiredReason: input.reviewRequiredReason,
    dataQualityFlags: input.dataQualityFlags,
    extra: { bindingDecision: "review_required", rejectedCandidateRefs: input.rejectedCandidateRefs },
  });
}

function createRejectedCandidateSourceInspection(
  rejectedCandidateRef: string,
  dataQualityFlag: VisualTargetDataQualityFlag,
): CandidateSourceInspection {
  return { acceptedCandidate: null, rejectedCandidateRef, dataQualityFlag, failure: null };
}

function createAcceptedCandidateSourceInspection(candidate: VisualTargetCandidate): CandidateSourceInspection {
  return { acceptedCandidate: candidate, rejectedCandidateRef: null, dataQualityFlag: null, failure: null };
}

function findCandidateObservationInspection(input: { profile: ResolvedVisualTargetProfile; candidate: VisualTargetCandidate }): CandidateSourceInspection | null {
  return input.profile.requiredObservationKinds.includes(input.candidate.targetType)
    ? null
    : createRejectedCandidateSourceInspection(input.candidate.candidateRef, "candidate_observation_kind_mismatch");
}

function resolveExpectedCandidateCaptureTime(input: { request: ParsedVisualTargetAbilityInput; candidate: VisualTargetCandidate }): string {
  return input.candidate.candidateKind === "ai_candidate" && input.request.sourceProof.ai
    ? input.request.sourceProof.ai.capturedAt
    : input.request.sourceProof.screenshot.capturedAt;
}

function findCandidateEvidenceBindingInspection(input: {
  request: ParsedVisualTargetAbilityInput;
  candidate: VisualTargetCandidate;
}): CandidateSourceInspection | null {
  const expectedSourceFrameRef = input.request.sourceProof.screenshot.screenshotEvidenceId;
  if (
    input.candidate.sourceFrameRef
    && !matchesRequestedBinding(expectedSourceFrameRef, input.candidate.sourceFrameRef)
  ) {
    return createRejectedCandidateSourceInspection(input.candidate.candidateRef, "candidate_source_binding_mismatch");
  }

  const expectedCapturedAt = resolveExpectedCandidateCaptureTime(input);
  return input.candidate.capturedAt === expectedCapturedAt
    ? null
    : createRejectedCandidateSourceInspection(input.candidate.candidateRef, "candidate_source_binding_mismatch");
}

function findCandidateSourceBindingInspection(input: {
  request: ParsedVisualTargetAbilityInput;
  profile: ResolvedVisualTargetProfile;
  candidate: VisualTargetCandidate;
}): CandidateSourceInspection | null {
  const { candidate } = input;
  if (candidate.sourceProofRef !== input.request.sourceProof.sourceProofRef) {
    return createRejectedCandidateSourceInspection(candidate.candidateRef, "candidate_source_binding_mismatch");
  }
  if (!input.profile.allowedCandidateKinds.includes(candidate.candidateKind)) {
    return createRejectedCandidateSourceInspection(candidate.candidateRef, "candidate_source_kind_mismatch");
  }
  return candidate.candidateKind === "ai_candidate" && !candidate.sourceFrameRef
    ? createRejectedCandidateSourceInspection(candidate.candidateRef, "candidate_source_frame_missing")
    : null;
}

function findCandidateSourceReadinessInspection(input: { candidate: VisualTargetCandidate }): CandidateSourceInspection | null {
  const { candidate } = input;
  if (candidate.blockedReason) {
    return createRejectedCandidateSourceInspection(candidate.candidateRef, "candidate_blocked");
  }
  if (!candidate.isVisible) {
    return createRejectedCandidateSourceInspection(candidate.candidateRef, "candidate_invisible");
  }
  return null;
}

function inspectCandidateSourceCandidate(input: {
  request: ParsedVisualTargetAbilityInput;
  profile: ResolvedVisualTargetProfile;
  candidate: VisualTargetCandidate;
}): CandidateSourceInspection {
  const bindingInspection = findCandidateSourceBindingInspection(input);
  if (bindingInspection) {
    return bindingInspection;
  }
  const observationInspection = findCandidateObservationInspection(input);
  if (observationInspection) {
    return observationInspection;
  }
  const evidenceBindingInspection = findCandidateEvidenceBindingInspection({
    request: input.request,
    candidate: input.candidate,
  });
  if (evidenceBindingInspection) {
    return evidenceBindingInspection;
  }
  const readinessInspection = findCandidateSourceReadinessInspection({
    candidate: input.candidate,
  });
  return readinessInspection ?? createAcceptedCandidateSourceInspection(input.candidate);
}

function resolveEmptyCandidateSourceReviewReason(dataQualityFlags: Set<VisualTargetDataQualityFlag>): VisualTargetFailureReason | null {
  if (dataQualityFlags.has("candidate_source_frame_missing")) {
    return "candidate_source_frame_missing";
  }
  if (dataQualityFlags.has("candidate_invisible")) {
    return "invisible_candidate";
  }
  return dataQualityFlags.has("operator_manual_review_required") ? "operator_approval_required" : null;
}

function resolveEmptyCandidateSourceBlocked(
  rejectedCandidateRefs: string[],
  dataQualityFlags: Set<VisualTargetDataQualityFlag>,
  flags: VisualTargetDataQualityFlag[],
): CandidateSourceBlocked | null {
  if (dataQualityFlags.has("candidate_blocked")) {
    return createCandidateSourceBlocked("blocked_candidate", "All visual target candidates were blocked by source policy.", rejectedCandidateRefs, flags);
  }
  if (dataQualityFlags.has("candidate_source_binding_mismatch")) {
    return createCandidateSourceBlocked("candidate_source_binding_mismatch", "Visual Target candidate proof binding diverged from the governed evidence chain.", rejectedCandidateRefs, flags);
  }
  if (dataQualityFlags.has("candidate_observation_kind_mismatch")) {
    return createCandidateSourceBlocked("candidate_observation_kind_mismatch", "Visual Target candidate observation kind is outside the governed child profile.", rejectedCandidateRefs, flags);
  }
  return dataQualityFlags.has("candidate_source_kind_mismatch")
    ? createCandidateSourceBlocked("candidate_source_kind_mismatch", "Visual Target candidate kind is outside the governed child profile.", rejectedCandidateRefs, flags)
    : null;
}

function createEmptyCandidateSourceFailure(
  rejectedCandidateRefs: string[],
  dataQualityFlags: Set<VisualTargetDataQualityFlag>,
): CandidateSourceBlocked | CandidateSourceReviewRequired {
  const flags = collectVisualTargetFlags(dataQualityFlags);
  const blockedFailure = resolveEmptyCandidateSourceBlocked(rejectedCandidateRefs, dataQualityFlags, flags);
  if (blockedFailure) {
    return blockedFailure;
  }

  const reviewReason = resolveEmptyCandidateSourceReviewReason(dataQualityFlags);
  if (reviewReason) {
    return createCandidateSourceReview({
      failureReason: reviewReason,
      statusMessage: "Visual Target requires review because no governed candidate survived source gating.",
      reviewRequiredReason: "Visual Target source gating left no bindable visible candidate for success.",
      rejectedCandidateRefs,
      dataQualityFlags: flags,
    });
  }
  return createCandidateSourceBlocked(
    "missing_candidate_source_proof",
    "Visual Target candidate source proof validation rejected every candidate.",
    rejectedCandidateRefs,
    flags,
  );
}

function collectCandidateSourceResults(input: {
  request: ParsedVisualTargetAbilityInput;
  profile: ResolvedVisualTargetProfile;
}): {
  candidates: VisualTargetCandidate[];
  rejectedCandidateRefs: string[];
  dataQualityFlags: Set<VisualTargetDataQualityFlag>;
  failure: CandidateSourceReviewRequired | null;
} {
  const candidates: VisualTargetCandidate[] = [];
  const rejectedCandidateRefs: string[] = [];
  const dataQualityFlags = new Set<VisualTargetDataQualityFlag>();

  for (const candidate of input.request.candidates) {
    const inspection = inspectCandidateSourceCandidate({ ...input, candidate });
    if (inspection.failure) {
      return { candidates, rejectedCandidateRefs, dataQualityFlags, failure: inspection.failure };
    }
    if (inspection.rejectedCandidateRef) {
      rejectedCandidateRefs.push(inspection.rejectedCandidateRef);
    }
    if (inspection.dataQualityFlag) {
      dataQualityFlags.add(inspection.dataQualityFlag);
    }
    if (inspection.acceptedCandidate) {
      candidates.push(inspection.acceptedCandidate);
    }
  }

  return { candidates, rejectedCandidateRefs, dataQualityFlags, failure: null };
}

export function validateCandidateSources(input: {
  request: ParsedVisualTargetAbilityInput;
  profile: ResolvedVisualTargetProfile;
}): CandidateSourceAllow | CandidateSourceBlocked | CandidateSourceReviewRequired {
  if (input.request.candidates.length === 0) {
    return createCandidateSourceBlocked("no_candidates", "Visual Target request contains no candidates.", [], []);
  }

  if (!input.profile.allowedSourceAbilityGroups.includes(input.request.sourceAbilityGroupId)) {
    return createCandidateSourceBlocked(
      "invalid_source_ability",
      "Visual Target sourceAbilityGroupId is outside the child policy allowlist.",
      [],
      [],
    );
  }

  const result = collectCandidateSourceResults(input);
  if (result.failure) {
    return result.failure;
  }

  if (result.candidates.length === 0) {
    return createEmptyCandidateSourceFailure(result.rejectedCandidateRefs, result.dataQualityFlags);
  }

  return createVisualTargetGateSuccess("allow", collectVisualTargetFlags(result.dataQualityFlags), {
    bindingDecision: "allow",
    candidates: result.candidates,
    rejectedCandidateRefs: result.rejectedCandidateRefs,
  });
}
