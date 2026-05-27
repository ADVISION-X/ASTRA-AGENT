import { randomUUID } from "node:crypto";

import type { AiInputGatewayAbilityGroup } from "../../capabilities/ai-input-gateway/index.js";
import { AmazonMiningSchemas } from "./amazon-product-mining.schema.js";
import type {
  AmazonKeywordOpportunityManualIngestInput,
  AmazonKeywordOpportunityReviewRecord,
  AmazonKeywordOpportunityVerdict,
  AmazonKeywordProviderKind,
  AmazonKeywordRecord,
} from "./amazon-product-mining.schema.js";
import type { AmazonMiningStorage } from "./amazon-product-mining.storage.js";
import {
  buildKeywordEvidenceSlice,
  parseKeywordReviewResponse,
  resolveKeywordReviewArtifacts,
  validateKeywordReviewVerdict,
  writeKeywordReviewResponseArtifact,
  writeKeywordReviewSourceArtifacts,
  type KeywordReviewArtifacts,
} from "./amazon-product-mining.keyword-review-support.js";

const buildReviewRecord = (input: {
  reviewId: string;
  taskId: string;
  keyword: AmazonKeywordRecord;
  status: AmazonKeywordOpportunityReviewRecord["status"];
  verdict: AmazonKeywordOpportunityVerdict | null;
  artifacts: KeywordReviewArtifacts;
  aiPromptText: string;
  aiRawResponse: string;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string | null;
}): AmazonKeywordOpportunityReviewRecord => ({
  reviewId: input.reviewId,
  taskId: input.taskId,
  keywordId: input.keyword.keywordId,
  keyword: input.keyword.keyword,
  status: input.status,
  decision: input.verdict?.decision ?? null,
  demandSignal: input.verdict?.demandSignal ?? null,
  reviewHealth: input.verdict?.reviewHealth ?? null,
  priceCeiling: input.verdict?.priceCeiling ?? null,
  competitionOpenness: input.verdict?.competitionOpenness ?? null,
  improvementOpportunity: input.verdict?.improvementOpportunity ?? null,
  dataConfidence: input.verdict?.dataConfidence ?? null,
  evidenceRefs: input.verdict?.evidenceRefs ?? [],
  missingEvidence: input.verdict?.missingEvidence ?? [],
  riskPoints: input.verdict?.riskPoints ?? [],
  humanNextStep: input.verdict?.humanNextStep ?? null,
  aiPromptText: input.aiPromptText,
  aiRawResponse: input.aiRawResponse,
  aiResponseRef: input.artifacts.responsePath,
  packageRef: input.artifacts.inputJsonPath,
  keywordPackageSliceRef: input.artifacts.inputJsonPath,
  failureReason: input.failureReason,
  createdAt: input.createdAt,
  updatedAt: input.updatedAt,
});

export const persistKeywordOpportunityReview = (input: {
  storage: AmazonMiningStorage;
  review: AmazonKeywordOpportunityReviewRecord;
}): AmazonKeywordOpportunityReviewRecord => input.storage.saveKeywordOpportunityReview(input.review);

