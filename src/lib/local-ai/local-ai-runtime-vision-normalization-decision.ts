import { type LocalAiVisionTaskRequest } from "../../types/local-ai-runtime-vision-contract.js";
import { loadMuscleMemoryCatalog } from "../../muscle-memory/catalog/muscle-memory-catalog.js";
import type { VisualMissionActionPlan } from "../../muscle-memory/decoder/action-plan.schema.js";

type JsonRecord = Record<string, unknown>;
type VisionProductPresenceRequest = Extract<LocalAiVisionTaskRequest, { taskType: "vision.productPresence" }>;

export type VisionRuntimeDecisionState = {
  normalizedRootIsProductVideo: boolean | null | undefined;
  rootIsProductVideo: boolean | null;
  visibleProductTypes: string[];
  evidenceObservations: string[];
  taskDecision: "YES_SEEDING_VIDEO_FLOW" | "NO_SEEDING_VIDEO_FLOW";
  pageStateDecision: "ready";
  actionPlan: VisualMissionActionPlan;
  nonExecutableSummary: string;
  confidence: number;
  uncertainty: string[];
  consistentDecision: ReturnType<typeof normalizeDecisionConsistency>;
  isProductVideo: boolean | null;
};

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];

const NULLABLE_BOOLEAN_BY_TEXT = {
  true: true,
  false: false,
  null: null,
} as const;

const normalizeNullableBoolean = (value: unknown): boolean | null | undefined => {
  if (typeof value === "boolean" || value === null) return value;
  if (typeof value !== "string") return undefined;

  const normalized = value.trim().toLowerCase();
  return normalized in NULLABLE_BOOLEAN_BY_TEXT
    ? NULLABLE_BOOLEAN_BY_TEXT[normalized as keyof typeof NULLABLE_BOOLEAN_BY_TEXT]
    : undefined;
};

const resolveTaskDecision = (value: JsonRecord, isProductVideo: boolean | null): "YES_SEEDING_VIDEO_FLOW" | "NO_SEEDING_VIDEO_FLOW" => {
  const rawTaskDecision = typeof value.taskDecision === "string" ? value.taskDecision : null;
  if (rawTaskDecision === "YES_SEEDING_VIDEO_FLOW" || rawTaskDecision === "NO_SEEDING_VIDEO_FLOW") {
    return rawTaskDecision;
  }

  const rawActionPlan = value.actionPlan;
  if (
    rawActionPlan
    && typeof rawActionPlan === "object"
    && Array.isArray((rawActionPlan as { actions?: unknown[] }).actions)
  ) {
    const firstActionCode = (rawActionPlan as { actions: Array<{ actionCode?: unknown }> }).actions[0]?.actionCode;
    if (firstActionCode === "YES_SEEDING_VIDEO_FLOW" || firstActionCode === "NO_SEEDING_VIDEO_FLOW") {
      return firstActionCode;
    }
  }

  return isProductVideo === true ? "YES_SEEDING_VIDEO_FLOW" : "NO_SEEDING_VIDEO_FLOW";
};

const resolveNonExecutableSummary = (taskDecision: "YES_SEEDING_VIDEO_FLOW" | "NO_SEEDING_VIDEO_FLOW") =>
  taskDecision === "YES_SEEDING_VIDEO_FLOW"
    ? "当前证据显示视频存在明确产品展示，执行保存线索、点赞并切到下一条。"
    : "当前证据未显示明确产品展示，直接切到下一条。";

const normalizeDecisionConsistency = (input: {
  decision: "product_yes" | "product_no";
  isProductVideo: boolean | null;
  visibleProductTypes: string[];
  uncertainty: string[];
  mustReview: unknown;
}) => {
  if (input.decision === "product_no" && input.visibleProductTypes.length === 0 && input.uncertainty.length === 0) {
    return { isProductVideo: false, mustReview: false } as const;
  }
  if (input.decision === "product_yes" && input.visibleProductTypes.length > 0) {
    return { isProductVideo: true, mustReview: input.mustReview } as const;
  }

  return {
    isProductVideo: input.decision === "product_yes" ? input.isProductVideo : false,
    mustReview: false,
  } as const;
};

