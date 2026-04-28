import type { VisualTargetConfidencePolicy } from "../contract.js";

export const DEFAULT_VISUAL_TARGET_MIN_CONFIDENCE = 0.72;

export function resolveConfidencePolicy(input: VisualTargetConfidencePolicy | null | undefined): VisualTargetConfidencePolicy {
  return {
    minConfidence: input?.minConfidence ?? DEFAULT_VISUAL_TARGET_MIN_CONFIDENCE,
  };
}