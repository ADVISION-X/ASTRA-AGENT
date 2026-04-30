import type { ParsedVisualTargetAbilityInput, VisualTargetDataQualityFlag, VisualTargetFailureReason } from "../contract.js";
import { hashVisualTargetPayload } from "../shared/visual-target-types.js";

export function validateVisualTargetPayloadBudget(input: {
  request: ParsedVisualTargetAbilityInput;
}):
  | {
      ok: true;
      decision: "allow";
      candidateSetHash: string;
      dataQualityFlags: VisualTargetDataQualityFlag[];
    }
  | {
      ok: false;
      status: "failed" | "review_required";
      decision: "block" | "review_required";
      failureReason: VisualTargetFailureReason;
      statusMessage: string;
      reviewRequiredReason: string | null;
      candidateSetHash: string;
      dataQualityFlags: VisualTargetDataQualityFlag[];
    } {
  const candidateRefs = input.request.candidates.map((candidate) => candidate.candidateRef);
  const candidateSetHash = hashVisualTargetPayload(
    input.request.candidates.map((candidate) => ({
      candidateRef: candidate.candidateRef,
      targetType: candidate.targetType,
      coordinateSpace: candidate.coordinateSpace,
      boundingBox: candidate.boundingBox,
    })),
  );
  const duplicateRefs = candidateRefs.filter((candidateRef, index) => candidateRefs.indexOf(candidateRef) !== index);

  if (input.request.candidates.length > 50) {
    return {
      ok: false,
      status: "failed",
      decision: "block",
      failureReason: "payload_budget_exceeded",
      statusMessage: "Visual Target candidate payload exceeded the governed budget.",
      reviewRequiredReason: null,
      candidateSetHash,
      dataQualityFlags: ["payload_budget_exceeded"],
    };
  }

  if (duplicateRefs.length > 0) {
    return {
      ok: false,
      status: "failed",
      decision: "block",
      failureReason: "candidate_ref_duplicate",
      statusMessage: "Visual Target candidateRef values must stay unique inside one request.",
      reviewRequiredReason: null,
      candidateSetHash,
      dataQualityFlags: ["candidate_ref_duplicate"],
    };
  }

  return {
    ok: true,
    decision: "allow",
    candidateSetHash,
    dataQualityFlags: [],
  };
}