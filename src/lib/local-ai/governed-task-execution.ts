import { createId } from "../local-runtime/ids.js";
import type { LocalModelRoleConfig } from "./model-config.js";
import { buildVisionTaskResult } from "./vision-task-result.js";
import {
  CommentSignalTaskResultSchema,
  OcrTaskResultSchema,
  ProductSignalTaskResultSchema,
  type LocalAiTaskRequest,
  type LocalAiTaskResult,
} from "../../types/local-ai.js";

const createResultBase = (request: LocalAiTaskRequest, roleConfig: LocalModelRoleConfig, createdAt: string) => ({
  id: createId("ai"),
  taskType: request.taskType,
  modelRole: roleConfig.role,
  provider: roleConfig.provider,
  runtime: roleConfig.runtime,
  model: roleConfig.model,
  implementationStatus: "governed-heuristic" as const,
  promptVersion: roleConfig.promptVersion,
  schemaVersion: roleConfig.schemaVersion,
  evidenceRefs: request.evidenceRefs,
  createdAt,
});

const includesHint = (text: string, hints: string[]) => hints.some((hint) => text.includes(hint));

const resolveFrameLabels = (request: Extract<LocalAiTaskRequest, { taskType: "vision.productPresence" }>) => {
  if (request.input.samplingStrategy === "fixed_3_6_10") {
    return ["frame_3s", "frame_6s", "frame_10s"] as const;
  }

  return ["adaptive_first", "adaptive_mid", "adaptive_late"] as const;
};

const buildFrameLevelObservations = (request: Extract<LocalAiTaskRequest, { taskType: "vision.productPresence" }>) => {
  const frameLabels = resolveFrameLabels(request);
  const frameIds = request.input.frameEvidenceIds.length > 0
    ? request.input.frameEvidenceIds
    : request.input.screenshotEvidenceId
      ? [request.input.screenshotEvidenceId]
      : [];

  return frameIds.map((frameEvidenceId, index) => ({
    frameLabel: frameLabels[index] ?? "adaptive_late",
    hasVisibleProduct: null,
    visibleProductTypes: [],
    observations: [`aggregate heuristic evaluated frame evidence ${frameEvidenceId} without per-frame model attribution`],
  }));
};

const resolveVisionClassification = (summary: string, tags: string[]) => {
  const productHints = ["product", "kitchen", "organizer", "storage", "buy", "clean", "tool"];
  const negativeHints = ["no product", "non-product", "not a product", "pet clip"];
  const hasNegativeHint = includesHint(summary, negativeHints) || tags.includes("non-product");
  const hasProductHint = productHints.some((hint) => summary.includes(hint) || tags.includes(hint));
  return !hasNegativeHint && hasProductHint;
};

const resolveVisibleProductTypes = (isProduct: boolean, tags: string[]) => {
  return isProduct
    ? tags.filter((tag) => ["product", "organizer", "storage", "kitchen", "bathroom", "tool", "gadget"].includes(tag))
    : [];
};

const buildVisionEvidenceObservations = (summary: string) => {
  return [summary.slice(0, 120)].filter((item) => item.length > 0);
};

const resolveVisionUncertainty = (summary: string) =>
  summary.includes("uncertain") || summary.includes("maybe");

const resolveSuggestedVisionAction = (input: { isUncertain: boolean; isProduct: boolean }) =>
  input.isUncertain
    ? "skip_or_operator_review"
    : (input.isProduct ? "collect_metrics_like_marker_open_comments" : "click_not_interested_or_scroll_next");

