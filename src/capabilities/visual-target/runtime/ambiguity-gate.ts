import type { VisualTargetCandidate, VisualTargetDataQualityFlag, VisualTargetFailureReason } from "../contract.js";

function intersectionArea(left: VisualTargetCandidate, right: VisualTargetCandidate): number {
  const x1 = Math.max(left.boundingBox.x, right.boundingBox.x);
  const y1 = Math.max(left.boundingBox.y, right.boundingBox.y);
  const x2 = Math.min(left.boundingBox.x + left.boundingBox.width, right.boundingBox.x + right.boundingBox.width);
  const y2 = Math.min(left.boundingBox.y + left.boundingBox.height, right.boundingBox.y + right.boundingBox.height);
  return Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
}

function unionArea(left: VisualTargetCandidate, right: VisualTargetCandidate): number {
  return left.boundingBox.width * left.boundingBox.height + right.boundingBox.width * right.boundingBox.height - intersectionArea(left, right);
}

function overlapRatio(left: VisualTargetCandidate, right: VisualTargetCandidate): number {
  const union = unionArea(left, right);
  return union <= 0 ? 0 : intersectionArea(left, right) / union;
}

export function validateAmbiguity(input: {
  candidates: VisualTargetCandidate[];
  minimumAmbiguityGap: number;
}):
  | { ok: true; decision: "clear"; dataQualityFlags: VisualTargetDataQualityFlag[] }
  | {
      ok: false;
      status: "review_required";
      decision: "review_required";
      failureReason: VisualTargetFailureReason;
      statusMessage: string;
      reviewRequiredReason: string;
      dataQualityFlags: VisualTargetDataQualityFlag[];
    } {
  if (input.candidates.length < 2) {
    return { ok: true, decision: "clear", dataQualityFlags: [] };
  }
  const [first, second] = input.candidates;
  const gap = Math.abs(first!.confidence - second!.confidence);
  const overlap = overlapRatio(first!, second!);
  if (gap < input.minimumAmbiguityGap || overlap >= 0.4) {
    return {
      ok: false,
      status: "review_required",
      decision: "review_required",
      failureReason: "ambiguous_candidates",
      statusMessage: "Visual Target detected ambiguous candidates and refused success.",
      reviewRequiredReason: "Visual Target requires review because candidate confidence gap or overlap is ambiguous.",
      dataQualityFlags: [gap < input.minimumAmbiguityGap ? "ambiguity_confidence_gap" : "ambiguity_overlap"],
    };
  }
  return { ok: true, decision: "clear", dataQualityFlags: [] };
}