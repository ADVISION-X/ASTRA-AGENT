import { type LocalAiVisionTaskRequest } from "../../types/local-ai-runtime-vision-contract.js";
import {
  PRODUCT_DISCOVERY_NEGATIVE_ROUTE_LABEL,
  PRODUCT_DISCOVERY_POSITIVE_ROUTE_LABEL,
} from "../../map-plugins/route-plans/product-discovery-route-plan.constants.js";

type JsonRecord = Record<string, unknown>;
type VisionProductPresenceRequest = Extract<LocalAiVisionTaskRequest, { taskType: "vision.productPresence" }>;

export type VisionRuntimeDecisionState = {
  normalizedRootIsProductVideo: boolean | null | undefined;
  rootIsProductVideo: boolean | null;
  visibleProductTypes: string[];
  evidenceObservations: string[];
  decision: "product_yes" | "product_no";
  routeLabel: string;
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

const normalizeProductDecision = (value: JsonRecord, isProductVideo: boolean | null) => {
  const rawDecision = typeof value.decision === "string" ? value.decision : null;
  if (rawDecision === "product_yes" || rawDecision === "product_no") return rawDecision;
  if (isProductVideo === true) return "product_yes";
  return "product_no";
};

const resolveRouteLabelForDecision = (decision: "product_yes" | "product_no") =>
  decision === "product_yes" ? PRODUCT_DISCOVERY_POSITIVE_ROUTE_LABEL : PRODUCT_DISCOVERY_NEGATIVE_ROUTE_LABEL;

const resolveNonExecutableSummaryForRouteLabel = (routeLabel: string) =>
  routeLabel === PRODUCT_DISCOVERY_POSITIVE_ROUTE_LABEL
    ? "当前证据支持产品展示，选择产品证据路线标签。"
    : "当前证据未证明产品展示，选择非产品路线标签。";

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

const resolveVisionRuntimeDecisionLabels = (value: JsonRecord, rootIsProductVideo: boolean | null) => {
  const decision = normalizeProductDecision(value, rootIsProductVideo);
  const routeLabel = resolveRouteLabelForDecision(decision);
  const nonExecutableSummary = typeof value.nonExecutableSummary === "string" && value.nonExecutableSummary.length > 0
    ? value.nonExecutableSummary
    : resolveNonExecutableSummaryForRouteLabel(routeLabel);

  return {
    decision,
    routeLabel,
    nonExecutableSummary,
  };
};

export const resolveVisionRuntimeDecisionState = (value: JsonRecord): VisionRuntimeDecisionState => {
  const inputs = resolveVisionRuntimeDecisionInputs(value);
  const labels = resolveVisionRuntimeDecisionLabels(value, inputs.rootIsProductVideo);
  const uncertainty = toStringArray(value.uncertainty);
  const confidence = typeof value.confidence === "number" && Number.isFinite(value.confidence) && value.confidence >= 0 && value.confidence <= 1
    ? value.confidence
    : typeof value.confidence === "string"
      ? (() => {
        const parsed = Number(value.confidence.trim());
        return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0;
      })()
      : 0;
  const consistentDecision = normalizeDecisionConsistency({
    decision: labels.decision,
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
