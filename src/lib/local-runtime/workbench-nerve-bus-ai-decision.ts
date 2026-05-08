import {
  PRODUCT_DISCOVERY_NEGATIVE_ROUTE_LABEL,
  PRODUCT_DISCOVERY_POSITIVE_ROUTE_LABEL,
} from "../../map-plugins/route-plans/product-discovery-route-plan.constants.js";
import {
  STARTUP_PREPARATION_BLOCKED_ROUTE_LABEL,
  STARTUP_PREPARATION_READY_ROUTE_LABEL,
} from "../../map-plugins/shared/startup-preparation.constants.js";

const PAGE_PREPARATION_TASK_TYPE = "page_preparation_judgment";
const PRODUCT_PRESENCE_TASK_TYPE = "product_presence_judgment";

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
): value is { isProductVideo: boolean | null; mustReview: boolean; routeLabel?: string; nonExecutableSummary?: string } => (
  isRecord(value)
  && "isProductVideo" in value
  && (typeof value.isProductVideo === "boolean" || value.isProductVideo === null)
  && "mustReview" in value
  && typeof value.mustReview === "boolean"
);

const isPagePreparationOutput = (
  value: unknown,
): value is { decision: "yes" | "no"; routeLabel?: string; nonExecutableSummary?: string } => (
  isRecord(value)
  && "decision" in value
  && (value.decision === "yes" || value.decision === "no")
);

const resolveProductPresenceReviewReason = (input: {
  reviewRequiredReason: string | null | undefined;
  mustReview: boolean;
  isProductVideo: boolean | null;
}) => {
  if (input.reviewRequiredReason) {
    return input.reviewRequiredReason;
  }
  if (input.mustReview) {
    return "product_presence_requires_human_review";
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
    nonExecutableSummary: null,
  };
};

const resolveProductPresenceRouteLabel = (output: { routeLabel?: string; isProductVideo: boolean | null }) =>
  typeof output.routeLabel === "string" && output.routeLabel.length > 0
    ? output.routeLabel
    : (output.isProductVideo === true ? PRODUCT_DISCOVERY_POSITIVE_ROUTE_LABEL : PRODUCT_DISCOVERY_NEGATIVE_ROUTE_LABEL);

const resolveProductPresenceNonExecutableSummary = (output: { nonExecutableSummary?: string; routeLabel?: string; isProductVideo: boolean | null }) => {
  if (typeof output.nonExecutableSummary === "string" && output.nonExecutableSummary.length > 0) {
    return output.nonExecutableSummary;
  }
  return resolveProductPresenceRouteLabel(output) === PRODUCT_DISCOVERY_POSITIVE_ROUTE_LABEL
    ? "当前证据支持产品展示，选择产品证据路线标签。"
    : "当前证据未证明产品展示，选择非产品路线标签。";
};

const resolvePagePreparationRouteLabel = (output: { routeLabel?: string; decision: "yes" | "no" }) =>
  typeof output.routeLabel === "string" && output.routeLabel.length > 0
    ? output.routeLabel
    : (output.decision === "yes" ? STARTUP_PREPARATION_READY_ROUTE_LABEL : STARTUP_PREPARATION_BLOCKED_ROUTE_LABEL);

const resolvePagePreparationNonExecutableSummary = (output: { nonExecutableSummary?: string; routeLabel?: string; decision: "yes" | "no" }) => {
  if (typeof output.nonExecutableSummary === "string" && output.nonExecutableSummary.length > 0) {
    return output.nonExecutableSummary;
  }
  return resolvePagePreparationRouteLabel(output) === STARTUP_PREPARATION_READY_ROUTE_LABEL
    ? "当前页面准备工作已完成，可以继续产品判断。"
    : "当前页面准备工作未完成，必须 fail-closed。";
};

const resolvePagePreparationDecision = (input: {
  status: "success" | "failed" | "review_required";
  output: { decision: "yes" | "no"; routeLabel?: string; nonExecutableSummary?: string };
}) => ({
  status: input.status,
  decision: input.output.decision,
  reviewRequiredReason: input.status === "review_required" ? "page_preparation_review_required" : null,
  isProductVideo: null,
  mustReview: false,
  routeLabel: resolvePagePreparationRouteLabel(input.output),
  nonExecutableSummary: resolvePagePreparationNonExecutableSummary(input.output),
});

const buildProductPresenceFailedDecision = (output: { isProductVideo: boolean | null; mustReview: boolean; routeLabel?: string; nonExecutableSummary?: string }) => {
  return {
    status: "failed" as const,
    decision: "product_presence_failed",
    reviewRequiredReason: null,
    isProductVideo: output.isProductVideo,
    mustReview: output.mustReview,
    routeLabel: resolveProductPresenceRouteLabel(output),
    nonExecutableSummary: resolveProductPresenceNonExecutableSummary(output),
  };
};

const buildProductPresenceReviewDecision = (input: {
  reviewRequiredReason: string | null | undefined;
  mustReview: boolean;
  isProductVideo: boolean | null;
}) => {
  return {
    status: "review_required" as const,
    decision: "product_no",
    reviewRequiredReason: resolveProductPresenceReviewReason(input),
    isProductVideo: input.isProductVideo,
    mustReview: input.mustReview,
    routeLabel: PRODUCT_DISCOVERY_NEGATIVE_ROUTE_LABEL,
    nonExecutableSummary: "当前证据未证明产品展示，选择非产品路线标签。",
  };
};

const resolveProductPresenceDecision = (input: {
  status: "success" | "failed" | "review_required";
  reviewRequiredReason: string | null | undefined;
  output: { isProductVideo: boolean | null; mustReview: boolean; routeLabel?: string; nonExecutableSummary?: string };
}) => {
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
      nonExecutableSummary: resolveProductPresenceNonExecutableSummary(input.output),
    };
  }
  return {
    status: "success" as const,
    decision: isProductVideo ? "product_yes" : "product_no",
    reviewRequiredReason: null,
    isProductVideo: isProductVideo === true,
    mustReview: false,
    routeLabel: resolveProductPresenceRouteLabel(input.output),
    nonExecutableSummary: resolveProductPresenceNonExecutableSummary(input.output),
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
  if (input.aiTaskType === PAGE_PREPARATION_TASK_TYPE && isPagePreparationOutput(input.output)) {
    return resolvePagePreparationDecision({
      status: input.status,
      output: input.output,
    });
  }

  if (input.aiTaskType !== PRODUCT_PRESENCE_TASK_TYPE || !isProductPresenceOutput(input.output)) {
    return buildDefaultDecision(input);
  }

  return resolveProductPresenceDecision({
    status: input.status,
    reviewRequiredReason: input.reviewRequiredReason,
    output: input.output,
  });
};
