import type { AmazonKeywordOpportunityReviewRecord } from "./amazon-product-mining.package-artifact-builders.js";

type PackageKeywordEntry = {
  keywordId: string;
};

export const buildKeywordReviewEntries = (reviews: readonly AmazonKeywordOpportunityReviewRecord[]) =>
  reviews.map((review) => ({
    reviewId: review.reviewId,
    keywordId: review.keywordId,
    keyword: review.keyword,
    status: review.status,
    decision: review.decision,
    demandSignal: review.demandSignal,
    reviewHealth: review.reviewHealth,
    priceCeiling: review.priceCeiling,
    competitionOpenness: review.competitionOpenness,
    improvementOpportunity: review.improvementOpportunity,
    dataConfidence: review.dataConfidence,
    evidenceRefs: review.evidenceRefs,
    missingEvidence: review.missingEvidence,
    riskPoints: review.riskPoints,
    humanNextStep: review.humanNextStep,
    aiResponseRef: review.aiResponseRef,
    packageRef: review.packageRef,
    keywordPackageSliceRef: review.keywordPackageSliceRef,
    failureReason: review.failureReason,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  }));

export const attachKeywordReviewStatusToKeywordEntries = <T extends PackageKeywordEntry>(
  keywords: readonly T[],
  reviews: readonly AmazonKeywordOpportunityReviewRecord[],
) => {
  const reviewByKeywordId = new Map<string, AmazonKeywordOpportunityReviewRecord>();
  for (const review of reviews) {
    if (!reviewByKeywordId.has(review.keywordId)) {
      reviewByKeywordId.set(review.keywordId, review);
    }
  }

  return keywords.map((keyword) => {
    const review = reviewByKeywordId.get(keyword.keywordId);
    return {
      ...keyword,
      aiReviewStatus: review?.status ?? null,
      aiReviewDecision: review?.decision ?? null,
      aiReviewHumanNextStep: review?.humanNextStep ?? null,
      aiReviewDataConfidence: review?.dataConfidence ?? null,
      aiReviewResponseRef: review?.aiResponseRef ?? null,
      aiReviewPackageRef: review?.packageRef ?? null,
      aiReviewFailureReason: review?.failureReason ?? null,
    };
  });
};
