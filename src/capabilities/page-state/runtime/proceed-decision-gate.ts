import type { PageStateClassificationOutcome } from "../shared/page-state-types.js";

export function decideProceed(input: PageStateClassificationOutcome): PageStateClassificationOutcome {
  if (input.reviewRequiredReason && input.status === "success") {
    return {
      ...input,
      status: "review_required",
      decision: "review_required",
      failureReason: input.failureReason ?? "classification_failed",
    };
  }

  if ((input.status === "blocked" || input.status === "review_required") && input.decision === "proceed") {
    return {
      ...input,
      decision: input.status === "blocked" ? "block" : "review_required",
      failureReason: input.failureReason ?? "classification_failed",
    };
  }

  return input;
}