const resolveVisionDecision = (summary: string, tags: string[]) => {
  const isUncertain = resolveVisionUncertainty(summary);
  const isProduct = resolveVisionClassification(summary, tags);
  return {
    confidence: isUncertain ? 0.45 : 0.91,
    isProductVideo: isUncertain ? null : isProduct,
    decision: isUncertain ? "product_uncertain" : (isProduct ? "product_yes" : "product_no"),
    reason: isProduct ? "summary contains product usage and utility hints" : "summary lacks product utility hints",
    suggestedNextAction: resolveSuggestedVisionAction({ isUncertain, isProduct }),
    visibleProductTypes: resolveVisibleProductTypes(isProduct, tags),
    evidenceObservations: buildVisionEvidenceObservations(summary),
    uncertainty: isUncertain ? ["product visibility is uncertain in the current screenshot"] : [],
    mustReview: false,
  } as const;
};

const buildNoValidFrameVisionResult = (input: {
  request: Extract<LocalAiTaskRequest, { taskType: "vision.productPresence" }>;
  roleConfig: LocalModelRoleConfig;
  createdAt: string;
  summary: string;
  frameLevelObservations: ReturnType<typeof buildFrameLevelObservations>;
}): LocalAiTaskResult =>
  buildVisionTaskResult(createResultBase(input.request, input.roleConfig, input.createdAt), input.request, 0, {
    isProductVideo: null,
    decision: "product_uncertain",
    confidence: 0,
    visibleProductTypes: [],
    evidenceObservations: buildVisionEvidenceObservations(input.summary),
    reason: "no valid frames available for product-presence classification",
    frameLevelObservations: input.frameLevelObservations,
    aggregateReason: "no valid frames available for product-presence classification",
    suggestedNextAction: "review_required",
    uncertainty: ["no_valid_frames"],
    mustReview: true,
  });

const resolveVisionCoverage = (input: {
  request: Extract<LocalAiTaskRequest, { taskType: "vision.productPresence" }>;
  decision: ReturnType<typeof resolveVisionDecision>;
}) => {
  const singleFramePositiveFallback = input.request.input.validFrameCount === 1 && input.decision.isProductVideo === true;
  const confidence = singleFramePositiveFallback ? Math.min(input.decision.confidence, 0.74) : input.decision.confidence;
  const uncertainty = [...input.decision.uncertainty];
  if (input.request.input.inputMode === "single_frame_fallback") uncertainty.push("single_frame_fallback");
  if (input.request.input.validFrameCount < 2) uncertainty.push("reduced_frame_coverage");
  return { singleFramePositiveFallback, confidence, uncertainty };
};

const buildValidFrameVisionResult = (input: {
  request: Extract<LocalAiTaskRequest, { taskType: "vision.productPresence" }>;
  roleConfig: LocalModelRoleConfig;
  createdAt: string;
  decision: ReturnType<typeof resolveVisionDecision>;
  frameLevelObservations: ReturnType<typeof buildFrameLevelObservations>;
}): LocalAiTaskResult => {
  const coverage = resolveVisionCoverage({ request: input.request, decision: input.decision });
  const aggregateReason = coverage.singleFramePositiveFallback
    ? `single-frame fallback reduced trust: ${input.decision.reason}`
    : input.decision.reason;
  return buildVisionTaskResult(createResultBase(input.request, input.roleConfig, input.createdAt), input.request, coverage.confidence, {
    isProductVideo: input.decision.isProductVideo,
    decision: coverage.singleFramePositiveFallback ? "product_uncertain" : input.decision.decision,
    confidence: coverage.confidence,
    visibleProductTypes: input.decision.visibleProductTypes,
    evidenceObservations: input.decision.evidenceObservations,
    reason: aggregateReason,
    frameLevelObservations: input.frameLevelObservations,
    aggregateReason,
    suggestedNextAction: coverage.singleFramePositiveFallback ? "skip_or_operator_review" : input.decision.suggestedNextAction,
    uncertainty: [...new Set(coverage.uncertainty)],
    mustReview: input.decision.mustReview,
  });
};