const resolveVisionRuntimeDecisionInputs = (value: JsonRecord) => {
  const visibleProductTypes = toStringArray(value.visibleProductTypes);
  const evidenceObservations = toStringArray(value.evidenceObservations);
  const normalizedRootIsProductVideo = normalizeNullableBoolean(value.isProductVideo);
  const rootIsProductVideo = normalizedRootIsProductVideo === undefined ? null : normalizedRootIsProductVideo;

  return {
    visibleProductTypes,
    evidenceObservations,
    normalizedRootIsProductVideo,
    rootIsProductVideo,
  };
};

const resolvePlatform = (sourceUrl: string): VisualMissionActionPlan["platform"] => {
  const normalized = sourceUrl.toLowerCase();
  if (normalized.includes("facebook")) {
    return "facebook-web";
  }
  if (normalized.includes("tiktok")) {
    return "tiktok-web";
  }
  return "unknown";
};

const buildActionPlan = (input: {
  request: VisionProductPresenceRequest;
  taskDecision: "YES_SEEDING_VIDEO_FLOW" | "NO_SEEDING_VIDEO_FLOW";
  pageStateDecision: "ready";
  confidence: number;
  uncertainty: string[];
  reason: string;
  nonExecutableSummary: string;
}): VisualMissionActionPlan => ({
  schemaVersion: "visualMissionActionPlan.v1",
  userRequirementRef: input.request.input.userRequirementRef ?? `user-requirement:${input.request.id}`,
  muscleMemoryCatalogVersion: loadMuscleMemoryCatalog().catalogVersion,
  platform: resolvePlatform(input.request.input.sourceUrl),
  pageStateDecision: input.pageStateDecision,
  taskDecision: input.taskDecision,
  confidence: input.confidence,
  reason: input.reason,
  actions: [
    {
      actionCode: input.taskDecision,
      required: true,
      reason: input.reason,
    },
  ],
  riskFlags: input.uncertainty,
  nonExecutableSummary: input.nonExecutableSummary,
});

const resolveVisionRuntimeDecisionLabels = (
  request: VisionProductPresenceRequest,
  value: JsonRecord,
  rootIsProductVideo: boolean | null,
  confidence: number,
  uncertainty: string[],
): Pick<VisionRuntimeDecisionState, "taskDecision" | "pageStateDecision" | "actionPlan" | "nonExecutableSummary"> => {
  const taskDecision = resolveTaskDecision(value, rootIsProductVideo);
  const pageStateDecision = "ready" as const;
  const nonExecutableSummary = typeof value.nonExecutableSummary === "string" && value.nonExecutableSummary.length > 0
    ? value.nonExecutableSummary
    : resolveNonExecutableSummary(taskDecision);
  const reason = typeof value.reason === "string" && value.reason.length > 0
    ? value.reason
    : (typeof value.aggregateReason === "string" && value.aggregateReason.length > 0
      ? value.aggregateReason
      : nonExecutableSummary);

  return {
    taskDecision,
    pageStateDecision,
    actionPlan: buildActionPlan({ request, taskDecision, pageStateDecision, confidence, uncertainty, reason, nonExecutableSummary }),
    nonExecutableSummary,
  };
};

export const resolveVisionRuntimeDecisionState = (value: JsonRecord, request: VisionProductPresenceRequest): VisionRuntimeDecisionState => {
  const inputs = resolveVisionRuntimeDecisionInputs(value);
  const uncertainty = toStringArray(value.uncertainty);
  const confidence = typeof value.confidence === "number" && Number.isFinite(value.confidence) && value.confidence >= 0 && value.confidence <= 1
    ? value.confidence
    : typeof value.confidence === "string"
      ? (() => {
        const parsed = Number(value.confidence.trim());
        return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0;
      })()
      : 0;
  const labels = resolveVisionRuntimeDecisionLabels(request, value, inputs.rootIsProductVideo, confidence, uncertainty);
  const consistentDecision = normalizeDecisionConsistency({
    decision: labels.taskDecision === "YES_SEEDING_VIDEO_FLOW" ? "product_yes" : "product_no",
    isProductVideo: inputs.rootIsProductVideo,
    visibleProductTypes: inputs.visibleProductTypes,
    uncertainty,
    mustReview: value.mustReview,
  });

  return {
    ...inputs,
    ...labels,
    confidence,
    uncertainty,
    consistentDecision,
    isProductVideo: consistentDecision.isProductVideo,
  };
};
