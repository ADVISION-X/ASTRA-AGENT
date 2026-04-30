import type { PageStateClassificationOutcome } from "../shared/page-state-types.js";

const CRITICAL_FLAGS = new Set([
  "low_confidence",
  "missing_observation",
  "stale_snapshot",
  "stale_observation",
  "source_mismatch",
  "platform_mismatch",
  "insufficient_signal",
]);

export function decideProceed(input: PageStateClassificationOutcome): PageStateClassificationOutcome {
  if (input.reviewRequiredReason && input.status === "success") {
    return {
      ...input,
      status: "review_required",
      decision: "review_required",
      failureReason: input.failureReason ?? "classification_failed",
    };
  }

  if (input.status === "review_required" && input.decision === "proceed") {
    return {
      ...input,
      decision: "review_required",
      failureReason: input.failureReason ?? "classification_failed",
    };
  }

  if (input.status === "success" && input.dataQualityFlags.some((flag) => CRITICAL_FLAGS.has(flag))) {
    return {
      ...input,
      status: "review_required",
      decision: "review_required",
      failureReason: input.failureReason ?? "insufficient_signal",
      reviewRequiredReason: input.reviewRequiredReason ?? "Review required because critical data-quality flags remain on the page-state result.",
    };
  }

  return input;
}