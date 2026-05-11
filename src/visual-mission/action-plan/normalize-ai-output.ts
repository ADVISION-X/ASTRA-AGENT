import { loadMuscleMemoryCatalog } from "../../muscle-memory/catalog.js";
import {
  VisualMissionActionPlanOutputSchema,
  type VisualMissionActionPlanOutput,
} from "./ai-output.schema.js";
import {
  VisualMissionExecutablePlanSchema,
  type VisualMissionExecutablePlan,
  type VisualMissionExecutablePlanContextRefs,
} from "./executable-plan.schema.js";

type ContextRefInput = Partial<VisualMissionExecutablePlanContextRefs>;

const EMPTY_CONTEXT_REFS: VisualMissionExecutablePlanContextRefs = {
  aiResultRef: null,
  originalScreenshotRef: null,
  coordinateGridScreenshotRef: null,
  gridSpecRef: null,
  visualMissionInputRef: null,
  platformContextRef: null,
};

export const isVisualMissionActionPlanOutput = (value: unknown): value is VisualMissionActionPlanOutput =>
  VisualMissionActionPlanOutputSchema.safeParse(value).success;

const normalizeVisualMissionPageStateDecision = (
  decision: VisualMissionActionPlanOutput["pageStateDecision"],
): VisualMissionExecutablePlan["pageStateDecision"] => {
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
  return "STOP_REVIEW_REQUIRED";
};

export const shouldReviewVisualMissionOutput = (output: VisualMissionActionPlanOutput): boolean => (
  output.pageStateDecision === "review_required"
  || output.pageStateDecision === "blocked"
  || output.productDecision === "uncertain"
  || output.actions.some((action) => action.actionCode === "STOP_REVIEW_REQUIRED")
);

export const resolveVisualMissionReviewReason = (output: VisualMissionActionPlanOutput): string => {
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

export function buildVisualMissionContextRefs(input?: ContextRefInput): VisualMissionExecutablePlanContextRefs {
  return {
    ...EMPTY_CONTEXT_REFS,
    ...(input ?? {}),
  };
}

export function normalizeVisualMissionActionPlanOutput(input: {
  output: VisualMissionActionPlanOutput;
  userRequirementRef?: string | null;
  sourceAiResultRef?: string | null;
  contextRefs?: ContextRefInput;
}): VisualMissionExecutablePlan {
  return VisualMissionExecutablePlanSchema.parse({
    schemaVersion: "visualMissionActionPlan.v1",
    userRequirementRef: input.userRequirementRef ?? null,
    muscleMemoryCatalogVersion: loadMuscleMemoryCatalog().catalogVersion,
    platform: input.output.platform,
    pageStateDecision: normalizeVisualMissionPageStateDecision(input.output.pageStateDecision),
    taskDecision: resolveVisualMissionTaskDecision(input.output),
    confidence: input.output.confidence,
    reason: input.output.reason,
    actions: input.output.actions.map((action) => ({
      actionCode: action.actionCode,
      required: action.required,
      ...(action.input ? { input: action.input } : {}),
      reason: action.reason,
    })),
    riskFlags: input.output.riskFlags,
    nonExecutableSummary: input.output.nonExecutableSummary,
    contextRefs: buildVisualMissionContextRefs({
      ...(input.contextRefs ?? {}),
      aiResultRef: input.sourceAiResultRef ?? input.contextRefs?.aiResultRef ?? null,
    }),
  });
}