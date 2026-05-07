import {
  PRODUCT_DISCOVERY_NEGATIVE_ROUTE_LABEL,
  PRODUCT_DISCOVERY_POSITIVE_ROUTE_LABEL,
} from "../../map-plugins/route-plans/product-discovery-route-plan.constants.js";

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
): value is { isProductVideo: boolean | null; mustReview: boolean; routeLabel?: string; nextIntent?: string } => (
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
    routeLabel: null,
    nextIntent: null,
  };
};

const resolveProductPresenceRouteLabel = (output: { routeLabel?: string; isProductVideo: boolean | null }) =>
  typeof output.routeLabel === "string" && output.routeLabel.length > 0
    ? output.routeLabel
    : (output.isProductVideo === true ? PRODUCT_DISCOVERY_POSITIVE_ROUTE_LABEL : PRODUCT_DISCOVERY_NEGATIVE_ROUTE_LABEL);

const resolveProductPresenceNextIntent = (output: { nextIntent?: string; routeLabel?: string; isProductVideo: boolean | null }) => {
  if (typeof output.nextIntent === "string" && output.nextIntent.length > 0) {
    return output.nextIntent;
  }
  return resolveProductPresenceRouteLabel(output) === PRODUCT_DISCOVERY_POSITIVE_ROUTE_LABEL
    ? "读取评论并保存当前视频的选品证据。"
    : "跳过当前视频并继续自动发现。";
};

const buildProductPresenceFailedDecision = (output: { isProductVideo: boolean | null; mustReview: boolean; routeLabel?: string; nextIntent?: string }) => {
  return {
    status: "failed" as const,
    decision: "product_presence_failed",
    reviewRequiredReason: null,
    isProductVideo: output.isProductVideo,
    mustReview: output.mustReview,
    routeLabel: resolveProductPresenceRouteLabel(output),
    nextIntent: resolveProductPresenceNextIntent(output),
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
    decision: "product_no",
    reviewRequiredReason: resolveProductPresenceReviewReason(input),
    isProductVideo: input.isProductVideo,
    mustReview: input.mustReview,
    routeLabel: PRODUCT_DISCOVERY_NEGATIVE_ROUTE_LABEL,
    nextIntent: "跳过当前视频并继续自动发现。",
  };
};

const resolveProductPresenceDecision = (input: {
  status: "success" | "failed" | "review_required";
  confidence: number | null;
  reviewRequiredReason: string | null | undefined;
  output: { isProductVideo: boolean | null; mustReview: boolean; routeLabel?: string; nextIntent?: string };
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
      routeLabel: resolveProductPresenceRouteLabel(input.output),
      nextIntent: resolveProductPresenceNextIntent(input.output),
    };
  }
  return {
    status: "success" as const,
    decision: isProductVideo ? "product_yes" : "product_no",
    reviewRequiredReason: null,
    isProductVideo: isProductVideo === true,
    mustReview: false,
    routeLabel: resolveProductPresenceRouteLabel(input.output),
    nextIntent: resolveProductPresenceNextIntent(input.output),
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
