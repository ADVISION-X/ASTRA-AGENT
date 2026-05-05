import {
  VisionTaskResultSchema,
  type LocalAiTaskRequest,
  type LocalAiTaskResult,
} from "../../types/local-ai.js";

type VisionProductPresenceRequest = Extract<LocalAiTaskRequest, { taskType: "vision.productPresence" }>;

type VisionFrameLevelObservation = {
  frameLabel: string;
  hasVisibleProduct: boolean | null;
  visibleProductTypes: string[];
  observations: string[];
};

type VisionResultInput = {
  isProductVideo: boolean | null;
  decision: "product_yes" | "product_no" | "product_uncertain" | null;
  confidence: number;
  visibleProductTypes: string[];
  evidenceObservations: string[];
  reason: string;
  frameLevelObservations: VisionFrameLevelObservation[];
  aggregateReason: string;
  suggestedNextAction: "collect_metrics_like_marker_open_comments" | "click_not_interested_or_scroll_next" | "skip_or_operator_review" | "review_required" | "scroll_next";
  uncertainty: string[];
  mustReview: boolean;
};

const createVisionResultPayload = (request: VisionProductPresenceRequest, input: VisionResultInput) => ({
  taskType: "vision.productPresence" as const,
  promptId: "vision.productPresence.v1" as const,
  promptVersion: "v1" as const,
  schemaVersion: "vision.productPresence.schema.v1" as const,
  inputMode: request.input.inputMode,
  multiFrameEvidenceSetId: request.input.multiFrameEvidenceSetId,
  contactSheetEvidenceId: request.input.contactSheetEvidenceId,
  frameEvidenceIds: request.input.frameEvidenceIds,
  screenshotEvidenceId: request.input.screenshotEvidenceId,
  sampledFrameCount: request.input.sampledFrameCount,
  validFrameCount: request.input.validFrameCount,
  expectedFrameCount: request.input.expectedFrameCount,
  fallbackReason: request.input.fallbackReason,
  missingFrames: request.input.missingFrames,
  isProductVideo: input.isProductVideo,
  decision: input.decision,
  confidence: input.confidence,
  visibleProductTypes: input.visibleProductTypes,
  evidenceObservations: input.evidenceObservations,
  reason: input.reason,
  frameLevelObservations: input.frameLevelObservations,
  aggregateReason: input.aggregateReason,
  suggestedNextAction: input.suggestedNextAction,
  uncertainty: input.uncertainty,
  mustReview: input.mustReview,
});

export const buildVisionTaskResult = (
  resultBase: Record<string, unknown>,
  request: VisionProductPresenceRequest,
  confidence: number,
  input: VisionResultInput,
): LocalAiTaskResult => VisionTaskResultSchema.parse({
  ...resultBase,
  confidence,
  result: createVisionResultPayload(request, input),
});
