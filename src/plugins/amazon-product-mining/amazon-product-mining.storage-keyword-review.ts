import type Database from "better-sqlite3";

import type {
  AmazonKeywordOpportunityDecision,
  AmazonKeywordOpportunityReviewRecord,
} from "./amazon-product-mining.schema.js";
import { rowToKeywordOpportunityReview } from "./amazon-product-mining.storage-support.js";

type KeywordOpportunityReviewFilter = {
  taskId?: string;
  decision?: AmazonKeywordOpportunityDecision;
};

export type AmazonKeywordReviewStorageOperations = {
  saveKeywordOpportunityReview(review: AmazonKeywordOpportunityReviewRecord): AmazonKeywordOpportunityReviewRecord;
  getKeywordOpportunityReview(reviewId: string): AmazonKeywordOpportunityReviewRecord | null;
  listKeywordOpportunityReviews(input?: KeywordOpportunityReviewFilter): AmazonKeywordOpportunityReviewRecord[];
};

const keywordOpportunityReviewUpsertSql = `INSERT INTO amazon_mining_keyword_opportunity_reviews (
  review_id, task_id, keyword_id, keyword, status, decision, demand_signal,
  review_health, price_ceiling, competition_openness, improvement_opportunity,
  data_confidence, human_next_step, evidence_refs_json, missing_evidence_json,
  risk_points_json, ai_prompt_text, ai_raw_response, ai_response_ref, package_ref,
  keyword_package_slice_ref, failure_reason, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(review_id) DO UPDATE SET
  status=excluded.status,
  decision=excluded.decision,
  demand_signal=excluded.demand_signal,
  review_health=excluded.review_health,
  price_ceiling=excluded.price_ceiling,
  competition_openness=excluded.competition_openness,
  improvement_opportunity=excluded.improvement_opportunity,
  data_confidence=excluded.data_confidence,
  human_next_step=excluded.human_next_step,
  evidence_refs_json=excluded.evidence_refs_json,
  missing_evidence_json=excluded.missing_evidence_json,
  risk_points_json=excluded.risk_points_json,
  ai_prompt_text=excluded.ai_prompt_text,
  ai_raw_response=excluded.ai_raw_response,
  ai_response_ref=excluded.ai_response_ref,
  package_ref=excluded.package_ref,
  keyword_package_slice_ref=excluded.keyword_package_slice_ref,
  failure_reason=excluded.failure_reason,
  updated_at=excluded.updated_at`;

const buildKeywordOpportunityReviewValues = (
  review: AmazonKeywordOpportunityReviewRecord,
): readonly unknown[] => [
  review.reviewId, review.taskId, review.keywordId, review.keyword, review.status,
  review.decision, review.demandSignal, review.reviewHealth, review.priceCeiling,
  review.competitionOpenness, review.improvementOpportunity, review.dataConfidence,
  review.humanNextStep, JSON.stringify(review.evidenceRefs), JSON.stringify(review.missingEvidence),
  JSON.stringify(review.riskPoints), review.aiPromptText, review.aiRawResponse,
  review.aiResponseRef, review.packageRef, review.keywordPackageSliceRef, review.failureReason,
  review.createdAt, review.updatedAt,
];

const buildKeywordOpportunityReviewQuery = (
  input?: KeywordOpportunityReviewFilter,
): { values: unknown[]; whereClause: string } => {
  const conditions: string[] = [];
  const values: unknown[] = [];
  if (input?.taskId) {
    conditions.push("task_id=?");
    values.push(input.taskId);
  }
  if (input?.decision) {
    conditions.push("decision=?");
    values.push(input.decision);
  }
  return {
    values,
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
  };
};

export const createKeywordReviewOperations = (
  db: Database.Database,
): AmazonKeywordReviewStorageOperations => ({
  saveKeywordOpportunityReview(review) {
    db.prepare(keywordOpportunityReviewUpsertSql).run(...buildKeywordOpportunityReviewValues(review));
    return this.getKeywordOpportunityReview(review.reviewId)!;
  },

  getKeywordOpportunityReview(reviewId) {
    const row = db.prepare("SELECT * FROM amazon_mining_keyword_opportunity_reviews WHERE review_id=?").get(reviewId);
    return row ? rowToKeywordOpportunityReview(row as Record<string, unknown>) : null;
  },

  listKeywordOpportunityReviews(input) {
    const { values, whereClause } = buildKeywordOpportunityReviewQuery(input);
    const rows = db.prepare(`
      SELECT * FROM amazon_mining_keyword_opportunity_reviews
      ${whereClause}
      ORDER BY created_at DESC, review_id DESC
    `).all(...values) as Array<Record<string, unknown>>;
    return rows.map((row) => rowToKeywordOpportunityReview(row));
  },
});