export const runKeywordOpportunityReview = async (input: {
  dataDir: string;
  taskId: string;
  keyword: AmazonKeywordRecord;
  storage: AmazonMiningStorage;
  aiInputGateway: AiInputGatewayAbilityGroup;
  providerKind: AmazonKeywordProviderKind;
}): Promise<AmazonKeywordOpportunityReviewRecord> => {
  const evidenceSlice = buildKeywordEvidenceSlice({
    storage: input.storage,
    taskId: input.taskId,
    keyword: input.keyword,
  });
  const { artifacts, aiPromptText } = writeKeywordReviewSourceArtifacts({
    dataDir: input.dataDir,
    taskId: input.taskId,
    keywordId: input.keyword.keywordId,
    evidenceSlice,
  });

  const reviewId = randomUUID();
  const createdAt = new Date().toISOString();

  try {
    const aiResult = await input.aiInputGateway.execute({
      providerKind: input.providerKind,
      promptPackageId: `amazon-mining-keyword-review-${input.taskId}-${input.keyword.keywordId}`,
      promptContractId: "amazon-product-mining-keyword-opportunity-review-v1",
      expectedOutputSchemaRef: null,
      textPrompt: aiPromptText,
      inputRefs: [artifacts.inputJsonPath],
      modelName: null,
      timeoutMs: 120_000,
      maxInputChars: 120_000,
      maxFileCount: 0,
      maxFileBytes: 1,
      requestedBy: "ai-capability",
      missionId: input.taskId,
      runId: reviewId,
      roundId: input.keyword.keywordId,
    });
    const aiRawResponse = aiResult.normalizedText ?? "";

    if (aiResult.status === "review_required") {
      writeKeywordReviewResponseArtifact({
        reviewId,
        status: "manual_required",
        failureReason: aiResult.reviewRequiredReason ?? "keyword_review_manual_required",
        rawResponse: aiRawResponse,
        verdict: null,
        responsePath: artifacts.responsePath,
      });
      return persistKeywordOpportunityReview({
        storage: input.storage,
        review: buildReviewRecord({
          reviewId,
          taskId: input.taskId,
          keyword: input.keyword,
          status: "manual_required",
          verdict: null,
          artifacts,
          aiPromptText,
          aiRawResponse,
          failureReason: aiResult.reviewRequiredReason ?? "keyword_review_manual_required",
          createdAt,
          updatedAt: null,
        }),
      });
    }

    if (aiResult.status !== "success") {
      writeKeywordReviewResponseArtifact({
        reviewId,
        status: "failed",
        failureReason: aiResult.failureReason ?? "keyword_review_ai_failed",
        rawResponse: aiRawResponse,
        verdict: null,
        responsePath: artifacts.responsePath,
      });
      return persistKeywordOpportunityReview({
        storage: input.storage,
        review: buildReviewRecord({
          reviewId,
          taskId: input.taskId,
          keyword: input.keyword,
          status: "failed",
          verdict: null,
          artifacts,
          aiPromptText,
          aiRawResponse,
          failureReason: aiResult.failureReason ?? "keyword_review_ai_failed",
          createdAt,
          updatedAt: null,
        }),
      });
    }

    const verdict = parseKeywordReviewResponse(aiRawResponse);
    if (!verdict) {
      writeKeywordReviewResponseArtifact({
        reviewId,
        status: "failed",
        failureReason: "keyword_review_invalid_or_non_json_response",
        rawResponse: aiRawResponse,
        verdict: null,
        responsePath: artifacts.responsePath,
      });
      return persistKeywordOpportunityReview({
        storage: input.storage,
        review: buildReviewRecord({
          reviewId,
          taskId: input.taskId,
          keyword: input.keyword,
          status: "failed",
          verdict: null,
          artifacts,
          aiPromptText,
          aiRawResponse,
          failureReason: "keyword_review_invalid_or_non_json_response",
          createdAt,
          updatedAt: null,
        }),
      });
    }

    writeKeywordReviewResponseArtifact({
      reviewId,
      status: "completed",
      failureReason: null,
      rawResponse: aiRawResponse,
      verdict,
      responsePath: artifacts.responsePath,
    });
    return persistKeywordOpportunityReview({
      storage: input.storage,
      review: buildReviewRecord({
        reviewId,
        taskId: input.taskId,
        keyword: input.keyword,
        status: "completed",
        verdict,
        artifacts,
        aiPromptText,
        aiRawResponse,
        failureReason: null,
        createdAt,
        updatedAt: null,
      }),
    });
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : String(error);
    writeKeywordReviewResponseArtifact({
      reviewId,
      status: "failed",
      failureReason,
      rawResponse: "",
      verdict: null,
      responsePath: artifacts.responsePath,
    });
    return persistKeywordOpportunityReview({
      storage: input.storage,
      review: buildReviewRecord({
        reviewId,
        taskId: input.taskId,
        keyword: input.keyword,
        status: "failed",
        verdict: null,
        artifacts,
        aiPromptText,
        aiRawResponse: "",
        failureReason,
        createdAt,
        updatedAt: null,
      }),
    });
  }
};

export const ingestManualKeywordOpportunityReview = (input: {
  dataDir: string;
  storage: AmazonMiningStorage;
  rawInput: unknown;
}): AmazonKeywordOpportunityReviewRecord => {
  const manualInput = AmazonMiningSchemas.AmazonKeywordOpportunityManualIngestSchema.parse(input.rawInput) as AmazonKeywordOpportunityManualIngestInput;
  const existing = input.storage.getKeywordOpportunityReview(manualInput.reviewId);
  if (!existing) {
    throw new Error("keyword_review_not_found");
  }
  const { reviewId: _reviewId, aiRawResponse: manualRawResponse, ...verdictInput } = manualInput;
  const verdict = validateKeywordReviewVerdict(verdictInput);
  const artifacts = resolveKeywordReviewArtifacts({
    dataDir: input.dataDir,
    taskId: existing.taskId,
    keywordId: existing.keywordId,
  });
  const aiRawResponse = manualRawResponse ?? JSON.stringify(verdict, null, 2);
  const updatedAt = new Date().toISOString();
  writeKeywordReviewResponseArtifact({
    reviewId: existing.reviewId,
    status: "completed",
    failureReason: null,
    rawResponse: aiRawResponse,
    verdict,
    responsePath: artifacts.responsePath,
  });
  return persistKeywordOpportunityReview({
    storage: input.storage,
    review: {
      ...existing,
      status: "completed",
      decision: verdict.decision,
      demandSignal: verdict.demandSignal,
      reviewHealth: verdict.reviewHealth,
      priceCeiling: verdict.priceCeiling,
      competitionOpenness: verdict.competitionOpenness,
      improvementOpportunity: verdict.improvementOpportunity,
      dataConfidence: verdict.dataConfidence,
      evidenceRefs: verdict.evidenceRefs,
      missingEvidence: verdict.missingEvidence,
      riskPoints: verdict.riskPoints,
      humanNextStep: verdict.humanNextStep,
      aiRawResponse,
      aiResponseRef: artifacts.responsePath,
      packageRef: existing.packageRef ?? artifacts.inputJsonPath,
      keywordPackageSliceRef: existing.keywordPackageSliceRef ?? artifacts.inputJsonPath,
      failureReason: null,
      updatedAt,
    },
  });
};