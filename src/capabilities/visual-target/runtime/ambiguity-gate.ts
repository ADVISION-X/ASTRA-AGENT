import type { VisualTargetDataQualityFlag, VisualTargetFailureReason } from "../contract.js";
import type { VisualTargetResolvedCandidate } from "./visual-target-child-contract.js";

function intersectionArea(left: VisualTargetResolvedCandidate, right: VisualTargetResolvedCandidate): number {
  const x1 = Math.max(left.executableBoundingBox.x, right.executableBoundingBox.x);
  const y1 = Math.max(left.executableBoundingBox.y, right.executableBoundingBox.y);
  const x2 = Math.min(left.executableBoundingBox.x + left.executableBoundingBox.width, right.executableBoundingBox.x + right.executableBoundingBox.width);
  const y2 = Math.min(left.executableBoundingBox.y + left.executableBoundingBox.height, right.executableBoundingBox.y + right.executableBoundingBox.height);
  return Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
}

function unionArea(left: VisualTargetResolvedCandidate, right: VisualTargetResolvedCandidate): number {
  return left.executableBoundingBox.width * left.executableBoundingBox.height + right.executableBoundingBox.width * right.executableBoundingBox.height - intersectionArea(left, right);
}

function overlapRatio(left: VisualTargetResolvedCandidate, right: VisualTargetResolvedCandidate): number {
  const union = unionArea(left, right);
  return union <= 0 ? 0 : intersectionArea(left, right) / union;
}

function clickPointDistance(left: VisualTargetResolvedCandidate, right: VisualTargetResolvedCandidate): number {
  if (!left.executableClickPoint || !right.executableClickPoint) {
    return Number.POSITIVE_INFINITY;
  }
  const dx = left.executableClickPoint.x - right.executableClickPoint.x;
  const dy = left.executableClickPoint.y - right.executableClickPoint.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function validateAmbiguity(input: {
  candidates: VisualTargetResolvedCandidate[];
  minimumAmbiguityGap: number;
}):
  | { ok: true; decision: "clear"; ambiguityTrace: string[]; dataQualityFlags: VisualTargetDataQualityFlag[] }
  | {
      ok: false;
      status: "review_required";
      decision: "review_required";
      failureReason: VisualTargetFailureReason;
      statusMessage: string;
      reviewRequiredReason: string;
      ambiguityTrace: string[];
      dataQualityFlags: VisualTargetDataQualityFlag[];
    } {
  if (input.candidates.length < 2) {
    return { ok: true, decision: "clear", ambiguityTrace: ["ambiguity clear: fewer than two candidates"], dataQualityFlags: [] };
  }

  const topCandidates = input.candidates.slice(0, 5);
  const primary = topCandidates[0]!;
  const ambiguityTrace = topCandidates.map((candidate, index) => `ambiguity rank ${index + 1}: ${candidate.candidateRef} confidence=${candidate.confidence.toFixed(4)}`);

  for (const challenger of topCandidates.slice(1)) {
    const gap = Math.abs(primary.confidence - challenger.confidence);
    const overlap = overlapRatio(primary, challenger);
    const nearClickPoint = clickPointDistance(primary, challenger) <= 4;
    const sourceConflict = primary.candidateKind !== challenger.candidateKind;

    ambiguityTrace.push(
      `compare ${primary.candidateRef} vs ${challenger.candidateRef}: gap=${gap.toFixed(4)} iou=${overlap.toFixed(4)} nearClick=${nearClickPoint ? "yes" : "no"} sourceConflict=${sourceConflict ? "yes" : "no"}`,
    );

    if (gap < input.minimumAmbiguityGap || overlap >= 0.4 || nearClickPoint || sourceConflict) {
      const flags: VisualTargetDataQualityFlag[] = [];
      if (gap < input.minimumAmbiguityGap) {
        flags.push("ambiguity_confidence_gap");
      }
      if (overlap >= 0.4) {
        flags.push("ambiguity_overlap");
      }
      if (nearClickPoint) {
        flags.push("ambiguity_near_click_point");
      }
      if (sourceConflict) {
        flags.push("ambiguity_source_conflict");
      }

      return {
        ok: false,
        status: "review_required",
        decision: "review_required",
        failureReason: "ambiguous_candidates",
        statusMessage: "Visual Target detected ambiguous candidates and refused success.",
        reviewRequiredReason: "Visual Target requires review because top-ranked candidates are still ambiguous.",
        ambiguityTrace,
        dataQualityFlags: flags,
      };
    }
  }

  return { ok: true, decision: "clear", ambiguityTrace, dataQualityFlags: [] };
}