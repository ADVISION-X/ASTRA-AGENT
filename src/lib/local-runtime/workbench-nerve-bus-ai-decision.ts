import {
  STARTUP_PREPARATION_BLOCKED_ROUTE_LABEL,
  STARTUP_PREPARATION_READY_ROUTE_LABEL,
} from "../../map-plugins/shared/startup-preparation.constants.js";
import { loadMuscleMemoryCatalog } from "../../muscle-memory/index.js";
import type { VisualMissionActionPlan } from "../../muscle-memory/decoder/action-plan.schema.js";
import { VisualMissionActionPlanOutputSchema, type VisualMissionActionPlanOutput } from "../../types/visual-mission-action-plan.js";

const PAGE_PREPARATION_TASK_TYPE = "page_preparation_judgment";
const PRODUCT_PRESENCE_TASK_TYPE = "product_presence_judgment";
const VISUAL_MISSION_ACTION_PLAN_TASK_TYPE = "visual_mission_action_plan";

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
): value is { isProductVideo: boolean | null; mustReview: boolean; taskDecision: string; pageStateDecision: string; actionPlan?: VisualMissionActionPlan; nonExecutableSummary?: string } => (
  isRecord(value)
  && "isProductVideo" in value
  && (typeof value.isProductVideo === "boolean" || value.isProductVideo === null)
  && "mustReview" in value
  && typeof value.mustReview === "boolean"
  && typeof value.taskDecision === "string"
  && typeof value.pageStateDecision === "string"
);

const isPagePreparationOutput = (
  value: unknown,
): value is { decision: "yes" | "no"; routeLabel?: string; nonExecutableSummary?: string } => (
  isRecord(value)
  && "decision" in value
  && (value.decision === "yes" || value.decision === "no")
);

const isVisualMissionActionPlanOutput = (value: unknown): value is VisualMissionActionPlanOutput =>
  VisualMissionActionPlanOutputSchema.safeParse(value).success;

const normalizeVisualMissionPageStateDecision = (decision: VisualMissionActionPlanOutput["pageStateDecision"]): VisualMissionActionPlan["pageStateDecision"] => {
  switch (decision) {
    case "ready":
      return "ready";
    case "recover":
      return "recover_to_entry";
    case "review_required":
    case "blocked":
      return "stop_review_required";
  }
};

const resolveVisualMissionTaskDecision = (output: VisualMissionActionPlanOutput): string => {
  const firstActionCode = output.actions[0]?.actionCode ?? null;
  if (firstActionCode) {
    return firstActionCode;
  }
  if (output.productDecision === "product_yes") {
    return "SAVE_LEAD";
  }
  if (output.productDecision === "product_no") {
    return "NEXT_VIDEO";
  }
  return "STOP_REVIEW_REQUIRED";
};

const shouldReviewVisualMissionOutput = (output: VisualMissionActionPlanOutput): boolean =>
  output.pageStateDecision === "review_required"
  || output.pageStateDecision === "blocked"
  || output.productDecision === "uncertain"
  || output.actions.some((action) => action.actionCode === "STOP_REVIEW_REQUIRED");

const resolveVisualMissionReviewReason = (output: VisualMissionActionPlanOutput): string => {
  if (output.pageStateDecision === "blocked") {
    return "visual_mission_blocked";
  }
  if (output.pageStateDecision === "review_required") {
    return "visual_mission_review_required";
  }
  if (output.productDecision === "uncertain") {
    return "visual_mission_product_uncertain";
  }
  return "visual_mission_stop_review_required";
};

const buildCompatibleVisualMissionActionPlan = (output: VisualMissionActionPlanOutput): VisualMissionActionPlan => ({
  schemaVersion: "visualMissionActionPlan.v1",
  userRequirementRef: null,
  muscleMemoryCatalogVersion: loadMuscleMemoryCatalog().catalogVersion,
  platform: output.platform,
  pageStateDecision: normalizeVisualMissionPageStateDecision(output.pageStateDecision),
  taskDecision: resolveVisualMissionTaskDecision(output),
  confidence: output.confidence,
  reason: output.reason,
  actions: output.actions.map((action) => ({
    actionCode: action.actionCode,
    required: action.required,
    ...(action.input ? { input: action.input } : {}),
    reason: action.reason,
  })),
  riskFlags: output.riskFlags,
  nonExecutableSummary: output.nonExecutableSummary,
});

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
    taskDecision: null,
    pageStateDecision: null,
    actionPlan: null,
    reviewRequiredReason: input.status === "review_required"
      ? (input.reviewRequiredReason ?? input.failureReason ?? "review required")
      : null,
    isProductVideo: null,
    mustReview: null,
    nonExecutableSummary: null,
  };
};

