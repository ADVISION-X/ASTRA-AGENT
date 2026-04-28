import type { PageStateConfidencePolicy } from "../contract.js";

export function applyConfidencePolicy(input: {
  confidence: number;
  confidencePolicy: PageStateConfidencePolicy;
  reviewRequiredReason?: string | null;
}): { confidence: number; reviewRequiredReason: string | null; dataQualityFlags: string[] } {
  const confidence = Math.max(0, Math.min(1, input.confidence));
  if (confidence < input.confidencePolicy.minimumConfidence && input.confidencePolicy.allowReviewRequired) {
    return {
      confidence,
      reviewRequiredReason: input.reviewRequiredReason ?? `page-state confidence ${confidence.toFixed(2)} is below minimum ${input.confidencePolicy.minimumConfidence.toFixed(2)}`,
      dataQualityFlags: ["low_confidence"],
    };
  }

  return {
    confidence,
    reviewRequiredReason: input.reviewRequiredReason ?? null,
    dataQualityFlags: [],
  };
}