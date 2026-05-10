import { loadMuscleMemoryCatalog } from "../../muscle-memory/catalog/muscle-memory-catalog.js";
import type { VisualMissionActionPlan } from "../../muscle-memory/decoder/action-plan.schema.js";
import { VisualMissionActionPlanOutputSchema, type VisualMissionActionPlanOutput } from "../../types/visual-mission-action-plan.js";

export const isVisualMissionActionPlanOutput = (value: unknown): value is VisualMissionActionPlanOutput =>
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

export const resolveVisualMissionDecision = (input: {
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