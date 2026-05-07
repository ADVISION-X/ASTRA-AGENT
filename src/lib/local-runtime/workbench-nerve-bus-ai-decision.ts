const PRODUCT_PRESENCE_TASK_TYPE = "product_presence_judgment";
const PRODUCT_PRESENCE_MIN_CONFIDENCE = 0.6;

export const describeFailureReason = (
  failureReason: string | { code?: string; message?: string; detail?: string | null } | null | undefined,
): string | null => {
  if (!failureReason) {
    return null;
  }

  if (typeof failureReason === "string") {
    return failureReason;
  }

  return failureReason.message ?? failureReason.code ?? failureReason.detail ?? "AI request failed.";
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isProductPresenceOutput = (
  value: unknown,
): value is { isProductVideo: boolean | null; mustReview: boolean } => (
  isRecord(value)
  && "isProductVideo" in value
  && (typeof value.isProductVideo === "boolean" || value.isProductVideo === null)
  && "mustReview" in value
  && typeof value.mustReview === "boolean"
);

const resolveProductPresenceReviewReason = (input: {
  reviewRequiredReason: string | null | undefined;
  mustReview: boolean;
  lowConfidence: boolean;
  isProductVideo: boolean | null;
}) => {
  if (input.reviewRequiredReason) {
    return input.reviewRequiredReason;
  }
  if (input.mustReview) {
    return "product_presence_requires_human_review";
  }
  if (input.lowConfidence) {
    return "product_presence_low_confidence";
  }
  if (input.isProductVideo === null) {
    return "product_presence_uncertain";
  }
  return "product_presence_review_required";
};

const buildDefaultDecision = (input: {
  aiTaskType: string;
  status: "success" | "failed" | "review_required";
  reviewRequiredReason: string | null | undefined;
  failureReason: string | null;
}) => {
  return {
    status: input.status,
    decision: input.aiTaskType,
    reviewRequiredReason: input.status === "review_required"
      ? (input.reviewRequiredReason ?? input.failureReason ?? "review required")
      : null,
    isProductVideo: null,
    mustReview: null,
  };
};

const buildProductPresenceFailedDecision = (output: { isProductVideo: boolean | null; mustReview: boolean }) => {
  return {
    status: "failed" as const,
    decision: "product_presence_failed",
    reviewRequiredReason: null,
    isProductVideo: output.isProductVideo,
    mustReview: output.mustReview,
  };
};

const buildProductPresenceReviewDecision = (input: {
  reviewRequiredReason: string | null | undefined;
  mustReview: boolean;
  lowConfidence: boolean;
  isProductVideo: boolean | null;
}) => {
  return {
    status: "review_required" as const,
    decision: "product_uncertain",
    reviewRequiredReason: resolveProductPresenceReviewReason(input),
    isProductVideo: input.isProductVideo,
    mustReview: input.mustReview,
  };
};

const resolveProductPresenceDecision = (input: {
  status: "success" | "failed" | "review_required";
  confidence: number | null;
  reviewRequiredReason: string | null | undefined;
  output: { isProductVideo: boolean | null; mustReview: boolean };
}) => {
  const lowConfidence = input.confidence === null || input.confidence < PRODUCT_PRESENCE_MIN_CONFIDENCE;
  const { isProductVideo, mustReview } = input.output;
  if (input.status === "failed") {
    return buildProductPresenceFailedDecision({ isProductVideo, mustReview });
  }
  if (isProductVideo === false && mustReview === false) {
    return {
      status: "success" as const,
      decision: "product_no",
      reviewRequiredReason: null,
      isProductVideo,
      mustReview,
    };
  }
  if (input.status === "review_required" || mustReview || lowConfidence || isProductVideo === null) {
    return buildProductPresenceReviewDecision({
      reviewRequiredReason: input.reviewRequiredReason,
      mustReview,
      lowConfidence,
      isProductVideo,
    });
  }

  return {
    status: "success" as const,
    decision: isProductVideo ? "product_yes" : "product_no",
    reviewRequiredReason: null,
    isProductVideo,
    mustReview,
  };
};

export const resolveWorkbenchAiDecision = (input: {
  aiTaskType: string;
  status: "success" | "failed" | "review_required";
  confidence: number | null;
  failureReason: string | null;
  reviewRequiredReason: string | null | undefined;
  output: unknown;
}) => {
  if (input.aiTaskType !== PRODUCT_PRESENCE_TASK_TYPE || !isProductPresenceOutput(input.output)) {
    return buildDefaultDecision(input);
  }

  return resolveProductPresenceDecision({
    status: input.status,
    confidence: input.confidence,
    reviewRequiredReason: input.reviewRequiredReason,
    output: input.output,
  });
};