const executeVisionTask = (request: Extract<LocalAiTaskRequest, { taskType: "vision.productPresence" }>, roleConfig: LocalModelRoleConfig, createdAt: string): LocalAiTaskResult => {
  const summary = request.input.summary.toLowerCase();
  const tags = request.input.tags.map((tag) => tag.toLowerCase());
  const frameLevelObservations = buildFrameLevelObservations(request);
  if (request.input.validFrameCount === 0) {
    return buildNoValidFrameVisionResult({ request, roleConfig, createdAt, summary, frameLevelObservations });
  }

  const decision = resolveVisionDecision(summary, tags);
  return buildValidFrameVisionResult({ request, roleConfig, createdAt, decision, frameLevelObservations });
};

const executeOcrTask = (request: Extract<LocalAiTaskRequest, { taskType: "comments.ocr_cleanup" }>, roleConfig: LocalModelRoleConfig, createdAt: string): LocalAiTaskResult => {
  const cleanedComments = request.input.rawCommentBlocks.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
  const uncertainText = cleanedComments.filter((entry) => entry.includes("???"));
  const confidence = uncertainText.length > 0 ? 0.62 : 0.93;
  return OcrTaskResultSchema.parse({
    ...createResultBase(request, roleConfig, createdAt),
    confidence,
    result: { cleanedComments, uncertainText, confidence },
  });
};

const executeCommentIntentTask = (request: Extract<LocalAiTaskRequest, { taskType: "comments.intent_analysis" }>, roleConfig: LocalModelRoleConfig, createdAt: string): LocalAiTaskResult => {
  const joined = request.input.cleanedComments.join(" ").toLowerCase();
  const purchaseIntent = joined.includes("where can i buy") || joined.includes("i need this") ? "high" : joined.includes("useful") ? "medium" : "low";
  const painPoints = ["messy", "space", "storage", "bathroom", "kitchen"].filter((term) => joined.includes(term));
  const complaints = ["fake", "broke", "expensive"].filter((term) => joined.includes(term));
  const demandTerms = ["where can i buy", "need this", "save space", "useful"].filter((term) => joined.includes(term));
  const confidence = complaints.length > 0 ? 0.78 : 0.9;
  return CommentSignalTaskResultSchema.parse({
    ...createResultBase(request, roleConfig, createdAt),
    confidence,
    result: { purchaseIntent, painPoints, complaints, demandTerms, confidence },
  });
};

const executeProductSignalTask = (request: Extract<LocalAiTaskRequest, { taskType: "product.signal_summary" }>, roleConfig: LocalModelRoleConfig, createdAt: string): LocalAiTaskResult => {
  const { commentSignals, videoSummary, productPresence } = request.input;
  const category = videoSummary.toLowerCase().includes("bathroom") ? "Bathroom Organizer" : "Home Utility";
  return ProductSignalTaskResultSchema.parse({
    ...createResultBase(request, roleConfig, createdAt),
    confidence: Math.max(productPresence.confidence, commentSignals.confidence),
    result: {
      category,
      useCase: category === "Bathroom Organizer" ? "Reduce bathroom clutter" : "Solve a visible home utility problem",
      sellingPoints: ["visual utility", "easy to understand", "clear before-after outcome"],
      painPoints: commentSignals.painPoints.length > 0 ? commentSignals.painPoints : ["space"],
      purchaseIntent: commentSignals.purchaseIntent,
      risk: commentSignals.complaints.length > 0 ? "medium" : "low",
      score: commentSignals.purchaseIntent === "high" ? 0.84 : 0.58,
      rationale: "candidate generated from evidence-backed vision and comment signals",
    },
  });
};

export const executeGovernedTask = (request: LocalAiTaskRequest, roleConfig: LocalModelRoleConfig, createdAt: string): LocalAiTaskResult => {
  switch (request.taskType) {
    case "vision.productPresence":
      return executeVisionTask(request, roleConfig, createdAt);
    case "comments.ocr_cleanup":
      return executeOcrTask(request, roleConfig, createdAt);
    case "comments.intent_analysis":
      return executeCommentIntentTask(request, roleConfig, createdAt);
    case "product.signal_summary":
      return executeProductSignalTask(request, roleConfig, createdAt);
  }
};
