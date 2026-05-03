import type { ParsedTextInputAbilityInput } from "../contract.js";

function buildTextInputTargetProofFailure(input: {
  status: "failed" | "review_required";
  failureReason: "input_target_ref_required" | "target_ref_required" | "target_proof_ref_required" | "target_binding_invalid" | null;
  reviewRequiredReason: string | null;
  statusMessage: string;
  policyDecision: "block" | "review_required";
  dataQualityFlags: string[];
}) {
  return {
    ok: false as const,
    status: input.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    statusMessage: input.statusMessage,
    policyDecision: input.policyDecision,
    dataQualityFlags: input.dataQualityFlags,
  };
}

function hasTextInputTargetRef(request: ParsedTextInputAbilityInput): boolean {
  return request.targetRef.length > 0;
}

function hasTextInputInputTargetRef(request: ParsedTextInputAbilityInput): boolean {
  return request.inputTargetRef.length > 0;
}

function hasTextInputTargetProofRef(request: ParsedTextInputAbilityInput): boolean {
  return request.targetProofRef.length > 0;
}

function hasTextInputTargetEvidenceRefs(request: ParsedTextInputAbilityInput): boolean {
  return request.targetEvidenceRefs.length > 0;
}

function hasTextInputTargetBinding(request: ParsedTextInputAbilityInput): boolean {
  return request.roundId !== null || request.videoVisitId !== null;
}

function resolveInputTargetRefFailure(request: ParsedTextInputAbilityInput) {
  if (hasTextInputInputTargetRef(request)) {
    return null;
  }

  return buildTextInputTargetProofFailure({
    status: "failed",
    failureReason: "input_target_ref_required",
    reviewRequiredReason: null,
    statusMessage: "Text Input requires a governed inputTargetRef.",
    policyDecision: "block",
    dataQualityFlags: ["input_target_ref_missing"],
  });
}

function resolveTargetRefFailure(request: ParsedTextInputAbilityInput) {
  if (hasTextInputTargetRef(request)) {
    return null;
  }

  return buildTextInputTargetProofFailure({
    status: "failed",
    failureReason: "target_ref_required",
    reviewRequiredReason: null,
    statusMessage: "Text Input requires a governed targetRef.",
    policyDecision: "block",
    dataQualityFlags: ["target_ref_missing"],
  });
}

function resolveGeometryGuardProofFailure(request: ParsedTextInputAbilityInput) {
  if (request.targetProofOwner !== "geometry-guard" || request.geometryGuardProofRef !== null) {
    return null;
  }

  return buildTextInputTargetProofFailure({
    status: "failed",
    failureReason: "target_binding_invalid",
    reviewRequiredReason: null,
    statusMessage: "Text Input requires geometryGuardProofRef when targetProofOwner is geometry-guard.",
    policyDecision: "block",
    dataQualityFlags: ["geometry_guard_proof_ref_missing"],
  });
}

function resolveInputTargetProofRefFailure(request: ParsedTextInputAbilityInput) {
  if (hasTextInputTargetProofRef(request)) {
    return null;
  }

  return buildTextInputTargetProofFailure({
    status: "failed",
    failureReason: "target_proof_ref_required",
    reviewRequiredReason: null,
    statusMessage: "Text Input requires targetProofRef before writing or pressing keys.",
    policyDecision: "block",
    dataQualityFlags: ["target_proof_ref_missing"],
  });
}

function resolveInputTargetEvidenceRefsFailure(request: ParsedTextInputAbilityInput) {
  if (hasTextInputTargetEvidenceRefs(request)) {
    return null;
  }

  return buildTextInputTargetProofFailure({
    status: "review_required",
    failureReason: null,
    reviewRequiredReason: "Text Input requires targetEvidenceRefs so the target proof remains reviewable.",
    statusMessage: "Text Input requires targetEvidenceRefs so the target proof remains reviewable.",
    policyDecision: "review_required",
    dataQualityFlags: ["target_evidence_refs_missing"],
  });
}

function resolveInputTargetBindingFailure(request: ParsedTextInputAbilityInput) {
  if (hasTextInputTargetBinding(request)) {
    return null;
  }

  return buildTextInputTargetProofFailure({
    status: "review_required",
    failureReason: null,
    reviewRequiredReason: "Text Input target proof must bind to roundId or videoVisitId.",
    statusMessage: "Text Input target proof must bind to roundId or videoVisitId.",
    policyDecision: "review_required",
    dataQualityFlags: ["target_binding_incomplete"],
  });
}

function resolveInputTargetProofPolicy(request: ParsedTextInputAbilityInput) {
  for (const failure of [
    resolveInputTargetRefFailure(request),
    resolveTargetRefFailure(request),
    resolveInputTargetProofRefFailure(request),
    resolveGeometryGuardProofFailure(request),
    resolveInputTargetEvidenceRefsFailure(request),
    resolveInputTargetBindingFailure(request),
  ]) {
    if (failure) {
      return failure;
    }
  }

  return {
    ok: true as const,
    policyDecision: "allow" as const,
    dataQualityFlags: [] as string[],
  };
}

export function validateInputTargetProof(input: { request: ParsedTextInputAbilityInput }) {
  return resolveInputTargetProofPolicy(input.request);
}