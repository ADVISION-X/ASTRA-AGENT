import { randomUUID } from "node:crypto";

import type { AiFeedInput, AiInputGatewayAbilityGroup } from "../../capabilities/ai-input-gateway/index.js";
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

export const AMAZON_KEYWORD_OPPORTUNITY_REVIEW_MAX_INPUT_CHARS = 300_000;
export const AMAZON_KEYWORD_OPPORTUNITY_REVIEW_PROVIDER_KIND: AmazonKeywordProviderKind = "gpt-web-chat";

const buildKeywordOpportunityReviewInputRefs = (input: {
  keyword: AmazonKeywordRecord;
  artifacts: KeywordReviewArtifacts;
}): AiFeedInput["inputRefs"] => [{
  id: `keyword-opportunity-review-input-${input.keyword.keywordId}`,
  kind: "amazon-product-mining-keyword-evidence-slice",
  summary: `Keyword opportunity review evidence slice for ${input.keyword.keyword}. Source artifact: ${input.artifacts.inputJsonPath}`,
}];

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

type KeywordOpportunityReviewRuntimeContext = {
  artifacts: KeywordReviewArtifacts;
  aiPromptText: string;
  createdAt: string;
  keyword: AmazonKeywordRecord;
  reviewId: string;
  taskId: string;
};

type KeywordOpportunityReviewAiResult = Awaited<ReturnType<AiInputGatewayAbilityGroup["execute"]>>;

export const persistKeywordOpportunityReview = (input: {
  storage: AmazonMiningStorage;
  review: AmazonKeywordOpportunityReviewRecord;
}): AmazonKeywordOpportunityReviewRecord => input.storage.saveKeywordOpportunityReview(input.review);

const persistKeywordOpportunityReviewOutcome = (input: {
  storage: AmazonMiningStorage;
  context: KeywordOpportunityReviewRuntimeContext;
  status: AmazonKeywordOpportunityReviewRecord["status"];
  verdict: AmazonKeywordOpportunityVerdict | null;
  aiRawResponse: string;
  failureReason: string | null;
}): AmazonKeywordOpportunityReviewRecord => {
  writeKeywordReviewResponseArtifact({
    reviewId: input.context.reviewId,
    status: input.status,
    failureReason: input.failureReason,
    rawResponse: input.aiRawResponse,
    verdict: input.verdict,
    responsePath: input.context.artifacts.responsePath,
  });

  return persistKeywordOpportunityReview({
    storage: input.storage,
    review: buildReviewRecord({
      reviewId: input.context.reviewId,
      taskId: input.context.taskId,
      keyword: input.context.keyword,
      status: input.status,
      verdict: input.verdict,
      artifacts: input.context.artifacts,
      aiPromptText: input.context.aiPromptText,
      aiRawResponse: input.aiRawResponse,
      failureReason: input.failureReason,
      createdAt: input.context.createdAt,
      updatedAt: null,
    }),
  });
};

const requestKeywordOpportunityReview = (input: {
  aiInputGateway: AiInputGatewayAbilityGroup;
  context: KeywordOpportunityReviewRuntimeContext;
}) => input.aiInputGateway.execute({
  providerKind: AMAZON_KEYWORD_OPPORTUNITY_REVIEW_PROVIDER_KIND,
  promptPackageId: `amazon-mining-keyword-review-${input.context.taskId}-${input.context.keyword.keywordId}`,
  promptContractId: "amazon-product-mining-keyword-opportunity-review-v1",
  expectedOutputSchemaRef: null,
  textPrompt: input.context.aiPromptText,
  inputRefs: buildKeywordOpportunityReviewInputRefs({
    keyword: input.context.keyword,
    artifacts: input.context.artifacts,
  }),
  modelName: null,
  timeoutMs: 120_000,
  maxInputChars: AMAZON_KEYWORD_OPPORTUNITY_REVIEW_MAX_INPUT_CHARS,
  maxFileCount: 0,
  maxFileBytes: 1,
  requestedBy: "ai-capability",
  missionId: input.context.taskId,
  runId: input.context.reviewId,
  roundId: input.context.keyword.keywordId,
});

const finalizeKeywordOpportunityReview = (input: {
  storage: AmazonMiningStorage;
  context: KeywordOpportunityReviewRuntimeContext;
  aiResult: KeywordOpportunityReviewAiResult;
}): AmazonKeywordOpportunityReviewRecord => {
  const aiRawResponse = input.aiResult.normalizedText ?? "";
  if (input.aiResult.status === "review_required") {
    return persistKeywordOpportunityReviewOutcome({
      storage: input.storage,
      context: input.context,
      status: "manual_required",
      failureReason: input.aiResult.reviewRequiredReason ?? "keyword_review_manual_required",
      verdict: null,
      aiRawResponse,
    });
  }

  if (input.aiResult.status !== "success") {
    return persistKeywordOpportunityReviewOutcome({
      storage: input.storage,
      context: input.context,
      status: "failed",
      failureReason: input.aiResult.failureReason ?? "keyword_review_ai_failed",
      verdict: null,
      aiRawResponse,
    });
  }

  const verdict = parseKeywordReviewResponse(aiRawResponse);
  if (!verdict) {
    return persistKeywordOpportunityReviewOutcome({
      storage: input.storage,
      context: input.context,
      status: "failed",
      failureReason: "keyword_review_invalid_or_non_json_response",
      verdict: null,
      aiRawResponse,
    });
  }

  return persistKeywordOpportunityReviewOutcome({
    storage: input.storage,
    context: input.context,
    status: "completed",
    failureReason: null,
    verdict,
    aiRawResponse,
  });
};

export const runKeywordOpportunityReview = async (input: {
  dataDir: string;
  taskId: string;
  keyword: AmazonKeywordRecord;
  storage: AmazonMiningStorage;
  aiInputGateway: AiInputGatewayAbilityGroup;
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

  const context: KeywordOpportunityReviewRuntimeContext = {
    artifacts,
    aiPromptText,
    createdAt: new Date().toISOString(),
    keyword: input.keyword,
    reviewId: randomUUID(),
    taskId: input.taskId,
  };

  try {
    const aiResult = await requestKeywordOpportunityReview({
      aiInputGateway: input.aiInputGateway,
      context,
    });
    return finalizeKeywordOpportunityReview({
      storage: input.storage,
      context,
      aiResult,
    });
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : String(error);
    return persistKeywordOpportunityReviewOutcome({
      storage: input.storage,
      context,
      status: "failed",
      failureReason,
      verdict: null,
      aiRawResponse: "",
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
