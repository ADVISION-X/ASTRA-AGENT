import { createId } from "./ids.js";
import type { EvidenceRef } from "../../types/evidence.js";
import type { LocalAiTaskResult } from "../../types/local-ai.js";
import { ProductOpportunityCandidateSchema, type ProductOpportunityCandidate } from "../../types/product-opportunity.js";

type VisionTaskResult = Extract<LocalAiTaskResult, { taskType: "vision.productPresence" }>;
type CommentTaskResult = Extract<LocalAiTaskResult, { taskType: "comments.intent_analysis" }>;

export function buildPendingAnalysisCandidate(input: {
  taskRunId: string;
  roundId: string;
  platformId: string;
  sourceVideoId: string;
  evidenceRefs: EvidenceRef[];
  visionResult: VisionTaskResult;
  commentSignalResult?: CommentTaskResult | null;
  note?: string;
}): ProductOpportunityCandidate {
  const commentSignalResult = input.commentSignalResult ?? null;
  const noteList = input.note ? [input.note] : [];
  const evidenceStrength = commentSignalResult
    ? Math.min(1, Number((input.visionResult.confidence * 0.7 + commentSignalResult.confidence * 0.3).toFixed(2)))
    : input.visionResult.confidence;

  return ProductOpportunityCandidateSchema.parse({
    id: createId("candidate"),
    taskRunId: input.taskRunId,
    roundId: input.roundId,
    platformId: input.platformId,
    sourceVideoId: input.sourceVideoId,
    analysisStatus: "pending_analysis",
    category: "pending_product_review",
    useCase: "Pending operator and advanced evidence review",
    sellingPoints: input.visionResult.result.visibleProductTypes.length > 0
      ? input.visionResult.result.visibleProductTypes
      : ["visible_product_present"],
    painPoints: commentSignalResult?.result.painPoints ?? [],
    purchaseIntent: commentSignalResult?.result.purchaseIntent ?? "low",
    risk: "medium",
    score: evidenceStrength,
    rationale: commentSignalResult
      ? `Pending-analysis candidate created from governed product-presence (${input.visionResult.confidence.toFixed(2)}) and comment-intent (${commentSignalResult.confidence.toFixed(2)}) evidence.`
      : `Pending-analysis candidate created from governed product-presence evidence only (${input.visionResult.confidence.toFixed(2)}).`,
    evidenceRefs: input.evidenceRefs,
    reviewStatus: "pending",
    notes: noteList,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}