import type { VisualMissionActionPlan } from "../../muscle-memory/decoder/action-plan.schema.js";
import type { VisualMissionActionPlanOutput } from "../../types/visual-mission-action-plan.js";
import {
  isVisualMissionActionPlanOutput,
  normalizeVisualMissionActionPlanOutput,
  resolveVisualMissionReviewReason,
  shouldReviewVisualMissionOutput,
} from "../../visual-mission/action-plan/normalize-ai-output.js";

export const resolveVisualMissionDecision = (input: {
  status: "success" | "failed" | "review_required";
  reviewRequiredReason: string | null | undefined;
  output: VisualMissionActionPlanOutput;
}) => {
  const compatibleActionPlan = normalizeVisualMissionActionPlanOutput({
    output: input.output,
  }) as VisualMissionActionPlan;
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