const resolveProductPresenceNonExecutableSummary = (output: { nonExecutableSummary?: string | undefined; taskDecision: string }) => {
  if (typeof output.nonExecutableSummary === "string" && output.nonExecutableSummary.length > 0) {
    return output.nonExecutableSummary;
  }
  return output.taskDecision === "YES_SEEDING_VIDEO_FLOW"
    ? "当前证据显示视频存在明确产品展示，执行保存线索、点赞并切到下一条。"
    : "当前证据未显示明确产品展示，直接切到下一条。";
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
  taskDecision: null,
  pageStateDecision: input.output.decision === "yes" ? "ready" : "stop_review_required",
  actionPlan: null,
  reviewRequiredReason: input.status === "review_required" ? "page_preparation_review_required" : null,
  isProductVideo: null,
  mustReview: false,
  nonExecutableSummary: resolvePagePreparationNonExecutableSummary(input.output),
});

const buildProductPresenceFailedDecision = (output: { isProductVideo: boolean | null; mustReview: boolean; taskDecision: string; pageStateDecision: string; actionPlan?: VisualMissionActionPlan | undefined; nonExecutableSummary?: string | undefined }) => {
  return {
    status: "failed" as const,
    decision: "product_presence_failed",
    taskDecision: output.taskDecision,
    pageStateDecision: output.pageStateDecision,
    actionPlan: output.actionPlan ?? null,
    reviewRequiredReason: null,
    isProductVideo: output.isProductVideo,
    mustReview: output.mustReview,
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
    decision: "product_presence_review_required",
    taskDecision: null,
    pageStateDecision: "stop_review_required",
    actionPlan: null,
    reviewRequiredReason: resolveProductPresenceReviewReason(input),
    isProductVideo: input.isProductVideo,
    mustReview: input.mustReview,
    nonExecutableSummary: "当前证据不足以进入自动动作执行，任务需要人工复核。",
  };
};

const resolveProductPresenceDecision = (input: {
  status: "success" | "failed" | "review_required";
  reviewRequiredReason: string | null | undefined;
  output: { isProductVideo: boolean | null; mustReview: boolean; taskDecision: string; pageStateDecision: string; actionPlan?: VisualMissionActionPlan; nonExecutableSummary?: string };
}) => {
  const { isProductVideo, mustReview } = input.output;
  if (input.status === "failed") {
    return buildProductPresenceFailedDecision({
      isProductVideo,
      mustReview,
      taskDecision: input.output.taskDecision,
      pageStateDecision: input.output.pageStateDecision,
      actionPlan: input.output.actionPlan,
      nonExecutableSummary: input.output.nonExecutableSummary,
    });
  }
  if (isProductVideo === false && mustReview === false) {
    return {
      status: "success" as const,
      decision: input.output.taskDecision,
      taskDecision: input.output.taskDecision,
      pageStateDecision: input.output.pageStateDecision,
      actionPlan: input.output.actionPlan ?? null,
      reviewRequiredReason: null,
      isProductVideo,
      mustReview,
      nonExecutableSummary: resolveProductPresenceNonExecutableSummary(input.output),
    };
  }
  return {
    status: "success" as const,
    decision: input.output.taskDecision,
    taskDecision: input.output.taskDecision,
    pageStateDecision: input.output.pageStateDecision,
    actionPlan: input.output.actionPlan ?? null,
    reviewRequiredReason: null,
    isProductVideo: isProductVideo === true,
    mustReview: false,
    nonExecutableSummary: resolveProductPresenceNonExecutableSummary(input.output),
  };
};

const resolveVisualMissionDecision = (input: {
  status: "success" | "failed" | "review_required";
  reviewRequiredReason: string | null | undefined;
  output: VisualMissionActionPlanOutput;
}) => {
  const compatibleActionPlan = buildCompatibleVisualMissionActionPlan(input.output);
  const taskDecision = compatibleActionPlan.taskDecision;
  const reviewRequiredReason = input.reviewRequiredReason ?? resolveVisualMissionReviewReason(input.output);

  if (input.status === "failed") {
    return {
      status: "failed" as const,
      decision: taskDecision,
      taskDecision,
      pageStateDecision: compatibleActionPlan.pageStateDecision,
      actionPlan: null,
      reviewRequiredReason: null,
      isProductVideo: input.output.isProductVideo,
      mustReview: false,
      nonExecutableSummary: input.output.nonExecutableSummary,
    };
  }

  if (input.status === "review_required" || shouldReviewVisualMissionOutput(input.output)) {
    return {
      status: "review_required" as const,
      decision: taskDecision,
      taskDecision,
      pageStateDecision: compatibleActionPlan.pageStateDecision,
      actionPlan: null,
      reviewRequiredReason,
      isProductVideo: input.output.isProductVideo,
      mustReview: true,
      nonExecutableSummary: input.output.nonExecutableSummary,
    };
  }

  return {
    status: "success" as const,
    decision: taskDecision,
    taskDecision,
    pageStateDecision: compatibleActionPlan.pageStateDecision,
    actionPlan: compatibleActionPlan,
    reviewRequiredReason: null,
    isProductVideo: input.output.isProductVideo,
    mustReview: false,
    nonExecutableSummary: input.output.nonExecutableSummary,
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

  if (input.aiTaskType === VISUAL_MISSION_ACTION_PLAN_TASK_TYPE && isVisualMissionActionPlanOutput(input.output)) {
    return resolveVisualMissionDecision({
      status: input.status,
      reviewRequiredReason: input.reviewRequiredReason,
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
